import type { NextFunction, Request, RequestHandler, Response } from 'express'

type RateLimitRule = {
  name: string
  limit: number
  windowMs: number
  matches: (method: string, path: string) => boolean
}

type Bucket = { count: number; resetAt: number }

export type RateLimitDecision = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
  rule: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const MAX_BUCKETS = 50_000

const RULES: RateLimitRule[] = [
  {
    name: 'global',
    limit: 1_000,
    windowMs: MINUTE,
    matches: () => true,
  },
  {
    name: 'authentication-attempt',
    limit: 5,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && /^\/v1\/auth\/(verify-email|wallet\/verify|oauth\/(google|x)(?:\/start)?|recover\/confirm|demo\/login)$/.test(path),
  },
  {
    name: 'registration',
    limit: 3,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && /^\/v1\/auth\/(register\/email|demo\/register)$/.test(path),
  },
  {
    name: 'account-recovery',
    limit: 5,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && path === '/v1/auth/recover',
  },
  {
    name: 'step-up',
    limit: 10,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && path.startsWith('/v1/security/step-up/'),
  },
  {
    name: 'partner-callback',
    limit: 300,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && /^\/v1\/(job-queue\/callbacks|compliance\/kyc\/webhooks\/didit|wallet\/callbacks\/custody\/(deposits|withdrawals)|ledger\/callbacks\/custody\/reconciliations)$/.test(path),
  },
]

export class ApiRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private nextSweepAt = 0

  consume(input: { method: string; path: string; ip: string; now?: number }): RateLimitDecision {
    const now = input.now ?? Date.now()
    this.sweepExpired(now)

    let strictest: RateLimitDecision = {
      allowed: true,
      limit: RULES[0].limit,
      remaining: RULES[0].limit,
      retryAfterSeconds: 0,
      rule: RULES[0].name,
    }

    for (const rule of RULES) {
      if (!rule.matches(input.method.toUpperCase(), input.path)) continue
      const decision = this.consumeRule(rule, normalizeIp(input.ip), now)
      if (!decision.allowed) return decision
      if (decision.remaining / decision.limit < strictest.remaining / strictest.limit) strictest = decision
    }

    return strictest
  }

  private consumeRule(rule: RateLimitRule, ip: string, now: number): RateLimitDecision {
    const key = `${rule.name}:${ip}`
    let bucket = this.buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      if (!bucket && this.buckets.size >= MAX_BUCKETS) {
        return { allowed: false, limit: rule.limit, remaining: 0, retryAfterSeconds: 1, rule: 'capacity-protection' }
      }
      bucket = { count: 0, resetAt: now + rule.windowMs }
      this.buckets.set(key, bucket)
    }

    bucket.count += 1
    return {
      allowed: bucket.count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - bucket.count),
      retryAfterSeconds: bucket.count > rule.limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)) : 0,
      rule: rule.name,
    }
  }

  private sweepExpired(now: number) {
    if (now < this.nextSweepAt && this.buckets.size < MAX_BUCKETS) return
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key)
    }
    this.nextSweepAt = now + MINUTE
  }
}

export function createApiRateLimitMiddleware(limiter = new ApiRateLimiter()): RequestHandler {
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
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Retry after the indicated delay.',
      },
      requestId: response.locals.requestId,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    })
  }
}

function requestPath(request: Request): string {
  const raw = request.originalUrl || request.url || '/'
  try {
    return new URL(raw, 'http://localhost').pathname
  } catch {
    return raw.split('?')[0]
  }
}

function normalizeIp(value: string): string {
  return value.trim().slice(0, 128) || 'unknown'
}
