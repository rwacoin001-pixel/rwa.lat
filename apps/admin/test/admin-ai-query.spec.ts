import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { Pool } from 'pg'
import { AdminAiQueryService } from '../src/admin-ai-query.service'
import { AdminAiModelClient } from '../src/admin-ai-model.client'

jest.mock('pg', () => ({ Pool: jest.fn() }))
const actor = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const schema = [{ view_name: 'users', column_name: 'id', data_type: 'uuid', view_comment: 'Accounts', column_comment: 'Identifier' }]

function setup(configured = true) {
  const client = { query: jest.fn(async (query: any): Promise<any> => {
    if (typeof query === 'object') return { rows: [['9007199254740993']], fields: [{ name: 'count', dataTypeID: 20 }] }
    if (query.includes('current_user')) return { rows: [{ valid: true }] }
    if (query.includes('information_schema.columns')) return { rows: schema }
    return { rows: [] }
  }), release: jest.fn() }
  const pool = { connect: jest.fn(async () => client), end: jest.fn(), on: jest.fn() }
  ;(Pool as unknown as jest.Mock).mockImplementation(() => pool)
  let id = 0
  const db = { query: jest.fn(async (sql: string, _params?: unknown[]): Promise<any> => {
    if (sql.startsWith('INSERT')) return [{ id: `audit-${++id}` }]
    if (sql.startsWith('SELECT question')) return [{ question: 'Count users', sql: 'SELECT count(*) FROM ai_ro.users' }]
    return []
  }) }
  const model = { complete: jest.fn() }
  const service = new AdminAiQueryService(db as unknown as DataSource,
    new ConfigService(configured ? { AI_READER_DATABASE_URL: 'postgresql://ai_reader@localhost/ai_test' } : {}), model as unknown as AdminAiModelClient)
  const tool = (name: string, args = {}) => ({ text: '', calls: [{ id: name, name, arguments: JSON.stringify(args) }] })
  const conversation = (sql = 'SELECT count(*) FROM ai_ro.users') => {
    model.complete.mockResolvedValueOnce(tool('describe_schema')).mockResolvedValueOnce(tool('run_sql', { sql })).mockResolvedValueOnce({ text: 'Count verified.', calls: [] })
  }
  return { client, pool, db, model, service, tool, conversation }
}

