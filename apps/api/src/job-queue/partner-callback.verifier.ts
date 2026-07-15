import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_WINDOW_MS = 5 * 60 * 1_000

@Injectable()
export class PartnerCallbackVerifier {
  private readonly secrets: Record<string, string>

  constructor(config: ConfigService) {
    this.secrets = parseSecrets(config.get<string>('PARTNER_CALLBACK_SECRETS_JSON'))
  }

  verify(input: {
    partner: string
    eventType: string
    eventId: string
    timestamp: string
    signature: string
    payload: Record<string, unknown>
    now?: Date
  }): void {
    const secret = this.secrets[input.partner]
    const timestampMs = parseTimestamp(input.timestamp)
    const now = input.now ?? new Date()
    if (
      !secret
      || secret.length < 32
      || timestampMs === null
      || Math.abs(now.getTime() - timestampMs) > SIGNATURE_WINDOW_MS
      || typeof input.eventId !== 'string'
      || input.eventId.length < 1
      || input.eventId.length > 256
      || typeof input.signature !== 'string'
    ) {
      throw invalidSignature()
    }
    const suppliedHex = input.signature.replace(/^sha256=/i, '')
    if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) throw invalidSignature()
    const canonical = canonicalCallbackJson({
      eventId: input.eventId,
      eventType: input.eventType,
      partner: input.partner,
      payload: input.payload,
      timestamp: input.timestamp,
    })
    const expected = createHmac('sha256', secret).update(canonical).digest()
    const supplied = Buffer.from(suppliedHex, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalidSignature()
  }
}

export function canonicalCallbackJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => canonicalCallbackJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalCallbackJson(record[key])}`).join(',')}}`
}

function parseSecrets(value: string | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => (
      /^[a-z][a-z0-9_-]{1,63}$/i.test(entry[0]) && typeof entry[1] === 'string'
    )))
  } catch {
    return {}
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
    code: 'PARTNER_CALLBACK_SIGNATURE_INVALID',
    message: 'Partner callback authentication failed.',
  })
}
