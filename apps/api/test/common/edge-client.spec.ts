import type { Request, Response } from 'express'
import { ApiRateLimiter, createApiRateLimitMiddleware } from '../../src/common/api-rate-limit.middleware'
import { createEdgeClientMiddleware, edgeClientSignature, verifyEdgeClient } from '../../src/common/edge-client'
import { activityFromRequest } from '../../src/analytics/activity-tracking.middleware'

const SECRET = 's'.repeat(48)
const WORKER_IP = '104.28.1.1'

function signedHeaders(ip: string, country = 'JP', seconds = Math.floor(Date.now() / 1000), secret = SECRET) {
  return { 'x-client-ip': ip, 'x-client-country': country, 'x-client-sig': `v1.${seconds}.${edgeClientSignature(secret, seconds, ip, country)}` }
}

function exchange(headers: Record<string, string>, path = '/v1/auth/register/email') {
  const request = {
    method: 'POST', originalUrl: path, url: path, ip: WORKER_IP, socket: {},
    headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', ...headers },
  } as unknown as Request
  const response = { locals: {}, statusCode: 200, setHeader: jest.fn(), status(code: number) { this.statusCode = code; return this }, json: jest.fn() }
  return { request, response: response as unknown as Response & { statusCode: number } }
}

/** Runs the production middleware order: edge verification, then the rate limiter. */
function pipeline(secret: string) {
  const edge = createEdgeClientMiddleware(secret)
  const limit = createApiRateLimitMiddleware(new ApiRateLimiter())
  return (headers: Record<string, string>) => {
    const { request, response } = exchange(headers)
    let passed = false
    edge(request, response, () => limit(request, response, () => { passed = true }))
    return { passed, request, response }
  }
}

describe('edge client verification', () => {
  it('accepts a fresh signature and rejects tampering, stale timestamps and other secrets', () => {
    const now = Date.UTC(2026, 9, 13)
    const seconds = Math.floor(now / 1000)
    expect(verifyEdgeClient(signedHeaders('203.0.113.7', 'JP', seconds), SECRET, now)).toEqual({ ip: '203.0.113.7', country: 'JP' })
    expect(verifyEdgeClient({ ...signedHeaders('203.0.113.7', 'JP', seconds), 'x-client-ip': '203.0.113.9' }, SECRET, now)).toBeNull()
    expect(verifyEdgeClient(signedHeaders('203.0.113.7', 'JP', seconds - 121), SECRET, now)).toBeNull()
    expect(verifyEdgeClient(signedHeaders('203.0.113.7', 'JP', seconds, 'o'.repeat(48)), SECRET, now)).toBeNull()
    expect(verifyEdgeClient({ 'x-client-ip': '203.0.113.7' }, SECRET, now)).toBeNull()
  })

  it('strips unverified visitor headers so analytics falls back to the connection address', () => {
    const { request, response } = exchange({ 'x-client-ip': '198.51.100.1', 'x-client-country': 'KP', 'x-client-sig': 'v1.1.forged' }, '/v1/catalog/products')
    createEdgeClientMiddleware(SECRET)(request, response, () => undefined)
    expect(request.headers['x-client-ip']).toBeUndefined()
    expect(request.headers['x-client-country']).toBeUndefined()
    expect(request.headers['x-client-sig']).toBeUndefined()
    expect(activityFromRequest(request, 200)).toMatchObject({ ip: WORKER_IP, country: null })
  })

  it('keeps signed visitor headers for analytics', () => {
    const { request, response } = exchange(signedHeaders('203.0.113.7'), '/v1/catalog/products')
    createEdgeClientMiddleware(SECRET)(request, response, () => undefined)
    expect(activityFromRequest(request, 200)).toMatchObject({ ip: '203.0.113.7', country: 'JP' })
    expect(request.headers['x-client-sig']).toBeUndefined()
  })
})

describe('rate limiting behind the frontend Worker', () => {
  it('gives each signed visitor their own allowance', () => {
    const send = pipeline(SECRET)
    for (let i = 0; i < 3; i += 1) expect(send(signedHeaders('203.0.113.7')).passed).toBe(true)
    const blocked = send(signedHeaders('203.0.113.7'))
    expect(blocked.passed).toBe(false)
    expect(blocked.response.statusCode).toBe(429)
    // Another visitor behind the same Worker address is unaffected.
    expect(send(signedHeaders('203.0.113.8')).passed).toBe(true)
  })

  it('does not let a forged visitor header escape the limit', () => {
    const send = pipeline(SECRET)
    const results = ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4'].map((ip) => send({ 'x-client-ip': ip }).passed)
    expect(results).toEqual([true, true, true, false])
  })

  it('without a secret, keys by the connection address exactly as before', () => {
    const send = pipeline('')
    const results = ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4'].map((ip) => send(signedHeaders(ip)).passed)
    expect(results).toEqual([true, true, true, false])
  })
})
