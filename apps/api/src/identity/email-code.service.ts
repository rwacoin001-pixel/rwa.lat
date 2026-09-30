import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common'
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from './identity-crypto.service'
import { IdentityDeliveryService } from './identity-delivery.service'
import { IdentityService } from './identity.service'
import type { ConfirmEmailCodeDto, EmailLookupResultDto, RequestEmailCodeDto } from './dto/email-code.dto'

const TTL_SECONDS = 600
const RESEND_SECONDS = 60
const MAX_ATTEMPTS = 5
const MAX_SENDS_PER_HOUR = 10
type Challenge = { id: string; user_id: string | null; code_hash: Buffer; attempts: number; expires_at: Date; consumed_at: Date | null }

@Injectable()
export class EmailCodeService {
  constructor(private readonly db: DataSource, private readonly crypto: IdentityCrypto,
    private readonly delivery: IdentityDeliveryService, private readonly identity: IdentityService) {}

  /**
   * Email-first sign-in: tells the form whether to ask for a password/code (existing) or start signup (new).
   * This reveals whether an address is registered, a deliberate product choice bounded by the email-lookup rate limit.
   * A pending (never verified) identity counts as new so the owner can finish signup with a fresh code.
   */
  async lookup(rawEmail: string): Promise<EmailLookupResultDto> {
    const rows = await this.db.query(`SELECT li.state, li.revoked_at, u.status, c.password_hash IS NOT NULL AS has_password,
        EXISTS (SELECT 1 FROM app.passkey_credentials p WHERE p.user_id = u.id AND p.state = 'active') AS has_passkey
      FROM app.login_identities li JOIN app.users u ON u.id = li.user_id LEFT JOIN app.auth_credentials c ON c.user_id = u.id
      WHERE li.kind = 'email' AND li.identifier_hash = $1`, [this.crypto.hashIdentifier(rawEmail.trim().toLowerCase())]) as
      Array<{ state: string; revoked_at: Date | null; status: string; has_password: boolean; has_passkey: boolean }>
    const row = rows[0]
    if (!row) return { account: 'new', password: false, passkey: false }
    if (row.revoked_at || row.state === 'revoked' || row.status === 'closed' || row.status === 'suspended') return { account: 'unavailable', password: false, passkey: false }
    if (row.state !== 'verified') return { account: 'new', password: false, passkey: false }
    return { account: 'existing', password: Boolean(row.has_password), passkey: Boolean(row.has_passkey) }
  }

  async request(input: RequestEmailCodeDto) {
    const email = input.email.trim().toLowerCase()
    const identifierHash = this.crypto.hashIdentifier(email)
    const challengeId = randomUUID()
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await this.db.transaction(async manager => {
      // Serializes concurrent requests across API replicas and both form modes.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identifierHash.toString('hex')])
      const recent = await manager.query(`SELECT created_at FROM app.email_code_challenges
        WHERE identifier_hash = $1 AND created_at > now() - interval '1 hour' ORDER BY created_at DESC`, [identifierHash]) as Array<{ created_at: Date }>
      const retryAfter = recent.length >= MAX_SENDS_PER_HOUR ? 3600
        : recent.length ? Math.ceil(RESEND_SECONDS - (Date.now() - new Date(recent[0].created_at).getTime()) / 1000) : 0
      if (retryAfter > 0) throw new HttpException({ code: 'AUTH_EMAIL_CODE_RATE_LIMIT', message: 'Please wait before requesting another code.', details: { retryAfter } }, 429)
      let userId: string | null = null
      if (input.intent === 'register') {
        userId = await this.identity.prepareEmailRegistration(email, input.locale ?? 'en', input.consents, manager)
      } else {
        const rows = await manager.query(`SELECT li.user_id FROM app.login_identities li JOIN app.users u ON u.id = li.user_id
          WHERE li.kind = 'email' AND li.identifier_hash = $1 AND li.revoked_at IS NULL
          AND li.state IN ('pending','verified') AND u.status NOT IN ('closed','suspended')`, [identifierHash]) as Array<{ user_id: string }>
        userId = rows[0]?.user_id ?? null
      }
      await manager.query(`UPDATE app.email_code_challenges SET consumed_at = now()
        WHERE identifier_hash = $1 AND consumed_at IS NULL`, [identifierHash])
      await manager.query(`INSERT INTO app.email_code_challenges(id,identifier_hash,user_id,intent,code_hash,expires_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [challengeId, identifierHash, userId, input.intent,
        this.crypto.hashToken(`email-code:${challengeId}:${input.intent}:${code}`), new Date(Date.now() + TTL_SECONDS * 1000)])
      // Unknown login emails have the identical response; no account is created.
      // A delivery failure rolls back the new challenge and preserves the old one.
      if (userId) await this.delivery.sendEmailCode({ email, intent: input.intent, code, locale: input.locale ?? 'en' })
    })
    return { accepted: true as const, challengeId, expiresIn: TTL_SECONDS, retryAfter: RESEND_SECONDS }
  }

  async confirm(input: ConfirmEmailCodeDto) {
    const identifierHash = this.crypto.hashIdentifier(input.email.trim().toLowerCase())
    const userId = await this.db.transaction(async manager => {
      const rows = await manager.query(`SELECT id,user_id,code_hash,attempts,expires_at,consumed_at FROM app.email_code_challenges
        WHERE id=$1 AND identifier_hash=$2 AND intent=$3 FOR UPDATE`, [input.challengeId, identifierHash, input.intent]) as Challenge[]
      const row = rows[0]
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() || row.attempts >= MAX_ATTEMPTS) return null
      const expected = this.crypto.hashToken(`email-code:${row.id}:${input.intent}:${input.code}`)
      const valid = row.code_hash.length === expected.length && timingSafeEqual(row.code_hash, expected) && Boolean(row.user_id)
      await manager.query(`UPDATE app.email_code_challenges SET attempts=attempts+1,
        consumed_at=CASE WHEN $2 OR attempts+1 >= $3 THEN now() ELSE consumed_at END WHERE id=$1`, [row.id, valid, MAX_ATTEMPTS])
      return valid ? row.user_id : null
    })
    // Throw after commit so failed guesses cannot roll back their attempt counter.
    if (!userId) throw new UnauthorizedException({ code: 'AUTH_EMAIL_CODE_INVALID', message: 'The verification code is invalid or expired.' })
    return this.identity.completeEmailCode(userId, input.device)
  }
}
