export const POLYMARKET_READ_ADAPTER = Symbol('POLYMARKET_READ_ADAPTER')

export interface PolymarketMarketRecord {
  gammaMarketId: string
  conditionId: string | null
  slug: string
  question: string
  active: boolean
  closed: boolean
  archived: boolean
  restricted: boolean
  enableOrderBook: boolean
  resolutionSource: string | null
  startAt: Date | null
  endAt: Date | null
  providerUpdatedAt: Date | null
  outcomes: string[]
  tokenIds: string[]
  outcomePrices: string[]
  rawPayload: Record<string, unknown>
}

export interface PolymarketMarketPage {
  markets: PolymarketMarketRecord[]
  nextCursor: string | null
  fetchedAt: Date
}

export interface PolymarketBookLevel {
  price: string
  size: string
}

export interface PolymarketOrderBook {
  tokenId: string
  conditionId: string | null
  hash: string | null
  bids: PolymarketBookLevel[]
  asks: PolymarketBookLevel[]
  tickSize: string | null
  minOrderSize: string | null
  lastTradePrice: string | null
  negRisk: boolean
  asOf: Date
  fetchedAt: Date
}

export interface PolymarketReadAdapter {
  readonly provider: 'polymarket'
  readonly mode: 'disabled' | 'public-read-only'
  isEnabled(): boolean
  listMarkets(cursor?: string, limit?: number): Promise<PolymarketMarketPage>
  getOrderBook(tokenId: string): Promise<PolymarketOrderBook>
}
