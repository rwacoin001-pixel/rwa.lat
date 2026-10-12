import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PortfolioService } from '../../src/portfolio/portfolio.service'
import { PositionSnapshot, Redemption } from '../../src/portfolio/portfolio.entities'
import { PortfolioError } from '../../src/portfolio/portfolio.errors'
import { LedgerService } from '../../src/ledger/ledger.service'
import { CatalogService } from '../../src/catalog/catalog.service'

const USER = '44444444-4444-4444-4444-444444444444'
const PRODUCT = '55555555-5555-5555-5555-555555555555'

describe('PortfolioService (unit)', () => {
  let svc: PortfolioService
  let redemptionRepo: jest.Mocked<Repository<Redemption>>
  let snapshotRepo: jest.Mocked<Repository<PositionSnapshot>>
  let transactionQuery: jest.Mock
  let ledger: { listUserBalances: jest.Mock }
  let catalog: { getProduct: jest.Mock; getLatestQuote: jest.Mock }

  beforeEach(async () => {
    ledger = { listUserBalances: jest.fn() }
    catalog = { getProduct: jest.fn(), getLatestQuote: jest.fn() }
    const mod = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: getRepositoryToken(Redemption), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => e), create: jest.fn((e) => Object.assign(new Redemption(), e)) } },
        { provide: getRepositoryToken(PositionSnapshot), useValue: { find: jest.fn(), query: jest.fn(), save: jest.fn((e) => e), create: jest.fn((e) => e) } },
        { provide: LedgerService, useValue: ledger },
        { provide: CatalogService, useValue: catalog },
      ],
    }).compile()
    svc = mod.get(PortfolioService)
    redemptionRepo = mod.get(getRepositoryToken(Redemption))
    snapshotRepo = mod.get(getRepositoryToken(PositionSnapshot))
    Object.assign(snapshotRepo, { manager: { transaction: async (work: (manager: unknown) => unknown) => work({ query: (sql: string, params?: unknown[]) => (snapshotRepo.query as unknown as (query: string, parameters?: unknown[]) => Promise<unknown>)(sql, params), getRepository: () => snapshotRepo }) } })
    transactionQuery = jest.fn(async (sql: string) => {
      if (sql.includes('FROM app.positions')) return [{ quantity: '1000' }]
      if (sql.includes('SUM(quantity_atomic_amount)')) return [{ quantity: '0' }]
      return []
    })
    Object.assign(redemptionRepo, { manager: { transaction: async (work: (manager: unknown) => unknown) => work({
      query: transactionQuery,
      getRepository: () => redemptionRepo,
    }) } })
  })

  it('listPositions never reports cash ledger accounts as product positions', async () => {
    snapshotRepo.query.mockResolvedValue([])
    ledger.listUserBalances.mockResolvedValue({
      accounts: [
        { accountId: PRODUCT, assetCode: 'USDT', assetDecimals: 6, atomicBalance: '1000000', purpose: 'available', updatedAt: new Date() },
      ],
    })
    expect(await svc.listPositions(USER)).toEqual([])
    expect(ledger.listUserBalances).not.toHaveBeenCalled()
  })

  it('does not capture a market-value snapshot in a currency without a configured USD/USDT conversion', async () => {
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'RWA', assetDecimals: 2 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '123', unitPriceDecimals: 2, currency: 'EUR', stale: false })
    await expect(svc.captureSnapshot(USER, PRODUCT)).rejects.toMatchObject({ status: 409, response: { code: 'PORTFOLIO_QUOTE_CURRENCY_UNSUPPORTED' } })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a single-product snapshot when the stored asset unit differs from the catalog', async () => {
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'USD', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', stale: false })
    snapshotRepo.query.mockResolvedValue([{
      quantity: '1000000', min_asset_code: 'USDT', max_asset_code: 'USDT', min_asset_decimals: 6, max_asset_decimals: 6,
    }])

    await expect(svc.captureSnapshot(USER, PRODUCT)).rejects.toMatchObject({
      status: 409, response: { code: 'PORTFOLIO_POSITION_ASSET_CHANGED' },
    })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a single-product snapshot when the stored asset precision differs from the catalog', async () => {
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'USDT', assetDecimals: 8 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', stale: false })
    snapshotRepo.query.mockResolvedValue([{
      quantity: '1000000', min_asset_code: 'USDT', max_asset_code: 'USDT', min_asset_decimals: 6, max_asset_decimals: 6,
    }])

    await expect(svc.captureSnapshot(USER, PRODUCT)).rejects.toMatchObject({
      status: 409, response: { code: 'PORTFOLIO_POSITION_SCALE_MISMATCH' },
    })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('does not snapshot cash balances as a product holding', async () => {
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'USDT', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', stale: false })
    snapshotRepo.query.mockResolvedValue([{
      quantity: '0', min_asset_code: null, max_asset_code: null, min_asset_decimals: null, max_asset_decimals: null,
    }])
    ledger.listUserBalances.mockResolvedValue({
      accounts: [{ assetCode: 'USDT', assetDecimals: 6, purpose: 'available', atomicBalance: '1000000' }],
    })

    await expect(svc.captureSnapshot(USER, PRODUCT)).rejects.toMatchObject({
      status: 409, response: { code: 'PORTFOLIO_POSITION_EMPTY' },
    })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('captures all active positions atomically under one portfolio snapshot batch', async () => {
    const secondProduct = '66666666-5555-5555-5555-555555555555'
    const positions = [
      { product_id: PRODUCT, outcome_key: 'long', asset_code: 'RWA', asset_decimals: 2, quantity: '100' },
      { product_id: secondProduct, outcome_key: 'long', asset_code: 'RWA2', asset_decimals: 4, quantity: '2500' },
    ]
    snapshotRepo.query.mockImplementation(async (sql: string) => sql.includes('snapshot_batch_id = $2') ? [] : positions)
    catalog.getProduct.mockImplementation(async (id: string) => ({ assetClassId: 'real_estate', assetCode: id === PRODUCT ? 'RWA' : 'RWA2', assetDecimals: id === PRODUCT ? 2 : 4 }))
    catalog.getLatestQuote.mockImplementation(async (id: string) => ({ unitPriceAtomicAmount: '123', unitPriceDecimals: id === PRODUCT ? 2 : 4, currency: id === PRODUCT ? 'USD' : 'USDT', capturedAt: new Date() }))
    const batch = await svc.capturePortfolioSnapshot(USER)
    const saved = snapshotRepo.save.mock.calls[0][0] as PositionSnapshot[]
    expect(batch.snapshotCount).toBe(2)
    expect(saved.map((snapshot) => snapshot.snapshot_batch_id)).toEqual([batch.snapshotBatchId, batch.snapshotBatchId])
    expect(saved[0].captured_at).toEqual(saved[1].captured_at)
    expect(saved[0].unit_price_decimals).toBe(2)
    expect(saved[1].unit_price_decimals).toBe(4)
  })

  it('returns an existing snapshot batch on retry without reading new prices', async () => {
    const batchId = '77777777-5555-5555-8555-555555555555'
    const capturedAt = new Date('2026-09-25T00:00:00.000Z')
    snapshotRepo.query.mockResolvedValue([{
      productId: PRODUCT,
      assetCode: 'RWA',
      assetDecimals: 2,
      quantityAtomicAmount: '100',
      unitPriceAtomicAmount: '123',
      unitPriceDecimals: 2,
      currency: 'USD',
      valuedAt: new Date('2026-09-24T23:59:00.000Z'),
      capturedAt,
    }])

    const result = await svc.capturePortfolioSnapshot(USER, batchId)

    expect(result.snapshotBatchId).toBe(batchId)
    expect(result.snapshotCount).toBe(1)
    expect(result.capturedAt).toBe(capturedAt)
    expect(result.positions[0].unitPriceDecimals).toBe(2)
    expect(catalog.getProduct).not.toHaveBeenCalled()
  })

  it('rejects a portfolio batch when stored precision differs from the catalog precision', async () => {
    snapshotRepo.query.mockImplementation(async (sql: string) => sql.includes('snapshot_batch_id = $2') ? [] : [{
      product_id: PRODUCT, outcome_key: 'long', asset_code: 'USDT', asset_decimals: 6, quantity: '1000000',
    }])
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'USDT', assetDecimals: 8 })

    await expect(svc.capturePortfolioSnapshot(USER)).rejects.toMatchObject({
      status: 409, response: { code: 'PORTFOLIO_POSITION_SCALE_MISMATCH' },
    })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a batch when holdings change while quotes are being loaded', async () => {
    const before = { product_id: PRODUCT, outcome_key: 'long', asset_code: 'RWA', asset_decimals: 2, quantity: '100' }
    snapshotRepo.query.mockResolvedValueOnce([]).mockResolvedValueOnce([before]).mockResolvedValueOnce([{ ...before, quantity: '101' }])
    catalog.getProduct.mockResolvedValue({ assetClassId: 'real_estate', assetCode: 'RWA', assetDecimals: 2 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '123', unitPriceDecimals: 2, currency: 'USD', capturedAt: new Date() })

    await expect(svc.capturePortfolioSnapshot(USER)).rejects.toMatchObject({ status: 409, response: { code: 'PORTFOLIO_POSITIONS_CHANGED' } })
    expect(snapshotRepo.save).not.toHaveBeenCalled()
  })

  it('requestRedemption creates a requested record', async () => {
    catalog.getProduct.mockResolvedValue({ assetCode: 'USDT', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', capturedAt: new Date() })
    const r = await svc.requestRedemption({
      user_id: USER,
      product_id: PRODUCT,
      quantity_atomic_amount: '500',
      request_id: 'req-1',
    })
    expect(r.state).toBe('requested')
    expect(r.estimatedUnitPriceAtomicAmount).toBe('1000000')
    expect(redemptionRepo.save).toHaveBeenCalled()
  })

  it('requestRedemption throws when product missing', async () => {
    catalog.getProduct.mockRejectedValue(PortfolioError.productNotFound(PRODUCT))
    await expect(
      svc.requestRedemption({ user_id: USER, product_id: PRODUCT, quantity_atomic_amount: '1', request_id: 'req-2' }),
    ).rejects.toBeInstanceOf(PortfolioError)
  })

  it('cancelRedemption flips requested -> canceled', async () => {
    const r = new Redemption()
    Object.assign(r, { id: 'r1', user_id: USER, state: 'requested', product_id: PRODUCT })
    redemptionRepo.findOne.mockResolvedValue(r)
    const out = await svc.cancelRedemption('r1', USER)
    expect(out.state).toBe('canceled')
    expect(r.canceled_at).toBeDefined()
  })

  it('cancelRedemption throws when already completed', async () => {
    const r = new Redemption()
    Object.assign(r, { id: 'r2', user_id: USER, state: 'completed', product_id: PRODUCT })
    redemptionRepo.findOne.mockResolvedValue(r)
    await expect(svc.cancelRedemption('r2', USER)).rejects.toBeInstanceOf(PortfolioError)
  })


  const intent = { user_id: USER, product_id: PRODUCT, quantity_atomic_amount: '500', request_id: 'same-intent' }
  const seedCatalog = () => {
    catalog.getProduct.mockResolvedValue({ assetCode: 'USDT', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', stale: false })
  }

  it.each(['0', '-1', '1.5', '1e3', 'abc', '9'.repeat(79)])('rejects invalid quantity %s before touching database', async (quantity) => {
    await expect(svc.requestRedemption({ ...intent, quantity_atomic_amount: quantity })).rejects.toMatchObject({ status: 400 })
    expect(transactionQuery).not.toHaveBeenCalled()
  })

  it.each(['', '   ', 'x'.repeat(129)])('rejects invalid request ID', async (requestId) => {
    await expect(svc.requestRedemption({ ...intent, request_id: requestId })).rejects.toMatchObject({ status: 400 })
  })

  it('returns the same record for an identical intent even after quote expiry', async () => {
    redemptionRepo.findOne.mockResolvedValue(Object.assign(new Redemption(), { ...intent, id: 'original', state: 'completed' }))
    const result = await svc.requestRedemption(intent)
    expect(result.id).toBe('original')
    expect(result.state).toBe('completed')
    expect(catalog.getLatestQuote).not.toHaveBeenCalled()
    expect(redemptionRepo.save).not.toHaveBeenCalled()
    expect(transactionQuery.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
  })

  it.each([
    { user_id: 'someone-else' }, { product_id: 'another-product' },
    { quantity_atomic_amount: '501' }, { destination_address: 'another-destination' },
  ])('rejects a reused request ID for another intent without returning its record', async (change) => {
    redemptionRepo.findOne.mockResolvedValue(Object.assign(new Redemption(), { ...intent, ...change, id: 'private-record' }))
    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({ status: 409, response: { code: 'PORTFOLIO_IDEMPOTENCY_CONFLICT' } })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('rejects stale quote before saving', async () => {
    seedCatalog()
    catalog.getLatestQuote.mockResolvedValue({ stale: true })
    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({ status: 409, response: { code: 'PORTFOLIO_QUOTE_STALE' } })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('rejects incompatible stored scales when requesting a redemption', async () => {
    seedCatalog()
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM app.positions')) return [{ quantity: '500', asset_decimals: 6 }, { quantity: '500', asset_decimals: 8 }]
      return [{ quantity: '0' }]
    })
    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({ status: 409, response: { code: 'REDEMPTION_PRODUCT_SCALE_MISMATCH' } })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a redemption when the active position unit differs from the catalog unit', async () => {
    catalog.getProduct.mockResolvedValue({ assetCode: 'USD', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '1000000', unitPriceDecimals: 6, currency: 'USD', stale: false })
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM app.positions')) return [{ quantity: '1000', asset_code: 'USDT', asset_decimals: 6 }]
      return [{ quantity: '0' }]
    })

    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({
      status: 409, response: { code: 'REDEMPTION_PRODUCT_SCALE_CHANGED' },
    })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('rejects absent long holdings and pending requests exceeding available units', async () => {
    seedCatalog()
    transactionQuery.mockImplementation(async (sql: string) => sql.includes('FROM app.positions') ? [] : [{ quantity: '0' }])
    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({ status: 409 })
    transactionQuery.mockImplementation(async (sql: string) => [{ quantity: sql.includes('FROM app.positions') ? '1000' : '600' }])
    await expect(svc.requestRedemption(intent)).rejects.toMatchObject({ status: 409 })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('locks the long position before checking pending reservations', async () => {
    seedCatalog()
    await svc.requestRedemption(intent)
    expect(transactionQuery.mock.calls[1][0]).toContain("outcome_key = 'long'")
    expect(transactionQuery.mock.calls[1][0]).toContain('FOR UPDATE')
    expect(transactionQuery.mock.calls[2][0]).toContain("'requested', 'queued', 'executing'")
    expect(transactionQuery.mock.calls[2][0]).not.toContain('FOR UPDATE')
  })

  it('locks cancellation before inspecting state and refuses a completed record', async () => {
    redemptionRepo.findOne.mockResolvedValue(Object.assign(new Redemption(), { state: 'completed' }))
    await expect(svc.cancelRedemption('r1', USER)).rejects.toMatchObject({ status: 409 })
    expect(redemptionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'r1', user_id: USER }, lock: { mode: 'pessimistic_write' } })
    expect(redemptionRepo.save).not.toHaveBeenCalled()
  })

  it('history aggregates snapshots via query', async () => {
    snapshotRepo.query.mockResolvedValue([{ capturedAt: new Date(), totalValueAtomicAmount: '200', currency: 'USD', currencyDecimals: 6 }])
    const out = await svc.history(USER)
    expect(out[0].totalValueAtomicAmount).toBe('200')
    expect(out[0].currencyDecimals).toBe(6)
  })
})
