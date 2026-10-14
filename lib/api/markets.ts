/**
 * Batch-1 market + order reads/writes on the shared HTTP client.
 * Two universes, never mixed:
 *   · catalog products (`/v1/catalog/products`) — investable, UUID ids, quoted
 *   · RWA directory (`/v1/rwa/*`) — third-party market data, research only
 */
import { onDeviceClock } from '../prediction-clock'
import { request, type ApiResult } from './_http'
import type { CatalogProductsDto, CatalogQuoteDto, OrdersDto, RwaAssetsDto, RwaDetailDto, RwaHistoryDto, RwaIssuerDto, RwaIssuersDto, WalletDto } from './contracts'
import { USDT_DECIMALS } from '../money'

export type CatalogProduct = CatalogProductsDto[number]
export type CatalogQuote = CatalogQuoteDto
export type RwaAsset = RwaAssetsDto['items'][number]
export type RwaDetail = RwaDetailDto
export type RwaIssuerSummary = RwaIssuersDto['items'][number]
export type RwaIssuer = RwaIssuerDto
export type Order = OrdersDto[number]
export type Wallet = WalletDto
export type MarketPair = { id: string; symbol: string; quoteAssetCode: string; tickSize: number; minQuantity: number; state: string; lastPrice: number | null; updatedAt: string | null }
export type PolymarketPreview = { source: string; fetchedAt: string; tradingEnabled: boolean; items: Array<{ id: string; slug: string; question: string; category: string; outcomes: Array<{ label: string; impliedProbability: number | null }>; volume24hUsd: number | null; providerUpdatedAt: string | null; endAt: string | null }> }
/** `/v1/basket/portfolios` rows. Decimals arrive as trimmed strings (USD / units at 18 dp server-side). */
export type BasketPortfolio = { id: string; name: string; status: string; strategySlug: string; strategyName: string; riskLevel: string | null; totalUnits: string; navPerUnit: string | null; aumUsd: string | null; minimumSubscriptionUsd?: string | null; createdAt: string }
export type BasketHolding = { assetId: string; slug: string; name: string; assetClass: string | null; quantity: string; marketValueUsd: string | null; targetWeightPct: string | null; actualWeightPct: string | null; priceUsd: string | null; priceTimestamp: string | null }
export type BasketDetail = BasketPortfolio & { strategyId: string; strategyVersionId: string; cashBalanceUsd: string | null; updatedAt: string; holdings: BasketHolding[]; navHistory: Array<{ grossAssetValueUsd: string | null; nav: string | null; timestamp: string; quality: string | null }>; userUnits: string | null }
export type BasketDisclosure = { id: string; productType: string; strategyId: string | null; version: number; title: string; content: string; effectiveFrom: string }
export type BasketSubscription = { id: string; status: string; amountUsd: string; unitsIssued: string | null; navPerUnit: string | null; settledAt: string | null }
export type BasketRedemption = { id: string; status: string; units: string; netAmountUsd: string | null; navPerUnit: string | null; settledAt: string | null }
export type TradeLevel = { price: number; quantity: number }
export type OrderBook = { symbol: string; bids: TradeLevel[]; asks: TradeLevel[]; lastPrice: number | null; updatedAt: string }
export type PublicTrade = { id: string; price: number; quantity: number; at: string }
export type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number }
export type TradingOrder = { id: string; symbol: string | null; side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number | null; quantity: number; filledQuantity: number; state: string; createdAt: string; updatedAt: string }
export type PlaceTradingOrderBody = { symbol: string; side: 'buy' | 'sell'; type: 'limit' | 'market'; price?: number; quantity: number; idempotencyKey: string }
/** A+C 混合收费：下注费（place）+ 派彩费（payout）。以服务端 /v1/predictions/status 为权威。 */
export type PredictionFees = { placeFeeBps: number; payoutFeeBps: number; placeFeeRate: number; payoutFeeRate: number; assetDecimals: number }
export type PredictionStatus = { enabled: boolean; mode: string; limits: { maxStakeAtomic: string | null; maxDailyStakeAtomic: string; maxMarketExposureAtomic: string; slippageBps: string; assetDecimals: number }; fees?: PredictionFees }
export type PredictionBet = { id: string; status: string; stakeAtomic: string; shares: string; price: string; feeAtomic?: string; payoutFeeAtomic?: string; riskStakeAtomic?: string; [key: string]: unknown }
export type PlaceBetBody = { tokenId: string; stakeAtomic: string; expectedPrice?: string; idempotencyKey: string }
/** Shape of the same-origin `/api/polymarket/market/:id` proxy (Gamma + CLOB). */
export type PolymarketMarket = {
  source: string; fetchedAt: string
  market: { id: string; eventId?: string | null; question: string; description: string; category: string; outcomes: string[]; prices: number[]; tokenIds: string[]; volume: number; volume24h: number; liquidity: number; endDate: string | null; acceptingOrders: boolean; closed?:boolean; resolved?:boolean; active?:boolean; archived?:boolean }
  outcomeBooks?: Array<({ tokenId: string; fetchedAt: string; asOf?: string; bids: Array<{price:number;size:number}>; asks: Array<{price:number;size:number}>; minimumOrderSize: number }) | null>
  orderbook: { bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }>; tickSize: number; minimumOrderSize: number } | null
  pricing: { midpoint: number; spread: number; history: Array<{ time: number; price: number }> }
}

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
export const isOrderableId = (id: string) => UUID.test(id)

