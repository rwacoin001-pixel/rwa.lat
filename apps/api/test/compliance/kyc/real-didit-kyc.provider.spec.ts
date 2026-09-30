import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import {
  DiditWebhookVerificationError,
  RealDiditKycProvider,
} from '../../../src/compliance/kyc/providers/real-didit-kyc.provider'

const workflowId = '11111111-2222-4333-8444-555555555555'
const sessionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function provider(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    APP_ENV: 'test',
    PUBLIC_APP_URL: 'https://rwa.lat',
    DIDIT_API_BASE_URL: 'https://verification.didit.me',
    DIDIT_API_KEY: 'test-api-key-at-least-16-characters',
    DIDIT_WORKFLOW_ID: workflowId,
    DIDIT_WEBHOOK_SECRET: 'test-webhook-secret-at-least-16-characters',
    DIDIT_CALLBACK_URL: 'https://rwa.lat/profile/kyc?status=complete',
    DIDIT_API_MAX_RETRIES: '0',
    ...overrides,
  }
  return new RealDiditKycProvider({ get: (key: string) => values[key] } as ConfigService)
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonical(item))))
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const record = value as Record<string, unknown>
  return JSON.stringify(Object.fromEntries(Object.keys(record).sort().map((key) => [key, JSON.parse(canonical(record[key]))])))
}

describe('RealDiditKycProvider', () => {
  afterEach(() => jest.restoreAllMocks())

  it('creates a hosted session with the official endpoint and x-api-key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(201, {
      session_id: sessionId,
      url: 'https://verify.didit.me/en/session/token',
      status: 'Not Started',
    }))

    const result = await provider().submitCase({ userId: 'user-123', payload: { language: 'zh-CN' } })

    expect(result).toEqual({
      providerCaseRef: sessionId,
      status: 'not_started',
      verificationUrl: 'https://verify.didit.me/en/session/token',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://verification.didit.me/v3/session/')
    expect(init?.headers).toMatchObject({ 'x-api-key': 'test-api-key-at-least-16-characters' })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      workflow_id: workflowId,
      vendor_data: 'user-123',
      callback_method: 'both',
      language: 'zh-CN',
    })
  })

  it('retrieves the authoritative decision endpoint and maps statuses', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(200, {
      session_id: sessionId,
      status: 'Awaiting User',
    }))
    await expect(provider().getCase(sessionId)).resolves.toEqual({ state: 'needs_information' })
    expect(fetchMock.mock.calls[0][0]).toBe(`https://verification.didit.me/v3/session/${sessionId}/decision/`)
  })

  it.each([
    ['Not Started', { state: 'not_started' }],
    ['InProgress', { state: 'in_progress' }],
    ['Abandoned', { state: 'expired', reason: 'didit_abandoned' }],
    ['Approved', { state: 'approved', decision: 'approved' }],
    ['Declined', { state: 'rejected', decision: 'rejected', reason: 'didit_declined' }],
    ['Kyc Expired', { state: 'expired', reason: 'didit_kycexpired' }],
    ['In Review', { state: 'submitted' }],
  ])('maps %s without persisting raw provider data', (status, expected) => {
    expect(provider().mapStatus(status)).toEqual(expected)
  })

  it('rejects unknown states instead of inventing review', () => {
    expect(() => provider().mapStatus('Unknown')).toThrow('unknown verification status')
  })

  it('verifies X-Signature-V2 over sorted Unicode-preserving JSON', () => {
    const body = {
      workflow_id: workflowId,
      status: 'Approved',
      session_id: sessionId,
      webhook_type: 'status.updated',
      event_id: 'event-1',
      decision: { name: 'José', score: 99 },
    }
    const signatureV2 = createHmac('sha256', 'test-webhook-secret-at-least-16-characters')
      .update(canonical(body), 'utf8')
      .digest('hex')
    const now = new Date('2026-07-19T00:00:00.000Z')
    const timestamp = String(Math.floor(now.getTime() / 1_000))

    expect(provider().verifyWebhook({ body, signatureV2, timestamp, now })).toEqual({
      eventId: 'event-1',
      webhookType: 'status.updated',
      sessionId,
      status: 'Approved',
      workflowId,
    })
  })

  it('rejects malformed signatures and stale webhook timestamps', () => {
    const body = {
      event_id: 'event-1',
      webhook_type: 'status.updated',
      session_id: sessionId,
      status: 'Approved',
    }
    const now = new Date('2026-07-19T00:10:00.000Z')
    expect(() => provider().verifyWebhook({
      body,
      signatureV2: 'not-hex',
      timestamp: String(Math.floor(now.getTime() / 1_000)),
      now,
    })).toThrow(DiditWebhookVerificationError)
    expect(() => provider().verifyWebhook({
      body,
      signatureV2: 'a'.repeat(64),
      timestamp: String(Math.floor(now.getTime() / 1_000) - 301),
      now,
    })).toThrow(DiditWebhookVerificationError)
  })

  it('normalizes provider failures without leaking response bodies', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(401, { api_key: 'do-not-log-this' }))
    await expect(provider().submitCase({ userId: 'user-123', payload: {} })).rejects.toMatchObject({
      code: 'PROVIDER_AUTH_FAILED',
      retryable: false,
      httpStatus: 401,
    })
  })

  it('pins the official API origin in production', () => {
    expect(() => provider({ APP_ENV: 'production', DIDIT_API_BASE_URL: 'https://proxy.example.com' }))
      .toThrow(/verification\.didit\.me/)
  })

  it('uses the documented multipart fields for all three native checks', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { request_id: sessionId, id_verification: { status: 'Approved', document_type: 'Passport', warnings: [], full_name: 'must-not-retain' } }))
      .mockResolvedValueOnce(jsonResponse(200, { request_id: workflowId, liveness: { status: 'Approved', score: 90, warnings: [] } }))
      .mockResolvedValueOnce(jsonResponse(200, { request_id: sessionId, face_match: { status: 'Approved', score: 90, warnings: [] } }))
    const image = { buffer: Buffer.from([255, 216, 255, 0]), mimetype: 'image/jpeg' }
    const result = await provider().verifyImages({ userId: 'user', documentType: 'passport', front: image, selfie: image })
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['https://verification.didit.me/v3/id-verification/', 'https://verification.didit.me/v3/passive-liveness/', 'https://verification.didit.me/v3/face-match/'])
    const forms = fetchMock.mock.calls.map(call => call[1]?.body as FormData)
    expect(forms[0].get('front_image')).toBeInstanceOf(Blob)
    expect(forms[0].get('perform_document_liveness')).toBe('true')
    expect(forms[1].get('user_image')).toBeInstanceOf(Blob)
    expect(forms[2].get('ref_image')).toBeInstanceOf(Blob)
    expect(forms.every(form => form.get('save_api_request') === 'true')).toBe(true)
    expect(JSON.stringify(result)).not.toContain('must-not-retain')
  })

  it('never retries a paid POST automatically after a timeout response', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(504, {}))
    const image = { buffer: Buffer.alloc(32), mimetype: 'image/jpeg' }
    await expect(provider({ DIDIT_API_MAX_RETRIES: '3' }).verifyImages({ userId: 'user', documentType: 'passport', front: image, selfie: image })).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a two-sided document incorrectly submitted as a passport', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(200, {
      request_id: sessionId, id_verification: { status: 'Approved', document_type: 'Identity Card', warnings: [] },
    }))
    const image = { buffer: Buffer.alloc(32), mimetype: 'image/jpeg' }
    await expect(provider().verifyImages({ userId: 'user', documentType: 'passport', front: image, selfie: image })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_REQUEST' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
