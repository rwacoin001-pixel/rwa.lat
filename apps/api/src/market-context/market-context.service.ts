import { Injectable, Logger } from '@nestjs/common'
import { MarketCacheService } from './market-cache.service'
import { YahooProvider, YAHOO_SYMBOLS } from './providers/yahoo.provider'
import { FrankfurterProvider } from './providers/frankfurter.provider'
import { CoinGeckoProvider } from './providers/coingecko.provider'
import { DefiLlamaProvider } from './providers/defillama.provider'
import { OkxProvider } from './providers/okx.provider'
import type { MarketContextResponse, MarketQuote, OnchainMetric, UsdtPegStatus } from './market-context.types'

/**
 * Market Context 编排服务
 *
 * 分级 TTL（裁定）：
 * - Yahoo：开盘 60s 刷新；宽限期 15 分钟（闭市后旧值可用）
 * - CoinGecko：45s；宽限 5 分钟
 * - Frankfurter：6h（日频）；宽限 24h
 * - DefiLlama：10 分钟；宽限 1 小时
 */
@Injectable()
export class MarketContextService {
  private readonly log = new Logger(MarketContextService.name)

  constructor(
    private readonly cache: MarketCacheService,
    private readonly yahoo: YahooProvider,
    private readonly frankfurter: FrankfurterProvider,
    private readonly okx: OkxProvider,
    private readonly coingecko: CoinGeckoProvider,
    private readonly defillama: DefiLlamaProvider,
  ) {}

