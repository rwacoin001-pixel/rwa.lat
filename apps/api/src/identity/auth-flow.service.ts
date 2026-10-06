import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common'
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import type { DataSource, EntityManager } from 'typeorm'
import { IdentityCrypto } from './identity-crypto.service'
import { IdentityDeliveryService } from './identity-delivery.service'
import { assertPassword, hashPassword, verifyPassword } from './password-hash'
import type { RegistrationConsentAcceptance } from './consent-policy'
import { LoginIdentity } from './login-identity.entity'
import { IDENTITY_ERROR_CODES } from './identity.errors'
import { maskEmail } from '../data-governance/data-masking.util'

export type AuthDevice = { fingerprint?: string; name?: string }
type Step = 'totp' | 'email' | 'password' | 'consent'
export type AuthProof = 'primary' | 'passkey' | 'password' | 'recovery'
type OAuthSubject = { provider: 'google' | 'github' | 'x'; subject: string; locale?: string; verifiedEmail?: string; referralAttribution?: string }
type Payload = {
  userId?: string; device?: AuthDevice; steps: Step[]; purpose: 'login' | 'reset' | 'setup' | 'oauth' | 'email_change' | 'email_bind';
  version: number; factorIds: string[]; oauth?: OAuthSubject; emailHash?: string; sentAt?: number; sends?: number; bindingEmail?: string;
  previousEmailHash?: string | null;
}
export type AuthFlowView = { continuationToken: string; step: Step; expiresIn: number; retryAfter?: number; emailRequired?: boolean }
type Row = { payload_ciphertext: Buffer; encryption_key_version: number; attempts: number; expires_at: Date; consumed_at: Date | null }
type Policy = { status: string; version: number; password_required: boolean; password_hash: string | null }
const fail = () => new UnauthorizedException({ code: 'AUTH_FLOW_INVALID', message: 'Verification expired or failed. Start again.' })

/** Server-owned, short-lived authentication steps. No session exists until every step succeeds. */
export class AuthFlowService {
  constructor(private readonly db: DataSource, private readonly crypto: IdentityCrypto, private readonly delivery: IdentityDeliveryService) {}

  async requireRegistrationPassword(manager: EntityManager, userId: string) {
    await manager.query(`INSERT INTO app.auth_credentials(user_id,password_required) VALUES($1,true)
      ON CONFLICT(user_id) DO UPDATE SET password_required=true WHERE app.auth_credentials.password_hash IS NULL`, [userId])
  }

  private async policy(manager: EntityManager, userId: string): Promise<{ policy: Policy; factorIds: string[] }> {
    const [policy] = await manager.query(`SELECT u.status,coalesce(c.version,0) AS version,
      coalesce(c.password_required,false) AS password_required,c.password_hash
      FROM app.users u LEFT JOIN app.auth_credentials c ON c.user_id=u.id WHERE u.id=$1`, [userId]) as Policy[]
    if (!policy || ['closed', 'suspended'].includes(policy.status)) throw fail()
    const factors = await manager.query(`SELECT id FROM app.totp_factors WHERE user_id=$1 AND state='active' AND revoked_at IS NULL ORDER BY id`, [userId]) as { id: string }[]
    return { policy, factorIds: factors.map(factor => factor.id) }
  }

  async authorize(userId: string, proof: AuthProof, device?: AuthDevice, expectedVersion?: number): Promise<void> {
    const { policy, factorIds } = await this.policy(this.db.manager, userId)
    if (expectedVersion !== undefined && policy.version !== expectedVersion) throw fail()
    const steps: Step[] = []
    if (proof !== 'passkey' && factorIds.length) steps.push('totp')
    else if (proof === 'password') steps.push('email')
    if (proof === 'recovery' || policy.password_required) steps.push('password')
    if (!steps.length) return
    const flow = await this.begin({ userId, device, steps, version: policy.version, factorIds,
      purpose: proof === 'recovery' ? 'reset' : policy.password_required ? 'setup' : 'login' })
    this.required(flow)
  }

  required(flow: AuthFlowView): never {
    throw new ConflictException({ code: 'AUTH_FLOW_REQUIRED', message: 'Complete verification.', authFlow: flow })
  }

