import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { FundsSummaryService } from '../../src/wallet/funds-summary.service'
import type { ManualCustodyAdapter } from '../../src/wallet/manual/manual-custody.adapter'
import type { TronClientService } from '../../src/wallet/manual/tron-client.service'

function service(query: (sql: string) => unknown, options: { mode?: string; hot?: string | null; tron?: Partial<TronClientService> } = {}) {
  return new FundsSummaryService(
    { query: jest.fn(async (sql: string) => query(sql)) } as unknown as DataSource,
    { getHotWalletAddress: () => options.hot ?? null } as unknown as ManualCustodyAdapter,
    (options.tron ?? {}) as TronClientService,
    { get: (key: string) => (key === 'WALLET_CUSTODY_ADAPTER' ? options.mode ?? 'manual' : undefined) } as unknown as ConfigService,
  )
}

describe('FundsSummaryService.series', () => {
  it('walks the end-of-day cash balance back from the current ledger total', async () => {
    const funds = service((sql) => {
      if (sql.includes('generate_series')) {
        return [
          { day: '2026-10-11', dep_atomic: '0', dep_count: 0, wd_atomic: '0', wd_count: 0, delta: '0' },
          { day: '2026-10-12', dep_atomic: '5000000', dep_count: 1, wd_atomic: '0', wd_count: 0, delta: '5000000' },
          { day: '2026-10-13', dep_atomic: '3000000', dep_count: 1, wd_atomic: '1000000', wd_count: 1, delta: '2000000' },
        ]
      }
      if (sql.includes('GROUP BY a.purpose')) return [{ purpose: 'available', atomic: '10000000' }, { purpose: 'locked', atomic: '0' }]
      if (sql.includes('COUNT(DISTINCT')) return [{ funded: 1 }]
      return []
    })
    const series = await funds.series(3)
    expect(series.map((d) => d.cashBalanceAtomic)).toEqual(['3000000', '8000000', '10000000'])
    expect(series[2]).toMatchObject({ netAtomic: '2000000', depositsCount: 1, withdrawalsCount: 1 })
  })
})

describe('FundsSummaryService.summary hot wallet', () => {
  const base = (sql: string) => {
    if (sql.includes('generate_series')) return []
    if (sql.includes('GROUP BY a.purpose')) return []
    if (sql.includes('COUNT(DISTINCT')) return [{ funded: 0 }]
    if (sql.includes('dep_count')) return [{ dep_count: 0, dep_atomic: '0', wd_count: 0, wd_atomic: '0', wd_fee: '0', req_count: 0, req_atomic: '0' }]
    if (sql.includes('deposit_pool_addresses')) return [{ available: 3, current: 1, retired: 0 }]
    return [{ count: 0, atomic: '0' }]
  }

  it('reads and caches the hot wallet balances', async () => {
    const getTrc20Balance = jest.fn().mockResolvedValue(7000000n)
    const getTrxBalance = jest.fn().mockResolvedValue(250000000n)
    const funds = service(base, { hot: 'THOT', tron: { getTrc20Balance, getTrxBalance } })
    const first = await funds.summary(30)
    await funds.summary(30)
    expect(first.hotWallet).toMatchObject({ address: 'THOT', usdtAtomic: '7000000', trxSun: '250000000', error: null })
    expect(getTrc20Balance).toHaveBeenCalledTimes(1)
    expect(first.pool).toEqual({ available: 3, current: 1, retired: 0 })
  })

  it('reports a node failure without failing the whole summary', async () => {
    const funds = service(base, { hot: 'THOT', tron: { getTrc20Balance: jest.fn().mockRejectedValue(new Error('TRON tron provider is rate limited')), getTrxBalance: jest.fn() } })
    const result = await funds.summary(30)
    expect(result.hotWallet).toMatchObject({ address: 'THOT', usdtAtomic: null, error: expect.stringMatching(/rate limited/) })
  })

  it('has no hot wallet outside manual custody and clamps unknown ranges to 30 days', async () => {
    const queries: string[] = []
    const funds = service((sql) => { queries.push(sql); return base(sql) }, { mode: 'stub', hot: 'THOT' })
    const result = await funds.summary(365)
    expect(result.hotWallet.address).toBeNull()
    expect(result.series).toEqual([])
  })
})
