import { Inject, Injectable, Logger } from '@nestjs/common'
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

export interface PolymarketPublicPreview {
  source: 'polymarket-gamma'
  fetchedAt: Date
  tradingEnabled: false
  items: Array<{
    id: string
    eventKey: string
    eventSlug: string | null
    slug: string
    question: string
    category: 'macro' | 'crypto' | 'commodities' | 'other'
    outcomes: Array<{ label: string; impliedProbability: number }>
    volume24hUsd: number | null
    providerUpdatedAt: Date | null
    endAt: Date | null
  }>
}

@Injectable()
export class PolymarketService {
  private readonly log = new Logger(PolymarketService.name)
  private readonly staleAfterMs: number
  private readonly leaseMs: number
  private previewCache: { until: number; value: PolymarketPublicPreview } | null = null
  private previewRequest: Promise<PolymarketPublicPreview> | null = null

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

  async publicPreview(scope: 'finance' | 'all' = 'finance', now: Date = new Date()): Promise<PolymarketPublicPreview> {
    if (!this.previewCache || this.previewCache.until <= now.getTime()) {
      if (!this.previewRequest) this.previewRequest = this.loadPublicPreview(now)
      try {
        const value = await this.previewRequest
        this.previewCache = { until: now.getTime() + 60_000, value }
      } finally {
        this.previewRequest = null
      }
    }
    const value = this.previewCache.value
    const eligible = scope === 'all' ? value.items : value.items.filter(item => item.category !== 'other')
    const picked: typeof eligible = []
    for (const category of ['macro', 'crypto', 'commodities', 'other'] as const) {
      const next = eligible.find(item => item.category === category && !picked.some(chosen => chosen.eventKey === item.eventKey))
      if (next && picked.length < 4) picked.push(next)
    }
    for (const item of eligible) {
      if (picked.length === 4) break
      if (!picked.some(chosen => chosen.eventKey === item.eventKey)) picked.push(item)
    }
    return { ...value, items: picked }
  }

