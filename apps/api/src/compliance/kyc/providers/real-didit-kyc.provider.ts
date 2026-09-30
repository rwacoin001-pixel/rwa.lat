import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  KycProvider,
  KycProviderCase,
  KycSubmissionResult,
  KycWebhookEvent,
  KycWebhookVerificationInput,
  NativeKycImages,
  NativeKycChecks,
  NativeKycCheck,
  KycImage,
} from '../../kyc-provider.interface'

const DEFAULT_BASE_URL = 'https://verification.didit.me'
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const WEBHOOK_WINDOW_SECONDS = 300

type DiditConfig = {
  apiKey: string
  baseUrl: string
  callbackUrl: string
  maxRetries: number
  retryBaseDelayMs: number
  timeoutMs: number
  webhookSecret: string
  workflowId: string
}

type DiditSessionResponse = {
  session_id?: unknown
  url?: unknown
  status?: unknown
}

export class DiditProviderError extends Error {
  constructor(
    readonly code: 'PROVIDER_AUTH_FAILED' | 'PROVIDER_RATE_LIMITED' | 'PROVIDER_INVALID_REQUEST' | 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE',
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message)
    this.name = 'DiditProviderError'
  }
}

export class DiditWebhookVerificationError extends Error {
  constructor() {
    super('Didit webhook authentication failed')
    this.name = 'DiditWebhookVerificationError'
  }
}

@Injectable()
export class RealDiditKycProvider implements KycProvider {
  readonly name = 'didit'
  readonly mode = 'live' as const
  private readonly config: DiditConfig

  constructor(config: ConfigService) {
    this.config = readDiditConfig(config)
  }

