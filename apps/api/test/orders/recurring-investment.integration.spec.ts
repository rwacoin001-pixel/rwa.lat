import { ConflictException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { CreateRecurringInvestments1790000000013 } from '../../src/database/migrations/1790000000013-create-recurring-investments'
import { nextRecurringDate, RecurringService } from '../../src/orders/recurring.service'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip

suite('Recurring investments against isolated PostgreSQL', () => {
  let db: DataSource
  const users: string[] = []
  const assetClasses: string[] = []

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('Local test database required')
    }
    db = new DataSource({ type: 'postgres', url: url.toString(), entities: [], synchronize: false })
    await db.initialize()
    const [exists] = await db.query(`SELECT to_regclass('app.recurring_investments') AS name`)
    if (!exists.name) {
      const runner = db.createQueryRunner()
      await runner.connect()
      try { await new CreateRecurringInvestments1790000000013().up(runner) } finally { await runner.release() }
    }
  })

  afterEach(async () => {
    if (!db?.isInitialized) return
    for (const userId of users.splice(0)) {
      await db.query(`DELETE FROM app.notifications WHERE recipient_user_id=$1`, [userId])
      await db.query(`DELETE FROM app.recurring_investment_runs WHERE plan_id IN (SELECT id FROM app.recurring_investments WHERE user_id=$1)`, [userId])
      await db.query(`DELETE FROM app.recurring_investments WHERE user_id=$1`, [userId])
      await db.query(`DELETE FROM app.orders WHERE user_id=$1`, [userId])
      await db.query(`DELETE FROM app.users WHERE id=$1`, [userId])
    }
    for (const assetClass of assetClasses.splice(0)) {
      await db.query(`DELETE FROM app.products WHERE asset_class_id=$1`, [assetClass])
      await db.query(`DELETE FROM app.asset_classes WHERE id=$1`, [assetClass])
    }
  })

  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  async function fixture() {
    const [user] = await db.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    users.push(user.id)
    const assetClass = `rec_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    assetClasses.push(assetClass)
    await db.query(`INSERT INTO app.asset_classes (id,display_name,state) VALUES ($1,'Recurring test','active')`, [assetClass])
    const [product] = await db.query(`INSERT INTO app.products
      (asset_class_id,version,display_name,asset_code,asset_decimals,state,published_at)
      VALUES ($1,1,'Recurring asset','RCT',2,'published',now()) RETURNING id`, [assetClass])
    return { userId: user.id as string, productId: product.id as string }
  }

  function service(create: jest.Mock) {
    return new RecurringService(
      db,
      { create } as any,
      { get: jest.fn((key: string) => key === 'RECURRING_INVESTMENT_WORKER_ENABLED' ? 'true' : undefined) } as any,
    )
  }

  it('preserves the anchor day across short months', () => {
    const anchor = new Date('2027-01-31T09:30:00.000Z')
    expect(nextRecurringDate(anchor, anchor, 'monthly').toISOString()).toBe('2027-02-28T09:30:00.000Z')
    expect(nextRecurringDate(new Date('2027-02-28T09:30:00.000Z'), anchor, 'monthly').toISOString()).toBe('2027-03-31T09:30:00.000Z')
  })

  it('records a failed installment once, notifies the user, and keeps the next run active', async () => {
    const fixtureData = await fixture()
    const scheduled = new Date(Date.now() - 60_000)
    const [plan] = await db.query(`INSERT INTO app.recurring_investments
      (user_id,product_id,amount_atomic,frequency,anchor_at,next_run_at,idempotency_key)
      VALUES ($1,$2,1000000,'weekly',$3,$3,$4) RETURNING id`,
    [fixtureData.userId, fixtureData.productId, scheduled, randomUUID()])
    const create = jest.fn().mockRejectedValue(new ConflictException({ code: 'ORDER_NOT_ELIGIBLE' }))
    const recurring = service(create)

    expect(await recurring.runDue(new Date())).toBe(1)
    const [run] = await db.query(`SELECT state,failure_code,notified_at FROM app.recurring_investment_runs WHERE plan_id=$1`, [plan.id])
    expect(run.state).toBe('failed')
    expect(run.failure_code).toBe('ORDER_NOT_ELIGIBLE')
    expect(run.notified_at).toBeTruthy()
    const [updated] = await db.query(`SELECT state,next_run_at FROM app.recurring_investments WHERE id=$1`, [plan.id])
    expect(updated.state).toBe('active')
    expect(new Date(updated.next_run_at).getTime()).toBeGreaterThan(Date.now())
    expect(await recurring.runDue(new Date())).toBe(0)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('recovers an already committed order without creating or charging it again', async () => {
    const fixtureData = await fixture()
    const scheduled = new Date(Date.now() - 30_000)
    const [plan] = await db.query(`INSERT INTO app.recurring_investments
      (user_id,product_id,amount_atomic,frequency,anchor_at,next_run_at,idempotency_key)
      VALUES ($1,$2,1000000,'daily',$3,$3,$4) RETURNING id`,
    [fixtureData.userId, fixtureData.productId, scheduled, randomUUID()])
    const orderKey = `recurring:${plan.id}:${scheduled.getTime()}`
    const [order] = await db.query(`INSERT INTO app.orders
      (user_id,product_id,side,requested_atomic_amount,unit_price_atomic_amount,product_asset_code,product_asset_decimals,quote_decimals,idempotency_key,request_id)
      VALUES ($1,$2,'buy',1000000,1000000,'RCT',2,6,$3,$3) RETURNING id`,
    [fixtureData.userId, fixtureData.productId, orderKey])
    const create = jest.fn()
    const recurring = service(create)

    expect(await recurring.runDue(new Date())).toBe(1)
    const [run] = await db.query(`SELECT state,order_id FROM app.recurring_investment_runs WHERE plan_id=$1`, [plan.id])
    expect(run).toMatchObject({ state: 'submitted', order_id: order.id })
    expect(create).not.toHaveBeenCalled()
  })

  it('requires explicit consent and reuses only an identical plan key', async () => {
    const fixtureData = await fixture()
    const recurring = service(jest.fn())
    const input = { productId: fixtureData.productId, amountAtomic: '1000000', frequency: 'monthly' as const,
      firstRunAt: new Date(Date.now() + 86_400_000).toISOString(), consent: true as const }
    const key = `recurring:${randomUUID()}`
    const first = await recurring.create(fixtureData.userId, input, key)
    expect(await recurring.create(fixtureData.userId, input, key)).toEqual({ id: first.id, replay: true })
    await expect(recurring.create(fixtureData.userId, { ...input, amountAtomic: '2000000' }, key)).rejects.toThrow('不同定投计划')
  })
})
