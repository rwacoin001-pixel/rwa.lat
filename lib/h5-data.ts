/**
 * H5 Data Layer — API-backed catalog
 *
 * All RWA-H5 data flows through this module.  When the Core API is running,
 * it fetches live data via @rwa-lat/api-client. Errors retain the last catalog
 * snapshot or return an empty list; they never substitute demo products.
 */

import { fromAtomic } from './money'
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
    minimum: api.minOrderAtomicAmount ? `${fromAtomic(api.minOrderAtomicAmount, api.assetDecimals)} ${api.assetCode}` : 'Review terms',
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
      // 真实空目录就是空——不再用 demo 冒充（圆桌第4场裁定 + 验收报告 P0）
      cachedProducts = []
      cacheTs = now
      return []
    }
    const mapped = items.map(mapApiProduct)
    cachedProducts = mapped
    cacheTs = now
    return mapped
  } catch {
    console.warn('[h5-data] API unavailable')
    return cachedProducts ?? []
  }
}

export function getFeaturedProducts(): DemoProduct[] {
  // Featured is a subset — API cached values only（不用 demo 回退）
  if (cachedProducts) return cachedProducts.filter((p) => p.availability === 'Open')
  return []
}

export function getProductById(id: string): DemoProduct | undefined {
  if (cachedProducts) return cachedProducts.find((p) => p.id === id)
  return undefined
}

export function getProjectProfile(id: string): DemoProjectProfile | undefined {
  return projectProfiles[id] ?? undefined
}

// ─── Auth helpers (re-export) ───────────────────────────────────────────────

export { setAuthToken, clearAuthToken, getAuthToken, isAuthenticated, demoLogin } from './api-client'

// ─── Re-export types for consumers ──────────────────────────────────────────

export type { DemoProduct, DemoProjectProfile, DemoCategory } from './demo-catalog'