  async beginOAuth(oauth: OAuthSubject, device?: AuthDevice): Promise<never> {
    this.required(await this.begin({ oauth, device, steps: ['consent'], purpose: 'oauth', version: 0, factorIds: [] }))
  }

  async checkPassword(email: string, password: string): Promise<{ userId: string; version: number }> {
    const identifier = this.crypto.hashIdentifier(email.trim().toLowerCase())
    const [bucket] = await this.db.query(`INSERT INTO app.auth_password_attempts(identifier_hash,attempts,expires_at)
      VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(identifier_hash) DO UPDATE SET
      attempts=CASE WHEN app.auth_password_attempts.expires_at<=now() THEN 1 ELSE app.auth_password_attempts.attempts+1 END,
      expires_at=CASE WHEN app.auth_password_attempts.expires_at<=now() THEN now()+interval '15 minutes' ELSE app.auth_password_attempts.expires_at END
      RETURNING attempts,ceil(extract(epoch FROM expires_at-now()))::int AS retry_after`, [identifier])
    if (bucket.attempts > 10) {
      throw new HttpException({ code: 'AUTH_PASSWORD_RATE_LIMIT', message: 'Too many attempts. Try again later.',
        details: { retryAfter: Math.max(1, Number(bucket.retry_after) || 900) } }, 429)
    }
    const [row] = await this.db.query(`SELECT li.user_id,c.password_hash,c.version FROM app.login_identities li
      JOIN app.users u ON u.id=li.user_id LEFT JOIN app.auth_credentials c ON c.user_id=u.id
      WHERE li.kind='email' AND li.identifier_hash=$1 AND li.state='verified' AND li.revoked_at IS NULL
      AND u.status NOT IN ('closed','suspended')`, [identifier])
    if (!await verifyPassword(password, row?.password_hash ?? null) || !row) {
      throw new UnauthorizedException({ code: 'AUTH_PASSWORD_INVALID', message: 'Email or password is incorrect.' })
    }
    // A correct password clears the lockout window, so earlier typos never count against the owner.
    await this.db.query('DELETE FROM app.auth_password_attempts WHERE identifier_hash=$1', [identifier])
    return { userId: row.user_id as string, version: row.version as number }
  }

  async beginPasswordManagement(userId: string, device?: AuthDevice, bindEmail?: string, reauthenticated = false): Promise<never> {
    const { policy, factorIds } = await this.policy(this.db.manager, userId)
    const existing = await this.db.manager.getRepository(LoginIdentity).findOne({ where: { userId, kind: 'email' } })
    const bindingEmail = !existing ? bindEmail?.trim().toLowerCase() : undefined
    if (!bindingEmail) await this.emailFor(this.db.manager, userId)
    const steps: Step[] = !reauthenticated && factorIds.length ? ['totp'] : []
    if (bindingEmail || (!reauthenticated && !factorIds.length)) steps.push('email')
    steps.push('password')
    this.required(await this.begin({ userId, device, bindingEmail, steps,
      purpose: 'reset', version: policy.version, factorIds }))
  }

  /** Called only after signed-in, session-bound step-up verification by IdentityService. */
  async beginEmailChange(userId: string, email: string): Promise<never> {
    const bindingEmail = email.trim().toLowerCase()
    const { policy, factorIds } = await this.policy(this.db.manager, userId)
    const identities = this.db.manager.getRepository(LoginIdentity)
    const existing = await identities.findOne({ where: { userId, kind: 'email' } })
    const hash = this.crypto.hashIdentifier(bindingEmail)
    if (await identities.findOne({ where: { kind: 'email', identifierHash: hash } })) {
      throw new ConflictException({ code: 'AUTH_EMAIL_BIND_CONFLICT', message: 'This email cannot be linked.' })
    }
    this.required(await this.begin({ userId, steps: ['email'], purpose: 'email_change', version: policy.version,
      factorIds, bindingEmail, previousEmailHash: existing?.identifierHash.toString('hex') ?? null }))
  }

  /**
   * GitHub and wallet sign-ins prove control of a third-party account or a key, not of an inbox.
   * Raised for a signed-in user at the first money-moving action, never at sign-in.
   * The address and its code arrive later through bindEmail().
   */
  async beginEmailBinding(userId: string, device?: AuthDevice): Promise<never> {
    const { policy, factorIds } = await this.policy(this.db.manager, userId)
    this.required(await this.begin({ userId, device, steps: ['email'], purpose: 'email_bind',
      version: policy.version, factorIds }))
  }

