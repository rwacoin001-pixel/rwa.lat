import type { DataSource } from 'typeorm'
import { VisitLogService, VISIT_IDLE_MS, visitorIdentity } from '../../src/analytics/visit-log.service'
import { refererPage } from '../../src/analytics/visit-classifier'
import type { ActivityHit } from '../../src/analytics/activity-recorder.service'

const USER = '9f1c0001-5b2e-4c71-9a3d-7e6400000001'
const T0 = new Date('2026-10-13T12:00:00Z').getTime()
const hit = (minutes: number, extra: Partial<ActivityHit> = {}): ActivityHit => ({
  at: new Date(T0 + minutes * 60_000), ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile',
  userAgent: 'Mozilla/5.0 (iPhone)', page: '/markets', ...extra,
})

function service(query = jest.fn().mockResolvedValue([])) {
  return { visits: new VisitLogService({ query } as unknown as DataSource), query }
}
const rows = (query: jest.Mock, call = 0) => {
  const params = query.mock.calls[call][1] as unknown[][]
  return params[0].map((id, i) => ({ id, userId: params[1][i], ip: params[2][i], firstPage: params[6][i], lastPage: params[7][i], started: params[8][i], last: params[9][i], requests: params[10][i] }))
}

describe('VisitLogService', () => {
  it('groups requests within 30 minutes of inactivity into one visit and starts a new one after', async () => {
    const { visits, query } = service()
    visits.record(hit(0, { page: '/home' }))
    visits.record(hit(10, { page: '/markets' }))
    visits.record(hit(39, { page: '/assets' }))
    visits.record(hit(39 + VISIT_IDLE_MS / 60_000 + 1, { page: '/profile' }))
    await visits.flush()
    const written = rows(query)
    expect(written).toHaveLength(2)
    expect(written[0]).toMatchObject({ ip: '203.0.113.7', requests: 3, firstPage: '/home', lastPage: '/assets', started: new Date(T0).toISOString() })
    expect(written[1]).toMatchObject({ requests: 1, firstPage: '/profile' })
    expect(String(query.mock.calls[0][0])).toContain('ON CONFLICT (id) DO UPDATE')
  })

  it('keeps extending the same row across flushes, adding only the new requests', async () => {
    const { visits, query } = service()
    visits.record(hit(0))
    await visits.flush()
    visits.record(hit(5))
    visits.record(hit(6))
    await visits.flush()
    const [first] = rows(query, 0)
    const [second] = rows(query, 1)
    expect(second.id).toBe(first.id)
    expect(second.requests).toBe(2)
    expect(String(query.mock.calls[1][0])).toContain('requests = v.requests + EXCLUDED.requests')
  })

  it('separates signed-in accounts, and anonymous visitors behind one IP with different browsers', async () => {
    const { visits, query } = service()
    visits.record(hit(0))
    visits.record(hit(1, { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }))
    visits.record(hit(2, { userId: USER }))
    await visits.flush()
    expect(rows(query).map((row) => row.userId)).toEqual([null, null, USER])
    expect(visitorIdentity({ userId: USER, ip: '1.1.1.1', userAgent: 'x' })).toBe(`u:${USER}`)
  })

  it('stores the raw client IP and never throws when the database fails', async () => {
    const { visits } = service(jest.fn().mockRejectedValue(new Error('db down')))
    visits.record(hit(0, { ip: '2001:db8::1' }))
    await expect(visits.flush()).resolves.toBeUndefined()
    expect(visits.pendingVisits).toBe(0)
  })
})

describe('refererPage', () => {
  it('keeps only the app route: no host, query, tokens or ids', () => {
    expect(refererPage('https://a-reit.com/markets?tab=rwa')).toBe('/markets')
    expect(refererPage('https://a-reit.com/verify-email?token=secret-token')).toBe('/verify-email')
    expect(refererPage('https://a-reit.com/markets/9f1c0001-5b2e-4c71-9a3d-7e6400000001')).toBe('/markets/:id')
    expect(refererPage('javascript:alert(1)')).toBeNull()
    expect(refererPage(undefined)).toBeNull()
  })
})
