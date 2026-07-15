import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  PolymarketIntegrationDisabledError,
  PolymarketUpstreamError,
  POLYMARKET_ERROR_CODES,
} from './polymarket.errors'
import type {
  PolymarketBookLevel,
  PolymarketMarketPage,
  PolymarketMarketRecord,
  PolymarketOrderBook,
  PolymarketReadAdapter,
} from './polymarket-adapter.interface'

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

@Injectable()
export class PolymarketPublicAdapter implements PolymarketReadAdapter {
  readonly provider = 'polymarket' as const
  readonly mode = 'public-read-only' as const

  private readonly gammaUrl: string
  private readonly clobUrl: string
  private readonly timeoutMs: number
  private readonly enabled: boolean

  constructor(config: ConfigService) {
    this.gammaUrl = stripTrailingSlash(config.get<string>('POLYMARKET_GAMMA_URL') ?? 'https://gamma-api.polymarket.com')
    this.clobUrl = stripTrailingSlash(config.get<string>('POLYMARKET_CLOB_URL') ?? 'https://clob.polymarket.com')
    this.timeoutMs = boundedInteger(config.get<string>('POLYMARKET_HTTP_TIMEOUT_MS'), 8_000, 500, 15_000)
    this.enabled = config.get<string>('POLYMARKET_READ_ENABLED') !== 'false'
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async listMarkets(cursor?: string, limit = 50): Promise<PolymarketMarketPage> {
    this.requireEnabled()
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
    const url = new URL(`${this.gammaUrl}/markets/keyset`)
    url.searchParams.set('limit', String(safeLimit))
    url.searchParams.set('ascending', 'true')
    url.searchParams.set('active', 'true')
    url.searchParams.set('closed', 'false')
    if (cursor) url.searchParams.set('after_cursor', cursor)

    const payload = await this.fetchJson(url)
    if (!isRecord(payload) || !Array.isArray(payload.markets)) {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE)
    }
    const markets = payload.markets
      .map((item) => normalizeMarket(item))
      .filter((item): item is PolymarketMarketRecord => item !== null)
    const nextCursor = optionalString(payload.next_cursor ?? payload.nextCursor)
    return { markets, nextCursor, fetchedAt: new Date() }
  }

  async getOrderBook(tokenId: string): Promise<PolymarketOrderBook> {
    this.requireEnabled()
    const url = new URL(`${this.clobUrl}/book`)
    url.searchParams.set('token_id', tokenId)
    const payload = await this.fetchJson(url)
    if (!isRecord(payload)) {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE)
    }
    const returnedTokenId = optionalString(payload.asset_id) ?? tokenId
    if (returnedTokenId !== tokenId) {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE)
    }
    return {
      tokenId,
      conditionId: optionalString(payload.market),
      hash: optionalString(payload.hash),
      bids: normalizeLevels(payload.bids),
      asks: normalizeLevels(payload.asks),
      tickSize: optionalDecimal(payload.tick_size),
      minOrderSize: optionalDecimal(payload.min_order_size),
      lastTradePrice: optionalDecimal(payload.last_trade_price),
      negRisk: payload.neg_risk === true,
      asOf: parseProviderTime(payload.timestamp) ?? new Date(),
      fetchedAt: new Date(),
    }
  }

  private requireEnabled(): void {
    if (!this.enabled) throw new PolymarketIntegrationDisabledError()
  }

  private async fetchJson(url: URL): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'RWA.LAT/0.1 market-data' },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_UNAVAILABLE)
    }
    if (!response.ok) {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_UNAVAILABLE)
    }
    try {
      return await response.json()
    } catch {
      throw new PolymarketUpstreamError(POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE)
    }
  }
}

export function normalizeMarket(value: unknown): PolymarketMarketRecord | null {
  if (!isRecord(value)) return null
  const gammaMarketId = optionalString(value.id)
  const question = optionalString(value.question)
  const slug = optionalString(value.slug)
  if (!gammaMarketId || !question || !slug) return null
  return {
    gammaMarketId,
    conditionId: optionalString(value.conditionId ?? value.condition_id),
    slug,
    question,
    active: value.active === true,
    closed: value.closed === true,
    archived: value.archived === true,
    restricted: value.restricted === true,
    enableOrderBook: value.enableOrderBook === true || value.enable_order_book === true,
    resolutionSource: optionalString(value.resolutionSource ?? value.resolution_source),
    startAt: parseDate(value.startDate ?? value.start_date),
    endAt: parseDate(value.endDate ?? value.end_date),
    providerUpdatedAt: parseDate(value.updatedAt ?? value.updated_at),
    outcomes: stringArray(value.outcomes),
    tokenIds: stringArray(value.clobTokenIds ?? value.clob_token_ids),
    outcomePrices: stringArray(value.outcomePrices ?? value.outcome_prices).filter((item) => DECIMAL_PATTERN.test(item)),
    rawPayload: value,
  }
}

function normalizeLevels(value: unknown): PolymarketBookLevel[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const price = optionalDecimal(item.price)
    const size = optionalDecimal(item.size)
    return price && size ? [{ price, size }] : []
  })
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => typeof item === 'string' ? [item] : [])
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.flatMap((item) => typeof item === 'string' ? [item] : []) : []
  } catch {
    return []
  }
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalDecimal(value: unknown): string | null {
  const candidate = optionalString(value)
  return candidate && DECIMAL_PATTERN.test(candidate) ? candidate : null
}

function parseDate(value: unknown): Date | null {
  const candidate = optionalString(value)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseProviderTime(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 10_000_000_000 ? value * 1_000 : value)
  }
  const candidate = optionalString(value)
  if (!candidate) return null
  if (/^\d+$/.test(candidate)) {
    const numeric = Number(candidate)
    return Number.isSafeInteger(numeric) ? new Date(candidate.length <= 10 ? numeric * 1_000 : numeric) : null
  }
  return parseDate(candidate)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value ? Number(value) : fallback
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback
}
