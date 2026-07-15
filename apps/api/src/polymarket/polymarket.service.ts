import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { In, Repository } from 'typeorm'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import {
  POLYMARKET_READ_ADAPTER,
  type PolymarketMarketRecord,
  type PolymarketReadAdapter,
} from './polymarket-adapter.interface'
import {
  PolymarketExternalEvent,
  PolymarketMarketMapping,
  type PolymarketMarketState,
  PolymarketSyncWatermark,
  PolymarketTokenMapping,
} from './polymarket.entities'
import {
  polymarketMarketNotFound,
  polymarketSyncInProgress,
  polymarketTokenNotFound,
  polymarketTradingDisabled,
} from './polymarket.errors'

const PROVIDER = 'polymarket'
const MARKET_STREAM = 'gamma_markets' as const

export interface PolymarketMarketView {
  id: string
  productId: string | null
  gammaMarketId: string
  conditionId: string | null
  slug: string
  question: string
  state: PolymarketMarketState
  restricted: boolean
  enableOrderBook: boolean
  resolutionSource: string | null
  marketStartAt: Date | null
  marketEndAt: Date | null
  asOf: Date
  stale: boolean
  tokens: Array<{ tokenId: string; outcome: string; outcomeIndex: number; state: string }>
  tradingEnabled: false
}

@Injectable()
export class PolymarketService {
  private readonly staleAfterMs: number
  private readonly leaseMs: number

  constructor(
    @InjectRepository(PolymarketMarketMapping)
    private readonly markets: Repository<PolymarketMarketMapping>,
    @InjectRepository(PolymarketTokenMapping)
    private readonly tokens: Repository<PolymarketTokenMapping>,
    @InjectRepository(PolymarketSyncWatermark)
    private readonly watermarks: Repository<PolymarketSyncWatermark>,
    @InjectRepository(PolymarketExternalEvent)
    private readonly events: Repository<PolymarketExternalEvent>,
    @Inject(POLYMARKET_READ_ADAPTER)
    private readonly adapter: PolymarketReadAdapter,
    private readonly config: ConfigService,
    private readonly rbac: AdminRbacService,
  ) {
    this.staleAfterMs = boundedSeconds(config.get<string>('POLYMARKET_MARKET_STALE_SECONDS'), 120) * 1_000
    this.leaseMs = boundedSeconds(config.get<string>('POLYMARKET_SYNC_LEASE_SECONDS'), 60) * 1_000
  }

  async status(now: Date = new Date()) {
    const watermark = await this.watermarks.findOne({
      where: { provider: PROVIDER, stream: MARKET_STREAM },
    })
    return {
      provider: PROVIDER,
      apiVersion: 'gamma-keyset/clob-v2',
      readMode: this.adapter.isEnabled() ? this.adapter.mode : 'disabled',
      tradingEnabled: false,
      tradingDisabledReason: 'user-signing-and-production-approval-required',
      staleAfterSeconds: this.staleAfterMs / 1_000,
      sync: watermark ? {
        state: watermark.state,
        cursor: watermark.cursor,
        lastSuccessAt: watermark.lastSuccessAt,
        lastEventAt: watermark.lastEventAt,
        consecutiveFailures: watermark.consecutiveFailures,
        stale: !watermark.lastSuccessAt || this.isStale(watermark.lastSuccessAt, now),
      } : {
        state: 'not_started',
        cursor: null,
        lastSuccessAt: null,
        lastEventAt: null,
        consecutiveFailures: 0,
        stale: true,
      },
    }
  }