/** Rows without an external slug or order limits are operator fixtures, not listings. */
export const isListed = (product: CatalogProduct) => product.state === 'published' && Boolean(product.externalRef) && isOrderableId(product.id) && product.minOrderAtomicAmount !== null

export const listProducts = () => request<CatalogProductsDto>('/v1/catalog/products')
export const getQuote = (productId: string) => request<CatalogQuote>(`/v1/catalog/products/${encodeURIComponent(productId)}/quote`)
export const getDisclosures = (productId: string) => request<unknown[]>(`/v1/catalog/products/${encodeURIComponent(productId)}/disclosures`)
export type RwaSort = 'rank' | 'market_cap' | 'volume' | 'change_24h' | 'apy' | 'name'
export const listRwaAssets = (params: { search?: string; assetClass?: string; sort?: RwaSort; limit?: number } = {}) => {
  const query = new URLSearchParams({ limit: String(params.limit ?? 50) })
  if (params.sort) query.set('sort', params.sort)
  if (params.search) query.set('search', params.search)
  if (params.assetClass) query.set('assetClass', params.assetClass)
  return request<RwaAssetsDto>(`/v1/rwa/assets?${query}`)
}
export const getRwaDetail = (slug: string) => request<RwaDetail>(`/v1/rwa/assets/${encodeURIComponent(slug)}`)
export const getRwaHistory = (slug: string, days = 90) => request<RwaHistoryDto>(`/v1/rwa/assets/${encodeURIComponent(slug)}/history?days=${days}`)
export const listIssuers = () => request<RwaIssuersDto>('/v1/rwa/issuers')
export const getIssuer = (slug: string) => request<RwaIssuer>(`/v1/rwa/issuers/${encodeURIComponent(slug)}`)
export const listPairs = () => request<MarketPair[]>('/v1/market/pairs')
export const listBaskets = () => request<BasketPortfolio[]>('/v1/basket/portfolios')
export const getPolymarketPreview = () => request<PolymarketPreview>('/v1/polymarket/public-preview?scope=finance')
export const getWallet = () => request<Wallet>('/v1/wallet')
export const getOrder = (id: string) => request<Order>(`/v1/orders/${encodeURIComponent(id)}`)

export type CreateOrderBody = { productId: string; atomicAmount: string; outcomeKey: 'long' | 'yes' | 'no'; riskAccepted: true }
export const createOrder = (body: CreateOrderBody, idempotencyKey: string) =>
  request<Order & { created?: boolean }>('/v1/orders', { method: 'POST', body: JSON.stringify(body), idempotencyKey })

/** Same scale conversion as calculateProductQuantityAtomic() on the API. */
function powerOfTen(decimals: number): bigint {
  let value = BigInt(1)
  for (let index = 0; index < decimals; index += 1) value *= BigInt(10)
  return value
}

export function estimateQuantity(
  settlementAmountAtomic: string,
  unitPriceAtomic: string,
  assetDecimals: number,
  quoteDecimals: number,
  settlementDecimals = USDT_DECIMALS,
): string | null {
  try {
    if (![assetDecimals, quoteDecimals, settlementDecimals].every((value) => Number.isInteger(value) && value >= 0 && value <= 30)) return null
    const price = BigInt(unitPriceAtomic)
    if (price <= BigInt(0)) return null
    const amount = BigInt(settlementAmountAtomic)
    if (amount < BigInt(0)) return null
    const numerator = amount * powerOfTen(assetDecimals + quoteDecimals)
    const denominator = powerOfTen(settlementDecimals) * price
    return (numerator / denominator).toString()
  } catch { return null }
}

export const TERMINAL_ORDER_STATES = new Set(['filled', 'partially_filled', 'failed', 'cancelled'])

/** Find the catalog product for a route slug: externalRef first, then id. */
export function productForSlug(products: CatalogProduct[] | undefined, slug: string): CatalogProduct | undefined {
  return products?.find((product) => isListed(product) && (product.externalRef === slug || product.id === slug))
}