  private async begin(payload: Payload): Promise<AuthFlowView> {
    return this.db.transaction(manager => this.insert(manager, payload))
  }

  private async insert(manager: EntityManager, payload: Payload, expiresAt = new Date(Date.now() + 600_000)): Promise<AuthFlowView> {
    const token = this.crypto.generateSessionToken()
    // email_bind flows begin without a target address; bindEmail() sends the code once one is supplied.
    const awaitingEmail = payload.steps[0] === 'email' && payload.purpose === 'email_bind' && !payload.bindingEmail
    if (payload.steps[0] === 'email' && !awaitingEmail) await this.deliver(manager, payload, token)
    const encrypted = this.crypto.encrypt(JSON.stringify(payload))
    await manager.query(`INSERT INTO app.auth_flows(token_hash,user_id,payload_ciphertext,encryption_key_version,expires_at)
      VALUES($1,$2,$3,$4,$5)`, [this.crypto.hashToken(token), payload.userId ?? null, encrypted.ciphertext, encrypted.keyVersion, expiresAt])
    return { continuationToken: token, step: payload.steps[0], expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      ...(payload.steps[0] === 'email' && !awaitingEmail ? { retryAfter: 60 } : {}),
      ...(awaitingEmail ? { emailRequired: true } : {}) }
  }

  private async emailFor(manager: EntityManager, userId: string): Promise<string> {
    const [row] = await manager.query(`SELECT identifier_ciphertext,encryption_key_version FROM app.login_identities
      WHERE user_id=$1 AND kind='email' AND state='verified' AND revoked_at IS NULL`, [userId])
    if (!row) throw new BadRequestException({ code: 'AUTH_EMAIL_BIND_REQUIRED', message: 'A verified account email is required.' })
    return this.crypto.decrypt(row.identifier_ciphertext, row.encryption_key_version)
  }

