import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifiedEdgeClient } from './edge-client'

type RateLimitRule = {
  name: string
  limit: number
  windowMs: number
  matches: (method: string, path: string) => boolean
  /** Count each endpoint separately, so one sign-in step never spends another's allowance. */
  perPath?: boolean
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
    name: 'transaction-password', limit: 10, windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && (path === '/v1/wallet/withdrawals' || /^\/v1\/security\/transaction-password\/(setup|change|reset)$/.test(path)),
  },
  {
    name: 'global',
    limit: 1_000,
    windowMs: MINUTE,
    matches: () => true,
  },
  {
    // Each member image upload carries up to 10 MB of bytes through the API; 4 per post keeps this generous.
    name: 'community-media-upload',
    limit: 60,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && path === '/v1/community/me/media',
  },
  {
    name: 'authentication-attempt',
    limit: 10,
    windowMs: MINUTE,
    perPath: true,
    matches: (method, path) => method === 'POST' && /^\/v1\/auth\/(verify-email|email-code\/confirm|login\/(password|email\/confirm)|flow\/(complete|resend)|password\/manage|passkey\/(challenge|verify)|wallet\/verify|oauth\/(google|x)(?:\/start)?|recover\/confirm|demo\/login)$/.test(path),
  },
  {
    name: 'registration',
    limit: 3,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && /^\/v1\/auth\/(register\/email|demo\/register)$/.test(path),
  },
  {
    // Email-first sign-in reveals whether an address is registered; this cap keeps bulk enumeration impractical.
    name: 'email-lookup',
    limit: 30,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && path === '/v1/auth/email/lookup',
  },
  {
    // Signup checks a typed invitation code live; the cap keeps guessing the 6-character space impractical.
    name: 'referral-code-lookup',
    limit: 60,
    windowMs: HOUR,
    matches: (method, path) => method === 'GET' && path.startsWith('/v1/referral/public/codes/'),
  },
  {
    name: 'email-code-delivery',
    limit: 20,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && path === '/v1/auth/email-code/request',
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
    name: 'identity-capture',
    limit: 5,
    windowMs: HOUR,
    matches: (method, path) => method === 'POST' && path === '/v1/compliance/kyc/capture',
  },
  {
    name: 'polymarket-translation',
    // 60/min, not 12/min (2026-10-02). Cost is bounded by CONTENT, not request count:
    // polymarket_translations caches every translated string, so a repeat request is a DB
    // read, not an LLM call. At 12/min a single market page (the UI sends 10 texts per
    // request) plus a couple of taps drained the allowance; the key is the client IP, so
    // mobile users behind carrier NAT shared that budget with strangers, the UI showed
    // "翻译失败，重试", and retrying could never succeed.
    limit: 60,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && (path === '/v1/polymarket/translations' || path === '/v1/polymarket/translations/content'),
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
      const client = normalizeIp(input.ip)
      const decision = this.consumeRule(rule, rule.perPath ? `${client}:${input.path}` : client, now)
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
      // Browser traffic arrives from the frontend Worker; key it by the visitor the Worker signed for.
      ip: verifiedEdgeClient(response)?.ip || request.ip || request.socket.remoteAddress || 'unknown',
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