describe('admin AI read-only query and audit', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses a separate role, read-only transaction, timeout, row cap and exact numeric strings', async () => {
    const s = setup(); s.conversation()
    const answer = await s.service.query(actor, { question: 'Count users' })
    expect(answer.results[0]).toMatchObject({ rows: [['9007199254740993']], rowCount: 1, columns: [{ name: 'count', numeric: true }] })
    expect(s.client.query).toHaveBeenCalledWith('BEGIN READ ONLY')
    expect(s.client.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '5s'")
    expect(s.client.query).toHaveBeenCalledWith('SET LOCAL search_path = pg_catalog')
    expect(s.client.query).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringMatching(/^SELECT \* FROM \(.+\) q LIMIT 500$/), rowMode: 'array' }))
    expect(s.client.query).toHaveBeenCalledWith('COMMIT')
    expect(s.client.release).toHaveBeenCalledTimes(2)
    const inserts = s.db.query.mock.calls.filter(([q]) => q.startsWith('INSERT'))
    expect(inserts.map(([, p]) => p?.[0])).toEqual([actor, actor])
    expect(inserts.map(([, p]) => p?.[1])).toEqual(['query', 'sql'])
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-2', expect.any(Number), 1, null])
    await s.service.onModuleDestroy(); expect(s.pool.end).toHaveBeenCalled()
  })

  it('audits missing reader configuration and returns a clear 503 for query and export', async () => {
    const s = setup(false)
    await expect(s.service.query(actor, { question: 'Count users' })).rejects.toMatchObject({ status: 503, response: { code: 'AI_READER_NOT_CONFIGURED' } })
    await expect(s.service.export(actor, sourceId)).rejects.toMatchObject({ status: 503 })
    expect(s.model.complete).not.toHaveBeenCalled()
    expect(s.db.query.mock.calls.filter(([q]) => q.startsWith('INSERT'))).toHaveLength(2)
  })

  it('rejects a reader URL using a privileged role and releases its connection', async () => {
    const s = setup()
    s.client.query.mockImplementation(async () => ({ rows: [{ valid: false }] }))
    await expect(s.service.describeSchema()).rejects.toMatchObject({ status: 503, response: { code: 'AI_READER_ROLE_INVALID' } })
    expect(s.client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(s.client.release).toHaveBeenCalledWith(false)
  })

  it('requires schema discovery and ignores model-supplied identity arguments', async () => {
    const s = setup()
    s.model.complete.mockResolvedValueOnce(s.tool('run_sql', { sql: 'SELECT 1' }))
      .mockResolvedValueOnce(s.tool('describe_schema', { adminId: 'another-admin' }))
      .mockResolvedValueOnce({ text: 'Unable to verify.', calls: [] })
    await s.service.query(actor, { question: 'Count users' })
    expect(s.pool.connect).not.toHaveBeenCalled()
    expect(JSON.stringify(s.model.complete.mock.calls[2][1])).toContain('AI_SCHEMA_REQUIRED')
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-2', expect.any(Number), 0, 'AI_SCHEMA_REQUIRED'])
  })

  it('audits SQL rejections without ever sending the SQL to PostgreSQL', async () => {
    const s = setup(); s.conversation('SELECT * FROM app.admin_users')
    await s.service.query(actor, { question: 'Show users' })
    expect(s.client.query.mock.calls.some(([q]) => typeof q === 'object')).toBe(false)
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-2', expect.any(Number), 0, 'AI_SQL_REJECTED'])
  })

  it('rolls back failed SQL, discards broken connections and never returns database error details', async () => {
    const s = setup(); s.conversation()
    const original = s.client.query.getMockImplementation()!
    s.client.query.mockImplementation(async q => {
      if (typeof q === 'object' || q === 'ROLLBACK') throw new Error('private backend diagnostics')
      return original(q)
    })
    const answer = await s.service.query(actor, { question: 'Count users' })
    expect(answer.results).toEqual([])
    expect(s.client.release).toHaveBeenCalledWith(true)
    expect(JSON.stringify(s.model.complete.mock.calls)).not.toContain('private backend diagnostics')
  })

  it('fails closed when audit creation fails', async () => {
    const s = setup()
    s.db.query.mockRejectedValue(new Error('Audit unavailable'))
    await expect(s.service.query(actor, { question: 'Count users' })).rejects.toThrow()
    expect(s.pool.connect).not.toHaveBeenCalled()
    expect(s.model.complete).not.toHaveBeenCalled()
  })

  it('aborts analysis when SQL audit completion fails, even transiently', async () => {
    const s = setup(); s.conversation()
    const original = s.db.query.getMockImplementation()!
    let failed = false
    s.db.query.mockImplementation(async (sql, params) => {
      if (!failed && sql.startsWith('UPDATE') && params?.[0] === 'audit-2') {
        failed = true
        throw new Error('Audit unavailable')
      }
      return original(sql, params)
    })
    await expect(s.service.query(actor, { question: 'Count users' })).rejects.toMatchObject({ status: 503 })
    expect(s.model.complete).toHaveBeenCalledTimes(2)
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-1', expect.any(Number), 0, 'AI_QUERY_FAILED'])
  })

  it('marks 500 rows as limited and rejects oversized results before model delivery', async () => {
    const s = setup(); s.conversation()
    const original = s.client.query.getMockImplementation()!
    let oversized = false
    s.client.query.mockImplementation(async q => typeof q === 'object'
      ? { rows: oversized ? [['x'.repeat(1_000_001)]] : Array.from({ length: 500 }, () => ['1']), fields: [{ name: 'count', dataTypeID: 20 }] }
      : original(q))
    expect((await s.service.query(actor, { question: 'List users' })).results[0]).toMatchObject({ limited: true, rowCount: 500 })
    oversized = true; s.conversation()
    expect((await s.service.query(actor, { question: 'List users' })).results).toEqual([])
    expect(JSON.stringify(s.model.complete.mock.calls)).not.toContain('x'.repeat(1000))
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-4', expect.any(Number), 0, 'AI_RESULT_TOO_LARGE'])
  })

  it('exports only this session administrator\'s successful SQL and audits the fresh execution', async () => {
    const s = setup()
    expect(await s.service.export(actor, sourceId)).toContain('9007199254740993')
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining("admin_id=$2 AND action='sql' AND error IS NULL"), [sourceId, actor])
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-1', expect.any(Number), 1, null])
    expect(s.model.complete).not.toHaveBeenCalled()
  })

  it('audits inaccessible export IDs and never opens the reader pool', async () => {
    const s = setup()
    s.db.query.mockImplementation(async sql => sql.startsWith('INSERT') ? [{ id: 'audit-1' }] : [])
    await expect(s.service.export(actor, sourceId)).rejects.toMatchObject({ status: 404 })
    expect(s.pool.connect).not.toHaveBeenCalled()
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-1', expect.any(Number), 0, 'AI_RESULT_NOT_FOUND'])
  })

  it('audits exports whose schema read fails', async () => {
    const s = setup()
    s.pool.connect.mockRejectedValueOnce(new Error('Connection failed'))
    await expect(s.service.export(actor, sourceId)).rejects.toMatchObject({ status: 503 })
    expect(s.db.query).toHaveBeenCalledWith(expect.stringContaining('duration_ms=$2'), ['audit-1', expect.any(Number), 0, 'AI_QUERY_FAILED'])
  })

  it('bounds model tool rounds and releases the per-admin busy lock after failure', async () => {
    const s = setup(); s.model.complete.mockResolvedValue(s.tool('describe_schema'))
    await expect(s.service.query(actor, { question: 'Count users' })).rejects.toMatchObject({ response: { code: 'AI_TOOL_LIMIT' } })
    expect(s.model.complete).toHaveBeenCalledTimes(4)
    s.model.complete.mockResolvedValue({ text: 'No data verified.', calls: [] })
    await expect(s.service.query(actor, { question: 'Retry' })).resolves.toHaveProperty('text')
  })
})
