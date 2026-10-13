import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * The a-reit.com Worker proxies browser /v1 traffic, so request.ip is the Worker's egress address and every
 * visitor behind it would share one rate-limit bucket. The Worker passes the visitor's address in
 * x-client-ip / x-client-country and signs them (lib/edge-client-headers.mjs):
 *
 *   x-client-sig: v1.<unix seconds>.<base64url HMAC-SHA256(secret, "v1|<seconds>|<ip>|<country>")>
 *
 * With EDGE_CLIENT_SIGNING_SECRET set, only a valid, fresh signature is trusted; otherwise all three headers
 * are removed before any handler sees them, so a direct caller cannot pick its own rate-limit identity.
 * Without the secret the headers are left for analytics only (the behaviour before signing existed).
 */
export const EDGE_CLIENT_IP_HEADER = 'x-client-ip'
export const EDGE_CLIENT_COUNTRY_HEADER = 'x-client-country'
export const EDGE_CLIENT_SIGNATURE_HEADER = 'x-client-sig'
export const EDGE_SIGNATURE_MAX_SKEW_SECONDS = 120
const SIGNATURE = /^v1\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/

export type EdgeClient = { ip: string; country: string | null }

export function edgeClientSignature(secret: string, seconds: number, ip: string, country: string): string {
  return createHmac('sha256', secret).update(`v1|${seconds}|${ip}|${country}`).digest('base64url')
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value
}

export function verifyEdgeClient(headers: IncomingHttpHeaders, secret: string, nowMs = Date.now()): EdgeClient | null {
  const ip = single(headers[EDGE_CLIENT_IP_HEADER])?.trim()
  const country = single(headers[EDGE_CLIENT_COUNTRY_HEADER])?.trim() ?? ''
  const match = SIGNATURE.exec(single(headers[EDGE_CLIENT_SIGNATURE_HEADER])?.trim() ?? '')
  if (!ip || ip.length > 64 || !match) return null
  const seconds = Number(match[1])
  if (Math.abs(nowMs / 1000 - seconds) > EDGE_SIGNATURE_MAX_SKEW_SECONDS) return null
  const expected = Buffer.from(edgeClientSignature(secret, seconds, ip, country))
  const given = Buffer.from(match[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { ip, country: country || null }
}

/** The verified visitor for this request, set by createEdgeClientMiddleware; null when not signed. */
export function verifiedEdgeClient(response: Response): EdgeClient | null {
  return (response.locals?.edgeClient as EdgeClient | undefined) ?? null
}

export function createEdgeClientMiddleware(secret = process.env.EDGE_CLIENT_SIGNING_SECRET?.trim() ?? ''): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    if (secret) {
      const client = verifyEdgeClient(request.headers, secret)
      if (client) {
        response.locals.edgeClient = client
      } else {
        delete request.headers[EDGE_CLIENT_IP_HEADER]
        delete request.headers[EDGE_CLIENT_COUNTRY_HEADER]
      }
    }
    delete request.headers[EDGE_CLIENT_SIGNATURE_HEADER]
    next()
  }
}
