import { request } from './_http'
export type RwaRanking = { slug: string; name: string; symbol: string | null; logoUrl: string | null; marketCapUsd: string | null; change24hPct: string | null; position: number }
export type RwaOverview = Record<string, string | number | null | undefined>
export const getRwaOverview = () => request<RwaOverview>('/v1/rwa/overview')
export const getRankings = (metric: 'market_cap' | 'apy' = 'market_cap', limit = 5) =>
  request<{ metric: string; items: RwaRanking[] }>(`/v1/rwa/rankings?metric=${metric}&limit=${limit}`)
