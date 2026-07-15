import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { CustodyWebhookVerifier, canonicalJson } from '../../src/wallet/custody-webhook.verifier'

describe('CustodyWebhookVerifier', () => {
  const secret = 'webhook-secret-for-tests'
  const verifier = new CustodyWebhookVerifier({ get: () => secret } as unknown as ConfigService)
  const payload = { z: 1, nested: { b: true, a: 'stable' } }

  it('accepts canonical signed payloads independent of object key insertion order', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const eventId = 'evt-1'
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${eventId}.${canonicalJson(payload)}`)
      .digest('hex')
    expect(() => verifier.verify(eventId, timestamp, `sha256=${signature}`, payload)).not.toThrow()
    expect(canonicalJson(payload)).toBe('{"nested":{"a":"stable","b":true},"z":1}')
  })

  it('omits undefined object fields introduced by request DTO transformation', () => {
    expect(canonicalJson({ network: 'arbitrum', blockNumber: undefined, confirmations: 60 }))
      .toBe('{"confirmations":60,"network":"arbitrum"}')
  })

  it('rejects invalid signatures and stale replay attempts', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    expect(() => verifier.verify('evt-2', timestamp, 'sha256='.padEnd(71, '0'), payload)).toThrow()
    const stale = String(Math.floor(Date.now() / 1000) - 301)
    const staleSignature = createHmac('sha256', secret).update(`${stale}.evt-3.${canonicalJson(payload)}`).digest('hex')
    expect(() => verifier.verify('evt-3', stale, staleSignature, payload)).toThrow()
  })
})