  async submitCase(input: { userId: string; payload: Record<string, unknown> }): Promise<KycSubmissionResult> {
    const data = await this.request<DiditSessionResponse>('/v3/session/', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: this.config.workflowId,
        vendor_data: input.userId,
        callback: this.config.callbackUrl,
        callback_method: 'both',
        metadata: { source: 'rwa-lat' },
        language: readLanguage(input.payload.language),
      }),
    })
    if (typeof data.session_id !== 'string' || !data.session_id || typeof data.url !== 'string' || !isHttpsUrl(data.url)) {
      throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit returned an invalid session response', false)
    }
    return {
      providerCaseRef: data.session_id,
      status: data.status === undefined ? 'not_started' : this.submissionStatus(data.status),
      verificationUrl: data.url,
    }
  }

  async getCase(ref: string): Promise<KycProviderCase> {
    if (!isUuid(ref)) throw new DiditProviderError('PROVIDER_INVALID_REQUEST', 'Invalid Didit session reference', false)
    const data = await this.request<DiditSessionResponse>(`/v3/session/${encodeURIComponent(ref)}/decision/`, {
      method: 'GET',
    })
    if (typeof data.status !== 'string') {
      throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit returned an invalid decision response', false)
    }
    return this.mapStatus(data.status)
  }

  mapStatus(status: string): KycProviderCase {
    const normalized = status.trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (normalized === 'notstarted') return { state: 'not_started' }
    if (normalized === 'inprogress') return { state: 'in_progress' }
    if (normalized === 'approved') return { state: 'approved', decision: 'approved' }
    if (normalized === 'declined' || normalized === 'rejected') {
      return { state: 'rejected', decision: 'rejected', reason: 'didit_declined' }
    }
    if (normalized === 'expired' || normalized === 'kycexpired' || normalized === 'abandoned') {
      return { state: 'expired', reason: `didit_${normalized}` }
    }
    if (normalized === 'awaitinguser' || normalized === 'requiresadditionalinfo') {
      return { state: 'needs_information' }
    }
    if (normalized === 'inreview' || normalized === 'resubmitted') return { state: 'submitted' }
    throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit returned an unknown verification status', false)
  }

  private submissionStatus(value: unknown): 'not_started' | 'in_progress' | 'submitted' {
    if (typeof value !== 'string') throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Invalid session status', false)
    const state = this.mapStatus(value).state
    if (state === 'not_started' || state === 'in_progress' || state === 'submitted') return state
    throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Unexpected new session status', false)
  }

  async verifyImages(input: NativeKycImages): Promise<NativeKycChecks> {
    const form = () => {
      const body = new FormData()
      // Provider retains evidence for review. Our database stores encrypted references only.
      body.set('save_api_request', 'true')
      body.set('vendor_data', input.userId)
      return body
    }
    const add = (body: FormData, field: string, image: KycImage) => body.set(field, new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), `${field}.${image.mimetype === 'image/png' ? 'png' : 'jpg'}`)
    const idBody = form()
    add(idBody, 'front_image', input.front)
    if (input.back) add(idBody, 'back_image', input.back)
    idBody.set('perform_document_liveness', 'true')
    const id = await this.request<Record<string, unknown>>('/v3/id-verification/', { method: 'POST', body: idBody })
    const document = nativeCheck(id, 'id_verification')
    const detected = isRecord(id.id_verification) ? id.id_verification.document_type : null
    const allowed = input.documentType === 'passport' ? ['Passport'] : ['Identity Card', "Driver's License", 'Residence Permit']
    if (document.status === 'Approved' && !allowed.includes(String(detected))) throw new DiditProviderError('PROVIDER_INVALID_REQUEST', 'The detected document does not match the selected document type', false)
    const livenessBody = form()
    add(livenessBody, 'user_image', input.selfie)
    const live = await this.request<Record<string, unknown>>('/v3/passive-liveness/', { method: 'POST', body: livenessBody })
    const liveness = nativeCheck(live, 'liveness', true)
    const faceBody = form()
    add(faceBody, 'user_image', input.selfie)
    // Match against the same authenticated document image; never follow provider media URLs.
    add(faceBody, 'ref_image', input.front)
    const face = await this.request<Record<string, unknown>>('/v3/face-match/', { method: 'POST', body: faceBody })
    const references = [id, live, face].map(data => {
      if (typeof data.request_id !== 'string' || !isUuid(data.request_id)) throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Invalid native request reference', false)
      return data.request_id
    })
    return { references, document, liveness, faceMatch: nativeCheck(face, 'face_match', true) }
  }

  verifyWebhook(input: KycWebhookVerificationInput): KycWebhookEvent {
    if (!isFreshTimestamp(input.timestamp, input.now ?? new Date())) throw new DiditWebhookVerificationError()
    if (!/^[a-f0-9]{64}$/i.test(input.signatureV2)) throw new DiditWebhookVerificationError()
    if (!isRecord(input.body)) throw new DiditWebhookVerificationError()

    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(JSON.stringify(sortKeys(input.body)), 'utf8')
      .digest()
    const supplied = Buffer.from(input.signatureV2, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new DiditWebhookVerificationError()
    }

    const webhookType = readBoundedString(input.body.webhook_type, 128)
    const status = readBoundedString(input.body.status, 64)
    const rawSessionId = readBoundedString(input.body.session_id, 128)
    if (rawSessionId && !isUuid(rawSessionId)) throw new DiditWebhookVerificationError()
    const sessionId = rawSessionId
    // Console "Try Webhook" test deliveries omit event_id (real events include
    // it). Synthesize a stable identifier so audit trails stay meaningful
    // without weakening the signature or timestamp checks.
    const eventId = readBoundedString(input.body.event_id, 128)
      || `didit-${sessionId || 'unknown'}-${String(input.body.timestamp ?? 'na')}`
    const workflowId = optionalBoundedString(input.body.workflow_id, 128)
    if (!webhookType || !status) throw new DiditWebhookVerificationError()
    return { eventId, webhookType, sessionId, status, workflowId }
  }

  private async request<T>(path: string, init: { method: 'GET' | 'POST'; body?: string | FormData }): Promise<T> {
    // Paid POSTs may have succeeded even if their response was lost. Never replay them automatically.
    const maxRetries = init.method === 'GET' ? this.config.maxRetries : 0
    let lastError: DiditProviderError | undefined
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const response = await fetch(`${this.config.baseUrl}${path}`, {
          method: init.method,
          body: init.body,
          headers: {
            'x-api-key': this.config.apiKey,
            Accept: 'application/json',
            ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          },
          redirect: 'error',
          signal: controller.signal,
        })
        if (!response.ok) {
          lastError = errorForStatus(response.status)
          if (!lastError.retryable || attempt === maxRetries) throw lastError
          await delay(retryDelay(response.headers.get('retry-after'), attempt, this.config.retryBaseDelayMs))
          continue
        }
        return await parseJsonResponse<T>(response)
      } catch (error) {
        const normalized = normalizeRequestError(error)
        lastError = normalized
        if (!normalized.retryable || attempt === maxRetries) throw normalized
        await delay(this.config.retryBaseDelayMs * (2 ** attempt))
      } finally {
        clearTimeout(timeout)
      }
    }
    throw lastError ?? new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit request failed', false)
  }
}

function nativeCheck(data: Record<string, unknown>, key: string, scoreRequired = false): NativeKycCheck {
  const check = data[key]
  if (!isRecord(check) || !['Approved', 'Declined'].includes(String(check.status)) || !Array.isArray(check.warnings)) throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Invalid native verification result', false)
  const score = typeof check.score === 'number' && Number.isFinite(check.score) && check.score >= 0 && check.score <= 100 ? check.score : undefined
  if (scoreRequired && check.status === 'Approved' && score === undefined) throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Native verification score is missing', false)
  const warnings = check.warnings.map(warning => {
    if (!isRecord(warning) || typeof warning.risk !== 'string' || !/^[A-Z0-9_]{1,128}$/.test(warning.risk)) throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Invalid native warning', false)
    return warning.risk
  })
  return { status: check.status as NativeKycCheck['status'], score, warnings }
}

