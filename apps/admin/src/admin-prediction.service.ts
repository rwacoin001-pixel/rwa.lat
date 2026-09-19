import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CORE_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

type QueryValue = string | number | undefined

function withQuery(path: string, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    params.set(key, String(value))
  }
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

/**
 * Service-to-service client for the core API's prediction internal channel
 * (/v1/internal/predictions/*): betting stats, bet list, settlement runs
 * and manual settlement trigger.
 */
@Injectable()
export class AdminPredictionService {
  private readonly log = new Logger(AdminPredictionService.name)
  private readonly coreApiUrl: string | null
  private readonly serviceToken: string | null

  constructor(config: ConfigService) {
    const base = config.get<string>('CORE_API_URL')?.trim().replace(/\/+$/, '') || ''
    this.coreApiUrl = base || null
    this.serviceToken = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || null
  }

  stats(actorId: string) {
    return this.request('GET', '/internal/predictions/stats', actorId)
  }

  bets(actorId: string, query: { page?: number; limit?: number; status?: string; marketId?: string }) {
    return this.request('GET', withQuery('/internal/predictions/bets', query), actorId)
  }

  settlements(actorId: string, query: { page?: number; limit?: number }) {
    return this.request('GET', withQuery('/internal/predictions/settlements', query), actorId)
  }

  settle(actorId: string, marketMappingId: string) {
    return this.request('POST', `/internal/predictions/settle/${encodeURIComponent(marketMappingId)}`, actorId, {})
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, actorId: string, body?: Record<string, unknown>): Promise<T> {
    if (!this.coreApiUrl || !this.serviceToken || this.serviceToken.length < 32) {
      throw new ServiceUnavailableException('The core operations channel is not configured (CORE_API_URL / ADMIN_SERVICE_TOKEN).')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CORE_TIMEOUT_MS)
    try {
      const response = await fetch(`${this.coreApiUrl}${path}`, {
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
        throw new BadGatewayException({ code: 'CORE_PREDICTION_OPS_FAILED', message: 'The core operations response was too large.' })
      }
      const data = text ? safeJson(text) : null
      if (!response.ok) {
        throw new BadGatewayException({
          code: 'CORE_PREDICTION_OPS_FAILED',
          upstreamStatus: response.status,
          message: extractMessage(data) ?? `The core operations service responded with HTTP ${response.status}.`,
        })
      }
      return data as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      this.log.warn(`Core prediction ops request ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      throw new BadGatewayException({
        code: 'CORE_PREDICTION_OPS_UNAVAILABLE',
        message: 'The core operations service could not be reached.',
      })
    } finally {
      clearTimeout(timer)
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const record = data as Record<string, unknown>
  const direct = record.message
  if (typeof direct === 'string') return direct
  const nested = record.error
  if (nested && typeof nested === 'object') {
    const message = (nested as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return undefined
}
