import { ForbiddenException } from '@nestjs/common'
import { DataSource, Repository } from 'typeorm'
import { ComplianceService } from '../src/compliance/compliance.service'
import { TradingService } from '../src/trading/trading.service'
import { TradingFill, TradingOrder, TradingPair } from '../src/trading/trading.entities'
import { BasketSubscriptionService } from '../src/basket/subscription.service'
import { BasketPortfolioService } from '../src/basket/portfolio.service'
import { BasketNavService } from '../src/basket/basket.nav.service'
import { BasketRiskService } from '../src/basket/risk.service'
import { LedgerService } from '../src/ledger/ledger.service'
import { OperationalCapabilityService } from '../src/operations/operational-capability.service'
import { PredictionService } from '../src/prediction/prediction.service'
import { PolymarketService } from '../src/polymarket/polymarket.service'

describe('new investment eligibility boundary', () => {
  const denied = new ForbiddenException({ code: 'INVESTMENT_NOT_ELIGIBLE' })
  const compliance = { requireInvestmentEligibility: jest.fn().mockRejectedValue(denied) }
  beforeEach(() => jest.clearAllMocks())

  it.each(['browse_only', 'manual_review', 'ineligible'])('rejects policy decision %s', async decision => {
    const context = { evaluateEligibility: jest.fn().mockResolvedValue({ decision, reasonCodes: ['test'] }) }
    await expect(ComplianceService.prototype.requireInvestmentEligibility.call(context as unknown as ComplianceService, 'u', 'basket')).rejects.toMatchObject({ response: { code: 'INVESTMENT_NOT_ELIGIBLE', decision, reasonCodes: ['test'] } })
  })
  it('allows eligible policy decisions', async () => {
    const context = { evaluateEligibility: jest.fn().mockResolvedValue({ decision: 'eligible', reasonCodes: [] }) }
    await expect(ComplianceService.prototype.requireInvestmentEligibility.call(context as unknown as ComplianceService, 'u', 'basket')).resolves.toBeUndefined()
  })
  it('blocks a trading order before persistence', async () => {
    const pairs = { findOne: jest.fn().mockResolvedValue({ id: 'p', state: 'active', minQuantity: 0.01, tickSize: 0.01 }) }
    const orders = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), create: jest.fn() }
    const service = new TradingService(pairs as unknown as Repository<TradingPair>, orders as unknown as Repository<TradingOrder>, {} as Repository<TradingFill>, {} as DataSource, compliance as unknown as ComplianceService)
    await expect(service.placeOrder('u', { symbol: 'X', side: 'buy', type: 'limit', quantity: 1, price: 10, idempotencyKey: 'k' })).rejects.toBe(denied)
    expect(orders.save).not.toHaveBeenCalled()
  })
  it('blocks subscription before portfolio or ledger writes', async () => {
    const ds = { query: jest.fn().mockResolvedValue([]) }
    const ledger = { transferBasketSettlement: jest.fn() }
    const portfolios = { getPortfolio: jest.fn() }
    const service = new BasketSubscriptionService(ds as unknown as DataSource, ledger as unknown as LedgerService, { assertEnabled: jest.fn() } as unknown as OperationalCapabilityService, portfolios as unknown as BasketPortfolioService, {} as BasketNavService, {} as BasketRiskService, compliance as unknown as ComplianceService)
    await expect(service.subscribe('u', 'p', { amountUsd: '10' }, 'k', 'r')).rejects.toBe(denied)
    expect(portfolios.getPortfolio).not.toHaveBeenCalled()
    expect(ledger.transferBasketSettlement).not.toHaveBeenCalled()
    expect(ds.query.mock.calls.every(([sql]) => /^SELECT/i.test(String(sql).trim()))).toBe(true)
  })
  it('rolls back prediction participation before any financial mutation', async () => {
    const runner = { connect: jest.fn(), startTransaction: jest.fn(), query: jest.fn().mockResolvedValue([]), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() }
    const ds = { query: jest.fn().mockResolvedValue([{ state: 'active', market_state: 'active', enable_order_book: true }]), createQueryRunner: () => runner }
    const service = new PredictionService(ds as unknown as DataSource, { assertEnabled: jest.fn() } as unknown as OperationalCapabilityService, { getOrderBook: jest.fn().mockResolvedValue({ asks: [{ price: '0.5' }] }) } as unknown as PolymarketService, compliance as unknown as ComplianceService)
    await expect(service.placeBet('u', 'r', { tokenId: 't', stakeAtomic: '1000000', idempotencyKey: 'k' })).rejects.toBe(denied)
    expect(runner.rollbackTransaction).toHaveBeenCalled()
    expect(runner.commitTransaction).not.toHaveBeenCalled()
    expect(runner.query.mock.calls.every(([sql]) => /^SELECT/i.test(String(sql).trim()))).toBe(true)
  })
})
