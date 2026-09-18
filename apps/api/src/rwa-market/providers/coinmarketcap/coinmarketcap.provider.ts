import { Injectable } from '@nestjs/common'
import { normalizeCmcAsset, normalizeCmcIssuer, normalizeCmcMetrics } from '../../normalizers/rwa.normalizer'
import { CoinMarketCapClient } from './coinmarketcap.client'
import type {
  CmcIssuerListResponse,
  CmcRwaAssetListItem,
  CmcRwaIdEntry,
  CmcRwaInfoEntry,
  CmcRwaListResponse,
} from './coinmarketcap.types'
import type {
  NormalizedIssuer,
  NormalizedMarketMetric,
  NormalizedRwaAsset,
  ProviderHealth,
  RwaDataProvider,
  SyncAssetsOptions,
  SyncIssuersOptions,
} from '../rwa-data-provider'

const PAGE_LIMIT = 100
const MAX_PAGES = 300 // 保护上限：300 × 100 = 30000 条

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/**
 * CoinMarketCap RWA Provider（实测校准 2026-09-18）：
 * - assets/list: 分页 start(≥1)/limit(≤100)；单页 1 credit/250 条；含聚合行情
 * - map: 轻量 ID 映射（0 credits）
 * - info: 元数据 + About 描述（Basic+）
 * - issuers/list: 全量发行商（当前 25 家，1 credit/次）
 * - market-pairs/list: Basic 套餐不支持（1006）→ 本 Provider 不接入，留待后续套餐/Provider
 * - quotes/latest: 按 rwa_id 定向刷新（含 tokens 明细）
 */
@Injectable()
export class CoinMarketCapRwaProvider implements RwaDataProvider {
  readonly providerName = 'coinmarketcap'

  constructor(private readonly client: CoinMarketCapClient) {}

  async syncAssets(options: SyncAssetsOptions = {}): Promise<NormalizedRwaAsset[]> {
    return this.pageAssets(options, (item) => normalizeCmcAsset(item))
  }

  async syncMetrics(options: SyncAssetsOptions = {}): Promise<NormalizedMarketMetric[]> {
    return this.pageAssets(options, (item) => normalizeCmcMetrics(item))
  }

  async syncIssuers(options: SyncIssuersOptions = {}): Promise<NormalizedIssuer[]> {
    const limit = clamp(options.maxItems ?? 200, 1, 200)
    const data = await this.client.get<CmcIssuerListResponse>('/v5/real-world-assets/issuers/list', { limit })
    return (data.issuers ?? []).map(normalizeCmcIssuer)
  }

  async getAsset(externalId: string): Promise<NormalizedRwaAsset | null> {
    const map = await this.client.get<{ rwa_assets: CmcRwaIdEntry[] }>('/v5/real-world-assets/map', { rwa_id: externalId })
    const entry = (map.rwa_assets ?? [])[0]
    if (!entry) return null
    let info: CmcRwaInfoEntry | null = null
    try {
      const detail = await this.client.get<{ rwa_assets: CmcRwaInfoEntry[] }>('/v5/real-world-assets/info', { rwa_id: externalId })
      info = (detail.rwa_assets ?? [])[0] ?? null
    } catch {
      info = null // 详情失败不阻塞基础信息返回
    }
    return normalizeCmcAsset(entry as unknown as CmcRwaAssetListItem, info)
  }

  async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = new Date()
    const started = Date.now()
    try {
      await this.client.get<{ rwa_assets: unknown[] }>('/v5/real-world-assets/map', { limit: 1 })
      return { provider: this.providerName, ok: true, checkedAt, latencyMs: Date.now() - started }
    } catch (error) {
      return { provider: this.providerName, ok: false, checkedAt, latencyMs: Date.now() - started, error: (error as Error).message }
    }
  }

  private async pageAssets<T>(options: SyncAssetsOptions, map: (item: CmcRwaAssetListItem) => T): Promise<T[]> {
    const limit = clamp(options.limit ?? PAGE_LIMIT, 1, PAGE_LIMIT)
    const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY
    const out: T[] = []
    let start = options.start && options.start >= 1 ? options.start : 1
    for (let page = 0; page < MAX_PAGES && out.length < maxItems; page += 1) {
      const data = await this.client.get<CmcRwaListResponse>('/v5/real-world-assets/assets/list', { start, limit })
      const items = data.rwa_assets ?? []
      for (const item of items) {
        if (out.length >= maxItems) break
        out.push(map(item))
      }
      if (!data.has_more || items.length === 0) break
      start += items.length
    }
    return out
  }
}