  private async deliver(manager: EntityManager, payload: Payload, token: string) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const [user] = payload.userId ? await manager.query('SELECT locale FROM app.users WHERE id=$1', [payload.userId]) as { locale: string }[] : []
    await this.delivery.sendEmailCode({ email: payload.bindingEmail ?? await this.emailFor(manager, payload.userId!), code, intent: 'login', locale: user?.locale || 'en' })
    payload.emailHash = this.crypto.hashToken(`auth-flow:${token}:${code}`).toString('hex')
    payload.sentAt = Date.now()
    payload.sends = (payload.sends ?? 0) + 1
  }

  async resend(token: string): Promise<{ retryAfter: number }> {
    return this.db.transaction(async manager => {
      const { row, payload } = await this.read(manager, token)
      if (payload.steps[0] !== 'email' || row.attempts >= 5 || (payload.sends ?? 0) >= 5) throw fail()
      if (Date.now() - (payload.sentAt ?? 0) < 60_000) throw new HttpException({ code: 'AUTH_EMAIL_CODE_RATE_LIMIT', message: 'Please wait before resending.' }, 429)
      await this.deliver(manager, payload, token)
      const encrypted = this.crypto.encrypt(JSON.stringify(payload))
      await manager.query('UPDATE app.auth_flows SET payload_ciphertext=$2,encryption_key_version=$3 WHERE token_hash=$1',
        [this.crypto.hashToken(token), encrypted.ciphertext, encrypted.keyVersion])
      return { retryAfter: 60 }
    })
  }

  /**
   * Supply the address for a pending email-binding flow and send its one-time code.
   * The flow — and therefore the session — only completes after that code is verified.
   */
  async bindEmail(continuationToken: string, rawEmail: string): Promise<AuthFlowView> {
    const bindingEmail = rawEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindingEmail)) {
      throw new BadRequestException({ code: 'AUTH_EMAIL_INVALID', message: 'Enter a valid email address.' })
    }
    return this.db.transaction(async manager => {
      const { row, payload } = await this.read(manager, continuationToken)
      if (payload.purpose !== 'email_bind' || payload.steps[0] !== 'email' || !payload.userId) throw fail()
      const identifierHash = this.crypto.hashIdentifier(bindingEmail)
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`email:${identifierHash.toString('hex')}`])
      const owner = await manager.getRepository(LoginIdentity).findOne({ where: { kind: 'email', identifierHash } })
      if (owner && owner.userId !== payload.userId) {
        throw new ConflictException({ code: IDENTITY_ERROR_CODES.EMAIL_TAKEN, message: 'An account with this email already exists.' })
      }
      if (payload.bindingEmail === bindingEmail) {
        if ((payload.sends ?? 0) >= 5) throw fail()
        if (Date.now() - (payload.sentAt ?? 0) < 60_000) {
          throw new HttpException({ code: 'AUTH_EMAIL_CODE_RATE_LIMIT', message: 'Please wait before resending.', details: { retryAfter: 60 } }, 429)
        }
      } else {
        payload.sends = 0
        payload.bindingEmail = bindingEmail
      }
      await this.deliver(manager, payload, continuationToken)
      const encrypted = this.crypto.encrypt(JSON.stringify(payload))
      await manager.query('UPDATE app.auth_flows SET payload_ciphertext=$2,encryption_key_version=$3 WHERE token_hash=$1',
        [this.crypto.hashToken(continuationToken), encrypted.ciphertext, encrypted.keyVersion])
      return { continuationToken, step: 'email', emailRequired: false, email: maskEmail(bindingEmail),
        expiresIn: Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000)), retryAfter: 60 }
    })
  }

  private async read(manager: EntityManager, token: string): Promise<{ row: Row; payload: Payload }> {
    const [row] = await manager.query('SELECT * FROM app.auth_flows WHERE token_hash=$1 FOR UPDATE', [this.crypto.hashToken(token)]) as Row[]
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() || row.attempts >= 5) throw fail()
    const payload = JSON.parse(this.crypto.decrypt(row.payload_ciphertext, row.encryption_key_version)) as Payload
    if (payload.userId) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`auth:${payload.userId}`])
      const { policy, factorIds } = await this.policy(manager, payload.userId)
      if (policy.version !== payload.version || JSON.stringify(factorIds) !== JSON.stringify(payload.factorIds)) throw fail()
    }
    return { row, payload }
  }

  async complete(input: { continuationToken: string; code?: string; password?: string; consents?: RegistrationConsentAcceptance[] },
    finish: (payload: Payload, manager: EntityManager) => Promise<unknown>): Promise<unknown> {
    // Hash only for a password step, never spend scrypt work on an unverified request.
    const result = await this.db.transaction(async manager => {
      const { row, payload } = await this.read(manager, input.continuationToken)
      const step = payload.steps[0]
      let valid = false
      if (step === 'email') {
        const actual = this.crypto.hashToken(`auth-flow:${input.continuationToken}:${input.code ?? ''}`)
        const expected = Buffer.from(payload.emailHash ?? '', 'hex')
        valid = expected.length === actual.length && timingSafeEqual(expected, actual)
        if (valid && payload.bindingEmail) {
          const identifierHash = this.crypto.hashIdentifier(payload.bindingEmail)
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`email:${identifierHash.toString('hex')}`])
          const identities = manager.getRepository(LoginIdentity)
          const existing = await identities.findOne({ where: { kind: 'email', userId: payload.userId } })
          const owner = await identities.findOne({ where: { kind: 'email', identifierHash } })
          if (payload.purpose === 'email_bind') {
            // GitHub/wallet accounts may have no email identity yet, so only a foreign owner blocks the bind.
            if (owner && owner.userId !== payload.userId) {
              throw new ConflictException({ code: IDENTITY_ERROR_CODES.EMAIL_TAKEN, message: 'An account with this email already exists.' })
            }
          } else if (owner ||
            (payload.purpose !== 'email_change' && existing) ||
            (payload.purpose === 'email_change' && (existing?.identifierHash.toString('hex') ?? null) !== payload.previousEmailHash)) {
            throw new ConflictException({ code: 'AUTH_EMAIL_BIND_CONFLICT', message: 'This email cannot be linked. Sign in with its existing account.' })
          }
          const encrypted = this.crypto.encrypt(payload.bindingEmail)
          await identities.save({ id: existing?.id ?? randomUUID(), userId: payload.userId, kind: 'email', state: 'verified', revokedAt: null, verifiedAt: new Date(),
            identifierHash, identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
          await manager.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,user_id,action,object_type,object_id,request_id,metadata)
            VALUES($1,'user',$2::uuid,$2::uuid,'security.email.bound','user',$2::text,$3,'{}')`, [randomUUID(), payload.userId, randomUUID()])
          delete payload.bindingEmail
          if (payload.purpose === 'email_change') {
            await manager.query(`INSERT INTO app.auth_credentials(user_id,version) VALUES($1,1)
              ON CONFLICT(user_id) DO UPDATE SET version=app.auth_credentials.version+1,updated_at=now()`, [payload.userId])
            await manager.query(`UPDATE app.sessions SET state='revoked',revoked_at=now(),revoke_reason='email_changed'
              WHERE user_id=$1 AND state='active'`, [payload.userId])
            await manager.query(`UPDATE app.identity_one_time_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, [payload.userId])
            await manager.query(`UPDATE app.email_code_challenges SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, [payload.userId])
            await manager.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,user_id,action,object_type,object_id,request_id,metadata)
              VALUES($1,'user',$2::uuid,$2::uuid,'security.email.changed','user',$2::text,$3,'{}')`, [randomUUID(), payload.userId, randomUUID()])
          }
        }
      } else if (step === 'totp') {
        const factors = await manager.query(`SELECT id,secret_ciphertext,encryption_key_version FROM app.totp_factors
          WHERE user_id=$1 AND state='active' AND revoked_at IS NULL ORDER BY id`, [payload.userId])
        for (const factor of factors) {
          const counter = this.crypto.verifyTotpCounter(this.crypto.decrypt(factor.secret_ciphertext, factor.encryption_key_version), input.code ?? '')
          if (counter === null) continue
          const used = await manager.query(`INSERT INTO app.auth_totp_uses(factor_id,time_step) VALUES($1,$2)
            ON CONFLICT DO NOTHING RETURNING factor_id`, [factor.id, counter])
          valid = used.length === 1
          break
        }
      } else if (step === 'password') {
        assertPassword(input.password ?? '')
        const encoded = await hashPassword(input.password!)
        await manager.query(`INSERT INTO app.auth_credentials(user_id,password_hash,password_required,version)
          VALUES($1,$2,false,1) ON CONFLICT(user_id) DO UPDATE SET password_hash=$2,password_required=false,
          version=app.auth_credentials.version+1,updated_at=now()`, [payload.userId, encoded])
        await manager.query(`UPDATE app.sessions SET state='revoked',revoked_at=now(),revoke_reason='password_changed'
          WHERE user_id=$1 AND state='active'`, [payload.userId])
        await manager.query(`UPDATE app.identity_one_time_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, [payload.userId])
        await manager.query(`UPDATE app.email_code_challenges SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, [payload.userId])
        await manager.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,user_id,action,object_type,object_id,request_id,metadata)
          VALUES($1,'user',$2::uuid,$2::uuid,'security.password.changed','user',$2::text,$3,'{}')`, [randomUUID(), payload.userId, randomUUID()])
        valid = true
      } else if (step === 'consent') valid = true // Current versions are checked by the identity service inside this transaction.
      await manager.query(`UPDATE app.auth_flows SET attempts=attempts+1,consumed_at=CASE WHEN $2 OR attempts+1>=5 THEN now() ELSE NULL END
        WHERE token_hash=$1`, [this.crypto.hashToken(input.continuationToken), valid])
      if (!valid) return { invalid: true as const }
      payload.steps.shift()
      if (payload.steps.length) return { flow: await this.insert(manager, payload, new Date(row.expires_at)) }
      if (payload.purpose === 'email_change') return { done: { emailChanged: true, requiresLogin: true } }
      if (step === 'password' && payload.purpose === 'reset') return { done: { passwordChanged: true, requiresLogin: true } }
      return { done: await finish(payload, manager) }
    })
    // Failed guesses commit their attempt count before the public error is thrown.
    if ('invalid' in result) throw new UnauthorizedException({ code: 'AUTH_CODE_INVALID', message: 'Invalid verification code.' })
    if ('flow' in result) this.required(result.flow!)
    return result.done
  }
}