  private async loadPublicPreview(now: Date): Promise<PolymarketPublicPreview> {
    const page = await this.adapter.listTrendingMarkets(100)
    const items = page.markets.flatMap((market) => {
      if (!market.active || market.closed || market.archived || (market.endAt && market.endAt <= now)) return []
      const outcomes = market.outcomes.flatMap((label, index) => {
        const price = Number(market.outcomePrices[index])
        return Number.isFinite(price) && price >= 0 && price <= 1 ? [{ label, impliedProbability: price }] : []
      })
      if (outcomes.length < 2 || outcomes.length !== market.outcomes.length) return []
      const rawVolume = market.rawPayload.volume24hr
      const volume = typeof rawVolume === 'number' ? rawVolume : typeof rawVolume === 'string' ? Number(rawVolume) : NaN
      const event = Array.isArray(market.rawPayload.events) ? market.rawPayload.events[0] : null
      const eventId = event && typeof event === 'object' && ('id' in event) ? event.id : null
      const eventSlug = event && typeof event === 'object' && ('slug' in event) && typeof event.slug === 'string' ? event.slug : null
      return [{
        id: market.gammaMarketId,
        eventKey: typeof eventId === 'string' || typeof eventId === 'number' ? String(eventId) : market.gammaMarketId,
        eventSlug,
        slug: market.slug,
        question: market.question,
        category: previewCategory(`${market.question} ${market.slug}`),
        outcomes,
        volume24hUsd: Number.isFinite(volume) && volume >= 0 ? volume : null,
        providerUpdatedAt: market.providerUpdatedAt,
        endAt: market.endAt,
      }]
    })
    return { source: 'polymarket-gamma', fetchedAt: page.fetchedAt, tradingEnabled: false, items }
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

  async getOutcomeProbability(tokenId: string): Promise<number | null> {
    const token = await this.tokens.findOne({ where: { tokenId } })
    const market = token ? await this.markets.findOne({ where: { id: token.marketMappingId } }) : null
    if (!token || !market) return null
    try {
      const response = await fetch(`https://gamma-api.polymarket.com/markets/${encodeURIComponent(market.gammaMarketId)}`, { headers: {accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'}, signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null
      const row = await response.json() as {clobTokenIds?: string | string[]; outcomePrices?: string | string[]; acceptingOrders?: boolean; closed?: boolean}
      if (row.closed || row.acceptingOrders !== true) return null
      const tokens = typeof row.clobTokenIds === 'string' ? JSON.parse(row.clobTokenIds) : row.clobTokenIds
      const prices = typeof row.outcomePrices === 'string' ? JSON.parse(row.outcomePrices) : row.outcomePrices
      if (!Array.isArray(tokens) || !Array.isArray(prices)) return null
      const index = tokens.indexOf(tokenId), price = index >= 0 ? Number(prices[index]) : NaN
      return Number.isFinite(price) && price >= 0 && price <= 1 ? price : null
    } catch { return null }
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
    // lastBookAt 记录的是【我们最后一次成功取到盘口的时间】，不是上游的变动时间。
    // 上游时间戳（asOf）只在盘口真的变化时才前进，冷门市场会长时间冻结。
    token.lastBookAt = book.fetchedAt
    await this.tokens.save(token)
    return {
      ...book,
      source: 'polymarket-clob-v2',
      // 陈旧判定必须看【我们自己这次抓取】有多新（fetchedAt），不能看上游的变动时间
      // （asOf）。用 asOf 会把"盘口 2 分钟没人交易"误判成"报价过期"，冷门市场因此
      // 永远下不了注，而 UI 给的"刷新"根本改不了上游时间戳 ⇒ 死循环。
      stale: this.isStale(book.fetchedAt, now),
      marketState: market.state,
      restricted: market.restricted,
      tradingEnabled: false as const,
    }
  }

  /**
   * 按需入库：把一个上游市场（含它的两个结果代币）补进映射表，返回是否可用。
   *
   * 背景：映射表里那 150 条是人工 SQL 塞的，代码里没有任何入库管线；而界面展示的是
   * 上游全量市场（活跃事件 2100+），于是 93% 的市场点"下注"会被
   * PREDICTION_MARKET_NOT_TRADEABLE 拒掉。这里在用户真下注时按 tokenId 反查上游补齐。
   *
   * 安全边界（重要）：
   *  - 只接受「上游确认开放」的市场：active 且未 closed/archived 且开了订单簿；
   *  - 只新增，**绝不覆盖已有的 state / market_mapping_id** —— 人工封停的市场不会
   *    因为有人下注就被"复活"；
   *  - 必须确认反查结果里真的含这个 tokenId（由适配器保证），否则宁可不上；
   *  - 任何异常都吞掉返回 false，让调用方走原来的 NOT_TRADEABLE，行为不会更差。
   */
  async ensureTokenMapped(tokenId: string): Promise<boolean> {
    if (!tokenId || !this.adapter.isEnabled()) return false
    try {
      const record = await this.adapter.getMarketByTokenId(tokenId)
      if (!record) return false
      if (!record.active || record.closed || record.archived) return false
      if (!record.enableOrderBook) return false
      if (!record.conditionId) return false
      if (record.tokenIds.length < 2 || record.tokenIds.length !== record.outcomes.length) return false

      const [marketRow] = (await this.markets.manager.query(
        `INSERT INTO app.polymarket_market_mappings
           (gamma_market_id, condition_id, slug, question, state, restricted, enable_order_book,
            resolution_source, market_start_at, market_end_at, provider_updated_at, last_synced_at, raw_payload)
         VALUES ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$10, now(), $11::jsonb)
         ON CONFLICT (gamma_market_id) DO UPDATE SET
           condition_id       = COALESCE(EXCLUDED.condition_id, app.polymarket_market_mappings.condition_id),
           slug               = EXCLUDED.slug,
           question           = EXCLUDED.question,
           restricted         = EXCLUDED.restricted,
           enable_order_book  = EXCLUDED.enable_order_book,
           resolution_source  = COALESCE(EXCLUDED.resolution_source, app.polymarket_market_mappings.resolution_source),
           market_start_at    = COALESCE(EXCLUDED.market_start_at, app.polymarket_market_mappings.market_start_at),
           market_end_at      = COALESCE(EXCLUDED.market_end_at, app.polymarket_market_mappings.market_end_at),
           provider_updated_at= COALESCE(EXCLUDED.provider_updated_at, app.polymarket_market_mappings.provider_updated_at),
           last_synced_at     = now(),
           updated_at         = now()
         RETURNING id`,
        [
          record.gammaMarketId,
          record.conditionId,
          record.slug,
          record.question,
          record.restricted,
          record.enableOrderBook,
          record.resolutionSource,
          record.startAt,
          record.endAt,
          record.providerUpdatedAt,
          JSON.stringify(record.rawPayload ?? {}),
        ],
      )) as Array<{ id: string }>
      if (!marketRow?.id) return false

      for (let i = 0; i < record.tokenIds.length; i += 1) {
        await this.tokens.manager.query(
          `INSERT INTO app.polymarket_token_mappings
             (market_mapping_id, token_id, outcome, outcome_index, state)
           VALUES ($1,$2,$3,$4,'active')
           ON CONFLICT (token_id) DO NOTHING`,
          [marketRow.id, record.tokenIds[i], record.outcomes[i] ?? `Outcome ${i + 1}`, i],
        )
      }

      // 只有真正落库且可用于内部盘才返回 true
      const [check] = (await this.tokens.manager.query(
        `SELECT 1 AS ok FROM app.polymarket_token_mappings t
           JOIN app.polymarket_market_mappings m ON m.id = t.market_mapping_id
          WHERE t.token_id = $1 AND t.state = 'active' AND m.state = 'active'
            AND m.enable_order_book = true`,
        [tokenId],
      )) as Array<{ ok: number }>
      return check?.ok === 1
    } catch (error) {
      this.log?.warn?.(
        `polymarket ensureTokenMapped failed token=${tokenId.slice(0, 16)}: ${String(error).slice(0, 160)}`,
      )
      return false
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

function previewCategory(value: string): 'macro' | 'crypto' | 'commodities' | 'other' {
  if (/\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|crypto|stablecoin|usdc)\b/i.test(value)) return 'crypto'
  if (/\b(gold|silver|crude|brent|wti|copper)\b|\b(oil price|price of oil)\b/i.test(value)) return 'commodities'
  if (/\b(fed|federal reserve|interest rates?|inflation|cpi|recession|treasur(?:y|ies)|s&p|nasdaq|dow jones|gdp|unemployment|stock market)\b/i.test(value)) return 'macro'
  return 'other'
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
