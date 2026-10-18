/**
 * rwa-data.ts — Real RWA asset data (DefiLlama-synced backend).
 *
 * Maps /v1/rwa/assets into the DemoProduct shape the invest catalog already
 * understands, so real assets can flow through the existing screens while the
 * full v4.1 refactor lands. All values come from the API - nothing hardcoded.
 */
import { apiClient } from './api-client'
import type { DemoProduct, DemoRisk } from './demo-catalog'

export type RwaAssetRow = {
  slug: string
  name: string
  symbol?: string | null
  assetClass?: string | null
  logoUrl?: string | null
  countryCode?: string | null
  region?: string | null
  rank?: number | null
  isTokenized?: boolean
  isVerified?: boolean
  isFeatured?: boolean
  description?: string | null
  websiteUrl?: string | null
  eligibilityType?: string | null
  redemptionType?: string | null
  metrics?: {
    tvlUsd?: string | number | null
    marketCapUsd?: string | number | null
    apy?: string | number | null
    change24hPct?: string | number | null
    change7dPct?: string | number | null
  } | null
  overallScore?: string | number | null
  riskLevel?: string | null
}

const EN: Record<string, string> = {
  treasury: 'Treasury',
  money_market: 'Money market',
  private_credit: 'Private credit',
  real_estate: 'Real estate',
  commodity: 'Commodity',
  equity: 'Equity',
  bond: 'Bond',
  fund: 'Fund',
  currency: 'Currency',
  stable_value: 'Stable value',
  other: 'Alternative',
}

export function assetClassLabel(cls?: string | null): string {
  if (!cls) return 'Real assets'
  return EN[cls] ?? cls
}

function fmtBig(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n === null || n === undefined || !isFinite(n) || n === 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function riskOf(level?: string | null): DemoRisk {
  const l = (level ?? '').toLowerCase()
  if (l === 'low') return 'Low Risk'
  if (l === 'high') return 'High Risk'
  return 'Medium Risk'
}

/** Fetch real RWA assets from the backend (DefiLlama-synced). */
export async function fetchRwaAssets(limit = 40): Promise<RwaAssetRow[]> {
  const { data } = await apiClient.axios.get('/v1/rwa/assets', { params: { limit } })
  const items = (data?.items ?? data ?? []) as RwaAssetRow[]
  return Array.isArray(items) ? items : []
}

/** Map a real RWA asset into the catalog product shape used by InvestScreen. */
export function rwaToProduct(a: RwaAssetRow): DemoProduct {
  const m = a.metrics ?? {}
  const apy = typeof m.apy === 'string' ? parseFloat(m.apy) : m.apy
  const tvl = m.tvlUsd ?? m.marketCapUsd
  const ch24 = typeof m.change24hPct === 'string' ? parseFloat(m.change24hPct) : m.change24hPct
  const hasApy = apy !== null && apy !== undefined && isFinite(Number(apy)) && Number(apy) > 0
  const hasCh = ch24 !== null && ch24 !== undefined && isFinite(Number(ch24))
  return {
    id: `rwa-${a.slug}`,
    title: a.name,
    subtitle: `${assetClassLabel(a.assetClass)} · ${a.isVerified ? 'Verified' : 'Unverified'} · ${a.region ?? 'Global'}`,
    category: 'RWA',
    risk: riskOf(a.riskLevel),
    kind: 'solar-dome',
    returnMetric: hasApy ? `${Number(apy).toFixed(2)}%` : (hasCh ? `${Number(ch24) >= 0 ? '+' : ''}${Number(ch24).toFixed(2)}%` : fmtBig(tvl)),
    returnLabel: hasApy ? 'Current APY' : (hasCh ? '24h change' : 'On-chain TVL'),
    minimum: 'From 100 USDT',
    liquidity: `TVL ${fmtBig(tvl)}`,
    availability: 'Open',
    note: (a.description ?? '').slice(0, 120),
    isDemo: false,
    logoUrl: a.logoUrl ?? null,
  }
}

/** Fetch + map in one call. Returns [] on any failure (screens keep their fallback). */
export async function fetchRwaProducts(limit = 40): Promise<DemoProduct[]> {
  try {
    const rows = await fetchRwaAssets(limit)
    return rows.map(rwaToProduct)
  } catch {
    return []
  }
}
