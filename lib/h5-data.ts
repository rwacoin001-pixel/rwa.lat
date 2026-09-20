/**
 * H5 Data Layer — API-first with demo fallback
 *
 * All RWA-H5 data flows through this module.  When the Core API is running,
 * it fetches live data via @rwa-lat/api-client.  When the API is unreachable
 * (e.g. PG is down), it falls back to static demo data so the UI never breaks.
 */

import { apiClient, type Product, type ListProductsResponse } from './api-client'
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
  const assetClass = (api.assetClassId ?? 'compute').toLowerCase()
  // Map catalog asset classes (equity/fund/commodity) onto the H5 scene/category system
  const kind =
    assetClass === 'compute'
      ? 'compute'
      : assetClass === 'equity' || assetClass === 'fund' || assetClass === 'stocks'
        ? 'stocks'
        : assetClass === 'prediction'
          ? 'prediction'
          : assetClass === 'commodity'
            ? 'solar-dome'
            : 'solar'
  const catLabel =
    assetClass === 'equity' || assetClass === 'fund' || assetClass === 'stocks'
      ? 'Stocks'
      : assetClass === 'compute'
        ? 'Compute'
        : assetClass === 'prediction'
          ? 'Prediction'
          : 'RWA'

  return {
    id: api.id,
    title: api.displayName ?? rwa?.[api.id]?.title ?? api.id,
    subtitle: api.summary ?? '',
    category: catLabel,
    // Risk and performance are deliberately not invented from the catalog API.
    // Keep the presentation metadata only for seeded demo products and clearly
    // label newly published products as indicative until a quote is available.
    risk: (rwa?.[api.id]?.risk ?? 'Medium Risk') as DemoProduct['risk'],
    kind: kind as DemoProduct['kind'],
    returnMetric: rwa?.[api.id]?.returnMetric ?? '—',
    returnLabel: rwa?.[api.id]?.returnLabel ?? 'indicative',
    minimum: api.minOrderAtomicAmount ? `${Number(api.minOrderAtomicAmount) / (10 ** api.assetDecimals)} ${api.assetCode}` : 'Review terms',
    liquidity: 'Review terms',
    availability: api.state === 'published' ? 'Open' : 'Pending',
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
    const response = await apiClient.listProducts() as ListProductsResponse | Product[]
    // The deployed catalog controller returns an array while older API-client
    // builds describe the response as { items, total }; accept both shapes so
    // the homepage stays API-first across environments.
    const items = Array.isArray(response) ? response : response.items
    if (!items.length) {
      // An empty published catalog is a valid backend state during rollout, but
      // it should not collapse the discovery surface for public visitors.
      cachedProducts = demoProducts
      cacheTs = now
      return demoProducts
    }
    const mapped = items.map(mapApiProduct)
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
