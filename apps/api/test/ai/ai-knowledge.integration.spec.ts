import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AiKnowledgeService } from '../../src/ai/ai-knowledge.service'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip

suite('Knowledge publishing in dedicated AI database', () => {
  let database: DataSource, runner: QueryRunner, knowledge: AiKnowledgeService
  const adminId = randomUUID()
  const content = { expectedRevision: 0, title: '赎回流程', summary: '实际到账后再投资', body: '提交赎回申请不等于已经到账。', category: 'redemption', locale: 'zh-CN', visibility: 'public', productIds: [], effectiveAt: null, expiresAt: null }

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!)
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/rwa_ai_customer_20260930_test') throw new Error('This suite requires its dedicated temporary AI database')
    database = new DataSource(buildDatabaseOptions({ ...process.env, APP_ENV: 'test', NODE_ENV: 'test' }))
    await database.initialize()
    await database.runMigrations()
  })
  beforeEach(async () => {
    runner = database.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    const bound = { query: (sql: string, args: unknown[]) => runner.query(sql, args), transaction: (work: any) => work(runner.manager) } as unknown as DataSource
    knowledge = new AiKnowledgeService(bound, new ConfigService({ AI_KNOWLEDGE_ENABLED: 'true' }))
  })
  afterEach(async () => { await runner.rollbackTransaction(); await runner.release() })
  afterAll(async () => { if (database?.isInitialized) await database.destroy() })

  it('keeps edits unpublished, prevents stale publication, and removes archived sources', async () => {
    const saved = await knowledge.save(null, content as any, adminId)
    expect(await knowledge.retrieve('赎回到账', 'zh-CN', false)).toEqual([])
    await knowledge.publish(saved.id, 1, adminId)
    expect((await knowledge.retrieve('赎回到账', 'zh-CN', false))[0]).toMatchObject({ revision: 1, body: content.body })
    await knowledge.save(saved.id, { ...content, expectedRevision: 1, body: 'unpublished replacement' } as any, adminId)
    expect((await knowledge.retrieve('赎回到账', 'zh-CN', false))[0].body).toBe(content.body)
    await expect(knowledge.publish(saved.id, 1, adminId)).rejects.toThrow('changed')
    await knowledge.archive(saved.id, 2, adminId)
    expect(await knowledge.retrieve('赎回到账', 'zh-CN', false)).toEqual([])
    await expect(knowledge.publicVersion(saved.id, 1, false)).rejects.toThrow()
  })

  it('never supplies internal knowledge; authenticated knowledge needs a real login context', async () => {
    for (const visibility of ['internal', 'authenticated']) {
      const item = await knowledge.save(null, { ...content, visibility } as any, adminId)
      await knowledge.publish(item.id, 1, adminId)
    }
    expect(await knowledge.retrieve('赎回到账', 'zh-CN', false)).toEqual([])
    expect(await knowledge.retrieve('赎回到账', 'zh-CN', true)).toHaveLength(1)
  })

  it('restores a version into a draft and requires a separate explicit publication', async () => {
    const saved = await knowledge.save(null, content as any, adminId)
    await knowledge.publish(saved.id, 1, adminId)
    await knowledge.save(saved.id, { ...content, expectedRevision: 1, body: '新条款' } as any, adminId)
    await knowledge.publish(saved.id, 2, adminId)
    const restored = await knowledge.restore(saved.id, 1, 2, adminId)
    expect(restored.revision).toBe(3)
    expect((await knowledge.retrieve('赎回到账', 'zh-CN', false))[0].body).toBe('新条款')
    await knowledge.publish(saved.id, 3, adminId)
    expect((await knowledge.retrieve('赎回到账', 'zh-CN', false))[0].body).toBe(content.body)
    expect(await knowledge.versions(saved.id)).toHaveLength(3)
  })
})
