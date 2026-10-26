import { Injectable, Logger } from '@nestjs/common'
import type { MarketQuote, UsdtPegStatus } from '../market-context.types'

/**
 * OKX 现货适配器 — 加密货币聚合参考价（CoinGecko 限流后的主源）
 *
 * 裁定要点：
 * - 数据统一标注 "OKX 现货参考 · delayed / 非执行报价"，禁止写 "实时"
 * - 失败保留最后成功值由上层缓存层处理；本层只负责抓取与标准化
 * - 公开接口无需 API key，限额宽松（对照：CoinGecko 匿名接口按 IP 限流会返回 429）
 * - GET https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT
 * - USDT 脱锚状态直接关系入金安全（裁定列为 P0 补充），取 USDT-USD 计价
 */

interface OkxTicker {
  instId?: string
  last?: string
  open24h?: string
  ts?: string
}

interface OkxTickerResponse {
  code?: string
  msg?: string
  data?: OkxTicker[]
}

const DISCLAIMER = 'OKX 现货参考 · delayed / 非执行报价'

const CRYPTO_SPECS: Array<{ instId: string; symbol: string; name: string; unit: string }> = [
  { instId: 'BTC-USDT', symbol: 'BTC', name: '比特币', unit: 'USD' },
  { instId: 'ETH-USDT', symbol: 'ETH', name: '以太坊', unit: 'USD' },
]

/** USDT 对美元（脱锚观测口径） */
const USDT_INST_ID = 'USDT-USD'

@Injectable()
export class OkxProvider {
  private readonly log = new Logger(OkxProvider.name)
  private readonly baseUrl = (process.env.MARKET_OKX_BASE_URL ?? 'https://www.okx.com').replace(/\/+$/, '')
  private readonly timeoutMs = 8_000

  private async fetchTicker(instId: string): Promise<OkxTicker | null> {
    const url = `${this.baseUrl}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) {
        this.log.warn(`OKX HTTP ${res.status} (${instId})`)
        return null
      }
      const body = (await res.json()) as OkxTickerResponse
      if (body.code !== '0' || !Array.isArray(body.data) || body.data.length === 0) {
        this.log.warn(`OKX 非成功响应 (${instId}): code=${body.code} msg=${body.msg}`)
        return null
      }
      const row = body.data[0]
      if (!row || !row.last || !Number.isFinite(Number(row.last))) return null
      return row
    } catch (err) {
      this.log.warn(`OKX 抓取失败 (${instId}): ${(err as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /** BTC / ETH 最近 7 根 UTC 日线收盘价（旧→新）。失败返回 null。 */
  async fetchSpark(symbol: string): Promise<number[] | null> {
    const spec = CRYPTO_SPECS.find((s) => s.symbol === symbol)
    if (!spec) return null
    const url = `${this.baseUrl}/api/v5/market/candles?instId=${encodeURIComponent(spec.instId)}&bar=1Dutc&limit=7`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) {
        this.log.warn(`OKX spark HTTP ${res.status} (${spec.instId})`)
        return null
      }
      return parseOkxSpark((await res.json()) as { code?: string; data?: string[][] })
    } catch (err) {
      this.log.warn(`OKX spark 抓取失败 (${spec.instId}): ${(err as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async fetchQuotes(receivedAt: string): Promise<{ quotes: MarketQuote[]; usdt: UsdtPegStatus | null }> {
    const [cryptoRows, usdtRow] = await Promise.all([
      Promise.all(CRYPTO_SPECS.map((spec) => this.fetchTicker(spec.instId))),
      this.fetchTicker(USDT_INST_ID),
    ])

    const quotes: MarketQuote[] = []
    CRYPTO_SPECS.forEach((spec, index) => {
      const row = cryptoRows[index]
      if (!row?.last) return
      const value = Number(row.last)
      if (!Number.isFinite(value)) return
      const open = row.open24h ? Number(row.open24h) : NaN
      const hasOpen = Number.isFinite(open) && open > 0
      const change = hasOpen ? Number((value - open).toFixed(6)) : null
      const changePct = hasOpen ? Number((((value - open) / open) * 100).toFixed(4)) : null
      const tsMs = row.ts ? Number(row.ts) : NaN
      quotes.push({
        symbol: spec.symbol,
        name: spec.name,
        value,
        unit: spec.unit,
        change,
        changePct,
        changePeriod: '24h',
        source: 'OKX',
        asOf: Number.isFinite(tsMs) ? new Date(tsMs).toISOString() : null,
        receivedAt,
        marketStatus: 'open',
        stale: false,
        quoteId: `okx_${spec.symbol.toLowerCase()}`,
        assetClass: 'crypto',
        disclaimer: DISCLAIMER,
      })
    })

    let usdt: UsdtPegStatus | null = null
    const usdtPrice = usdtRow?.last ? Number(usdtRow.last) : NaN
    if (Number.isFinite(usdtPrice) && usdtPrice > 0) {
      const deviationBps = Number(((usdtPrice - 1) * 10_000).toFixed(2))
      const abs = Math.abs(deviationBps)
      const status: UsdtPegStatus['status'] = abs <= 20 ? 'ok' : abs <= 50 ? 'warning' : 'depegged'
      usdt = {
        price: usdtPrice,
        deviationBps,
        status,
        source: 'OKX',
        asOf: usdtRow?.ts && Number.isFinite(Number(usdtRow.ts)) ? new Date(Number(usdtRow.ts)).toISOString() : null,
        note:
          status === 'ok'
            ? 'USDT 锚定正常（偏离 ≤ 20bps）'
            : status === 'warning'
              ? 'USDT 偏离 1 美元，请留意入金滑点'
              : 'USDT 显著脱锚，入金价格可能受损，建议暂缓入金',
      }
    }

    return { quotes, usdt }
  }
}

/** OKX candles 是新→旧，[ts, o, h, l, c, ...]；转成收盘价旧→新。不足 2 个返回 null。 */
export function parseOkxSpark(body: { code?: string; data?: string[][] }): number[] | null {
  if (body.code !== '0' || !Array.isArray(body.data)) return null
  const closes = body.data
    .filter((row) => Array.isArray(row) && Number.isFinite(Number(row[0])) && Number.isFinite(Number(row[4])))
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map((row) => Number(row[4]))
  return closes.length >= 2 ? closes.slice(-7) : null
}
