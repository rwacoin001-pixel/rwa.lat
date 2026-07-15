import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { WALLET_ERROR_CODES } from './wallet.errors'

const CALLBACK_TOLERANCE_SECONDS = 5 * 60

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

@Injectable()
export class CustodyWebhookVerifier {
  private readonly secret: string | null

  constructor(config: ConfigService) {
    this.secret = config.get<string>('WALLET_WEBHOOK_SECRET') ?? null
  }

  verify(eventId: string, timestampHeader: string, signatureHeader: string, payload: unknown, now = Date.now()): void {
    if (!this.secret || !eventId || !timestampHeader || !signatureHeader || !/^\d+$/.test(timestampHeader)) return this.invalidSignature()
    const timestamp = Number(timestampHeader)
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > CALLBACK_TOLERANCE_SECONDS) {
      throw new UnauthorizedException({ code: WALLET_ERROR_CODES.CALLBACK_STALE, message: 'Custody callback timestamp is outside the accepted window.' })
    }
    const supplied = signatureHeader.replace(/^sha256=/i, '').toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(supplied)) return this.invalidSignature()
    const message = `${timestampHeader}.${eventId}.${canonicalJson(payload)}`
    const expected = createHmac('sha256', this.secret).update(message).digest('hex')
    if (!timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) return this.invalidSignature()
  }

  private invalidSignature(): never {
    throw new UnauthorizedException({ code: WALLET_ERROR_CODES.CALLBACK_SIGNATURE_INVALID, message: 'Custody callback signature is invalid.' })
  }
}