  async getContext(): Promise<MarketContextResponse> {
    const receivedAt = new Date().toISOString()
    const degradedReasons: string[] = []

    // ---- Yahoo 锚点 + TradFi（一次批量抓取，缓存到同一 key）----
    const yahooRead = await this.cache.getOrFetch<MarketQuote[]>(
      'yahoo:all',
      60_000,
      15 * 60_000,
      async () => {
        const results = await Promise.all(
          YAHOO_SYMBOLS.map((spec) => this.yahoo.fetchQuote(spec, new Date().toISOString())),
        )
        const quotes = results.filter((q): q is MarketQuote => q !== null)
        return quotes.length > 0 ? quotes : null
      },
    )
    const yahooQuotes = yahooRead.value ?? []
    if (yahooRead.stale && yahooQuotes.length === 0) degradedReasons.push('Yahoo 行情暂不可用')
    const bySymbol = new Map(yahooQuotes.map((q) => [q.symbol, q]))
    const anchorSymbols = YAHOO_SYMBOLS.filter((s) => s.group === 'anchor').map((s) => s.symbol)
    const tradfiSymbols = YAHOO_SYMBOLS.filter((s) => s.group === 'tradfi').map((s) => s.symbol)

    const anchors = anchorSymbols.map((s) => bySymbol.get(s)).filter((q): q is MarketQuote => q !== undefined)
    const tradfi = tradfiSymbols.map((s) => bySymbol.get(s)).filter((q): q is MarketQuote => q !== undefined)

    // 第二行：黄金（从 anchors 复用）+ BTC/ETH（下面 crypto）
    const gold = bySymbol.get('GC=F')

    // ---- OKX 主源（BTC/ETH + USDT 锚定）；失败才回落 CoinGecko ----
    // 背景：CoinGecko 匿名接口按 IP 限流，实测间歇性返回 429 → crypto 为空 → degraded。
    // OKX 公开接口无需 key 且限额宽松，故升为主源；CoinGecko 保留为兜底，两者都免费。
    // TTL 维持 45s/宽限 5min 不变（主源无速率压力，行情应尽量新鲜）。
    const cgRead = await this.cache.getOrFetch<{ quotes: MarketQuote[]; usdt: UsdtPegStatus | null; source: string }>(
      'crypto:quotes',
      45_000,
      5 * 60_000,
      async () => {
        const received = new Date().toISOString()
        const okxRead = await this.okx.fetchQuotes(received)
        if (okxRead.quotes.length > 0) return { ...okxRead, source: 'OKX' }
        this.log.warn('OKX 未返回加密货币行情，回落 CoinGecko')
        const cgFallback = await this.coingecko.fetchQuotes(received)
        return cgFallback.quotes.length > 0 ? { ...cgFallback, source: 'CoinGecko' } : null
      },
    )
    const crypto = cgRead.value?.quotes ?? []
    const usdtPeg = cgRead.value?.usdt ?? null
    if (crypto.length === 0) degradedReasons.push('加密货币行情暂不可用')

    const secondary = [gold, ...crypto].filter((q): q is MarketQuote => q !== undefined && q !== null)

    // ---- Frankfurter（FX）----
    const fxRead = await this.cache.getOrFetch<MarketQuote[]>(
      'frankfurter:fx',
      6 * 3_600_000,
      24 * 3_600_000,
      async () => {
        const quotes = await this.frankfurter.fetchQuotes(new Date().toISOString())
        return quotes.length > 0 ? quotes : null
      },
    )
    const fx = fxRead.value ?? []
    if (fx.length === 0) degradedReasons.push('ECB 汇率暂不可用')

    // ---- DefiLlama（TVL + 稳定币）----
    const llamaRead = await this.cache.getOrFetch<OnchainMetric[]>(
      'defillama:onchain',
      10 * 60_000,
      60 * 60_000,
      async () => {
        const [tvl, stable] = await Promise.all([
          this.defillama.fetchTvl(new Date().toISOString()),
          this.defillama.fetchStablecoinSupply(new Date().toISOString()),
        ])
        const metrics = [tvl, stable].filter((m): m is OnchainMetric => m !== null)
        return metrics.length > 0 ? metrics : null
      },
    )
    const onchain = llamaRead.value ?? []
    if (onchain.length === 0) degradedReasons.push('链上数据暂不可用')

    // ---- 7 天走势（首页小走势线）：1 小时一次，宽限 24 小时。最多等 1.5 秒，取不到就是 null，绝不拖慢或拖垮报价 ----
    const sparks = await this.readSparks([...anchors, ...tradfi].map((q) => q.symbol), crypto.map((q) => q.symbol))
    const withSpark = (quotes: MarketQuote[]): MarketQuote[] => quotes.map((q) => ({ ...q, spark: sparks[q.symbol] ?? null }))

    // 过期标记：缓存层返回 stale 时，把过期的行情标出来
    const markStale = (quotes: MarketQuote[]): MarketQuote[] =>
      withSpark(yahooRead.stale ? quotes.map((q) => ({ ...q, stale: true })) : quotes)

    return {
      anchors: markStale(anchors),
      secondary: markStale(secondary),
      sections: {
        tradfi: markStale(tradfi),
        fx,
        crypto: withSpark(crypto),
        onchain,
      },
      usdtPeg,
      serverTime: new Date().toISOString(),
      degraded: degradedReasons.length > 0,
      degradedReasons,
    }
  }

  private async readSparks(yahooSymbols: string[], cryptoSymbols: string[]): Promise<Record<string, number[]>> {
    const read = this.cache
      .getOrFetch<Record<string, number[]>>('spark:7d', 3_600_000, 24 * 3_600_000, async () => {
        const entries = await Promise.all([
          ...yahooSymbols.map(async (s) => [s, await this.yahoo.fetchSpark(s)] as const),
          ...cryptoSymbols.map(async (s) => [s, await this.okx.fetchSpark(s)] as const),
        ])
        const found = entries.filter((e): e is readonly [string, number[]] => Array.isArray(e[1]))
        return found.length > 0 ? Object.fromEntries(found) : null
      })
      .then((r) => r.value ?? {})
      .catch(() => ({}))
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<Record<string, number[]>>((resolve) => {
      timer = setTimeout(() => resolve({}), 1_500)
    })
    try {
      return await Promise.race([read, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
}
