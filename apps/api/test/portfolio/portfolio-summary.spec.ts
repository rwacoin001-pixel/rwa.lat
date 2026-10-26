import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { PortfolioService } from '../../src/portfolio/portfolio.service'
import { PortfolioController } from '../../src/portfolio/portfolio.controller'
import { PositionSnapshot, Redemption } from '../../src/portfolio/portfolio.entities'
import { LedgerService } from '../../src/ledger/ledger.service'
import { CatalogService } from '../../src/catalog/catalog.service'
import { RebalanceService } from '../../src/portfolio/rebalance.service'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { PORTFOLIO_SUMMARY_SQL } from '../../src/portfolio/portfolio-summary'

const USER = '44444444-4444-4444-4444-444444444444'
const SINCE = new Date('2026-10-26T16:00:00.000Z')
const AS_OF = new Date('2026-10-27T04:00:00.000Z')

describe('Portfolio summary (unit)', () => {
  let svc: PortfolioService
  let query: jest.Mock
  let transaction: jest.Mock
  let row: {
    totalAtomic: string; changeAtomic: string; hasIncome: boolean
    since: Date; asOf: Date
  }

  beforeEach(async () => {
    row = {
      totalAtomic: '100000000', changeAtomic: '0', hasIncome: true,
      since: SINCE, asOf: AS_OF,
    }
    query = jest.fn(async (sql: string) => sql === 'SET TRANSACTION READ ONLY' ? [] : [row])
    transaction = jest.fn(async (_isolation: string, work: (tx: unknown) => unknown) => work({ query }))
    const module = await Test.createTestingModule({ providers: [
      PortfolioService,
      { provide: getRepositoryToken(PositionSnapshot), useValue: { manager: { transaction } } },
      { provide: getRepositoryToken(Redemption), useValue: {} },
      { provide: LedgerService, useValue: {} },
      { provide: CatalogService, useValue: {} },
    ] }).compile()
    svc = module.get(PortfolioService)
  })

  it('returns null only when no income exists', async () => {
    row.hasIncome = false
    expect(await svc.summary(USER)).toEqual({
      currency: 'USDT', decimals: 6, totalAtomic: '100000000', today: null, asOf: AS_OF.toISOString(),
    })
  })

  it.each([
    ['100310000', '310000', '0.31'],
    ['99690000', '-310000', '-0.31'],
    ['100000000', '0', '0.00'],
    ['100005000', '5000', '0.01'],
    ['99995000', '-5000', '-0.01'],
    ['99999999', '-1', '0.00'],
    ['50000000', '50000000', null],
    ['0', '1', null],
    ['0', '0', null],
    ['153820000', '3820000', '2.55'],
    ['100310000000000000000000001', '310000000000000000000001', '0.31'],
  ])('calculates signed income %s / %s with percentage %s', async (total, change, pct) => {
    row.totalAtomic = total
    row.changeAtomic = change
    expect((await svc.summary(USER)).today).toEqual({
      changeAtomic: change, changePct: pct, since: SINCE.toISOString(), basis: 'ledger',
    })
  })

  it('propagates database errors instead of reporting a fabricated zero', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(svc.summary(USER)).rejects.toThrow('database unavailable')
  })

  it('reads everything in one read-only REPEATABLE READ transaction scoped to the actor', async () => {
    await svc.summary(USER)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))
    expect(query.mock.calls).toEqual([
      ['SET TRANSACTION READ ONLY'], [PORTFOLIO_SUMMARY_SQL, [USER]],
    ])
  })

  it('exposes summary under the existing session guard and uses the authenticated user', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PortfolioController)).toContain(SessionAuthGuard)
    expect(Reflect.getMetadata(PATH_METADATA, PortfolioController.prototype.summary)).toBe('summary')
    const controller = new PortfolioController(svc, {} as RebalanceService)
    const summary = jest.spyOn(svc, 'summary')
    await controller.summary({ userId: USER } as Parameters<PortfolioController['summary']>[0])
    expect(summary).toHaveBeenCalledWith(USER)
  })
})
