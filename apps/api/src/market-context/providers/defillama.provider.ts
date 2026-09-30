import { Injectable, Logger } from '@nestjs/common'
import type { OnchainMetric } from '../market-context.types'

/**
 * DefiLlama 适配器 — 链上指标（TVL + 稳定币供应量）
 *
 * 裁定要点：
 * - 只显示 7 日 / 30 日变化（不做分钟级刷新，5–15 分钟缓存）
 * - 来源标注 DefiLlama
 */

interface LlamaChainTvlPoint {
  date: number
  tvl: number
}

interface StablecoinChartPoint {
  date: string
  totalCirculatingUSD?: Record<string, number>
}

@Injectable()
export class DefiLlamaProvider {
  private readonly log = new Logger(DefiLlamaProvider.name)
  private readonly baseUrl = (process.env.MARKET_DEFILLAMA_BASE_URL ?? 'https://api.llama.fi').replace(/\/+$/, '')
  private readonly stableBaseUrl = (process.env.MARKET_DEFILLAMA_STABLE_BASE_URL ?? 'https://stablecoins.llama.fi').replace(/\/+$/, '')
  private readonly timeoutMs = 10_000

  private async getJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) {
        this.log.warn(`DefiLlama HTTP ${res.status} ${url}`)
        return null
      }
      return (await res.json()) as T
    } catch (err) {
      this.log.warn(`DefiLlama 抓取失败 ${url}: ${(err as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /** 全链 TVL：取历史序列最后一点，并计算 7 日 / 30 日变化 */
  async fetchTvl(receivedAt: string): Promise<OnchainMetric | null> {
    const data = await this.getJson<LlamaChainTvlPoint[]>(`${this.baseUrl}/v2/historicalChainTvl`)
    if (!Array.isArray(data) || data.length < 2) return null
    const latest = data[data.length - 1]
    const findAgo = (days: number): number | null => {
      const targetTs = latest.date - days * 86_400
      let best: LlamaChainTvlPoint | null = null
      for (const point of data) {
        if (point.date <= targetTs) best = point
        else break
      }
      return best ? best.tvl : null
    }
    const tvl7 = findAgo(7)
    const tvl30 = findAgo(30)
    return {
      symbol: 'DEFI_TVL',
      name: '全链 DeFi TVL',
      value: Number(latest.tvl.toFixed(0)),
      unit: 'USD',
      change7d: tvl7 !== null && tvl7 !== 0 ? Number((((latest.tvl - tvl7) / tvl7) * 100).toFixed(2)) : null,
      change30d: tvl30 !== null && tvl30 !== 0 ? Number((((latest.tvl - tvl30) / tvl30) * 100).toFixed(2)) : null,
      source: 'DefiLlama',
      asOf: new Date(latest.date * 1000).toISOString(),
      stale: false,
    }
  }

  /** 稳定币总供应量（裁定：贴 RWA 叙事 + 入金安全） */
  async fetchStablecoinSupply(receivedAt: string): Promise<OnchainMetric | null> {
    const data = await this.getJson<StablecoinChartPoint[]>(`${this.stableBaseUrl}/stablecoincharts/all`)
    if (!Array.isArray(data) || data.length < 2) return null
    const latest = data[data.length - 1]
    const totalUsd = latest.totalCirculatingUSD?.peggedUSD
    if (typeof totalUsd !== 'number' || !Number.isFinite(totalUsd)) return null
    // 注意：该端点 date 为 unix 秒（字符串形式），不是 YYYY-MM-DD
    const latestTs = Number(latest.date)
    if (!Number.isFinite(latestTs)) return null
    const findAgo = (days: number): number | null => {
      const targetTs = latestTs - days * 86_400
      for (let i = data.length - 1; i >= 0; i -= 1) {
        const ts = Number(data[i].date)
        if (Number.isFinite(ts) && ts <= targetTs) return data[i].totalCirculatingUSD?.peggedUSD ?? null
      }
      return null
    }
    const v7 = findAgo(7)
    const v30 = findAgo(30)
    return {
      symbol: 'STABLE_SUPPLY',
      name: '稳定币总供应量',
      value: Number(totalUsd.toFixed(0)),
      unit: 'USD',
      change7d: v7 !== null && v7 !== 0 ? Number((((totalUsd - v7) / v7) * 100).toFixed(2)) : null,
      change30d: v30 !== null && v30 !== 0 ? Number((((totalUsd - v30) / v30) * 100).toFixed(2)) : null,
      source: 'DefiLlama Stablecoins',
      asOf: new Date(latestTs * 1000).toISOString(),
      stale: false,
    }
  }
}
