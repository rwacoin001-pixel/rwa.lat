import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CORE_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

type QueryValue = string | number | undefined

/**
 * Service-to-service client for the core API's internal basket operations
 * channel (/v1/internal/basket/*). Uses the same shared ADMIN_SERVICE_TOKEN
 * as the wallet channel; the acting administrator id travels on every call
 * and is recorded by the core audit trail.
 */
@Injectable()
export class AdminBasketService {
  private readonly log = new Logger(AdminBasketService.name)
  private readonly coreApiUrl: string | null
  private readonly serviceToken: string | null

  constructor(config: ConfigService) {
    const base = config.get<string>('CORE_API_URL')?.trim().replace(/\/+$/, '') || ''
    this.coreApiUrl = base || null
    this.serviceToken = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || null
  }

  strategies(actorId: string) {
    return this.request('GET', '/internal/basket/strategies', actorId)
  }

  strategyDetail(actorId: string, slug: string) {
    return this.request('GET', `/internal/basket/strategies/${encodeURIComponent(slug)}`, actorId)
  }

  createStrategy(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/basket/strategies', actorId, body)
  }

  createVersion(actorId: string, strategyId: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/strategies/${encodeURIComponent(strategyId)}/versions`, actorId, body)
  }

  generateAllocation(actorId: string, strategyId: string, versionId: string, body: Record<string, unknown>) {
    return this.request(
      'POST',
      `/internal/basket/strategies/${encodeURIComponent(strategyId)}/versions/${encodeURIComponent(versionId)}/allocation`,
      actorId,
      body,
    )
  }

  candidateFacets(actorId: string, query: { minScore?: number }) {
    return this.request('GET', withQuery('/internal/basket/candidate-facets', query), actorId)
  }

  activateVersion(actorId: string, strategyId: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/strategies/${encodeURIComponent(strategyId)}/activate`, actorId, body)
  }

  portfolios(actorId: string, query: { includeClosed?: string }) {
    return this.request('GET', withQuery('/internal/basket/portfolios', query), actorId)
  }

  createPortfolio(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/basket/portfolios', actorId, body)
  }

  portfolio(actorId: string, id: string) {
    return this.request('GET', `/internal/basket/portfolios/${encodeURIComponent(id)}`, actorId)
  }

  setPortfolioStatus(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/portfolios/${encodeURIComponent(id)}/status`, actorId, body)
  }

  computeNav(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/portfolios/${encodeURIComponent(id)}/nav`, actorId, body)
  }

  drift(actorId: string, id: string) {
    return this.request('GET', `/internal/basket/portfolios/${encodeURIComponent(id)}/drift`, actorId)
  }

  risk(actorId: string, id: string) {
    return this.request('GET', `/internal/basket/portfolios/${encodeURIComponent(id)}/risk`, actorId)
  }

  planRebalance(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/portfolios/${encodeURIComponent(id)}/rebalance-plans`, actorId, body)
  }

  runs(actorId: string, id: string, query: { limit?: number }) {
    return this.request('GET', withQuery(`/internal/basket/portfolios/${encodeURIComponent(id)}/runs`, query), actorId)
  }

  run(actorId: string, runId: string) {
    return this.request('GET', `/internal/basket/runs/${encodeURIComponent(runId)}`, actorId)
  }

  executeRun(actorId: string, runId: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/runs/${encodeURIComponent(runId)}/execute`, actorId, body)
  }

  recordFill(actorId: string, orderId: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/orders/${encodeURIComponent(orderId)}/fills`, actorId, body)
  }

  reconcile(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('POST', `/internal/basket/portfolios/${encodeURIComponent(id)}/reconcile`, actorId, body)
  }

  reconciliations(actorId: string, query: { limit?: number }) {
    return this.request('GET', withQuery('/internal/basket/reconciliations', query), actorId)
  }

  disclosures(actorId: string, query: { strategyId?: string }) {
    return this.request('GET', withQuery('/internal/basket/disclosures', query), actorId)
  }

  createDisclosure(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/basket/disclosures', actorId, body)
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
        throw new BadGatewayException({ code: 'CORE_BASKET_OPS_FAILED', message: 'The core operations response was too large.' })
      }
      const data = text ? safeJson(text) : null
      if (!response.ok) {
        throw new BadGatewayException({
          code: 'CORE_BASKET_OPS_FAILED',
          upstreamStatus: response.status,
          message: extractMessage(data) ?? `The core operations service responded with HTTP ${response.status}.`,
        })
      }
      return data as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      this.log.warn(`Core basket ops request ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      throw new BadGatewayException({
        code: 'CORE_BASKET_OPS_UNAVAILABLE',
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
