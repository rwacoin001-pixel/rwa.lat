import { CmcProviderError, CoinMarketCapClient } from '../../src/rwa-market/providers/coinmarketcap/coinmarketcap.client'
import { CoinMarketCapRwaProvider } from '../../src/rwa-market/providers/coinmarketcap/coinmarketcap.provider'

type Canned = Record<string, unknown>

/** 记录调用参数、按页码返回预置数据 / 抛错的桩客户端 */
class StubClient {
  calls: Array<{ path: string; params: Record<string, unknown> }> = []

  constructor(private readonly handler: (path: string, params: Record<string, unknown>) => unknown) {}

  async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ path, params })
    const result = this.handler(path, params)
    if (result instanceof Error) throw result
    return result as T
  }
}

function makeProvider(handler: (path: string, params: Record<string, unknown>) => unknown) {
  const stub = new StubClient(handler)
  const provider = new CoinMarketCapRwaProvider(stub as unknown as CoinMarketCapClient)
  return { stub, provider }
}

function listItem(id: number, name: string) {
  return {
    name,
    symbol: name.toUpperCase().slice(0, 8),
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    rwa_id: id,
    asset_type: 'commodity',
    rwa_rank: id,
    has_tokens: true,
    average_tokenized_price: 10 + id,
    tokenized_market_cap: 1000 + id,
    tokenized_volume_24h: 100 + id,
    last_updated: '2026-09-18T08:00:00.000Z',
  }
}

describe('coinmarketcap provider', () => {
  it('paginates assets until has_more is false', async () => {
    const page1 = { total_size: 105, has_more: true, rwa_assets: [listItem(1, 'Gold'), listItem(2, 'Silver'), listItem(3, 'Oil')] }
    const page2 = { total_size: 105, has_more: false, rwa_assets: [listItem(4, 'Copper'), listItem(5, 'Wheat')] }
    const { stub, provider } = makeProvider((path, params) => {
      if (path.endsWith('/assets/list')) return Number(params.start) === 1 ? page1 : page2
      throw new Error('unexpected path ' + path)
    })

    const assets = await provider.syncAssets({ limit: 3 })
    expect(assets).toHaveLength(5)
    expect(assets.map((a) => a.externalId)).toEqual(['1', '2', '3', '4', '5'])
    expect(stub.calls.map((c) => c.params.start)).toEqual([1, 4])
  })

  it('respects maxItems and does not overshoot', async () => {
    const page = { total_size: 100, has_more: true, rwa_assets: [listItem(1, 'Gold'), listItem(2, 'Silver'), listItem(3, 'Oil')] }
    const { provider } = makeProvider(() => page)
    const assets = await provider.syncAssets({ limit: 3, maxItems: 2 })
    expect(assets.map((a) => a.externalId)).toEqual(['1', '2'])
  })

  it('propagates provider errors (e.g. plan restriction) as CmcProviderError', async () => {
    const { provider } = makeProvider(() => new CmcProviderError('plan', 403, '1006', 'plan does not support endpoint'))
    await expect(provider.syncAssets({ limit: 3 })).rejects.toMatchObject({ name: 'CmcProviderError', kind: 'plan', code: '1006' })
  })

  it('maps issuers list', async () => {
    const { provider } = makeProvider((path) => {
      expect(path).toBe('/v5/real-world-assets/issuers/list')
      return { issuers: [{ name: 'Backed Assets', issuer_id: 'abc', num_tokens: 1176 }], total_size: 1, has_more: false }
    })
    const issuers = await provider.syncIssuers()
    expect(issuers[0]).toMatchObject({ externalId: 'abc', slug: 'backed-assets' })
  })

  it('getAsset falls back gracefully when info call fails', async () => {
    const { provider } = makeProvider((path) => {
      if (path.endsWith('/map')) return { rwa_assets: [{ name: 'Gold', slug: 'gold', rwa_id: 1, asset_type: 'commodity', rwa_rank: 1, has_tokens: true }] }
      if (path.endsWith('/info')) throw new CmcProviderError('plan', 403, '1006', 'no info on this plan')
      throw new Error('unexpected ' + path)
    })
    const asset = await provider.getAsset('1')
    expect(asset).toMatchObject({ externalId: '1', name: 'Gold', description: null })
  })

  it('healthCheck reports ok and failure with latency', async () => {
    const ok = makeProvider(() => ({ rwa_assets: [] }))
    const health = await ok.provider.healthCheck()
    expect(health.ok).toBe(true)
    expect(health.provider).toBe('coinmarketcap')
    expect(typeof health.latencyMs).toBe('number')

    const bad = makeProvider(() => new Error('boom'))
    const health2 = await bad.provider.healthCheck()
    expect(health2.ok).toBe(false)
    expect(health2.error).toContain('boom')
  })

  it('metrics pagination reuses the same endpoint with normalized quotes', async () => {
    const { provider } = makeProvider(() => ({ total_size: 3, has_more: false, rwa_assets: [listItem(7, 'Platinum')] }))
    const metrics = await provider.syncMetrics({ limit: 3, maxItems: 10 })
    expect(metrics).toHaveLength(1)
    expect(metrics[0].externalId).toBe('7')
    expect(Number(metrics[0].priceUsd)).toBeCloseTo(17, 6)
  })
})
