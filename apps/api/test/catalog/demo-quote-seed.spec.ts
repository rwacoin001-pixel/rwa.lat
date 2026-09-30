/*
 * demo-quote-seed.spec.ts — apps/api/scripts/demo-quote-seed.ts 的安全前置与
 * 计划逻辑测试。全部用内存 store，独立可跑、不连数据库、绝不写库。
 * （Jest 30：断言统一用 toThrow，无 toThrowError。）
 */
import {
  DemoQuoteError,
  DemoQuoteInsertRow,
  DemoQuoteProductRow,
  DemoQuoteStore,
  TARGET_PRODUCTS,
  assertWritePreconditions,
  formatCliFailure,
  parseArgs,
  planDemoQuotes,
  runDemoQuoteSeed,
  toAtomicAmountExact,
} from '../../scripts/demo-quote-seed'
import { calculateProductQuantityAtomic, SETTLEMENT_ASSET_DECIMALS } from '../../src/financial/amounts'

const NOW = new Date('2026-09-26T00:00:00.000Z')

const PRODUCTS: DemoQuoteProductRow[] = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', externalRef: 'h100-inference-pool', displayName: 'H100 Inference Pool', assetClassId: 'compute', assetCode: 'USD', assetDecimals: 6, state: 'published' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', externalRef: 'solar-income-2027', displayName: 'Solar Income 2027', assetClassId: 'rwa', assetCode: 'USD', assetDecimals: 6, state: 'published' },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', externalRef: 'tech-growth-etf', displayName: 'Tech Growth ETF', assetClassId: 'stocks', assetCode: 'USD', assetDecimals: 6, state: 'published' },
  { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', externalRef: 'demo-fed-rate-cut', displayName: 'Fed Rate Cut Q3 2026', assetClassId: 'prediction', assetCode: 'USD', assetDecimals: 6, state: 'published' },
  { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', externalRef: 'demo-market-1', displayName: 'Demo Prediction Market', assetClassId: 'prediction', assetCode: 'USD', assetDecimals: 6, state: 'published' },
]

const PREDICTION_IDS = ['dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee']

interface QuoteFixture {
  productId: string
  assetCode: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
  currency: string
  source: string
  validUntil: Date | string
  capturedAt: Date | string
}

function makeStore(state: {
  databaseName: string
  products?: DemoQuoteProductRow[]
  quotes?: QuoteFixture[]
}) {
  const inserts: DemoQuoteInsertRow[] = []
  const quotes: QuoteFixture[] = [...(state.quotes ?? [])]
  let writeTxCount = 0
  let inTx = false
  let pending: DemoQuoteInsertRow[] = []
  let transactionQueue = Promise.resolve()
  const store: DemoQuoteStore = {
    currentDatabaseName: async () => state.databaseName,
    listProducts: async () => [...(state.products ?? PRODUCTS)],
    listQuotes: async (productIds) => quotes.filter((quote) => productIds.includes(quote.productId)),
    insertQuote: async (row) => {
      if (inTx) pending.push(row)
      else inserts.push(row)
    },
    runInWriteTransaction: async (work) => {
      writeTxCount += 1
      const previousTransaction = transactionQueue
      let releaseTransaction: () => void = () => undefined
      transactionQueue = new Promise((resolve) => { releaseTransaction = resolve })
      await previousTransaction
      inTx = true
      pending = []
      try {
        const result = await work()
        for (const row of pending) {
          inserts.push(row)
          quotes.push({
            productId: row.productId,
            assetCode: row.assetCode,
            unitPriceAtomicAmount: row.unitPriceAtomicAmount,
            unitPriceDecimals: row.unitPriceDecimals,
            currency: row.currency,
            source: row.source,
            validUntil: row.validUntil,
            capturedAt: row.capturedAt,
          })
        }
        return result
      } catch (error) {
        pending = [] // ROLLBACK：未提交的插入全部丢弃
        throw error
      } finally {
        inTx = false
        releaseTransaction()
      }
    },
  }
  return {
    store,
    inserts,
    quotes,
    get writeTxCount() {
      return writeTxCount
    },
  }
}

describe('demo-quote-seed (safety + planning)', () => {
  it('默认 dry-run：只读、不写入、不打开写事务，输出三项计划', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    const result = await runDemoQuoteSeed({ argv: [], env: {}, store: fake.store, now: NOW })
    expect(result.mode).toBe('dry-run')
    expect(result.insertedCount).toBe(0)
    expect(fake.inserts).toHaveLength(0)
    expect(fake.writeTxCount).toBe(0)
    expect(result.items.map((item) => item.externalRef)).toEqual(
      TARGET_PRODUCTS.map((target) => target.externalRef),
    )
    expect(result.items.every((item) => item.status === 'planned')).toBe(true)
  })

  it('生产环境拒绝写入（含大小写/首尾空格绕过形），零写入', async () => {
    for (const nodeEnv of ['production', 'PRODUCTION ', ' production', 'Production']) {
      const fake = makeStore({ databaseName: 'rwa_lat_dev' })
      await expect(
        runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: nodeEnv }, store: fake.store, now: NOW }),
      ).rejects.toMatchObject({ code: 'PRODUCTION_REFUSED' })
      expect(fake.inserts).toHaveLength(0)
      expect(fake.writeTxCount).toBe(0)
    }
    const appFake = makeStore({ databaseName: 'rwa_lat_dev' })
    await expect(
      runDemoQuoteSeed({ argv: ['--apply'], env: { APP_ENV: ' production ' }, store: appFake.store, now: NOW }),
    ).rejects.toMatchObject({ code: 'PRODUCTION_REFUSED' })
    expect(appFake.inserts).toHaveLength(0)
  })

  it('非 rwa_lat_dev 数据库拒绝写入（精确库名校验）', async () => {
    for (const databaseName of ['rwa_lat_production', 'rwa_lat_dev_backup', 'postgres']) {
      const fake = makeStore({ databaseName })
      await expect(
        runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
      ).rejects.toMatchObject({ code: 'DATABASE_REFUSED' })
      expect(fake.inserts).toHaveLength(0)
      expect(fake.writeTxCount).toBe(0)
    }
  })

  it('仅写三项投资产品，绝不触及预测产品', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    const result = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(result.mode).toBe('apply')
    expect(result.insertedCount).toBe(3)
    expect(fake.inserts).toHaveLength(3)
    const targetIds = PRODUCTS.slice(0, 3).map((product) => product.id)
    expect(fake.inserts.map((row) => row.productId).sort()).toEqual([...targetIds].sort())
    expect(fake.inserts.some((row) => PREDICTION_IDS.includes(row.productId))).toBe(false)
    expect(result.items.some((item) => item.assetClassId === 'prediction')).toBe(false)
  })

  it('目标解析到预测类产品时硬拒绝（PREDICTION_PRODUCT_REFUSED）', async () => {
    const tampered = PRODUCTS.map((product) =>
      product.externalRef === 'tech-growth-etf' ? { ...product, assetClassId: 'prediction' } : product,
    )
    const fake = makeStore({ databaseName: 'rwa_lat_dev', products: tampered })
    await expect(
      runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
    ).rejects.toMatchObject({ code: 'PREDICTION_PRODUCT_REFUSED' })
    expect(fake.inserts).toHaveLength(0)
  })

  it('数值精度：1000 USDT/份 = 1000000000 原子（6 位小数），与订单换算一致', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    for (const row of fake.inserts) {
      expect(row.unitPriceAtomicAmount).toBe('1000000000')
      expect(row.unitPriceDecimals).toBe(6)
      expect(row.currency).toBe('USDT')
      expect(row.source).toBe('demo')
      expect(row.assetCode).toBe('USD')
      expect(row.validUntil.getTime()).toBeGreaterThan(row.capturedAt.getTime())
    }
    expect(toAtomicAmountExact('1000', 6)).toBe('1000000000')
    expect(toAtomicAmountExact('1000.5', 6)).toBe('1000500000')
    expect(() => toAtomicAmountExact('0.0000001', 6)).toThrow(DemoQuoteError)
    // 代码确认的量纲：花 1000 USDT（6dp）按该报价应恰好买到 1.000000 单位（产品 6dp）
    const quantity = calculateProductQuantityAtomic(
      1000n * 10n ** BigInt(SETTLEMENT_ASSET_DECIMALS),
      SETTLEMENT_ASSET_DECIMALS,
      6,
      6,
      1000000000n,
    )
    expect(quantity).toBe(1000000n)
  })

  it('重复执行幂等：不会无限插入同一报价，且不重复打开写事务', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    const first = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(first.insertedCount).toBe(3)
    expect(fake.writeTxCount).toBe(1)
    const second = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(second.insertedCount).toBe(0)
    expect(second.unchangedCount).toBe(3)
    expect(second.items.every((item) => item.status === 'unchanged')).toBe(true)
    expect(fake.writeTxCount).toBe(2) // 幂等复查也必须在锁内进行
    const third = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(third.insertedCount).toBe(0)
    expect(fake.inserts).toHaveLength(3)
    expect(fake.writeTxCount).toBe(3)
  })

  it('并发 --apply 在锁内重读后只插入一组三项报价', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    const results = await Promise.all([
      runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
      runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
    ])
    expect(fake.inserts).toHaveLength(3)
    expect(results.map((result) => result.insertedCount).sort()).toEqual([0, 3])
    expect(results.map((result) => result.unchangedCount).sort()).toEqual([0, 3])
  })

  it('已失效的旧报价不阻止补一条新报价，但仍只补一条', async () => {
    const fake = makeStore({
      databaseName: 'rwa_lat_dev',
      quotes: [{
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assetCode: 'USD',
        unitPriceAtomicAmount: '1000000000',
        unitPriceDecimals: 6,
        currency: 'USDT',
        source: 'demo',
        validUntil: new Date(NOW.getTime() - 1000),
        capturedAt: new Date(NOW.getTime() - 2000),
      }],
    })
    const first = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(first.insertedCount).toBe(3)
    const second = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW })
    expect(second.insertedCount).toBe(0)
    expect(fake.inserts).toHaveLength(3)
  })

  it('幂等校验：未来采集时间或错资产码的报价不算有效重复', async () => {
    const futureCaptured = makeStore({
      databaseName: 'rwa_lat_dev',
      quotes: [{
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assetCode: 'USD',
        unitPriceAtomicAmount: '1000000000',
        unitPriceDecimals: 6,
        currency: 'USDT',
        source: 'demo',
        validUntil: new Date(NOW.getTime() + 60_000),
        capturedAt: new Date(NOW.getTime() + 60_000), // 未来采集时间
      }],
    })
    const firstFuture = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: futureCaptured.store, now: NOW })
    expect(firstFuture.items.find((item) => item.externalRef === 'h100-inference-pool')?.status).toBe('inserted')

    const wrongAsset = makeStore({
      databaseName: 'rwa_lat_dev',
      quotes: [{
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assetCode: 'EUR', // 与产品 asset_code 不一致
        unitPriceAtomicAmount: '1000000000',
        unitPriceDecimals: 6,
        currency: 'USDT',
        source: 'demo',
        validUntil: new Date(NOW.getTime() + 60_000),
        capturedAt: new Date(NOW.getTime() - 1000),
      }],
    })
    const firstWrong = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: wrongAsset.store, now: NOW })
    expect(firstWrong.items.find((item) => item.externalRef === 'h100-inference-pool')?.status).toBe('inserted')

    // 正确匹配（assetCode 一致 + capturedAt<=now + validUntil>now）才算有效重复
    const valid = makeStore({
      databaseName: 'rwa_lat_dev',
      quotes: [{
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assetCode: 'USD',
        unitPriceAtomicAmount: '1000000000',
        unitPriceDecimals: 6,
        currency: 'USDT',
        source: 'demo',
        validUntil: new Date(NOW.getTime() + 60_000),
        capturedAt: new Date(NOW.getTime() - 1000),
      }],
    })
    const validRun = await runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: valid.store, now: NOW })
    expect(validRun.items.find((item) => item.externalRef === 'h100-inference-pool')?.status).toBe('unchanged')
  })

  it('插入中途失败：写事务回滚，不留下部分写入', async () => {
    const fake = makeStore({ databaseName: 'rwa_lat_dev' })
    let calls = 0
    const originalInsert = fake.store.insertQuote
    fake.store.insertQuote = async (row) => {
      calls += 1
      if (calls === 2) throw new Error('simulated insert failure')
      return originalInsert(row)
    }
    await expect(
      runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
    ).rejects.toThrow('simulated insert failure')
    expect(fake.inserts).toHaveLength(0) // 回滚后零落库
  })

  it('未知参数与缺失目标产品都会失败退出（抛错即非零）', async () => {
    expect(() => parseArgs(['--force'])).toThrow(DemoQuoteError)
    const fake = makeStore({
      databaseName: 'rwa_lat_dev',
      products: PRODUCTS.filter((product) => product.externalRef !== 'solar-income-2027'),
    })
    await expect(
      runDemoQuoteSeed({ argv: ['--apply'], env: { NODE_ENV: 'development' }, store: fake.store, now: NOW }),
    ).rejects.toMatchObject({ code: 'TARGET_PRODUCT_MISSING' })
  })

  it('assertWritePreconditions：dry-run 放行、写入三重前置缺一不可、环境串归一', () => {
    expect(() => assertWritePreconditions({ apply: false, nodeEnv: 'production', databaseName: 'prod_db' })).not.toThrow()
    expect(() => assertWritePreconditions({ apply: true, nodeEnv: 'development', databaseName: 'rwa_lat_dev' })).not.toThrow()
    expect(() => assertWritePreconditions({ apply: true, nodeEnv: 'production', databaseName: 'rwa_lat_dev' })).toThrow(DemoQuoteError)
    expect(() => assertWritePreconditions({ apply: true, nodeEnv: 'PRODUCTION ', databaseName: 'rwa_lat_dev' })).toThrow(DemoQuoteError)
    expect(() => assertWritePreconditions({ apply: true, nodeEnv: ' development ', appEnv: ' Production', databaseName: 'rwa_lat_dev' })).toThrow(DemoQuoteError)
    expect(() => assertWritePreconditions({ apply: true, nodeEnv: 'development', databaseName: 'rwa_lat_test' })).toThrow(DemoQuoteError)
  })

  it('CLI 失败输出不回显连接/认证/SQL 细节', () => {
    const raw = new Error('password authentication failed for user "x" postgres://user:secret@db.host:5432/rwa')
    expect(formatCliFailure(raw)).toBe('demo-quote-seed failed: database error')
    expect(formatCliFailure(raw)).not.toContain('secret')
    expect(formatCliFailure(raw)).not.toContain('postgres://')
    expect(formatCliFailure(new DemoQuoteError('DATABASE_REFUSED', 'only writes to rwa_lat_dev')))
      .toContain('[DATABASE_REFUSED]')
  })
})
