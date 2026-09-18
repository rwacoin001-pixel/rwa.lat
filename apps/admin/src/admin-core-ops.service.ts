import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
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
        throw new BadGatewayException({
          code: 'CORE_ADMIN_OPS_FAILED',
          upstreamStatus: response.status,
          message: extractMessage(data) ?? `The core operations service responded with HTTP ${response.status}.`,
        })
      }
      return data as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      this.log.warn(`Core admin ops ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      throw new BadGatewayException({
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
    return null
  }
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (typeof record.message === 'string') return record.message.slice(0, 300)
  const error = record.error
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return String((error as Record<string, unknown>).message).slice(0, 300)
  }
  return null
}
