import type { ConfigService } from '@nestjs/config'
import type { DataSource, QueryRunner } from 'typeorm'
import { OrdersService } from '../../src/orders/orders.service'
import type { CatalogService } from '../../src/catalog/catalog.service'
import type { ComplianceService } from '../../src/compliance/compliance.service'
import type { NotificationService } from '../../src/notification/notification.service'
import type { OperationalCapabilityService } from '../../src/operations/operational-capability.service'

const TEST_ORDER = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  product_id: '33333333-3333-4333-8333-333333333333',
  outcome_key: 'long',
  requested_atomic_amount: '1000000',
  filled_atomic_amount: '0',
  filled_quantity_atomic_amount: '0',
  unit_price_atomic_amount: '1000000',
  settlement_asset_code: 'USDT',
  settlement_asset_decimals: 6,
  product_asset_code: 'WHOLE',
  product_asset_decimals: 0,
  quote_currency: 'USD',
  quote_decimals: 6,
  state: 'submitted',
  failure_reason: null,
  submitted_at: new Date(),
  completed_at: null,
}

function serviceFor(query: jest.Mock, getLatestQuote = jest.fn(), getProduct = jest.fn().mockResolvedValue({ assetCode: 'WHOLE', assetDecimals: 0 })) {
  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query,
  } as unknown as QueryRunner
  const dataSource = { createQueryRunner: () => runner } as unknown as DataSource
  const config = {
    get: jest.fn((key: string) => key === 'APP_ENV' ? 'development' : key === 'DEMO_OPERATIONS_ENABLED' ? 'true' : undefined),
  } as unknown as ConfigService
  const service = new OrdersService(
    dataSource,
    { getLatestQuote, getProduct } as unknown as CatalogService,
    {} as ComplianceService,
    {} as NotificationService,
    {} as OperationalCapabilityService,
    config,
  )
  return { service, runner }
}

describe('OrdersService precision guards', () => {
  it('rejects a positive partial fill that rounds to zero product units before writing ledger entries', async () => {
    const query = jest.fn().mockResolvedValue([TEST_ORDER])
    const { service, runner } = serviceFor(query)

    await expect(service.advance(TEST_ORDER.id, { state: 'partially_filled', filledAtomicAmount: '1' }, 'request-1'))
      .rejects.toMatchObject({ status: 400, response: { code: 'ORDER_FILL_QUANTITY_ZERO' } })

    expect(query).toHaveBeenCalledTimes(1)
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(runner.commitTransaction).not.toHaveBeenCalled()
  })

  it('rejects a positive redemption whose settlement payout rounds to zero before ledger entries', async () => {
    const redemption = {
      id: '44444444-4444-4444-8444-444444444444',
      user_id: TEST_ORDER.user_id,
      product_id: TEST_ORDER.product_id,
      quantity_atomic_amount: '1',
      state: 'requested',
      asset_code: 'WHOLE',
      asset_decimals: 30,
      quote_decimals: 6,
    }
    const position = { id: 'position-1', asset_code: 'WHOLE', asset_decimals: 30, quantity_atomic_amount: '100', cost_atomic_amount: '100' }
    const query = jest.fn()
      .mockResolvedValueOnce([redemption])
      .mockResolvedValueOnce([position])
    const getLatestQuote = jest.fn().mockResolvedValue({
      unitPriceAtomicAmount: '50000000',
      unitPriceDecimals: 6,
      currency: 'USD',
      stale: false,
    })
    const getProduct = jest.fn().mockResolvedValue({ assetCode: 'WHOLE', assetDecimals: 30 })
    const { service, runner } = serviceFor(query, getLatestQuote, getProduct)

    await expect(service.completeRedemption(redemption.id, 'request-2'))
      .rejects.toMatchObject({ status: 409, response: { code: 'REDEMPTION_PAYOUT_ROUNDS_TO_ZERO' } })

    expect(query).toHaveBeenCalledTimes(2)
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(runner.commitTransaction).not.toHaveBeenCalled()
  })

  it('rejects redemption completion when stored, active, and current product units differ', async () => {
    const redemption = {
      id: '44444444-4444-4444-8444-444444444444',
      user_id: TEST_ORDER.user_id,
      product_id: TEST_ORDER.product_id,
      quantity_atomic_amount: '1',
      state: 'requested',
      asset_code: 'USD',
      asset_decimals: 6,
      quote_decimals: 6,
    }
    const position = { id: 'position-1', asset_code: 'USDT', asset_decimals: 6, quantity_atomic_amount: '100', cost_atomic_amount: '100' }
    const query = jest.fn().mockResolvedValueOnce([redemption]).mockResolvedValueOnce([position])
    const getProduct = jest.fn().mockResolvedValue({ assetCode: 'USD', assetDecimals: 6 })
    const { service, runner } = serviceFor(query, jest.fn(), getProduct)

    await expect(service.completeRedemption(redemption.id, 'request-3'))
      .rejects.toMatchObject({ status: 409, response: { code: 'REDEMPTION_PRODUCT_SCALE_CHANGED' } })

    expect(query).toHaveBeenCalledTimes(2)
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(runner.commitTransaction).not.toHaveBeenCalled()
  })
})
