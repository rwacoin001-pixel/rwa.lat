/**
 * Data contracts for the P0-A screens.
 *
 * These helpers deliberately keep the API response close to the wire format. A
 * screen can then distinguish an unavailable value from a real zero instead of
 * filling the UI with demo numbers.
 */
import { apiClient } from './api-client'

export type MarketQuote = {
  symbol: string
  name: string
  value: number | null
  unit: string
  change: number | null
  changePct: number | null
  changePeriod: string
  source: string
  asOf: string | null
  receivedAt: string
  marketStatus: string
  stale: boolean
  quoteId: string
  assetClass: string
  disclaimer: string
  /** Last 7 daily closes, oldest first; null when the history isn't available. */
  spark?: number[] | null
}

export type MarketContext = {
  anchors: MarketQuote[]
  secondary: MarketQuote[]
  sections?: {
    tradfi?: MarketQuote[]
    fx?: MarketQuote[]
    crypto?: MarketQuote[]
    onchain?: Array<Record<string, unknown>>
  }
  usdtPeg?: { price: number | null; deviationBps: number | null; status: string; source: string; asOf: string | null; note: string } | null
  serverTime: string
  degraded: boolean
  degradedReasons: string[]
}

export type AssetHistoryPoint = {
  date: string
  priceUsd: number | string | null
  marketCapUsd: number | string | null
  tvlUsd?: number | string | null
  volumeUsd?: number | string | null
}

export type AssetHistory = {
  slug: string
  days: number
  points: AssetHistoryPoint[]
}

export type RwaIssuerAsset = {
  slug?: string
  name?: string
  symbol?: string | null
  assetClass?: string | null
  marketCapUsd?: number | string | null
  priceUsd?: number | string | null
  change30dPct?: number | string | null
  websiteUrl?: string | null
  isTokenized?: boolean
}

export type RwaIssuerProfile = {
  slug: string
  name: string
  logoUrl?: string | null
  websiteUrl?: string | null
  tokenCount?: number | null
  verified?: boolean
  description?: string | null
  totalMarketCapUsd?: number | string | null
  assetCount?: number | null
  assets: RwaIssuerAsset[]
}

export async function getMarketContext(): Promise<MarketContext> {
  const { data } = await apiClient.axios.get('/v1/market-context')
  return data as MarketContext
}

export async function getAssetHistory(slug: string, days = 90): Promise<AssetHistory> {
  const { data } = await apiClient.axios.get(`/v1/rwa/assets/${encodeURIComponent(slug)}/history`, { params: { days } })
  return data as AssetHistory
}

export async function getIssuerProfile(slug: string): Promise<RwaIssuerProfile> {
  const { data } = await apiClient.axios.get(`/v1/rwa/issuers/${encodeURIComponent(slug)}`)
  return data as RwaIssuerProfile
}