function readDiditConfig(config: ConfigService): DiditConfig {
  const environment = config.get<string>('APP_ENV') ?? 'development'
  const apiKey = requireValue(config, 'DIDIT_API_KEY', 16)
  const workflowId = requireValue(config, 'DIDIT_WORKFLOW_ID', 1)
  const webhookSecret = requireValue(config, 'DIDIT_WEBHOOK_SECRET', 16)
  if (!isUuid(workflowId)) throw new Error('DIDIT_WORKFLOW_ID must be a UUID')

  const baseUrl = normalizeBaseUrl(config.get<string>('DIDIT_API_BASE_URL') ?? DEFAULT_BASE_URL, environment)
  const callbackUrl = config.get<string>('DIDIT_CALLBACK_URL')
    ?? `${(config.get<string>('PUBLIC_APP_URL') ?? '').replace(/\/$/, '')}/profile/kyc?status=complete`
  if (!isHttpsUrl(callbackUrl) || (environment === 'production' && isLocalUrl(callbackUrl))) {
    throw new Error('DIDIT_CALLBACK_URL must be a non-local HTTPS URL')
  }

  return {
    apiKey,
    workflowId,
    webhookSecret,
    baseUrl,
    callbackUrl,
    timeoutMs: readInteger(config, 'DIDIT_API_TIMEOUT_MS', 10_000, 1_000, 30_000),
    maxRetries: readInteger(config, 'DIDIT_API_MAX_RETRIES', 2, 0, 3),
    retryBaseDelayMs: readInteger(config, 'DIDIT_API_RETRY_BASE_DELAY_MS', 500, 100, 5_000),
  }
}

function normalizeBaseUrl(raw: string, environment: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('DIDIT_API_BASE_URL must be a valid URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('DIDIT_API_BASE_URL must be an HTTPS origin without credentials or a path')
  }
  if (environment === 'production' && url.origin !== DEFAULT_BASE_URL) {
    throw new Error(`DIDIT_API_BASE_URL must be ${DEFAULT_BASE_URL} in production`)
  }
  return url.origin
}

function requireValue(config: ConfigService, key: string, minimumLength: number): string {
  const value = config.get<string>(key)?.trim() ?? ''
  if (value.length < minimumLength) throw new Error(`${key} must contain at least ${minimumLength} characters`)
  return value
}

function readInteger(config: ConfigService, key: string, fallback: number, minimum: number, maximum: number): number {
  const raw = config.get<string>(key)
  if (raw === undefined || raw === '') return fallback
  if (!/^\d+$/.test(raw)) throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`)
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`)
  }
  return parsed
}

function readLanguage(value: unknown): string {
  return typeof value === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value) ? value : 'en'
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isLocalUrl(value: string): boolean {
  const host = new URL(value).hostname
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
}

function isFreshTimestamp(value: string, now: Date): boolean {
  if (!/^\d{10}$/.test(value)) return false
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && Math.abs(Math.floor(now.getTime() / 1_000) - seconds) <= WEBHOOK_WINDOW_SECONDS
}

function readBoundedString(value: unknown, maximum: number): string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : ''
}

function optionalBoundedString(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null) return undefined
  return readBoundedString(value, maximum) || undefined
}

function errorForStatus(status: number): DiditProviderError {
  if (status === 401 || status === 403) return new DiditProviderError('PROVIDER_AUTH_FAILED', 'Didit rejected the API credentials', false, status)
  if (status === 400 || status === 404 || status === 422) return new DiditProviderError('PROVIDER_INVALID_REQUEST', 'Didit rejected the request', false, status)
  if (status === 408 || status === 504) return new DiditProviderError('PROVIDER_TIMEOUT', 'Didit request timed out', true, status)
  if (status === 429) return new DiditProviderError('PROVIDER_RATE_LIMITED', 'Didit rate limit reached', true, status)
  if (status >= 500) return new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit service is unavailable', true, status)
  return new DiditProviderError('PROVIDER_UNAVAILABLE', `Didit request failed with status ${status}`, false, status)
}

function normalizeRequestError(error: unknown): DiditProviderError {
  if (error instanceof DiditProviderError) return error
  if (error instanceof Error && error.name === 'AbortError') {
    return new DiditProviderError('PROVIDER_TIMEOUT', 'Didit request timed out', true)
  }
  return new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit request failed', true)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit response exceeded the safety limit', false)
  }
  const body = await response.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit response exceeded the safety limit', false)
  }
  try {
    return JSON.parse(body) as T
  } catch {
    throw new DiditProviderError('PROVIDER_UNAVAILABLE', 'Didit returned invalid JSON', false)
  }
}

function retryDelay(retryAfter: string | null, attempt: number, baseDelayMs: number): number {
  if (retryAfter && /^\d+$/.test(retryAfter)) return Math.min(Number(retryAfter) * 1_000, 5_000)
  return Math.min(baseDelayMs * (2 ** attempt), 5_000)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
