import { MarketCacheService } from '../../src/market-context/market-cache.service'
import { MarketContextService } from '../../src/market-context/market-context.service'
import { parseOkxSpark } from '../../src/market-context/providers/okx.provider'
import { parseYahooSpark, YahooProvider } from '../../src/market-context/providers/yahoo.provider'
import type { MarketQuote } from '../../src/market-context/market-context.types'

const quote = (symbol: string): MarketQuote => ({
  symbol, name: symbol, value: 1, unit: 'index', change: 0, changePct: 0, changePeriod: '1d', source: 'test', asOf: null,
  receivedAt: '', marketStatus: 'open', stale: false, quoteId: symbol, assetClass: 'index', disclaimer: '',
})

describe('spark parsing', () => {
  it('yahoo: keeps the last 7 valid closes, oldest first', () => {
    const close = [1, null, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(parseYahooSpark({ chart: { result: [{ indicators: { quote: [{ close }] } }] } })).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(parseYahooSpark({ chart: { result: [{ indicators: { quote: [{ close: [1] }] } }] } })).toBeNull()
  })
  it('okx: newest-first candles become oldest-first closes', () => {
    const data = [['3000', '0', '0', '0', '30'], ['1000', '0', '0', '0', '10'], ['2000', '0', '0', '0', '20']]
    expect(parseOkxSpark({ code: '0', data })).toEqual([10, 20, 30])
    expect(parseOkxSpark({ code: '50011', data })).toBeNull()
  })
})

describe('market context spark', () => {
  function build(spark: (s: string) => Promise<number[] | null>) {
    const yahoo = { fetchQuote: jest.fn(async (spec: { symbol: string }) => quote(spec.symbol)), fetchSpark: jest.fn(spark) }
    const okx = { fetchQuotes: jest.fn(async () => ({ quotes: [quote('BTC')], usdt: null })), fetchSpark: jest.fn(spark) }
    const empty = { fetchQuotes: jest.fn(async () => []), fetchTvl: jest.fn(async () => null), fetchStablecoinSupply: jest.fn(async () => null) }
    const service = new MarketContextService(new MarketCacheService(), yahoo as unknown as YahooProvider, empty as never, okx as never, empty as never, empty as never)
    return { service, yahoo, okx }
  }

  it('attaches spark and caches it (one history fetch per symbol)', async () => {
    const { service, yahoo, okx } = build(async () => [1, 2, 3])
    const first = await service.getContext()
    expect(first.anchors[0].spark).toEqual([1, 2, 3])
    expect(first.sections.crypto[0].spark).toEqual([1, 2, 3])
    const calls = yahoo.fetchSpark.mock.calls.length + okx.fetchSpark.mock.calls.length
    await service.getContext()
    expect(yahoo.fetchSpark.mock.calls.length + okx.fetchSpark.mock.calls.length).toBe(calls)
  })

  it('history failure: spark null, quotes still returned', async () => {
    const { service } = build(async () => { throw new Error('down') })
    const res = await service.getContext()
    expect(res.anchors.length).toBeGreaterThan(0)
    expect(res.anchors.every((q) => q.spark === null)).toBe(true)
  })

  it('slow history never holds the quote longer than 1.5s', async () => {
    const { service } = build(() => new Promise(() => undefined))
    const started = Date.now()
    const res = await service.getContext()
    expect(Date.now() - started).toBeLessThan(2_500)
    expect(res.anchors[0].spark).toBeNull()
  })
})
