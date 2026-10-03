import { ConfigService } from '@nestjs/config'
import type { ObjectLiteral, Repository } from 'typeorm'
import type { AdminRbacService } from '../../src/admin-rbac/admin-rbac.service'
import type { PolymarketReadAdapter } from '../../src/polymarket/polymarket-adapter.interface'
import { normalizeMarket } from '../../src/polymarket/polymarket-public.adapter'
import {
  PolymarketExternalEvent,
  PolymarketMarketMapping,
  PolymarketSyncWatermark,
  PolymarketTokenMapping,
} from '../../src/polymarket/polymarket.entities'
import { POLYMARKET_ERROR_CODES } from '../../src/polymarket/polymarket.errors'
import { canonicalJson, PolymarketService } from '../../src/polymarket/polymarket.service'

function repositoryMock<T extends ObjectLiteral>() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn((value) => value),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<Repository<T>>
}

describe('PolymarketService', () => {
  let markets: jest.Mocked<Repository<PolymarketMarketMapping>>
  let tokens: jest.Mocked<Repository<PolymarketTokenMapping>>
  let watermarks: jest.Mocked<Repository<PolymarketSyncWatermark>>
  let events: jest.Mocked<Repository<PolymarketExternalEvent>>
  let adapter: jest.Mocked<PolymarketReadAdapter>
  let service: PolymarketService

  beforeEach(() => {
    markets = repositoryMock<PolymarketMarketMapping>()
    tokens = repositoryMock<PolymarketTokenMapping>()
    watermarks = repositoryMock<PolymarketSyncWatermark>()
    events = repositoryMock<PolymarketExternalEvent>()
    adapter = {
      provider: 'polymarket',
      mode: 'public-read-only',
      isEnabled: jest.fn().mockReturnValue(true),
      listMarkets: jest.fn(),
      listTrendingMarkets: jest.fn(),
      getMarketByTokenId: jest.fn(),
      getOrderBook: jest.fn(),
    }
    service = new PolymarketService(
      markets,
      tokens,
      watermarks,
      events,
      adapter,
      new ConfigService({ POLYMARKET_MARKET_STALE_SECONDS: '120' }),
      { assertPermission: jest.fn() } as unknown as AdminRbacService,
    )
  })

  it('reports not-started sync and never advertises trading', async () => {
    watermarks.findOne.mockResolvedValue(null)
    await expect(service.status()).resolves.toMatchObject({
      apiVersion: 'gamma-keyset/clob-v2',
      tradingEnabled: false,
      sync: { state: 'not_started', stale: true },
    })
  })

  it('marks persisted markets stale while preserving read-only browsing', async () => {
    markets.find.mockResolvedValue([{
      id: 'mapping-1',
      productId: null,
      gammaMarketId: 'gamma-1',
      conditionId: '0xcondition',
      slug: 'market',
      question: 'Question?',
      state: 'active',
      restricted: false,
      enableOrderBook: true,
      resolutionSource: null,
      marketStartAt: null,
      marketEndAt: null,
      lastSyncedAt: new Date('2026-01-01T00:00:00Z'),
    } as PolymarketMarketMapping])
    tokens.find.mockResolvedValue([])

    const result = await service.listMarkets(undefined, 50, new Date('2026-01-01T00:03:00Z'))

    expect(result[0]).toMatchObject({ stale: true, tradingEnabled: false })
  })

  it('deduplicates normalized external events using canonical payload evidence', async () => {
    const saved = { id: 'event-1' } as PolymarketExternalEvent
    events.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(saved)
    events.save.mockResolvedValue(saved)
    const input = {
      channel: 'user' as const,
      eventType: 'order',
      externalId: 'order-1',
      status: 'UPDATE',
      occurredAt: new Date('2026-07-15T00:00:00Z'),
      payload: { size: '1', price: '0.50' },
    }

    await expect(service.ingestExternalEvent(input)).resolves.toMatchObject({ duplicate: false })
    await expect(service.ingestExternalEvent(input)).resolves.toMatchObject({ duplicate: true })
  })

  it('keeps the external order submission gate fail-closed', () => {
    expect(() => service.assertTradingEnabled()).toThrow()
    try {
      service.assertTradingEnabled()
    } catch (error) {
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: POLYMARKET_ERROR_CODES.TRADING_DISABLED }),
      })
    }
  })

  it('publishes only active finance quotes with provider prices and reuses its short cache', async () => {
    const marketsFromGamma = [
      { id: '1', slug: 'fed-rate', question: 'Will the Fed cut rates?', active: true, closed: false, restricted: true, outcomes: '["Yes","No"]', outcomePrices: '["0.63","0.37"]', volume24hr: 9000, events: [{ id: 'fed-event', slug: 'fed-decision' }] },
      { id: '2', slug: 'sports-game', question: 'Will the Tigers win?', active: true, closed: false, outcomes: '["Yes","No"]', outcomePrices: '["0.8","0.2"]' },
      { id: '3', slug: 'bitcoin-price', question: 'Will Bitcoin reach $90,000?', active: true, closed: false, outcomes: '["Yes","No"]', outcomePrices: '["0.4","0.6"]' },
      { id: '5', slug: 'fed-rate-up', question: 'Will the Fed raise rates?', active: true, closed: false, outcomes: '["Yes","No"]', outcomePrices: '["0.2","0.8"]', events: [{ id: 'fed-event' }] },
      { id: '4', slug: 'gold-price', question: 'Will gold reach $5,000?', active: false, closed: true, outcomes: '["Yes","No"]', outcomePrices: '["0.7","0.3"]' },
    ].map(normalizeMarket).filter((item): item is NonNullable<typeof item> => item !== null)
    adapter.listTrendingMarkets.mockResolvedValue({ markets: marketsFromGamma, nextCursor: null, fetchedAt: new Date('2026-09-24T00:00:00Z') })

    const finance = await service.publicPreview('finance', new Date('2026-09-24T00:00:00Z'))
    const all = await service.publicPreview('all', new Date('2026-09-24T00:00:01Z'))

    expect(finance.items.map(item => item.id)).toEqual(['1', '3'])
    expect(finance.items[0].outcomes[0].impliedProbability).toBe(.63)
    expect(finance.items[0].eventSlug).toBe('fed-decision')
    expect(finance.items[0].volume24hUsd).toBe(9000)
    expect(finance.tradingEnabled).toBe(false)
    expect(all.items.map(item => item.id)).toContain('2')
    expect(adapter.listTrendingMarkets).toHaveBeenCalledTimes(1)
  })

  it('canonicalizes object keys for stable event hashes', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}')
  })
})
