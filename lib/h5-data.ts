/**
 * H5 Data Layer — API-first with demo fallback
 *
 * All RWA-H5 data flows through this module.  When the Core API is running,
 * it fetches live data via @rwa-lat/api-client.  When the API is unreachable
 * (e.g. PG is down), it falls back to static demo data so the UI never breaks.
 */

import { apiClient, type Product, type AssetClass } from './api-client'
import {
  demoProducts,
  featuredProducts,
  projectProfiles,
  type DemoProduct,
  type DemoProjectProfile,
} from './demo-catalog'

// ─── Product layer: API → demo fallback ─────────────────────────────────────

function mapApiProduct(api: Product): DemoProduct {
  const { rwa } = require('./rwa-h5-copy')
  const assetClass = (api.assetClass ?? 'compute').toLowerCase() as
    | 'compute'
    | 'rwa'
    | 'stocks'
    | 'prediction'
  const kind =
    assetClass === 'compute'
      ? 'compute'
      : assetClass === 'stocks'
        ? 'stocks'
        : assetClass === 'prediction'
          ? 'prediction'
          : 'solar'
  const catLabel = (assetClass.charAt(0).toUpperCase() + assetClass.slice(1)) as
    | 'Compute'
    | 'RWA'
    | 'Stocks'
    | 'Prediction'

  return {
    id: api.id,
    title: api.name ?? rwa?.[api.id]?.title ?? api.id,
    subtitle: api.tagline ?? '',
    category: catLabel,
    risk: ((api.riskLevel ?? 'medium') === 'low'
      ? 'Low Risk'
      : (api.riskLevel ?? 'medium') === 'high'
        ? 'High Risk'
        : 'Medium Risk') as DemoProduct['risk'],
    kind: kind as DemoProduct['kind'],
    returnMetric: api.apyDisplay ?? `${api.apy ?? 10}%`,
    returnLabel: 'projected APY',
    minimum: api.minInvestment ? `${api.minInvestment} USDT` : '100 USDT',
    liquidity: api.liquidity ?? 'Monthly window',
    availability: api.status === 'live' ? 'Open' : 'Pending',
    note: 'Live data via Core API',
    isDemo: false,
  }
}

let cachedProducts: DemoProduct[] | null = null
let cacheTs = 0

export async function getProducts(): Promise<DemoProduct[]> {
  const now = Date.now()
  if (cachedProducts && now - cacheTs < 60_000) return cachedProducts

  try {
    const response = await apiClient.listProducts({ limit: 50 })
    const mapped = response.items.map(mapApiProduct)
    cachedProducts = mapped
    cacheTs = now
    return mapped
  } catch {
    console.warn('[h5-data] API unavailable — falling back to demo catalog')
    return demoProducts
  }
}

export function getFeaturedProducts(): DemoProduct[] {
  // Featured is a subset — we return API if cached, else demo
  if (cachedProducts) return cachedProducts.filter((p) => p.availability === 'Open')
  return featuredProducts
}

export function getProductById(id: string): DemoProduct | undefined {
  if (cachedProducts) return cachedProducts.find((p) => p.id === id)
  return demoProducts.find((p) => p.id === id)
}

export function getProjectProfile(id: string): DemoProjectProfile | undefined {
  return projectProfiles[id] ?? undefined
}

// ─── Auth helpers (re-export) ───────────────────────────────────────────────

export { setAuthToken, clearAuthToken, getAuthToken, isAuthenticated, demoLogin } from './api-client'

// ─── Re-export types for consumers ──────────────────────────────────────────

export type { DemoProduct, DemoProjectProfile, DemoCategory } from './demo-catalog'
