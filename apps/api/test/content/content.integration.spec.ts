import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { ContentService } from '../../src/content/content.service'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Learning content publishing against isolated PostgreSQL', () => {
  let db: DataSource
  let runner: QueryRunner
  let service: ContentService
  const admin = randomUUID()
  const input = { slug: `risk-${randomUUID()}`, locale: 'zh-CN', title: '测试学习文章', summary: '测试摘要', body: '仅用于隔离数据库验证。', author: 'QA' }
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations()
  })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    service = new ContentService({ query: (sql: string, args: unknown[]) => runner.query(sql, args), transaction: (work: any) => work(runner.manager) } as unknown as DataSource)
  })
  afterEach(async () => { await runner.rollbackTransaction(); await runner.release() })
  afterAll(async () => { await db.destroy() })

  it('keeps drafts private and publishes only the saved revision', async () => {
    const saved = await service.save(null, input, admin)
    expect((await service.listPublished('zh-CN')).some((row: any) => row.id === saved.id)).toBe(false)
    await expect(service.article(input.slug, 'zh-CN')).rejects.toThrow('not been published')
    await expect(service.publish(saved.id, saved.revision + 1, admin)).rejects.toThrow('changed')
    await service.publish(saved.id, saved.revision, admin)
    expect(await service.article(input.slug, 'zh-CN')).toMatchObject({ title: input.title, body: input.body, revision: 1 })
    await expect(service.article(input.slug, 'en')).rejects.toThrow('not been published')
  })
  it('preserves the published version through edits and withdraws archived articles', async () => {
    const saved = await service.save(null, input, admin)
    await service.publish(saved.id, 1, admin)
    await service.save(saved.id, { ...input, title: '修改后标题', expectedRevision: 1 }, admin)
    expect((await service.article(input.slug, 'zh-CN')).title).toBe(input.title)
    await expect(service.save(saved.id, { ...input, expectedRevision: 1 }, admin)).rejects.toThrow('changed')
    await service.publish(saved.id, 2, admin)
    expect((await service.article(input.slug, 'zh-CN')).title).toBe('修改后标题')
    await service.publish(saved.id, 2, admin, true)
    await expect(service.article(input.slug, 'zh-CN')).rejects.toThrow('not been published')
  })
})
