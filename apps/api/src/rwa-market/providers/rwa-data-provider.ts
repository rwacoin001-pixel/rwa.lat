import type { RwaAssetClass } from '../rwa-market.entities'

/** Provider 健康检查结果 */
export type ProviderHealth = {
  provider: string
  ok: boolean
  checkedAt: Date
  latencyMs?: number
  error?: string
}

/** 归一化后的 RWA 资产（与 Provider 解耦；Public API 永远不依赖 Provider 原始响应） */
export type NormalizedRwaAsset = {
  externalId: string
  externalSlug: string
  name: string
  symbol: string | null
  assetClass: RwaAssetClass
  rawAssetType: string | null
  description: string | null
  websiteUrl: string | null
  logoUrl: string | null
  rank: number | null
  isTokenized: boolean
}

export type NormalizedIssuer = {
  externalId: string
  name: string
  slug: string
  websiteUrl: string | null
  logoUrl: string | null
  tokenCount: number
}

export type NormalizedTokenRef = {
  symbol: string | null
  name: string | null
  cryptoId: number | null
  issuerExternalId: string | null
  issuerName: string | null
  priceUsd: string | null
}

export type NormalizedMarketMetric = {
  externalId: string
  priceUsd: string | null
  tokenizedMarketCapUsd: string | null
  tokenizedVolume24hUsd: string | null
  dataTimestamp: Date | null
  tokens: NormalizedTokenRef[]
}

export type SyncAssetsOptions = {
  start?: number
  limit?: number
  maxItems?: number
}

export type SyncIssuersOptions = {
  maxItems?: number
}

/** 统一数据源接口（规格 §12）；未来 RwaPipe / DefiLlama / Alchemy 等均通过 Adapter 接入 */
export interface RwaDataProvider {
  readonly providerName: string

  syncAssets(options?: SyncAssetsOptions): Promise<NormalizedRwaAsset[]>

  syncIssuers(options?: SyncIssuersOptions): Promise<NormalizedIssuer[]>

  syncMetrics(options?: SyncAssetsOptions): Promise<NormalizedMarketMetric[]>

  getAsset(externalId: string): Promise<NormalizedRwaAsset | null>

  healthCheck(): Promise<ProviderHealth>
}
