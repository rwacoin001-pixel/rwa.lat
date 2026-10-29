import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { QueryRunner } from 'typeorm'
import { AI_VIEWS, AdminAiViews1793000000000 } from '../src/database/migrations/1793000000000-admin-ai-views'
import { AdminAiQueryAudit1793000000100 } from '../src/database/migrations/1793000000100-admin-ai-query-audit'

const migrationDir = join(__dirname, '../src/database/migrations')
const priorSql = readdirSync(migrationDir).filter(f => /^\d+.*\.ts$/.test(f) && f < '1793000000000')
  .map(f => readFileSync(join(migrationDir, f), 'utf8').split('async down(')[0].split('public async down(')[0]).join('\n')

// Split SQL lists at top-level commas, preserving nested functions and quoted strings.
function splitColumns(input: string): string[] {
  let depth = 0, quoted = false, start = 0
  const parts: string[] = []
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "'") { if (quoted && input[i + 1] === "'") i++; else quoted = !quoted }
    if (quoted) continue
    if (input[i] === '(') depth++
    if (input[i] === ')') depth--
    if (input[i] === ',' && depth === 0) { parts.push(input.slice(start, i).trim()); start = i + 1 }
  }
  return [...parts, input.slice(start).trim()]
}

function tableColumns(table: string): Set<string> {
  const match = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?app\\.${table}\\s*\\(`).exec(priorSql)
  if (!match) throw new Error(`Missing source table ${table}`)
  const start = match.index + match[0].length
  let depth = 1, quoted = false, end = start
  for (; end < priorSql.length && depth; end++) {
    const c = priorSql[end]
    if (c === "'") { if (quoted && priorSql[end + 1] === "'") end++; else quoted = !quoted }
    if (!quoted) { if (c === '(') depth++; if (c === ')') depth-- }
  }
  const columns = new Set(splitColumns(priorSql.slice(start, end - 1)).map(c => c.match(/^([a-z_]+)/)?.[1] ?? ''))
  // Later ALTER TABLE additions belong to their own statement, before the next semicolon.
  for (const alter of priorSql.matchAll(new RegExp(`ALTER TABLE app\\.${table}\\s+([^;]+);`, 'g'))) {
    for (const col of alter[1].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?([a-z_]+)/g)) columns.add(col[1])
  }
  return columns
}

describe('admin AI migrations', () => {
  it('projects real business columns from earlier migrations', () => {
    for (const view of Object.values(AI_VIEWS)) {
      const sources = [...view.source.matchAll(/app\.([a-z_]+)/g)].map(m => tableColumns(m[1]))
      for (const projection of splitColumns(view.columns)) {
        const direct = projection.match(/^(?:\w+\.)?([a-z_]+)$/)?.[1]
        if (direct) expect(sources.some(columns => columns.has(direct))).toBe(true)
      }
    }
  })

  it('keeps private fields and unbounded user content out of every view', () => {
    for (const view of Object.values(AI_VIEWS)) {
      expect(view.columns).not.toMatch(/\b\w*(?:ciphertext|hash|token|secret|password|address|ip_address|body|payload|receipt|metadata|document|mfa)\w*\b/i)
      expect(view.columns).not.toMatch(/SELECT\s+\*|decrypt/i)
    }
    expect(AI_VIEWS.community_profiles.columns).toContain('left(display_name, 1) AS name_initial')
    expect(AI_VIEWS.platform_configuration.source).toContain('WHERE published IS NOT NULL')
    expect(AI_VIEWS.platform_configuration.columns).toContain("left(published->>'supportEmail',1) || '***@' || split_part(published->>'supportEmail','@',2)")
    expect(AI_VIEWS.users.source).toBe('app.users')
    expect(AI_VIEWS.notifications.columns).toBe('id, recipient_user_id, kind, created_at, read_at')
    expect(AI_VIEWS.tickets.columns).toBe('id, author_user_id, status, category, created_at, updated_at, closed_at')
  })

  it('creates only barrier views and documents every view and column in English with units', async () => {
    const query = jest.fn(async (sql: string, params?: string[]): Promise<unknown[]> => {
      if (sql.startsWith('SELECT column_name')) return splitColumns(AI_VIEWS[params![1]].columns).map(c => ({
        column_name: c.match(/\bAS\s+(\w+)$/i)?.[1] ?? c.split('.').at(-1),
      }))
      return []
    })
    const migration = new AdminAiViews1793000000000()
    await migration.up({ query } as unknown as QueryRunner)
    const sql = query.mock.calls.map(([s]) => s)
    expect(sql.filter(s => s.startsWith('CREATE VIEW'))).toHaveLength(Object.keys(AI_VIEWS).length)
    expect(sql.filter(s => s.startsWith('CREATE VIEW')).every(s => s.includes('security_barrier=true'))).toBe(true)
    expect(sql.filter(s => s.startsWith('COMMENT ON VIEW'))).toHaveLength(Object.keys(AI_VIEWS).length)
    expect(sql.filter(s => s.startsWith('COMMENT ON COLUMN'))).toHaveLength(Object.values(AI_VIEWS).reduce((n, v) => n + splitColumns(v.columns).length, 0))
    expect(sql.join('\n')).toContain('1000000 atomic = 1 USDT')
    expect(sql.join('\n')).toContain('REVOKE ALL ON SCHEMA ai_ro FROM PUBLIC')
    expect(sql.find(s => s.startsWith('COMMENT ON COLUMN ai_ro.quant_orders."created_at"'))).toContain('timestamp with time zone')
    expect(sql.find(s => s.startsWith('COMMENT ON COLUMN ai_ro.positions."quantity_atomic_amount"'))).toContain('10^asset_decimals')
    expect(sql.find(s => s.startsWith('COMMENT ON COLUMN ai_ro.positions."cost_atomic_amount"'))).toContain('1000000 atomic = 1 USDT')
    expect(sql.find(s => s.startsWith('COMMENT ON COLUMN ai_ro.prediction_bets."shares"'))).toContain('not atomic currency units')
    query.mockClear()
    await migration.down({ query } as unknown as QueryRunner)
    expect(query.mock.calls.at(-1)?.[0]).toBe('DROP SCHEMA ai_ro')
  })

  it('seeds only the existing owner role and never marks old sessions MFA-verified', async () => {
    const query = jest.fn().mockResolvedValue([])
    await new AdminAiQueryAudit1793000000100().up({ query } as unknown as QueryRunner)
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain("WHERE name='super_admin'")
    expect(sql).toContain("'ai.ops.query'")
    expect(sql).toContain('mfa_verified_at timestamptz;')
    expect(sql).not.toMatch(/UPDATE app.admin_sessions|mfa_verified_at timestamptz.*DEFAULT/)
    expect(sql).toContain('REFERENCES app.admin_users(id) ON DELETE RESTRICT')
    expect(sql).toContain("action IN ('query','sql','export')")
  })

  it('keeps manual role provisioning password-free and grants only ai_ro views', () => {
    const sql = readFileSync(join(__dirname, '../../../deploy/sql/ai-reader.sql'), 'utf8')
    expect(sql).toContain('CREATE ROLE ai_reader LOGIN NOSUPERUSER')
    expect(sql).toContain('default_transaction_read_only = on')
    expect(sql).toContain("statement_timeout = '5s'")
    expect(sql).toContain("idle_in_transaction_session_timeout = '10s'")
    expect(sql).toContain('\\password ai_reader')
    expect(sql).not.toMatch(/\bPASSWORD\s+['"]|GRANT.*ON SCHEMA app|GRANT.*ON ALL TABLES IN SCHEMA app/i)
    expect(sql).toContain('SELECT DISTINCT viewowner FROM pg_views')
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ai_ro GRANT SELECT ON TABLES TO ai_reader')
  })

  it('keeps the separate admin database migration identical to the shared migration', async () => {
    const query = jest.fn().mockResolvedValue([])
    await new AdminAiQueryAudit1793000000100().up({ query } as unknown as QueryRunner)
    const normalize = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\b(?:BEGIN|COMMIT);/g, '').replace(/\s+/g, ' ').trim()
    const manual = readFileSync(join(__dirname, '../../../deploy/migrations/admin-20261029-ai-query.sql'), 'utf8')
    expect(normalize(manual)).toBe(normalize(query.mock.calls[0][0]))
  })
})
