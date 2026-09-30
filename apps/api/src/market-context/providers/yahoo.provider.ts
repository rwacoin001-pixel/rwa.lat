import { Injectable, Logger } from '@nestjs/common'
import type { MarketQuote, MarketStatus } from '../market-context.types'

/**
 * Yahoo Finance 适配器（非官方接口）
 *
 * 裁定要点：
 * - 数据统一标注 "reference · delayed / 非执行报价"，禁止写 "实时"
 * - 失败保留最后成功值由上层缓存层处理；本层只负责抓取与标准化
 * - 使用 chart API：GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
 */

interface YahooChartMeta {
  symbol?: string
  regularMarketPrice?: number
  previousClose?: number
  chartPreviousClose?: number
  regularMarketTime?: number
  marketState?: string
  currency?: string
  exchangeName?: string
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{ meta?: YahooChartMeta }>
    error?: { code?: string; description?: string } | null
  }
}

/** 本模块监控的 Yahoo 符号与展示元数据 */
export const YAHOO_SYMBOLS: Array<{
  symbol: string
  name: string
  unit: string
  assetClass: MarketQuote['assetClass']
  group: 'anchor' | 'secondary' | 'tradfi'
}> = [
  { symbol: '^TNX', name: '美国10年期国债收益率', unit: 'yield%', assetClass: 'rates', group: 'anchor' },
  { symbol: 'DX-Y.NYB', name: '美元指数', unit: 'index', assetClass: 'fx', group: 'anchor' },
  { symbol: 'GC=F', name: '黄金期货', unit: 'USD/oz', assetClass: 'commodity', group: 'anchor' },
  { symbol: '^GSPC', name: '标普500', unit: 'index', assetClass: 'index', group: 'anchor' },
  { symbol: '^VIX', name: 'VIX 恐慌指数', unit: 'index', assetClass: 'volatility', group: 'tradfi' },
  { symbol: '^IXIC', name: '纳斯达克综合', unit: 'index', assetClass: 'index', group: 'tradfi' },
  { symbol: 'CL=F', name: 'WTI 原油', unit: 'USD/bbl', assetClass: 'commodity', group: 'tradfi' },
  { symbol: 'SI=F', name: '白银期货', unit: 'USD/oz', assetClass: 'commodity', group: 'tradfi' },
]

const DISCLAIMER = 'Yahoo Finance reference · delayed / 非执行报价'

function classifyMarketState(rawMarketTime: number | undefined): MarketStatus {
  // 该端点的 meta 不返回 marketState；用行情时间与当前时间的差推断
  if (!rawMarketTime || !Number.isFinite(rawMarketTime)) return 'unknown'
  const ageMs = Date.now() - rawMarketTime * 1000
  if (ageMs < 0) return 'unknown'
  if (ageMs <= 20 * 60_000) return 'open'
  return 'closed'
}

@Injectable()
export class YahooProvider {
  private readonly log = new Logger(YahooProvider.name)
  private readonly baseUrl = (process.env.MARKET_YAHOO_BASE_URL ?? 'https://query1.finance.yahoo.com').replace(/\/+$/, '')
  private readonly timeoutMs = 8_000

  /** 抓取单个符号。失败返回 null（由上层决定保留旧值或降级） */
  async fetchQuote(spec: (typeof YAHOO_SYMBOLS)[number], receivedAt: string): Promise<MarketQuote | null> {
    const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(spec.symbol)}?interval=1d&range=2d`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Yahoo 对无 UA 的请求可能 429；带浏览器化 UA 提升稳定性
          'User-Agent': 'Mozilla/5.0 (compatible; RwaLat-MarketContext/1.0)',
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        this.log.warn(`Yahoo ${spec.symbol} HTTP ${res.status}`)
        return null
      }
      const body = (await res.json()) as YahooChartResponse
      const meta = body.chart?.result?.[0]?.meta
      if (!meta || meta.regularMarketPrice === undefined || meta.regularMarketPrice === null) {
        this.log.warn(`Yahoo ${spec.symbol} 无可用价格`)
        return null
      }
      const value = Number(meta.regularMarketPrice)
      if (!Number.isFinite(value)) return null
      const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? NaN)
      const change = Number.isFinite(prev) && prev !== 0 ? value - prev : null
      const changePct = change !== null && prev !== 0 ? (change / prev) * 100 : null
      const asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
      const quoteId = this.quoteId(spec.symbol, asOf, 'yahoo')
      return {
        symbol: spec.symbol,
        name: spec.name,
        value,
        unit: spec.unit,
        change: change === null ? null : Number(change.toFixed(4)),
        changePct: changePct === null ? null : Number(changePct.toFixed(4)),
        changePeriod: '1d',
        source: 'Yahoo Finance',
        asOf,
        receivedAt,
        marketStatus: classifyMarketState(meta.regularMarketTime),
        stale: false,
        quoteId,
        assetClass: spec.assetClass,
        disclaimer: DISCLAIMER,
      }
    } catch (err) {
      this.log.warn(`Yahoo ${spec.symbol} 抓取失败: ${(err as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private quoteId(symbol: string, asOf: string | null, source: string): string {
    const raw = `${symbol}|${asOf ?? 'na'}|${source}`
    let h = 0
    for (let i = 0; i < raw.length; i += 1) {
      h = (h * 31 + raw.charCodeAt(i)) | 0
    }
    return `q_${Math.abs(h).toString(36)}`
  }
}
