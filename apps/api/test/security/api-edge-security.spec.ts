import type { ExecutionContext } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { ApiRateLimiter } from '../../src/common/api-rate-limit.middleware'
import { RequestContextMiddleware } from '../../src/common/request-context.middleware'
import { MetricsAccessGuard } from '../../src/observability/metrics-access.guard'
import { MetricsController } from '../../src/observability/metrics.controller'
import { MetricsService } from '../../src/observability/metrics.service'

describe('API edge security', () => {
  it('limits authentication attempts per client IP and resets after the window', () => {
    const limiter = new ApiRateLimiter()
    const input = { method: 'POST', path: '/v1/auth/wallet/verify', ip: '203.0.113.10', now: 1_000 }
    for (let attempt = 0; attempt < 5; attempt += 1) expect(limiter.consume(input).allowed).toBe(true)
    const blocked = limiter.consume(input)
    expect(blocked).toMatchObject({ allowed: false, limit: 5, rule: 'authentication-attempt' })
    expect(blocked.retryAfterSeconds).toBe(60)
    expect(limiter.consume({ ...input, now: 61_000 }).allowed).toBe(true)
  })

  it('applies the stricter hourly registration policy independently per IP', () => {
    const limiter = new ApiRateLimiter()
    const request = { method: 'POST', path: '/v1/auth/register/email', ip: '203.0.113.11', now: 5_000 }
    for (let attempt = 0; attempt < 3; attempt += 1) expect(limiter.consume(request).allowed).toBe(true)
    expect(limiter.consume(request)).toMatchObject({ allowed: false, limit: 3, rule: 'registration' })
    expect(limiter.consume({ ...request, ip: '203.0.113.12' }).allowed).toBe(true)
  })

  it('enforces the global request ceiling', () => {
    const limiter = new ApiRateLimiter()
    const request = { method: 'GET', path: '/v1/catalog/products', ip: '203.0.113.13', now: 10_000 }
    for (let attempt = 0; attempt < 1_000; attempt += 1) expect(limiter.consume(request).allowed).toBe(true)
    expect(limiter.consume(request)).toMatchObject({ allowed: false, limit: 1_000, rule: 'global' })
  })

  it('applies the bounded partner-callback policy to custody reconciliation snapshots', () => {
    const limiter = new ApiRateLimiter()
    const request = {
      method: 'POST', path: '/v1/ledger/callbacks/custody/reconciliations', ip: '203.0.113.14', now: 10_000,
    }
    for (let attempt = 0; attempt < 300; attempt += 1) expect(limiter.consume(request).allowed).toBe(true)
    expect(limiter.consume(request)).toMatchObject({ allowed: false, limit: 300, rule: 'partner-callback' })
  })

  it('requires the configured bearer token for production metrics', () => {
    const token = 'metrics-secret-value-at-least-32-characters'
    const guard = new MetricsAccessGuard(new ConfigService({ APP_ENV: 'production', METRICS_BEARER_TOKEN: token }))
    expect(() => guard.canActivate(contextWithAuthorization('Bearer wrong'))).toThrow()
    expect(guard.canActivate(contextWithAuthorization(`Bearer ${token}`))).toBe(true)
  })

  it('exports the service registry rather than an unrelated global registry', async () => {
    const metrics = new MetricsService()
    metrics.incPartnerCallback('custody', 'deposit.confirmed', 'accepted')
    const controller = new MetricsController(metrics)
    const headers: Record<string, string> = {}
    const response = { setHeader: (name: string, value: string) => { headers[name] = value } } as unknown as Response
    const body = await controller.index(response)
    expect(body).toContain('rwa_partner_callbacks_total')
    expect(headers['Cache-Control']).toBe('no-store')
  })

  it('rejects oversized or unsafe caller-supplied request IDs', () => {
    const middleware = new RequestContextMiddleware()
    const request = { header: () => 'unsafe id with spaces' } as unknown as Request
    const headers: Record<string, string> = {}
    const response = {
      locals: {},
      setHeader: (name: string, value: string) => { headers[name] = value },
    } as unknown as Response
    const next = jest.fn()
    middleware.use(request, response, next)
    expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

function contextWithAuthorization(authorization: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext
}
