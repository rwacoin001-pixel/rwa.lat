import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CORE_TIMEOUT_MS = 20_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

type QueryValue = string | number | undefined

/**
 * Service-to-service client for the core API's internal wallet operations
 * channel. The shared ADMIN_SERVICE_TOKEN authenticates this control plane;
 * every call carries the acting administrator id which the core audits.
 */
@Injectable()
export class AdminWalletOpsService {
  private readonly log = new Logger(AdminWalletOpsService.name)
  private readonly coreApiUrl: string | null
  private readonly serviceToken: string | null

  constructor(config: ConfigService) {
    const base = config.get<string>('CORE_API_URL')?.trim().replace(/\/+$/, '') || ''
    this.coreApiUrl = base || null
    this.serviceToken = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || null
  }

  depositPool(actorId: string, query: { network?: string; state?: string; limit?: number }) {
    return this.request('GET', withQuery('/internal/wallet/deposit-pool', query), actorId)
  }

  generateDepositPool(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/wallet/deposit-pool/generate', actorId, body)
  }

  importDepositPoolAddress(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/wallet/deposit-pool/import', actorId, body)
  }

  disableDepositPoolAddress(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('PUT', `/internal/wallet/deposit-pool/${encodeURIComponent(id)}/disable`, actorId, body)
  }

  withdrawalWhitelist(actorId: string, query: { network?: string; state?: string; limit?: number }) {
    return this.request('GET', withQuery('/internal/wallet/withdrawal-whitelist', query), actorId)
  }

  addWithdrawalWhitelist(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/wallet/withdrawal-whitelist', actorId, body)
  }

  revokeWithdrawalWhitelist(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('PUT', `/internal/wallet/withdrawal-whitelist/${encodeURIComponent(id)}/revoke`, actorId, body)
  }

  deposits(actorId: string, query: { state?: string; limit?: number }) {
    return this.request('GET', withQuery('/internal/wallet/deposits', query), actorId)
  }

  withdrawals(actorId: string, query: { state?: string; limit?: number }) {
    return this.request('GET', withQuery('/internal/wallet/withdrawals', query), actorId)
  }

  withdrawalReviews(actorId: string, limit?: number) {
    return this.request('GET', withQuery('/internal/wallet/withdrawals/reviews', { limit }), actorId)
  }

  approveWithdrawal(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('PUT', `/internal/wallet/withdrawals/${encodeURIComponent(id)}/approve`, actorId, body)
  }

  rejectWithdrawal(actorId: string, id: string, body: Record<string, unknown>) {
    return this.request('PUT', `/internal/wallet/withdrawals/${encodeURIComponent(id)}/reject`, actorId, body)
  }

  executeWithdrawal(actorId: string, id: string) {
    return this.request('POST', `/internal/wallet/withdrawals/${encodeURIComponent(id)}/execute`, actorId)
  }

  fundsStatus(actorId: string) {
    return this.request('GET', '/internal/wallet/funds/withdrawal-execution', actorId)
  }

  pauseFunds(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/wallet/funds/withdrawal-execution/pause', actorId, body)
  }

  requestFundsResume(actorId: string, body: Record<string, unknown>) {
    return this.request('POST', '/internal/wallet/funds/withdrawal-execution/resume-requests', actorId, body)
  }

  decideFundsResume(actorId: string, id: string, approve: boolean) {
    const action = approve ? 'approve' : 'reject'
    return this.request('PUT', `/internal/wallet/funds/withdrawal-execution/resume-requests/${encodeURIComponent(id)}/${action}`, actorId)
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
        throw new BadGatewayException({ code: 'CORE_WALLET_OPS_FAILED', message: 'The core operations response was too large.' })
      }
      const data = text ? safeJson(text) : null
      if (!response.ok) {
        throw new BadGatewayException({
          code: 'CORE_WALLET_OPS_FAILED',
          upstreamStatus: response.status,
          message: extractMessage(data) ?? `The core operations service responded with HTTP ${response.status}.`,
        })
      }
      return data as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      this.log.warn(`Core wallet ops request ${method} ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      throw new BadGatewayException({
        code: 'CORE_WALLET_OPS_UNAVAILABLE',
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
