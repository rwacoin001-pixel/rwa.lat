import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { Notification } from '../../src/notification/notification.entity'
import { NotificationService } from '../../src/notification/notification.service'
import { NotificationError } from '../../src/notification/notification.errors'

const USER = '11111111-1111-1111-1111-111111111111'

describe('DB-005 / API-011 notification integration', () => {
  let dataSource: DataSource
  let svc: NotificationService

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    // 测试隔离：完整重建（含 app schema 与 schema_migrations 记录）
    await dataSource.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await dataSource.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  beforeEach(async () => {
    await dataSource.query(
      `INSERT INTO app.users (id, status, locale, created_at, updated_at)
       VALUES ($1, 'active', 'en', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await dataSource.query(`TRUNCATE TABLE app.notifications RESTART IDENTITY CASCADE`)
  })

  it('migration creates notification + ops tables', async () => {
    const res = await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='app'
       AND tablename IN ('notifications','tickets','invitations','subscriptions','fees','rewards','preferences')`,
    )
    expect(res.map((r: { tablename: string }) => r.tablename).sort()).toEqual(
      ['fees', 'invitations', 'notifications', 'preferences', 'rewards', 'subscriptions', 'tickets'].sort(),
    )
  })

  it('create + list + markRead lifecycle', async () => {
    svc = new NotificationService(dataSource.getRepository(Notification))
    const created = await svc.create({
      recipient_user_id: USER,
      channel: 'in_app',
      kind: 'order_filled',
      title: 'Order filled',
    })
    expect(created.id).toBeDefined()

    const list = await svc.listForUser(USER, undefined, undefined, 'unread')
    expect(list).toHaveLength(1)
    expect(list[0].readAt).toBeNull()

    const read = await svc.markRead(created.id, USER)
    expect(read.readAt).toBeDefined()

    const after = await svc.listForUser(USER, undefined, undefined, 'unread')
    expect(after).toHaveLength(0)
  })

  it('markRead throws NOTIFICATION_NOT_FOUND for unknown id', async () => {
    svc = new NotificationService(dataSource.getRepository(Notification))
    await expect(svc.markRead('deadbeef-dead-dead-dead-deaddeaddead', USER)).rejects.toBeInstanceOf(
      NotificationError,
    )
  })
})
