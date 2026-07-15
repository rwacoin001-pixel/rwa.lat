import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { canonicalCallbackJson, PartnerCallbackVerifier } from '../../src/job-queue/partner-callback.verifier'

describe('PartnerCallbackVerifier', () => {
  const secret = 'partner-callback-secret-at-least-32-characters'
  const payload = { amount: '1000000', nested: { b: 2, a: 1 } }

  it('accepts a fresh canonical HMAC signature', () => {
    const verifier = new PartnerCallbackVerifier(new ConfigService({
      PARTNER_CALLBACK_SECRETS_JSON: JSON.stringify({ custody: secret }),
    }))
    const now = new Date('2026-07-15T00:00:00.000Z')
    const timestamp = String(now.getTime())
    const canonical = canonicalCallbackJson({
      eventId: 'evt-1',
      eventType: 'deposit.confirmed',
      partner: 'custody',
      payload,
      timestamp,
    })
    const signature = createHmac('sha256', secret).update(canonical).digest('hex')

    expect(() => verifier.verify({
      partner: 'custody',
      eventType: 'deposit.confirmed',
      eventId: 'evt-1',
      timestamp,
      signature: `sha256=${signature}`,
      payload,
      now,
    })).not.toThrow()
  })

  it('rejects caller-asserted or stale authentication evidence', () => {
    const verifier = new PartnerCallbackVerifier(new ConfigService({
      PARTNER_CALLBACK_SECRETS_JSON: JSON.stringify({ custody: secret }),
    }))
    expect(() => verifier.verify({
      partner: 'custody',
      eventType: 'deposit.confirmed',
      eventId: 'evt-1',
      timestamp: '1700000000000',
      signature: '0'.repeat(64),
      payload,
      now: new Date('2026-07-15T00:00:00.000Z'),
    })).toThrow()
  })

  it('fails closed when the partner secret map is absent', () => {
    const verifier = new PartnerCallbackVerifier(new ConfigService({}))
    expect(() => verifier.verify({
      partner: 'custody',
      eventType: 'deposit.confirmed',
      eventId: 'evt-1',
      timestamp: String(Date.now()),
      signature: '0'.repeat(64),
      payload,
    })).toThrow()
  })
})
