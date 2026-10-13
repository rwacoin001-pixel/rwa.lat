import type { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import type { DataSource } from 'typeorm'
import { ActivityRecorderService, activityDay } from '../../src/analytics/activity-recorder.service'
import { activityFromRequest } from '../../src/analytics/activity-tracking.middleware'

const KEY = 'ab'.repeat(32)
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const USER = '9f1c0001-5b2e-4c71-9a3d-7e6400000001'

function recorder(query = jest.fn().mockResolvedValue([]), key: string | undefined = KEY) {
  const db = { query } as unknown as DataSource
  const config = { get: (name: string) => (name === 'IDENTITY_HMAC_KEY' ? key : undefined) } as unknown as ConfigService
  return { service: new ActivityRecorderService(db, config), query }
}

function request(input: { url?: string; method?: string; headers?: Record<string, string>; userId?: string; ip?: string }) {
  return {
    method: input.method ?? 'GET', originalUrl: input.url ?? '/v1/catalog/products', url: input.url ?? '/v1/catalog/products',
    ip: input.ip ?? '172.18.0.4', socket: {},
    headers: { 'user-agent': IPHONE, ...input.headers },
    auth: input.userId ? { userId: input.userId } : undefined,
  } as unknown as Request
}

describe('activityDay', () => {
  it('buckets by Asia/Shanghai calendar day', () => {
    expect(activityDay(new Date('2026-10-12T15:59:59Z'))).toBe('2026-10-12')
    expect(activityDay(new Date('2026-10-12T16:00:00Z'))).toBe('2026-10-13')
  })
})

describe('ActivityRecorderService', () => {
  const at = new Date('2026-10-13T02:00:00Z')

  it('aggregates one row per visitor per day and counts requests', async () => {
    const { service, query } = recorder()
    service.record({ at, ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile' })
    service.record({ at: new Date(at.getTime() + 60_000), ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile' })
    service.record({ at, ip: '203.0.113.7', userId: USER, country: 'JP', device: 'mobile' })
    expect(service.pending).toBe(2)
    await service.flush()
    const params = query.mock.calls[0][1] as unknown[][]
    expect(params[2]).toEqual([null, USER])
    expect(params[7]).toEqual([2, 1])
    expect(String(query.mock.calls[0][0])).toContain('ON CONFLICT (day, visitor_key) DO UPDATE')
  })

  it('uses a per-day key: the same IP on different days is not linkable', () => {
    const { service } = recorder()
    const today = service.visitorKey('2026-10-13', { ip: '203.0.113.7', userId: null })
    const tomorrow = service.visitorKey('2026-10-14', { ip: '203.0.113.7', userId: null })
    expect(today.equals(tomorrow)).toBe(false)
    expect(today).toHaveLength(32)
    expect(today.toString('hex')).not.toContain('203')
  })

  it('never stores the raw IP', async () => {
    const { service, query } = recorder()
    service.record({ at, ip: '203.0.113.7', userId: null, country: null, device: 'desktop' })
    await service.flush()
    expect(JSON.stringify(query.mock.calls[0][1])).not.toContain('203.0.113.7')
  })

  it('stays disabled without a valid identity key', () => {
    const { service } = recorder(jest.fn(), 'short')
    const previous = process.env.ACTIVITY_TRACKING_ENABLED
    process.env.ACTIVITY_TRACKING_ENABLED = 'true'
    service.onModuleInit()
    expect(service.enabled).toBe(false)
    process.env.ACTIVITY_TRACKING_ENABLED = previous
  })

  it('swallows database failures', async () => {
    const { service } = recorder(jest.fn().mockRejectedValue(new Error('db down')))
    service.record({ at, ip: '203.0.113.7', userId: null, country: null, device: 'desktop' })
    await expect(service.flush()).resolves.toBeUndefined()
    expect(service.pending).toBe(0)
  })
})

describe('activityFromRequest', () => {
  it('records the Worker-supplied IP and country with the signed-in user', () => {
    const hit = activityFromRequest(request({ headers: { 'x-client-ip': '203.0.113.7', 'x-client-country': 'JP', 'cf-ipcountry': 'SG' }, userId: USER }), 200)
    expect(hit).toMatchObject({ ip: '203.0.113.7', country: 'JP', userId: USER, device: 'mobile' })
  })

  it('skips bots, unknown routes, preflights and the admin plane', () => {
    expect(activityFromRequest(request({ headers: { 'user-agent': 'curl/8.4.0' } }), 200)).toBeNull()
    expect(activityFromRequest(request({}), 404)).toBeNull()
    expect(activityFromRequest(request({ method: 'OPTIONS' }), 204)).toBeNull()
    expect(activityFromRequest(request({ url: '/v1/admin/funds/summary' }), 200)).toBeNull()
    expect(activityFromRequest(request({ url: '/v1/health' }), 200)).toBeNull()
  })
})
