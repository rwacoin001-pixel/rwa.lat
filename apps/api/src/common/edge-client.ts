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
 * Region/city are analytics metadata and are not part of the signature.
 * With EDGE_CLIENT_SIGNING_SECRET set, only a valid, fresh signature is trusted; otherwise all visitor headers
 * are removed before any handler sees them, so a direct caller cannot pick its own rate-limit identity.
 * Without the secret the headers are left for analytics only (the behaviour before signing existed).
 */
export const EDGE_CLIENT_IP_HEADER = 'x-client-ip'
export const EDGE_CLIENT_COUNTRY_HEADER = 'x-client-country'
export const EDGE_CLIENT_REGION_HEADER = 'x-client-region'
export const EDGE_CLIENT_CITY_HEADER = 'x-client-city'
export const EDGE_CLIENT_SIGNATURE_HEADER = 'x-client-sig'
export const EDGE_SIGNATURE_MAX_SKEW_SECONDS = 120
const SIGNATURE = /^(v1|v2)\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/

export type EdgeClient = { ip: string; country: string | null; brand?: 'kimeng' }

export function edgeClientSignature(secret: string, seconds: number, ip: string, country: string, brand?: 'kimeng'): string {
  const message = brand ? `v2|${seconds}|${ip}|${country}|${brand}` : `v1|${seconds}|${ip}|${country}`
  return createHmac('sha256', secret).update(message).digest('base64url')
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value
}

export function verifyEdgeClient(headers: IncomingHttpHeaders, secret: string, nowMs = Date.now()): EdgeClient | null {
  const ip = single(headers[EDGE_CLIENT_IP_HEADER])?.trim()
  const country = single(headers[EDGE_CLIENT_COUNTRY_HEADER])?.trim() ?? ''
  const match = SIGNATURE.exec(single(headers[EDGE_CLIENT_SIGNATURE_HEADER])?.trim() ?? '')
  if (!ip || ip.length > 64 || !match) return null
  const brand = match[1] === 'v2' ? single(headers['x-site-brand']) : undefined
  if (match[1] === 'v2' && brand !== 'kimeng') return null
  const seconds = Number(match[2])
  if (Math.abs(nowMs / 1000 - seconds) > EDGE_SIGNATURE_MAX_SKEW_SECONDS) return null
  const expected = Buffer.from(edgeClientSignature(secret, seconds, ip, country, brand === 'kimeng' ? brand : undefined))
  const given = Buffer.from(match[3])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { ip, country: country || null, ...(brand === 'kimeng' ? { brand } : {}) }
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
        delete request.headers[EDGE_CLIENT_REGION_HEADER]
        delete request.headers[EDGE_CLIENT_CITY_HEADER]
      }
    }
    delete request.headers[EDGE_CLIENT_SIGNATURE_HEADER]
    delete request.headers['x-site-brand']
    next()
  }
}
