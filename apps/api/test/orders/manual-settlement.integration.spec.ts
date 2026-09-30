import { randomUUID } from 'node:crypto'
import { GeneratedDocumentsService } from '../../src/generated-documents/generated-documents.service'
import { DataSource, QueryRunner } from 'typeorm'
import { ManualSettlementService } from '../../src/orders/manual-settlement.service'
import { CreateManualTradeSettlements1790000000012 } from '../../src/database/migrations/1790000000012-create-manual-trade-settlements'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Manual settlement against isolated PostgreSQL', () => {
  let db: DataSource
  let runner: QueryRunner
  let service: ManualSettlementService
  const actor = randomUUID()
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Local test database required')
    db = new DataSource({ type: 'postgres', url: url.toString(), entities: [], synchronize: false })
    await db.initialize()
  })
  afterAll(async () => { await db?.destroy() })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    const [exists] = await runner.query(`SELECT to_regclass('app.manual_trade_settlements') AS name`)
    if (!exists.name) await new CreateManualTradeSettlements1790000000012().up(runner)
    const proxy = {
      query: (sql: string, args: unknown[]) => runner.query(sql, args),
      transaction: async (work: (em: any) => Promise<unknown>) => {
        await runner.startTransaction()
        try { const value = await work(runner.manager); await runner.commitTransaction(); return value }
        catch (error) { await runner.rollbackTransaction(); throw error }
      },
    }
    service = new ManualSettlementService(proxy as unknown as DataSource, { assertEnabled: jest.fn().mockResolvedValue(undefined) } as any,
      new GeneratedDocumentsService(proxy as unknown as DataSource, {} as any))
  })
  afterEach(async () => { await runner?.rollbackTransaction(); await runner?.release() })

  async function fixture(funding = '10000000') {
    const [user] = await runner.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const ac = `test_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    await runner.query(`INSERT INTO app.asset_classes (id,display_name,state) VALUES ($1,'Test','active')`, [ac])
    const [product] = await runner.query(`INSERT INTO app.products (asset_class_id,version,display_name,asset_code,asset_decimals,state) VALUES ($1,1,'Test asset','TEST',2,'draft') RETURNING id`, [ac])
    const [order] = await runner.query(`INSERT INTO app.orders (user_id,product_id,side,requested_atomic_amount,unit_price_atomic_amount,product_asset_code,product_asset_decimals,quote_decimals,idempotency_key,request_id)
      VALUES ($1,$2,'buy',10000000,1000000,'TEST',2,6,$3,$4) RETURNING id`, [user.id, product.id, randomUUID(), randomUUID()])
    const key = `${randomUUID()}.pdf`
    await runner.query(`INSERT INTO app.object_storage_objects (bucket,key,content_type,size_bytes,scan_status,checksum_sha256) VALUES ('rwa-attachments',$1,'application/pdf',100,'clean',$2)`, [key, 'a'.repeat(64)])
    const [locked] = await runner.query(`INSERT INTO app.ledger_accounts (owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES ('user',$1,'locked','USDT',6,'credit') RETURNING id`, [user.id])
    const [source] = await runner.query(`INSERT INTO app.ledger_accounts (owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES ('platform',$1,'settlement','USDT',6,'debit',true) RETURNING id`, [randomUUID()])
    const [tx] = await runner.query(`INSERT INTO app.ledger_transactions (transaction_type,idempotency_key,request_id,reference_type,reference_id,reason_code,actor_type,effective_at) VALUES ('adjustment',$1,$2,'test_fixture',$3,'test_funding','service',now()) RETURNING id`, [randomUUID(), randomUUID(), randomUUID()])
    await runner.query(`INSERT INTO app.ledger_entries (transaction_id,account_id,side,atomic_amount) VALUES ($1,$2,'debit',$4),($1,$3,'credit',$4)`, [tx.id, source.id, locked.id, funding])
    return { user: user.id, product: product.id, order: order.id, input: { externalReference: randomUUID(), evidenceRef: `rwa-attachments/${key}`, amountAtomic: '8000000', quantityAtomic: '1234' } }
  }
  async function balances(user: string) {
    return runner.query(`SELECT a.purpose,b.current_atomic_balance::text AS amount FROM app.ledger_accounts a JOIN app.ledger_account_balances b ON b.account_id=a.id WHERE a.user_id=$1 ORDER BY a.purpose`, [user])
  }

  it('uses actual quantity, refunds the remainder, and replays without double posting', async () => {
    const f = await fixture()
    const first = await service.post('order', f.order, f.input, actor)
    expect(await service.post('order', f.order, f.input, actor)).toMatchObject({ id: first.id, replay: true })
    expect(await balances(f.user)).toEqual([{ purpose: 'available', amount: '2000000' }, { purpose: 'locked', amount: '0' }])
    const [position] = await runner.query(`SELECT quantity_atomic_amount::text AS quantity, cost_atomic_amount::text AS cost FROM app.positions WHERE user_id=$1`, [f.user])
    expect(position).toEqual({ quantity: '1234', cost: '8000000' })
    const documents = await runner.query("SELECT snapshot,state FROM app.generated_documents WHERE user_id=$1 AND kind='trade_confirmation'",[f.user])
    expect(documents).toHaveLength(1)
    expect(documents[0].state).toBe('queued')
    expect(documents[0].snapshot.fields).toContainEqual(['实际入账金额','8.000000 USDT'])
    expect(documents[0].snapshot.fields).toContainEqual(['实际成交份额','12.34'])
    const listed = await service.list()
    expect(listed.find((row: any) => row.id === first.id)?.evidenceObjectId).toBeTruthy()
    await expect(service.post('order', f.order, { ...f.input, quantityAtomic: '1235' }, actor)).rejects.toThrow('不同成交信息')
    await runner.query('SET CONSTRAINTS ALL IMMEDIATE')
  })

  it('rolls back receipts, balances and positions when funds are insufficient', async () => {
    const f = await fixture('1000000')
    await expect(service.post('order', f.order, f.input, actor)).rejects.toThrow()
    expect(await runner.query(`SELECT id FROM app.manual_trade_settlements WHERE reference_id=$1`, [f.order])).toEqual([])
    expect(await runner.query(`SELECT id FROM app.positions WHERE user_id=$1`, [f.user])).toEqual([])
    expect(await balances(f.user)).toEqual([{ purpose: 'locked', amount: '1000000' }])
  })
  it('does not block actual fund posting when the confirmation template is disabled',async()=>{
    const f=await fixture()
    await runner.query("UPDATE app.document_templates SET content=jsonb_set(content,'{enabled}','false'::jsonb) WHERE kind='trade_confirmation'")
    await service.post('order',f.order,f.input,actor)
    expect(await balances(f.user)).toEqual([{purpose:'available',amount:'2000000'},{purpose:'locked',amount:'0'}])
    expect(await runner.query("SELECT id FROM app.generated_documents WHERE user_id=$1 AND kind='trade_confirmation'",[f.user])).toEqual([])
  })

  it('rejects overspending, unavailable evidence, and a reused external execution number', async () => {
    const f = await fixture()
    await expect(service.post('order', f.order, { ...f.input, amountAtomic: '10000001' }, actor)).rejects.toThrow('超出')
    await expect(service.post('order', f.order, { ...f.input, evidenceRef: 'rwa-attachments/missing.pdf' }, actor)).rejects.toThrow('凭证')
    expect(await runner.query(`SELECT id FROM app.manual_trade_settlements WHERE reference_id=$1`, [f.order])).toEqual([])
    await service.post('order', f.order, f.input, actor)
    const other = await fixture()
    await expect(service.post('order', other.order, { ...other.input, externalReference: f.input.externalReference }, actor)).rejects.toThrow('已使用')
    expect(await balances(other.user)).toEqual([{ purpose: 'locked', amount: '10000000' }])
  })

  it('records an exception without changing money, then redeems at actual net proceeds', async () => {
    const f = await fixture()
    const receipt = await service.post('order', f.order, f.input, actor)
    const before = await balances(f.user)
    await service.review(receipt.id, { state: 'exception', note: 'Check documentation manually' }, actor)
    expect(await balances(f.user)).toEqual(before)
    const [redemption] = await runner.query(`INSERT INTO app.redemptions (user_id,product_id,asset_code,asset_decimals,quantity_atomic_amount,estimated_unit_price_atomic_amount,currency,request_id) VALUES ($1,$2,'TEST',2,1234,1000000,'USD',$3) RETURNING id`, [f.user, f.product, randomUUID()])
    await service.post('redemption', redemption.id, { ...f.input, externalReference: randomUUID(), amountAtomic: '7000000' }, actor)
    expect(await balances(f.user)).toEqual([{ purpose: 'available', amount: '9000000' }, { purpose: 'locked', amount: '0' }])
    const [position] = await runner.query(`SELECT quantity_atomic_amount::text AS quantity,state FROM app.positions WHERE user_id=$1`, [f.user])
    expect(position).toEqual({ quantity: '0', state: 'closed' })
    await runner.query('SET CONSTRAINTS ALL IMMEDIATE')
  })
})
