import { ConfigService } from '@nestjs/config'
import { PolymarketPublicAdapter, normalizeMarket } from '../../src/polymarket/polymarket-public.adapter'
import { POLYMARKET_ERROR_CODES } from '../../src/polymarket/polymarket.errors'

describe('PolymarketPublicAdapter', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('uses Gamma keyset pagination and normalizes stringified token arrays', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      markets: [{
        id: '123',
        slug: 'will-it-happen',
        question: 'Will it happen?',
        conditionId: '0xcondition',
        active: true,
        closed: false,
        enableOrderBook: true,
        outcomes: '["Yes","No"]',
        clobTokenIds: '["token-yes","token-no"]',
        outcomePrices: '["0.62","0.38"]',
      }],
      next_cursor: 'cursor-2',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    global.fetch = fetchMock
    const adapter = new PolymarketPublicAdapter(new ConfigService({ POLYMARKET_READ_ENABLED: 'true' }))

    const page = await adapter.listMarkets('cursor-1', 200)

    expect(page.nextCursor).toBe('cursor-2')
    expect(page.markets[0]).toMatchObject({
      gammaMarketId: '123',
      tokenIds: ['token-yes', 'token-no'],
      outcomes: ['Yes', 'No'],
      outcomePrices: ['0.62', '0.38'],
    })
    const requested = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requested.pathname).toBe('/markets/keyset')
    expect(requested.searchParams.get('after_cursor')).toBe('cursor-1')
    expect(requested.searchParams.get('limit')).toBe('100')
    expect(adapter.mode).toBe('public-read-only')
  })

  it('rejects an order book returned for another token', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      asset_id: 'different-token',
      market: '0xcondition',
      timestamp: '1766789469958',
      bids: [],
      asks: [],
    }), { status: 200 }))
    const adapter = new PolymarketPublicAdapter(new ConfigService({ POLYMARKET_READ_ENABLED: 'true' }))

    await expect(adapter.getOrderBook('requested-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE }),
    })
  })

  it('reads trending public markets from Gamma without opening a trading path', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: '987', slug: 'fed-rate', question: 'Will the Fed cut rates?', active: true, closed: false,
      outcomes: '["Yes","No"]', outcomePrices: '["0.63","0.37"]', volume24hr: 9000,
    }]), { status: 200 }))
    global.fetch = fetchMock
    const adapter = new PolymarketPublicAdapter(new ConfigService({ POLYMARKET_READ_ENABLED: 'true' }))

    const page = await adapter.listTrendingMarkets(100)

    expect(page.markets[0]).toMatchObject({ gammaMarketId: '987', outcomePrices: ['0.63', '0.37'] })
    const requested = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requested.pathname).toBe('/markets')
    expect(requested.searchParams.get('order')).toBe('volume24hr')
    expect(requested.searchParams.get('ascending')).toBe('false')
  })

  it('fails closed when public market-data access is disabled', async () => {
    const adapter = new PolymarketPublicAdapter(new ConfigService({ POLYMARKET_READ_ENABLED: 'false' }))
    await expect(adapter.listMarkets()).rejects.toMatchObject({
      response: expect.objectContaining({ code: POLYMARKET_ERROR_CODES.INTEGRATION_DISABLED }),
    })
  })

  it('drops malformed Gamma records instead of inventing identifiers', () => {
    expect(normalizeMarket({ id: '123', slug: 'missing-question' })).toBeNull()
  })

  it('fetches a known closed market by exact ID without active-market filters', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      id: '123', slug: 'finished', question: 'Finished?', closed: true,
      umaResolutionStatus: 'resolved', outcomes: '["Yes","No"]',
      clobTokenIds: '["yes","no"]', outcomePrices: '["1","0"]',
    }), { status: 200 }))
    global.fetch = fetchMock
    const adapter = new PolymarketPublicAdapter(new ConfigService({}))
    const market = await adapter.getMarketById('123')
    expect(market?.rawPayload.umaResolutionStatus).toBe('resolved')
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/markets/123')
    expect(url.search).toBe('')
  })

  it('rejects a market returned for the wrong Gamma ID', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'other', slug: 'wrong', question: 'Wrong?',
    }), { status: 200 }))
    await expect(new PolymarketPublicAdapter(new ConfigService({})).getMarketById('123'))
      .rejects.toMatchObject({ response: { code: POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE } })
  })
})