// ── Baskets ──
export const getBasket = (id: string) => request<BasketDetail>(`/v1/basket/portfolios/${encodeURIComponent(id)}`)
export const listBasketDisclosures = () => request<BasketDisclosure[]>('/v1/basket/disclosures')
export const acknowledgeDisclosure = (id: string) => request<{ acknowledged: boolean }>(`/v1/basket/disclosures/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: '{}' })
export const subscribeBasket = (id: string, amountUsd: string, idempotencyKey: string) =>
  request<{ duplicate?: boolean; subscription: BasketSubscription }>(`/v1/basket/portfolios/${encodeURIComponent(id)}/subscriptions`, { method: 'POST', body: JSON.stringify({ amountUsd }), idempotencyKey })
export const redeemBasket = (id: string, units: string, idempotencyKey: string) =>
  request<{ duplicate?: boolean; redemption: BasketRedemption }>(`/v1/basket/portfolios/${encodeURIComponent(id)}/redemptions`, { method: 'POST', body: JSON.stringify({ units }), idempotencyKey })
/** Same rule as the server (subscription.service assertDisclosureAcknowledged): latest strategy disclosure, else latest global basket one. */
export function disclosureFor(disclosures: BasketDisclosure[] | undefined, strategyId: string | undefined) {
  const pool = disclosures ?? []
  const byVersion = (a: BasketDisclosure, b: BasketDisclosure) => b.version - a.version || Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom) || (a.id < b.id ? 1 : -1)
  return pool.filter((item) => strategyId && item.strategyId === strategyId).sort(byVersion)[0]
    ?? pool.filter((item) => !item.strategyId && item.productType === 'basket').sort(byVersion)[0]
}

// ── Pair trading ──
const pairPath = (symbol: string) => `/v1/market/pairs/${encodeURIComponent(symbol)}`
export const getPair = (symbol: string) => request<MarketPair>(pairPath(symbol))
export const getOrderBook = (symbol: string, depth = 12) => request<OrderBook>(`${pairPath(symbol)}/orderbook?depth=${depth}`)
export const getPairTrades = (symbol: string, limit = 20) => request<PublicTrade[]>(`${pairPath(symbol)}/trades?limit=${limit}`)
export const CANDLE_INTERVALS = ['1h', '4h', '1d'] as const
export type CandleInterval = (typeof CANDLE_INTERVALS)[number]
export const getCandles = (symbol: string, interval: CandleInterval, limit = 96) => request<{ symbol: string; interval: string; candles: Candle[] }>(`${pairPath(symbol)}/candles?interval=${interval}&limit=${limit}`)
export const listTradingOrders = () => request<TradingOrder[]>('/v1/market/orders')
/** The trading API takes its idempotency key in the body, not the header. */
export const placeTradingOrder = (body: PlaceTradingOrderBody) => request<TradingOrder>('/v1/market/orders', { method: 'POST', body: JSON.stringify(body) })
export const cancelTradingOrder = (id: string) => request<TradingOrder>(`/v1/market/orders/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const OPEN_TRADING_STATES = new Set(['open', 'partial'])

// ── Prediction (internal market A) ──
export const getPredictionStatus = () => request<PredictionStatus>('/v1/predictions/status')
export const placePredictionBet = (body: PlaceBetBody) => request<PredictionBet & { duplicate?: boolean }>('/v1/predictions/bets', { method: 'POST', body: JSON.stringify(body) })
/** Starred prediction events, per account (≤200, newest first). Toggles are silent: the star is optimistic. */
export type PredictionFavorite = { eventId: string; createdAt: string }
export const listPredictionFavorites = () => request<PredictionFavorite[]>('/v1/predictions/favorites')
export const setPredictionFavorite = (eventId: string, favorite: boolean) => request<{ eventId: string; favorite: boolean }>(`/v1/predictions/favorites/${encodeURIComponent(eventId)}`, { method: favorite ? 'POST' : 'DELETE', loading: 'silent' })
/** Same-origin Next route, not /v1: it proxies public Polymarket data and never carries the session. */
export async function getPolymarketMarket(id: string, period = 'max', fresh = false): Promise<ApiResult<PolymarketMarket>> {
  try {
    const response = await fetch(`/api/polymarket/market/${encodeURIComponent(id)}?period=${encodeURIComponent(period)}${fresh ? '&refresh=1' : ''}`, { cache: 'no-store' })
    const data = await response.json().catch(() => null) as PolymarketMarket | null
    if (!response.ok || !data?.market) return { ok: false, error: { status: response.status, code: 'POLYMARKET_UNAVAILABLE', message: 'Market data is unavailable right now.' } }
    const receivedAt = Date.now()
    return { ok: true, data: { ...data, outcomeBooks: data.outcomeBooks?.map((book) => onDeviceClock(book, data.fetchedAt, receivedAt)) } }
  } catch {
    return { ok: false, error: { status: 0, code: 'NETWORK_ERROR', message: 'Market data is unavailable right now.' } }
  }
}
