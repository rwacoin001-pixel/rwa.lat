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
  let ledger: { listUserBalances: jest.Mock }
  let catalog: { getProduct: jest.Mock; getLatestQuote: jest.Mock }

  beforeEach(async () => {
    ledger = { listUserBalances: jest.fn() }
    catalog = { getProduct: jest.fn(), getLatestQuote: jest.fn() }
    const mod = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: getRepositoryToken(Redemption), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => e), create: jest.fn((e) => Object.assign(new Redemption(), e)) } },
        { provide: getRepositoryToken(PositionSnapshot), useValue: { find: jest.fn(), query: jest.fn(), save: jest.fn((e) => e) } },
        { provide: LedgerService, useValue: ledger },
        { provide: CatalogService, useValue: catalog },
      ],
    }).compile()
    svc = mod.get(PortfolioService)
    redemptionRepo = mod.get(getRepositoryToken(Redemption))
    snapshotRepo = mod.get(getRepositoryToken(PositionSnapshot))
  })

  it('listPositions maps ledger accounts to positions', async () => {
    ledger.listUserBalances.mockResolvedValue({
      accounts: [
        { accountId: PRODUCT, assetCode: 'USDT', assetDecimals: 6, atomicBalance: '1000000', purpose: 'available', updatedAt: new Date() },
      ],
    })
    const r = await svc.listPositions(USER)
    expect(r).toHaveLength(1)
    expect(r[0].quantityAtomicAmount).toBe('1000000')
    expect(r[0].source).toBe('immutable-ledger-projection')
  })

  it('requestRedemption creates a requested record', async () => {
    catalog.getProduct.mockResolvedValue({ assetCode: 'USDT', assetDecimals: 6 })
    catalog.getLatestQuote.mockResolvedValue({ unitPriceAtomicAmount: '100', currency: 'USD', capturedAt: new Date() })
    const r = await svc.requestRedemption({
      user_id: USER,
      product_id: PRODUCT,
      quantity_atomic_amount: '500',
      request_id: 'req-1',
    })
    expect(r.state).toBe('requested')
    expect(r.estimatedUnitPriceAtomicAmount).toBe('100')
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

  it('history aggregates snapshots via query', async () => {
    snapshotRepo.query.mockResolvedValue([{ capturedAt: new Date(), totalValueAtomicAmount: '200', currency: 'USD' }])
    const out = await svc.history(USER)
    expect(out[0].totalValueAtomicAmount).toBe('200')
  })
})
