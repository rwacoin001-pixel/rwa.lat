import { GET } from '../../src/polymarket/public/feed'
import { publicFetch } from '../../src/polymarket/public/public-fetch'
import { POLYMARKET_SORTS } from '../../src/polymarket/public/feed-types'

jest.mock('../../src/polymarket/public/public-fetch', () => ({ publicFetch: jest.fn() }))
const fetchMock = publicFetch as jest.Mock
const now = new Date('2026-11-05T00:00:00Z')
const market = (id: string, extra = {}) => ({ id, question: `Question ${id}`, active: true, closed: false,
  endDate: '2027-01-01T00:00:00Z', outcomes: ['Yes', 'No'], outcomePrices: ['0.6', '0.4'], ...extra })
const event = (id: string, extra = {}) => ({ id, title: `Event ${id}`, active: true, closed: false,
  endDate: '2027-01-01T00:00:00Z', markets: [market(id)], ...extra })
const get = (query = '') => GET(new Request(`https://api.test/v1/polymarket/public/feed?${query}`))
const query = () => new URL(String(fetchMock.mock.calls[0][0])).searchParams

describe('public prediction feed filters', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now)
    fetchMock.mockReset().mockImplementation(async (url: string) => url.includes('/slug/')
      ? new Response('', { status: 404 }) : Response.json([event('1'), event('2')]))
  })
  afterEach(() => { jest.useRealTimers() })

  it('keeps the default active query and first-page featured/pulse slots', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(Object.fromEntries(query())).toMatchObject({ active: 'true', closed: 'false', order: 'volume24hr', ascending: 'false', limit: '20', offset: '0' })
    expect(query().has('end_date_min')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((await response.json()).items.some((item: { featured: boolean }) => item.featured)).toBe(true)
  })

  it.each(POLYMARKET_SORTS)('passes sort %s with the existing direction rules', async sort => {
    expect((await get(`sort=${sort}&offset=20`)).status).toBe(200)
    expect(query().get('order')).toBe(sort === 'competitive' ? 'volume24hr' : sort)
    expect(query().get('ascending')).toBe(String(sort === 'endDate'))
  })

  it.each(['createdAt', 'competitive'])('screens micro markets and advances by provider records for %s', async sort => {
    fetchMock.mockResolvedValue(Response.json(Array.from({ length: 60 }, (_, index) => event(String(index),
      index % 2 ? {} : { title: 'Bitcoin Up or Down - November 5' }))))
    const body = await (await get(`sort=${sort}`)).json()
    expect(query().get('limit')).toBe('60')
    expect(body.items).toHaveLength(30)
    expect(body.nextOffset).toBe(60)
    expect(body.items.every((item: { question: string }) => !item.question.includes('Up or Down'))).toBe(true)
  })

  it('orders competitive by the Gamma competitive score over the most-traded markets', async () => {
    fetchMock.mockResolvedValue(Response.json([event('1', { competitive: 0.2 }), event('2', { competitive: 0.95 }), event('3', { competitive: 0.6 })]))
    const body = await (await get('sort=competitive')).json()
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(['event-2', 'event-3', 'event-1'])
  })

  it('keeps explicit search results even for competitive micro markets', async () => {
    fetchMock.mockResolvedValue(Response.json([event('1', { title: 'Bitcoin Up or Down - November 5' })]))
    const body = await (await get('sort=competitive&q=Bitcoin')).json()
    expect(query().get('title_search')).toBe('Bitcoin')
    expect(query().get('limit')).toBe('20')
    expect(body.items).toHaveLength(1)
  })

  it.each([['day', 1], ['week', 7], ['month', 30]] as const)('bounds active %s by %i days', async (window, days) => {
    const body = await (await get(`window=${window}`)).json()
    expect(query().get('end_date_min')).toBe(now.toISOString())
    expect(query().get('end_date_max')).toBe(new Date(now.getTime() + days * 86_400_000).toISOString())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(body.items.every((item: { featured: boolean }) => !item.featured)).toBe(true)
  })

  it('keeps endDate minimum for the active all window', async () => {
    await get('sort=endDate')
    expect(query().get('end_date_min')).toBe(now.toISOString())
    expect(query().has('end_date_max')).toBe(false)
  })

  it.each(['all', 'day', 'week', 'month'])('shows closed past markets without time bounds or slots for resolved/%s', async window => {
    fetchMock.mockResolvedValue(Response.json([event('old', { active: false, closed: true, resolved: true,
      endDate: '2026-01-01T00:00:00Z', markets: [market('closed', { active: false, closed: true, resolved: true, endDate: '2026-01-01T00:00:00Z' }), market('open')] })]))
    const body = await (await get(`status=resolved&window=${window}&sort=endDate`)).json()
    expect(query().get('closed')).toBe('true')
    expect(query().has('active')).toBe(false)
    expect(query().has('end_date_min')).toBe(false)
    expect(query().has('end_date_max')).toBe(false)
    expect(query().get('order')).toBe('endDate')
    expect(body.items).toEqual([expect.objectContaining({ id: 'event-old', closed: true, resolved: true, active: false, marketIds: ['closed'], featured: false })])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('omits featured/pulse slots for resolved volume24hr too', async () => {
    await get('status=resolved')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retains archived closed history without claiming that every closed market is resolved', async () => {
    fetchMock.mockResolvedValue(Response.json([event('archived', { closed: true, archived: true,
      markets: [market('closed', { closed: true, archived: true })] })]))
    const body = await (await get('status=resolved')).json()
    expect(body.items).toEqual([expect.objectContaining({ id: 'event-archived', closed: true, resolved: false })])
  })

  it('repeats excluded tags, deduplicates known values, and ignores unknown values', async () => {
    const body = await (await get('hide=sports,crypto,earnings,unknown,crypto')).json()
    expect(query().getAll('exclude_tag_id')).toEqual(['1', '21', '1013'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(body.items.every((item: { featured: boolean }) => !item.featured)).toBe(true)
  })

  it('ignores unknown-only hide values including for slot eligibility', async () => {
    expect((await get('hide=unknown')).status).toBe(200)
    expect(query().has('exclude_tag_id')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('combines existing category, search, offset with new filters', async () => {
    await get('category=politics&q=Senate&offset=20&sort=competitive&window=week&hide=sports')
    expect(Object.fromEntries(query())).toMatchObject({ tag_id: '2', title_search: 'Senate', offset: '20', order: 'volume24hr', exclude_tag_id: '1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['sort=bad', 'status=closed', 'window=year', 'status=', 'window=', 'sort=', 'category=bad', 'offset=1', 'offset=-20', 'offset=100020', `q=${'x'.repeat(121)}`])('rejects invalid parameters %s before upstream access', async params => {
    expect((await get(params)).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
