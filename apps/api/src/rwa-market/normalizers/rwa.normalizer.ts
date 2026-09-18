import type { RwaAssetClass } from '../rwa-market.entities'
import type {
  NormalizedIssuer,
  NormalizedMarketMetric,
  NormalizedRwaAsset,
  NormalizedTokenRef,
} from '../providers/rwa-data-provider'
import type { CmcIssuerListItem, CmcRwaAssetListItem, CmcRwaInfoEntry, CmcRwaToken } from '../providers/coinmarketcap/coinmarketcap.types'

/** CMC asset_type → RWA.LAT asset_class（实测类型：commodity / stock / …，未知一律 other） */
const ASSET_CLASS_MAP: Record<string, RwaAssetClass> = {
  commodity: 'commodity',
  stock: 'equity',
  equity: 'equity',
  etf: 'fund',
  fund: 'fund',
  bond: 'bond',
  government_security: 'bond',
  government_bond: 'bond',
  treasury: 'treasury',
  money_market: 'money_market',
  currency: 'currency',
  fiat: 'currency',
  real_estate: 'real_estate',
  private_credit: 'private_credit',
  stablecoin: 'stable_value',
  stable_value: 'stable_value',
}

export function mapCmcAssetType(rawType: string | null | undefined): RwaAssetClass {
  if (!rawType) return 'other'
  const key = rawType.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ASSET_CLASS_MAP[key] ?? 'other'
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)
}

/** number → 金融字段字符串（12 位小数，消除 float 噪声；落 numeric(36,18) 由 PG 自动补零） */
export function dec(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return null
  return num.toFixed(12)
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function normalizeCmcAsset(
  raw: CmcRwaAssetListItem,
  info?: CmcRwaInfoEntry | null,
): NormalizedRwaAsset {
  return {
    externalId: String(raw.rwa_id),
    externalSlug: raw.slug && raw.slug.length > 0 ? raw.slug : slugify(raw.name),
    name: raw.name,
    symbol: raw.symbol ?? null,
    assetClass: mapCmcAssetType(raw.asset_type),
    rawAssetType: raw.asset_type ?? null,
    description: info?.about?.description?.trim() || null,
    websiteUrl: info?.website ?? null,
    logoUrl: info?.logo ?? null,
    rank: raw.rwa_rank ?? null,
    isTokenized: raw.has_tokens === true,
  }
}

export function normalizeCmcIssuer(raw: CmcIssuerListItem): NormalizedIssuer {
  return {
    externalId: raw.issuer_id,
    name: raw.name,
    slug: slugify(raw.name),
    websiteUrl: raw.website ?? null,
    logoUrl: raw.logo ?? null,
    tokenCount: raw.num_tokens ?? 0,
  }
}

export function normalizeCmcToken(raw: CmcRwaToken): NormalizedTokenRef {
  return {
    symbol: raw.symbol ?? null,
    name: raw.name ?? null,
    cryptoId: raw.crypto_id ?? null,
    issuerExternalId: raw.issuer_id ?? null,
    issuerName: raw.issuer_name ?? null,
    priceUsd: dec(raw.price),
  }
}

export function normalizeCmcMetrics(raw: CmcRwaAssetListItem): NormalizedMarketMetric {
  const quote = raw.quotes?.[0]
  return {
    externalId: String(raw.rwa_id),
    priceUsd: dec(raw.average_tokenized_price ?? quote?.average_tokenized_price),
    tokenizedMarketCapUsd: dec(raw.tokenized_market_cap ?? quote?.tokenized_market_cap),
    tokenizedVolume24hUsd: dec(raw.tokenized_volume_24h ?? quote?.tokenized_volume_24h),
    dataTimestamp: parseDate(raw.last_updated ?? quote?.last_updated),
    tokens: (raw.tokens ?? []).map(normalizeCmcToken),
  }
}
