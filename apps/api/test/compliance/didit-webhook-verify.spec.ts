import { createHmac } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DiditWebhookVerificationError, RealDiditKycProvider } from '../../src/compliance/kyc/providers/real-didit-kyc.provider'

const SECRET = 'test-webhook-secret-0123456789abcdef'
const WORKFLOW_ID = 'e31ff861-0416-4956-b2b5-37c654d8b45c'
const SESSION_ID = '68db5b93-fc11-4c1e-8ddd-90f8e96f25a3'
const EVENT_TIME = 1789684770
const NOW = new Date(EVENT_TIME * 1000)

function provider() {
  const config = {
    get: (key: string) => {
      switch (key) {
        case 'APP_ENV': return 'test'
        case 'DIDIT_API_KEY': return 'k'.repeat(32)
        case 'DIDIT_WORKFLOW_ID': return WORKFLOW_ID
        case 'DIDIT_WEBHOOK_SECRET': return SECRET
        case 'DIDIT_CALLBACK_URL': return 'https://example.com/profile/kyc?status=complete'
        default: return undefined
      }
    },
  } as unknown as ConfigService
  return new RealDiditKycProvider(config)
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]))
  }
  return value
}

function sign(body: unknown, secret = SECRET): string {
  return createHmac('sha256', secret).update(JSON.stringify(sortKeys(body)), 'utf8').digest('hex')
}

/** Shape captured from a real Didit console "Try Webhook" delivery (no event_id). */
const TEST_PAYLOAD = {
  created_at: EVENT_TIME,
  session_id: SESSION_ID,
  status: 'Approved',
  timestamp: EVENT_TIME,
  webhook_type: 'status.updated',
  workflow_id: WORKFLOW_ID,
  vendor_data: 'your-vendor-reference-id',
  metadata: { source: 'test' },
  decision: { aml_screenings: [] },
}

describe('RealDiditKycProvider.verifyWebhook', () => {
  it('accepts a console test payload without event_id and synthesizes a stable id', () => {
    const event = provider().verifyWebhook({
      body: TEST_PAYLOAD,
      signatureV2: sign(TEST_PAYLOAD),
      timestamp: String(EVENT_TIME),
      now: NOW,
    })
    expect(event.webhookType).toBe('status.updated')
    expect(event.sessionId).toBe(SESSION_ID)
    expect(event.status).toBe('Approved')
    expect(event.eventId).toBe(`didit-${SESSION_ID}-${EVENT_TIME}`)
  })

  it('keeps a provided event_id untouched', () => {
    const body = { ...TEST_PAYLOAD, event_id: 'event-abc-123' }
    const event = provider().verifyWebhook({
      body,
      signatureV2: sign(body),
      timestamp: String(EVENT_TIME),
      now: NOW,
    })
    expect(event.eventId).toBe('event-abc-123')
  })

  it('rejects a tampered signature', () => {
    const signature = sign(TEST_PAYLOAD)
    const tampered = `${signature.slice(0, -2)}00`
    expect(() => provider().verifyWebhook({
      body: TEST_PAYLOAD,
      signatureV2: tampered,
      timestamp: String(EVENT_TIME),
      now: NOW,
    })).toThrow(DiditWebhookVerificationError)
  })

  it('rejects a signature produced with a different secret', () => {
    expect(() => provider().verifyWebhook({
      body: TEST_PAYLOAD,
      signatureV2: sign(TEST_PAYLOAD, 'another-secret-9876543210abcdef'),
      timestamp: String(EVENT_TIME),
      now: NOW,
    })).toThrow(DiditWebhookVerificationError)
  })

  it('rejects stale timestamps outside the replay window', () => {
    expect(() => provider().verifyWebhook({
      body: TEST_PAYLOAD,
      signatureV2: sign(TEST_PAYLOAD),
      timestamp: String(EVENT_TIME - 3600),
      now: NOW,
    })).toThrow(DiditWebhookVerificationError)
  })

  it('rejects payloads without webhook_type or status', () => {
    const body = { session_id: SESSION_ID, timestamp: EVENT_TIME }
    expect(() => provider().verifyWebhook({
      body,
      signatureV2: sign(body),
      timestamp: String(EVENT_TIME),
      now: NOW,
    })).toThrow(DiditWebhookVerificationError)
  })
})
