import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { canonicalCallbackJson } from '../job-queue/partner-callback.verifier'

const MAX_SKEW_MS = 5 * 60 * 1_000

@Injectable()
export class ObjectScanCallbackVerifier {
  private readonly secret: string

  constructor(config: ConfigService) {
    this.secret = config.get<string>('OBJECT_STORAGE_SCAN_CALLBACK_SECRET')?.trim() ?? ''
  }

  verify(input: { eventId: string; timestamp: string; signature: string; payload: Record<string, unknown>; now?: Date }) {
    const timestampMs = parseTimestamp(input.timestamp)
    if (
      this.secret.length < 32
      || typeof input.eventId !== 'string'
      || input.eventId.length < 1
      || input.eventId.length > 256
      || typeof input.signature !== 'string'
      || timestampMs === null
      || Math.abs((input.now ?? new Date()).getTime() - timestampMs) > MAX_SKEW_MS
    ) throw invalidSignature()

    const suppliedHex = input.signature.replace(/^sha256=/i, '')
    if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) throw invalidSignature()
    const canonical = canonicalCallbackJson({ eventId: input.eventId, payload: input.payload, timestamp: input.timestamp })
    const expected = createHmac('sha256', this.secret).update(canonical).digest()
    const supplied = Buffer.from(suppliedHex, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalidSignature()
  }
}

function parseTimestamp(value: string): number | null {
  if (!/^\d{10,13}$/.test(value)) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return null
  return value.length === 10 ? parsed * 1_000 : parsed
}

function invalidSignature() {
  return new UnauthorizedException({
    code: 'OBJECT_SCAN_SIGNATURE_INVALID',
    message: 'Object scan callback authentication failed.',
  })
}
