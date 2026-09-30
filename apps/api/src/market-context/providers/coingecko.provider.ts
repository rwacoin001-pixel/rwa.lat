import { Injectable, Logger } from '@nestjs/common'
import type { MarketQuote, UsdtPegStatus } from '../market-context.types'

/**
 * CoinGecko 适配器 — 加密货币聚合参考价
 *
 * 裁定要点：
 * - CoinGecko 为聚合参考；USDT 脱锚状态直接关系入金安全（裁定列为 P0 补充）
 * - 标注聚合延迟；禁止写 "实时"
 * - GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_change=true
 */

interface CoinGeckoSimplePrice {
  [id: string]: {
    usd?: number
    usd_24h_change?: number
  }
}

const DISCLAIMER = 'CoinGecko 聚合 · delayed / 非执行报价'

const CRYPTO_SPECS: Array<{ id: string; symbol: string; name: string; unit: string }> = [
  { id: 'bitcoin', symbol: 'BTC', name: '比特币', unit: 'USD' },
  { id: 'ethereum', symbol: 'ETH', name: '以太坊', unit: 'USD' },
]

@Injectable()
export class CoinGeckoProvider {
  private readonly log = new Logger(CoinGeckoProvider.name)
  private readonly baseUrl = (process.env.MARKET_COINGECKO_BASE_URL ?? 'https://api.coingecko.com').replace(/\/+$/, '')
  private readonly timeoutMs = 8_000

  async fetchQuotes(receivedAt: string): Promise<{ quotes: MarketQuote[]; usdt: UsdtPegStatus | null }> {
    const ids = [...CRYPTO_SPECS.map((s) => s.id), 'tether'].join(',')
    const url = `${this.baseUrl}/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) {
        this.log.warn(`CoinGecko HTTP ${res.status}`)
        return { quotes: [], usdt: null }
      }
      const body = (await res.json()) as CoinGeckoSimplePrice
      const quotes: MarketQuote[] = []
      for (const spec of CRYPTO_SPECS) {
        const entry = body[spec.id]
        if (!entry || typeof entry.usd !== 'number' || !Number.isFinite(entry.usd)) continue
        const value = entry.usd
        const changePct = typeof entry.usd_24h_change === 'number' ? entry.usd_24h_change : null
        quotes.push({
          symbol: spec.symbol,
          name: spec.name,
          value,
          unit: spec.unit,
          change: null,
          changePct: changePct === null ? null : Number(changePct.toFixed(4)),
          changePeriod: '24h',
          source: 'CoinGecko',
          asOf: null, // simple/price 不返回时点，以 receivedAt 为准
          receivedAt,
          marketStatus: 'open',
          stale: false,
          quoteId: `cg_${spec.symbol.toLowerCase()}`,
          assetClass: 'crypto',
          disclaimer: DISCLAIMER,
        })
      }
      const tether = body.tether
      let usdt: UsdtPegStatus | null = null
      if (tether && typeof tether.usd === 'number' && Number.isFinite(tether.usd)) {
        const price = tether.usd
        const deviationBps = Number(((price - 1) * 10_000).toFixed(2))
        const abs = Math.abs(deviationBps)
        const status: UsdtPegStatus['status'] = abs <= 20 ? 'ok' : abs <= 50 ? 'warning' : 'depegged'
        usdt = {
          price,
          deviationBps,
          status,
          source: 'CoinGecko',
          asOf: null,
          note:
            status === 'ok'
              ? 'USDT 锚定正常（偏离 ≤ 20bps）'
              : status === 'warning'
                ? 'USDT 偏离 1 美元，请留意入金滑点'
                : 'USDT 显著脱锚，入金价格可能受损，建议暂缓入金',
        }
      }
      return { quotes, usdt }
    } catch (err) {
      this.log.warn(`CoinGecko 抓取失败: ${(err as Error).message}`)
      return { quotes: [], usdt: null }
    } finally {
      clearTimeout(timer)
    }
  }
}
