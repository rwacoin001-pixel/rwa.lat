import { Injectable, Logger } from '@nestjs/common'
import type { MarketQuote } from '../market-context.types'

/**
 * Frankfurter 适配器 — ECB 官方参考汇率（日频数据）
 *
 * 裁定要点：
 * - 明确标注 "ECB 参考汇率"，必须显示 ECB 数据日期
 * - 不使用分钟级闪动（日频数据）
 * - GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,EUR,AED,SGD
 */

interface FrankfurterResponse {
  amount?: number
  base?: string
  date?: string
  rates?: Record<string, number>
}

const DISCLAIMER = 'Frankfurter (ECB) · 日频参考汇率 · 非执行报价'

/** 裁定指定币对：USD/CNY、USD/EUR、USD/AED、USD/SGD */
export const FRANKFURTER_SYMBOLS = ['CNY', 'EUR', 'AED', 'SGD'] as const

const FX_NAMES: Record<string, string> = {
  CNY: '美元/人民币',
  EUR: '美元/欧元',
  AED: '美元/迪拉姆',
  SGD: '美元/新加坡元',
}

@Injectable()
export class FrankfurterProvider {
  private readonly log = new Logger(FrankfurterProvider.name)
  private readonly baseUrl = (process.env.MARKET_FRANKFURTER_BASE_URL ?? 'https://api.frankfurter.dev').replace(/\/+$/, '')
  private readonly timeoutMs = 8_000

  async fetchQuotes(receivedAt: string): Promise<MarketQuote[]> {
    const url = `${this.baseUrl}/v1/latest?base=USD&symbols=${FRANKFURTER_SYMBOLS.join(',')}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) {
        this.log.warn(`Frankfurter HTTP ${res.status}`)
        return []
      }
      const body = (await res.json()) as FrankfurterResponse
      const rates = body.rates ?? {}
      const date = body.date ?? null
      const asOf = date ? `${date}T00:00:00.000Z` : null
      const quotes: MarketQuote[] = []
      for (const code of FRANKFURTER_SYMBOLS) {
        const rate = rates[code]
        if (typeof rate !== 'number' || !Number.isFinite(rate)) continue
        quotes.push({
          symbol: `USD/${code}`,
          name: FX_NAMES[code] ?? `USD/${code}`,
          value: Number(rate.toFixed(4)),
          unit: code,
          change: null, // 日频参考汇率：不提供日内变动，避免误导
          changePct: null,
          changePeriod: '1d',
          source: 'Frankfurter (ECB)',
          asOf,
          receivedAt,
          marketStatus: 'closed',
          stale: false,
          quoteId: `fx_${code.toLowerCase()}_${date ?? 'na'}`,
          assetClass: 'fx',
          disclaimer: DISCLAIMER,
        })
      }
      return quotes
    } catch (err) {
      this.log.warn(`Frankfurter 抓取失败: ${(err as Error).message}`)
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}
