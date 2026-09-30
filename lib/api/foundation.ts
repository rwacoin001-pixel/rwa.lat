import { request, type ApiResult } from './_http'
export type MarketOverview = { assetCount: number; totalMarketCapUsd: string | null; latestDataTimestamp: string | null; categoryDistribution: { assetClass: string; assetCount: number; totalMarketCapUsd: string | null }[] }
export type AssetRow = { slug: string; name: string; assetClass: string; priceUsd: string | null; apy: string | null; score: number | null }
export type AssetHistory = { slug: string; days: number; points: { date: string; priceUsd: string | null; marketCapUsd: string | null; tvlUsd?: string | null; volumeUsd: string | null }[] }
export type AssetDetail = Omit<AssetRow, 'score'> & { score: { overallScore: string | null; yieldScore: string | null; liquidityScore: string | null; issuerScore: string | null; collateralScore: string | null; redemptionScore: string | null; contractRiskScore: string | null; concentrationScore: string | null; marketRiskScore: string | null; dataQualityScore: string | null } | null }
export function mapOverview(dto: MarketOverview): MarketOverview {
  return { assetCount: dto.assetCount, totalMarketCapUsd: dto.totalMarketCapUsd ?? null, latestDataTimestamp: dto.latestDataTimestamp ?? null,
    categoryDistribution: dto.categoryDistribution.map(item => ({ assetClass: item.assetClass, assetCount: item.assetCount, totalMarketCapUsd: item.totalMarketCapUsd ?? null })) }
}
export async function getOverview(): Promise<ApiResult<MarketOverview>> {
  const result = await request<MarketOverview>('/v1/rwa/overview')
  return result.ok ? { ok: true, data: mapOverview(result.data) } : result
}
export const getAssetList = () => request<{ items: AssetRow[]; total: number }>('/v1/rwa/assets?limit=100')
export const getAssetDetail = (slug: string) => request<AssetDetail>(`/v1/rwa/assets/${encodeURIComponent(slug)}`)
export const getAssetHistory = (slug: string, days: number) => request<AssetHistory>(`/v1/rwa/assets/${encodeURIComponent(slug)}/history?days=${days}`)
