import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CORE_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/**
 * Service-to-service client for the core API's Koala Quant operations channel (/v1/internal/quant/*).
 * Same shared ADMIN_SERVICE_TOKEN as the basket channel; the acting administrator id travels on every call so the
 * core audit trail and the enter/approve separation of duties see the real operator.
 */
@Injectable()
export class AdminQuantService {
  private readonly log = new Logger(AdminQuantService.name)
  private readonly coreApiUrl: string | null
  private readonly serviceToken: string | null

  constructor(config: ConfigService) {
    const base = config.get<string>('CORE_API_URL')?.trim().replace(/\/+$/, '') || ''
    this.coreApiUrl = base || null
    this.serviceToken = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || null
  }

  products(actorId: string) {
    return this.request('GET', '/internal/quant/products', actorId)
  }

  product(actorId: string, slug: string) {
    return this.request('GET', `/internal/quant/products/${encodeURIComponent(slug)}`, actorId)
  }

  updateProduct(actorId: string, slug: string, body: Record<string, unknown>) {
    return this.request('PATCH', `/internal/quant/products/${encodeURIComponent(slug)}`, actorId, body)
  }

  settlements(actorId: string, slug: string, limit?: string) {
    return this.request('GET', `/internal/quant/products/${encodeURIComponent(slug)}/settlements${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`, actorId)
  }

  enter(actorId: string, slug: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/quant/products/${encodeURIComponent(slug)}/settlements`, actorId, body)
  }

  approve(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/quant/settlements/${encodeURIComponent(id)}/approve`, actorId, body)
  }

  post(actorId: string, id: string) {
    return this.request('POST', `/internal/quant/settlements/${encodeURIComponent(id)}/post`, actorId, {})
  }

  void(actorId: string, id: string) {
    return this.request('POST', `/internal/quant/settlements/${encodeURIComponent(id)}/void`, actorId, {})
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, actorId: string, body?: Record<string, unknown>): Promise<T> {
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
      if (text.length > MAX_RESPONSE_BYTES) throw new BadGatewayException({ code: 'CORE_QUANT_OPS_FAILED', message: 'The core operations response was too large.' })
      const data = text ? safeJson(text) : null
      if (!response.ok) {
        // Business rejections (out-of-order date, self-approval, large move) keep their code so the console can explain them.
        throw new BadGatewayException({
          code: 'CORE_QUANT_OPS_FAILED',
          upstreamStatus: response.status,
          upstreamCode: extractCode(data),
          message: extractMessage(data) ?? `The core operations service responded with HTTP ${response.status}.`,
        })
      }
      return data as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      this.log.warn(`Core quant ops request ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      throw new BadGatewayException({ code: 'CORE_QUANT_OPS_UNAVAILABLE', message: 'The core operations service could not be reached.' })
    } finally {
      clearTimeout(timer)
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractCode(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (typeof record.code === 'string') return record.code
  const error = record.error
  return error && typeof error === 'object' && typeof (error as Record<string, unknown>).code === 'string' ? String((error as Record<string, unknown>).code) : null
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (typeof record.message === 'string') return record.message.slice(0, 300)
  const error = record.error
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') return String((error as Record<string, unknown>).message).slice(0, 300)
  return null
}
