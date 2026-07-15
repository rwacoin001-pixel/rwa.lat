import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

type Bucket = { count: number; resetAt: number }

export class AdminRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private nextSweepAt = 0

  consume(input: { method: string; path: string; ip: string; now?: number }) {
    const now = input.now ?? Date.now()
    this.sweep(now)
    const global = this.consumeBucket(`global:${safeIp(input.ip)}`, 300, 60_000, now)
    if (!global.allowed) return { ...global, rule: 'global' }
    if (input.method.toUpperCase() === 'POST' && input.path === '/v1/admin/auth/login') {
      const login = this.consumeBucket(`login:${safeIp(input.ip)}`, 5, 60_000, now)
      return { ...login, rule: 'admin-login' }
    }
    return { ...global, rule: 'global' }
  }

  private consumeBucket(key: string, limit: number, windowMs: number, now: number) {
    let bucket = this.buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      if (!bucket && this.buckets.size >= 10_000) {
        return { allowed: false, limit, remaining: 0, retryAfterSeconds: 1 }
      }
      bucket = { count: 0, resetAt: now + windowMs }
      this.buckets.set(key, bucket)
    }
    bucket.count += 1
    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: bucket.count > limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)) : 0,
    }
  }

  private sweep(now: number) {
    if (now < this.nextSweepAt && this.buckets.size < 10_000) return
    for (const [key, bucket] of this.buckets) if (now >= bucket.resetAt) this.buckets.delete(key)
    this.nextSweepAt = now + 60_000
  }
}

export function createAdminRequestContextMiddleware(): RequestHandler {
  return (request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    const supplied = request.header('x-request-id')
    const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(supplied) ? supplied : randomUUID()
    request.requestId = requestId
    response.locals.requestId = requestId
    response.setHeader('x-request-id', requestId)
    next()
  }
}

export function createAdminRateLimitMiddleware(limiter = new AdminRateLimiter()): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const decision = limiter.consume({
      method: request.method,
      path: requestPath(request),
      ip: request.ip || request.socket.remoteAddress || 'unknown',
    })
    if (decision.allowed) {
      next()
      return
    }
    response.setHeader('Retry-After', String(decision.retryAfterSeconds))
    response.setHeader('RateLimit-Limit', String(decision.limit))
    response.setHeader('RateLimit-Remaining', '0')
    response.status(429).json({
      error: { code: 'ADMIN_RATE_LIMIT_EXCEEDED', message: 'Too many administrator requests.' },
      requestId: response.locals.requestId,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    })
  }
}

function requestPath(request: Request): string {
  try {
    return new URL(request.originalUrl || request.url, 'http://localhost').pathname
  } catch {
    return (request.originalUrl || request.url).split('?')[0]
  }
}

function safeIp(value: string): string {
  return value.trim().slice(0, 128) || 'unknown'
}
