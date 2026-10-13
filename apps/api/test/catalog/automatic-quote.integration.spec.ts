import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AutomaticQuoteWorker } from '../../src/catalog/automatic-quote.worker'
import { FreeContractPriceClient } from '../../src/catalog/free-contract-price.client'
import { QuoteBinding, ContractTokenQuote, contractCoin } from '../../src/catalog/automatic-quote'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('Automatic quotes (isolated PostgreSQL)', () => {
  let db: DataSource
  let id: string
  let binding: QuoteBinding
  let token: ContractTokenQuote
  const get=jest.fn()
  let worker: AutomaticQuoteWorker
  beforeAll(async () => {
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'})); await db.initialize()
    await db.query('DROP SCHEMA IF EXISTS app CASCADE'); await db.query('DROP TABLE IF EXISTS public.schema_migrations')
    await db.runMigrations({transaction:'all'})
  },120000)
  afterAll(async () => { if(db?.isInitialized) await db.destroy() })
  beforeEach(async () => {
    await db.query('TRUNCATE app.products,app.asset_classes CASCADE')
    await db.query("INSERT INTO app.asset_classes(id,display_name,state) VALUES('rwa','RWA','active')")
    id=randomUUID()
    binding={revision:1,bindingId:randomUUID(),enabled:true,issuerName:'Fixture issuer',tokenName:'Fixture token',tokenSymbol:'REAL',chain:'ethereum',contractAddress:'0x1234567890123456789012345678901234567890'}
    token={coin:contractCoin(binding),symbol:'REAL',price:'12.345678901234567891',timestamp:Math.floor((Date.now()-60000)/1000),confidence:0.99}
    await db.query(`INSERT INTO app.products(id,asset_class_id,display_name,asset_code,asset_decimals,state,published_at,quote_binding_json)
      VALUES($1,'rwa','Fixture product','UNDL',6,'published',now(),$2)`,[id,JSON.stringify(binding)])
    get.mockReset(); get.mockResolvedValue([token])
    worker=new AutomaticQuoteWorker(db,{get} as unknown as FreeContractPriceClient,new ConfigService({CATALOG_AUTO_QUOTES_ENABLED:'true'}))
  })
  async function makeDue() { await db.query("UPDATE app.products SET quote_sync_checked_at=now()-interval '6 minutes' WHERE id=$1",[id]) }
  it('records exact-token quotes, enforces five-minute scheduling and deduplicates unchanged timestamps', async () => {
    expect(await worker.tick()).toBe(1)
    const [quote]=await db.query('SELECT * FROM app.price_quotes WHERE product_id=$1',[id])
    expect(quote.asset_code).toBe('UNDL'); expect(quote.unit_price_atomic_amount).toBe('12345678901234567891')
    expect(quote.valid_until.getTime()-quote.captured_at.getTime()).toBe(600000)
    expect(await worker.tick()).toBe(0); expect(get).toHaveBeenCalledTimes(1)
    await makeDue(); expect(await worker.tick()).toBe(0)
    expect((await db.query('SELECT count(*)::int AS n FROM app.price_quotes WHERE product_id=$1',[id]))[0].n).toBe(1)
  })
  it('does not prolong old quotes on provider failure and records a safe diagnostic', async () => {
    await worker.tick()
    const before=(await db.query('SELECT valid_until FROM app.price_quotes WHERE product_id=$1',[id]))[0]
    await makeDue(); get.mockRejectedValue(new Error('Private provider error'))
    expect(await worker.tick()).toBe(0)
    expect((await db.query('SELECT valid_until FROM app.price_quotes WHERE product_id=$1',[id]))[0]).toEqual(before)
    expect((await db.query('SELECT quote_sync_error FROM app.products WHERE id=$1',[id]))[0].quote_sync_error).toBe('QUOTE_PROVIDER_UNAVAILABLE')
  })
  it('rejects quotes that became stale at the source rather than assigning a fresh receipt time', async () => {
    token.timestamp=Math.floor((Date.now()-600001)/1000)
    expect(await worker.tick()).toBe(0)
    expect((await db.query('SELECT count(*)::int AS n FROM app.price_quotes'))[0].n).toBe(0)
  })
  it('rechecks a binding changed while the upstream request was pending', async () => {
    get.mockImplementation(async () => {
      await db.query("UPDATE app.products SET quote_binding_json=jsonb_set(quote_binding_json,'{bindingId}',to_jsonb('new-binding'::text)) WHERE id=$1",[id])
      return [token]
    })
    expect(await worker.tick()).toBe(0)
    expect((await db.query('SELECT count(*)::int AS n FROM app.price_quotes'))[0].n).toBe(0)
  })
  it('does not request a disabled binding', async () => {
    await db.query("UPDATE app.products SET quote_binding_json=jsonb_set(quote_binding_json,'{enabled}','false') WHERE id=$1",[id])
    expect(await worker.tick()).toBe(0); expect(get).not.toHaveBeenCalled()
  })
  it('prepares draft quotes before publication without making the product orderable',async()=> {
    await db.query("UPDATE app.products SET state='draft',published_at=NULL WHERE id=$1",[id])
    expect(await worker.tick()).toBe(1)
    expect((await db.query('SELECT state FROM app.products WHERE id=$1',[id]))[0].state).toBe('draft')
  })
})
