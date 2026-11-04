import 'reflect-metadata'
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { OptionalSessionAuthGuard } from '../../src/security/optional-session-auth.guard'
import { VerifiedEmailGuard } from '../../src/security/verified-email.guard'
import { QuantController } from '../../src/quant/quant.controller'
import { QuantService } from '../../src/quant/quant.service'
import { BasketController } from '../../src/basket/basket.controller'
import { BasketSubscriptionService } from '../../src/basket/subscription.service'
import { BasketPortfolioService } from '../../src/basket/portfolio.service'
import { BasketRecommendationService } from '../../src/basket/recommendation.service'
import { PredictionUserController } from '../../src/prediction/prediction.controller'
import { PredictionService } from '../../src/prediction/prediction.service'
import { PredictionFavoriteService } from '../../src/prediction/prediction-favorite.service'
import { TransactionPinService } from '../../src/wallet/transaction-pin.service'

describe('purchase PIN HTTP boundaries', () => {
  let app: INestApplication
  let base: string
  let replay: Record<string, unknown> | undefined
  let lockedReplay: Record<string, unknown> | undefined
  const query = jest.fn()
  const runnerQuery = jest.fn()
  const ledger = { postQuantLegs: jest.fn(), transferBasketSettlement: jest.fn() }
  const operations = { assertEnabled: jest.fn() }
  const runner = { connect: jest.fn(), startTransaction: jest.fn(), query: runnerQuery,
    commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() }
  const db = { query, createQueryRunner: jest.fn(() => runner), transaction: jest.fn() }
  const pin = new TransactionPinService(db as never, new ConfigService({ TRANSACTION_PIN_PEPPER: 'http-test-pepper-with-at-least-32-bytes' }), {} as never)
  const verify = jest.spyOn(pin, 'verifyPurchase')
  const compliance = { requireInvestmentEligibility: jest.fn() }
  const quant = new QuantService(db as never, ledger as never, operations as never, compliance as never, pin)
  const basket = new BasketSubscriptionService(db as never, ledger as never, operations as never, {} as never, {} as never, {} as never, compliance as never, pin)
  const polymarket = { getOrderBook: jest.fn(), getOutcomeProbability: jest.fn() }
  const prediction = new PredictionService(db as never, operations as never, polymarket as never, compliance as never, pin)
  const token = { token_id: 'token', state: 'active', market_state: 'active', enable_order_book: true, market_mapping_id: 'market' }
  const receipt = { id: 'bet-id', market_mapping_id: 'market', token_id: 'token', side: 'YES', stake_atomic: '10000000',
    fee_atomic: '100000', payout_fee_atomic: '0', shares: '19.8', price: '0.5', status: 'placed', payout_atomic: null, created_at: new Date('2026-11-05T00:00:00Z') }
  const cases = [
    { name: 'quant', path: '/quant/products/test/subscriptions', body: { amountUsd: '10' }, result: 'order' },
    { name: 'basket', path: '/basket/portfolios/test/subscriptions', body: { amountUsd: '10' }, result: 'subscription' },
    { name: 'prediction', path: '/predictions/bets', body: { tokenId: 'token', stakeAtomic: '10000000', idempotencyKey: 'purchase-test-key' }, result: 'bet' },
  ]
  const post = (path: string, body: object) => fetch(`${base}/v1${path}`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'purchase-test-key' }, body: JSON.stringify(body) })

  beforeAll(async () => {
    const auth = { canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().auth = { userId: 'user', sessionId: 'session', deviceId: null }
      return true
    } }
    const module = await Test.createTestingModule({
      controllers: [QuantController, BasketController, PredictionUserController],
      providers: [
        { provide: QuantService, useValue: quant }, { provide: BasketSubscriptionService, useValue: basket },
        { provide: PredictionService, useValue: prediction }, { provide: BasketPortfolioService, useValue: {} },
        { provide: BasketRecommendationService, useValue: {} }, { provide: PredictionFavoriteService, useValue: {} },
      ],
    }).overrideGuard(SessionAuthGuard).useValue(auth)
      .overrideGuard(OptionalSessionAuthGuard).useValue(auth)
      .overrideGuard(VerifiedEmailGuard).useValue(auth).compile()
    app = module.createNestApplication({ logger: false })
    app.setGlobalPrefix('v1')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
  })
  afterAll(async () => { await app?.close() })
  beforeEach(() => {
    jest.clearAllMocks()
    replay = undefined
    lockedReplay = undefined
    query.mockImplementation(async (sql: string) => sql.includes('idempotency_key') ? (replay ? [replay] : []) : [token])
    runnerQuery.mockImplementation(async (sql: string) => sql.includes('idempotency_key') && lockedReplay ? [lockedReplay] : [])
    polymarket.getOrderBook.mockResolvedValue({ tokenId: 'token', stale: false, fetchedAt: new Date(), asks: [{ price: '0.5', size: '1000' }] })
    polymarket.getOutcomeProbability.mockResolvedValue(0.5)
  })

  function expectNoWrites() {
    for (const calls of [query.mock.calls, runnerQuery.mock.calls]) {
      expect(calls.every(([sql]) => /^SELECT\b/i.test(String(sql).trim()))).toBe(true)
    }
    expect(ledger.postQuantLegs).not.toHaveBeenCalled()
    expect(ledger.transferBasketSettlement).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  }

  it.each(cases)('$name rejects a missing PIN with a coded response before order/ledger writes', async item => {
    const response = await post(item.path, item.body)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'TRANSACTION_PIN_REQUIRED' } })
    expect(verify).toHaveBeenCalledWith('user', undefined)
    expectNoWrites()
  })

  it.each(cases)('$name returns the stored receipt without PIN verification', async item => {
    replay = item.name === 'prediction' ? receipt : { id: 'original-id', status: 'settled' }
    const response = await post(item.path, item.body)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.duplicate).toBe(true)
    if (item.result === 'bet') expect(body.id).toBe('bet-id')
    else expect(body[item.result]).toEqual(replay)
    expect(verify).not.toHaveBeenCalled()
    expect(operations.assertEnabled).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it('also skips the PIN when a prediction receipt appears while waiting for its advisory lock', async () => {
    lockedReplay = receipt
    const response = await post('/predictions/bets', cases[2].body)
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ duplicate: true, id: 'bet-id' })
    expect(verify).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it.each(cases)('$name forwards the six-digit PIN through its DTO and controller', async item => {
    // A valid DTO reaches the real verifier. No credential in this fixture means UNSET.
    query.mockImplementation(async (sql: string) => sql.includes('idempotency_key') ? [] : [token])
    const response = await post(item.path, { ...item.body, transactionPin: '012345' })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'TRANSACTION_PIN_UNSET' } })
    expect(verify).toHaveBeenCalledWith('user', '012345')
    expectNoWrites()
  })

  it.each(cases.flatMap(item => ['12345', 'abcdef', 123456].map(value => ({ ...item, value }))))('$name rejects malformed PIN $value at DTO validation', async item => {
    const response = await post(item.path, { ...item.body, transactionPin: item.value })
    expect(response.status).toBe(400)
    expect(verify).not.toHaveBeenCalled()
    expectNoWrites()
  })
})
