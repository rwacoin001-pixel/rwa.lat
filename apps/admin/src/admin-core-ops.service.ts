import { BadGatewayException, GatewayTimeoutException, HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CORE_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

type QueryValue = string | number | undefined

/**
 * Core admin-domain forwarder used by the operations console pages
 * (ledger / audit / approvals / support tickets / job queue / notifications / polymarket).
 * Requests travel to the core API's /v1/admin/* routes carrying the shared service
 * token plus x-actor-admin-id, so every core-side audit entry attributes the real
 * console administrator id (the upstream RBAC check happens in this service).
 */
@Injectable()
export class AdminCoreOpsService {
  private readonly log = new Logger(AdminCoreOpsService.name)
  private readonly coreApiUrl: string | null
  private readonly serviceToken: string | null

  constructor(config: ConfigService) {
    const base = config.get<string>('CORE_API_URL')?.trim().replace(/\/+$/, '') || ''
    this.coreApiUrl = base || null
    this.serviceToken = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || null
  }

  get<T>(actorId: string, path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    return this.request<T>('GET', withQuery(path, query), actorId)
  }

  post<T>(actorId: string, path: string, body?: Record<string, unknown>, query: Record<string, QueryValue> = {}): Promise<T> {
    return this.request<T>('POST', withQuery(path, query), actorId, body ?? {})
  }

  put<T>(actorId: string, path: string, body?: Record<string, unknown>, query: Record<string, QueryValue> = {}): Promise<T> {
    return this.request<T>('PUT', withQuery(path, query), actorId, body ?? {})
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, actorId: string, body?: Record<string, unknown>): Promise<T> {
    if (!this.coreApiUrl || !this.serviceToken || this.serviceToken.length < 32) {
      throw new ServiceUnavailableException('The core operations channel is not configured (CORE_API_URL / ADMIN_SERVICE_TOKEN).')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CORE_TIMEOUT_MS)
    try {
      const response = await fetch(`${this.coreApiUrl}/admin${path}`, {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.serviceToken}`,
          'x-actor-admin-id': actorId,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await response.text()
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new BadGatewayException({ code: 'CORE_ADMIN_OPS_FAILED', message: 'The core operations response was too large.' })
      }
      const data = text ? safeJson(text) : null
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new HttpException({
            code: extractCode(data) ?? 'CORE_ADMIN_OPS_REJECTED',
            message: extractMessage(data) ?? `The request was rejected (HTTP ${response.status}).`,
          }, response.status)
        }
        throw new BadGatewayException({
          code: 'CORE_ADMIN_OPS_FAILED',
          upstreamStatus: response.status,
          message: 'The core operations service could not complete the request.',
        })
      }
      if (text && data === undefined) {
        throw new BadGatewayException({ code: 'CORE_ADMIN_OPS_INVALID_RESPONSE', message: 'The core operations service returned an invalid response.' })
      }
      return data as T
    } catch (error) {
      if (error instanceof HttpException) throw error
      this.log.warn(`Core admin ops ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.name : 'unknown error'}`)
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new GatewayTimeoutException({ code: 'CORE_ADMIN_OPS_TIMEOUT', message: 'The core operations request timed out. Please retry.' })
      }
      throw new ServiceUnavailableException({
        code: 'CORE_ADMIN_OPS_UNAVAILABLE',
        message: 'The core operations service could not be reached.',
      })
    } finally {
      clearTimeout(timer)
    }
  }
}

function withQuery(path: string, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    params.set(key, String(value))
  }
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const error = record.error
  for (const value of [record.message, error && typeof error === 'object' ? (error as Record<string, unknown>).message : null]) {
    if (typeof value === 'string') return value.slice(0, 300)
    if (Array.isArray(value)) {
      const message = value.filter((item): item is string => typeof item === 'string').slice(0, 10).join('; ').slice(0, 300)
      if (message) return message
    }
  }
  return null
}

function extractCode(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const error = record.error
  const code = typeof record.code === 'string' ? record.code : error && typeof error === 'object' ? (error as Record<string, unknown>).code : null
  return typeof code === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(code) ? code : null
}