  async listMarkets(
    state?: PolymarketMarketState,
    limit = 50,
    now: Date = new Date(),
  ): Promise<PolymarketMarketView[]> {
    const mappings = await this.markets.find({
      where: state ? { state } : {},
      order: { lastSyncedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    })
    const tokenRows = mappings.length
      ? await this.tokens.find({
          where: { marketMappingId: In(mappings.map((market) => market.id)) },
          order: { outcomeIndex: 'ASC' },
        })
      : []
    return mappings.map((mapping) => this.toMarketView(
      mapping,
      tokenRows.filter((token) => token.marketMappingId === mapping.id),
      now,
    ))
  }

  async getMarket(id: string, now: Date = new Date()): Promise<PolymarketMarketView> {
    const mapping = await this.markets.findOne({
      where: [{ gammaMarketId: id }, { conditionId: id }],
    })
    if (!mapping) throw polymarketMarketNotFound(id)
    const tokens = await this.tokens.find({
      where: { marketMappingId: mapping.id },
      order: { outcomeIndex: 'ASC' },
    })
    return this.toMarketView(mapping, tokens, now)
  }

  async getOrderBook(tokenId: string, now: Date = new Date()) {
    const token = await this.tokens.findOne({ where: { tokenId } })
    if (!token) throw polymarketTokenNotFound(tokenId)
    const market = await this.markets.findOne({ where: { id: token.marketMappingId } })
    if (!market) throw polymarketMarketNotFound(token.marketMappingId)
    const book = await this.adapter.getOrderBook(tokenId)
    token.tickSize = book.tickSize
    token.minOrderSize = book.minOrderSize
    token.lastBookHash = book.hash
    token.lastBookAt = book.asOf
    await this.tokens.save(token)
    return {
      ...book,
      source: 'polymarket-clob-v2',
      stale: this.isStale(book.asOf, now),
      marketState: market.state,
      restricted: market.restricted,
      tradingEnabled: false as const,
    }
  }

  async syncMarkets(
    admin: AuthenticatedAdmin,
    requestedCursor?: string,
    limit = 50,
    now: Date = new Date(),
  ) {
    await this.rbac.assertPermission(admin.id, 'catalog.manage')
    const leaseOwner = `${admin.id}:${randomUUID()}`
    const watermark = await this.acquireSyncLease(leaseOwner, now)
    const cursor = requestedCursor ?? watermark.cursor ?? undefined
    try {
      const page = await this.adapter.listMarkets(cursor, limit)
      let tokenCount = 0
      for (const record of page.markets) {
        tokenCount += await this.upsertMarket(record, page.fetchedAt)
      }
      watermark.cursor = page.nextCursor
      watermark.state = 'idle'
      watermark.lastSuccessAt = page.fetchedAt
      watermark.lastEventAt = page.fetchedAt
      watermark.consecutiveFailures = 0
      watermark.lastErrorCode = null
      watermark.lastErrorAt = null
      watermark.leaseOwner = null
      watermark.leaseExpiresAt = null
      await this.watermarks.save(watermark)
      return {
        provider: PROVIDER,
        marketsUpserted: page.markets.length,
        tokensUpserted: tokenCount,
        nextCursor: page.nextCursor,
        fetchedAt: page.fetchedAt,
        tradingEnabled: false as const,
      }
    } catch (error) {
      watermark.state = 'degraded'
      watermark.consecutiveFailures += 1
      watermark.lastErrorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR'
      watermark.lastErrorAt = new Date()
      watermark.leaseOwner = null
      watermark.leaseExpiresAt = null
      await this.watermarks.save(watermark)
      throw error
    }
  }

  async ingestExternalEvent(input: {
    channel: 'market' | 'user' | 'rest_reconciliation'
    eventType: string
    externalId: string
    status?: string
    marketConditionId?: string
    externalOrderId?: string
    occurredAt: Date
    payload: Record<string, unknown>
  }): Promise<{ event: PolymarketExternalEvent; duplicate: boolean }> {
    const canonicalPayload = canonicalJson(input.payload)
    const payloadSha256 = createHash('sha256').update(canonicalPayload).digest()
    const externalEventKey = createHash('sha256')
      .update([input.externalId, input.eventType, input.status ?? '', input.occurredAt.toISOString(), payloadSha256.toString('hex')].join('|'))
      .digest('hex')
    const existing = await this.events.findOne({
      where: { provider: PROVIDER, channel: input.channel, externalEventKey },
    })
    if (existing) return { event: existing, duplicate: true }

    const entity = this.events.create({
      provider: PROVIDER,
      channel: input.channel,
      externalEventKey,
      eventType: input.eventType,
      marketConditionId: input.marketConditionId ?? null,
      externalOrderId: input.externalOrderId ?? null,
      occurredAt: input.occurredAt,
      payload: input.payload,
      payloadSha256,
      processingState: 'received',
      processingAttempts: 0,
      lastErrorCode: null,
      processedAt: null,
    })
    try {
      return { event: await this.events.save(entity), duplicate: false }
    } catch (error) {
      const raced = await this.events.findOne({
        where: { provider: PROVIDER, channel: input.channel, externalEventKey },
      })
      if (raced) return { event: raced, duplicate: true }
      throw error
    }
  }

  assertTradingEnabled(): never {
    throw polymarketTradingDisabled()
  }

  private async acquireSyncLease(leaseOwner: string, now: Date): Promise<PolymarketSyncWatermark> {
    let watermark = await this.watermarks.findOne({
      where: { provider: PROVIDER, stream: MARKET_STREAM },
    })
    if (!watermark) {
      watermark = this.watermarks.create({
        provider: PROVIDER,
        stream: MARKET_STREAM,
        cursor: null,
        state: 'idle',
        lastEventAt: null,
        lastSuccessAt: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      watermark = await this.watermarks.save(watermark)
    }
    if (watermark.leaseExpiresAt && watermark.leaseExpiresAt.getTime() > now.getTime()) {
      throw polymarketSyncInProgress()
    }
    watermark.state = 'running'
    watermark.leaseOwner = leaseOwner
    watermark.leaseExpiresAt = new Date(now.getTime() + this.leaseMs)
    return this.watermarks.save(watermark)
  }

  private async upsertMarket(record: PolymarketMarketRecord, syncedAt: Date): Promise<number> {
    const tokensComplete = record.tokenIds.length > 0 && record.tokenIds.length === record.outcomes.length
    const state = resolveMarketState(record, tokensComplete)
    await this.markets.upsert({
      gammaMarketId: record.gammaMarketId,
      conditionId: record.conditionId,
      slug: record.slug,
      question: record.question,
      state,
      restricted: record.restricted,
      enableOrderBook: record.enableOrderBook,
      resolutionSource: record.resolutionSource,
      marketStartAt: record.startAt,
      marketEndAt: record.endAt,
      providerUpdatedAt: record.providerUpdatedAt,
      lastSyncedAt: syncedAt,
      rawPayload: record.rawPayload as never,
    }, ['gammaMarketId'])
    const mapping = await this.markets.findOneOrFail({ where: { gammaMarketId: record.gammaMarketId } })
    if (!tokensComplete) return 0
    for (let index = 0; index < record.tokenIds.length; index += 1) {
      await this.tokens.upsert({
        marketMappingId: mapping.id,
        tokenId: record.tokenIds[index],
        outcome: record.outcomes[index],
        outcomeIndex: index,
        state: state === 'resolved' ? 'resolved' : state === 'active' ? 'active' : 'inactive',
      }, ['tokenId'])
    }
    return record.tokenIds.length
  }

  private toMarketView(
    mapping: PolymarketMarketMapping,
    tokens: PolymarketTokenMapping[],
    now: Date,
  ): PolymarketMarketView {
    return {
      id: mapping.id,
      productId: mapping.productId,
      gammaMarketId: mapping.gammaMarketId,
      conditionId: mapping.conditionId,
      slug: mapping.slug,
      question: mapping.question,
      state: mapping.state,
      restricted: mapping.restricted,
      enableOrderBook: mapping.enableOrderBook,
      resolutionSource: mapping.resolutionSource,
      marketStartAt: mapping.marketStartAt,
      marketEndAt: mapping.marketEndAt,
      asOf: mapping.lastSyncedAt,
      stale: this.isStale(mapping.lastSyncedAt, now),
      tokens: tokens.map((token) => ({
        tokenId: token.tokenId,
        outcome: token.outcome,
        outcomeIndex: token.outcomeIndex,
        state: token.state,
      })),
      tradingEnabled: false,
    }
  }

  private isStale(asOf: Date, now: Date): boolean {
    return now.getTime() - asOf.getTime() > this.staleAfterMs
  }
}

function resolveMarketState(record: PolymarketMarketRecord, tokensComplete: boolean): PolymarketMarketState {
  if (record.archived) return 'archived'
  if (record.closed) return 'closed'
  if (record.active && record.conditionId && record.enableOrderBook && tokensComplete) return 'active'
  return 'discovered'
}

function boundedSeconds(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : fallback
  return Number.isInteger(parsed) && parsed >= 10 && parsed <= 86_400 ? parsed : fallback
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}
