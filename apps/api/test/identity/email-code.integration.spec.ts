import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { EmailCodeService } from '../../src/identity/email-code.service'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { OAuthProviderService } from '../../src/identity/oauth-provider.service'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from '../../src/identity/identity-passkey-challenge.entity'
import { PasskeyCredential } from '../../src/security/passkey-credential.entity'
import { REGISTRATION_CONSENT_REQUIREMENTS } from '../../src/identity/consent-policy'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IdentityController } from '../../src/identity/identity.controller'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
const consents = REGISTRATION_CONSENT_REQUIREMENTS.map(row => ({ documentType: row.documentType, version: row.version, accepted: true as const }))
suite('Mobile email codes against a new disposable PostgreSQL database', () => {
  let db: DataSource
  let crypto: IdentityCrypto
  let delivery: IdentityDeliveryService
  let identity: IdentityService
  let codes: EmailCodeService
  let app: INestApplication
  let base: string
  const email = () => `qa-${randomUUID()}@example.test`
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, APP_ENV: 'test' }))
    await db.initialize(); await db.runMigrations()
    const config = new ConfigService({ AUTH_ADAPTER: 'demo', IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64) })
    crypto = new IdentityCrypto(config)
    delivery = new IdentityDeliveryService(config)
    identity = new IdentityService(db.getRepository(User), db.getRepository(LoginIdentity), db.getRepository(Device),
      db.getRepository(Session), db.getRepository(IdentityOneTimeToken), db.getRepository(PasskeyCredential),
      db.getRepository(IdentityPasskeyChallenge), crypto, delivery, {} as OAuthProviderService, config, db)
    codes = new EmailCodeService(db, crypto, delivery, identity)
    const module = await Test.createTestingModule({ controllers: [IdentityController], providers: [
      { provide: IdentityService, useValue: identity }, { provide: EmailCodeService, useValue: codes },
    ] }).compile()
    app = module.createNestApplication({ logger: false })
    app.setGlobalPrefix('v1')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
  })
  afterEach(() => jest.restoreAllMocks())
  afterAll(async () => { if (app) await app.close(); delivery?.onModuleDestroy(); if (db?.isInitialized) await db.destroy() })
  const signup = async (address: string) => codes.request({ email: address, intent: 'register', locale: 'zh-CN', consents })
  const confirm = async (address: string, challengeId: string, intent: 'login' | 'register' = 'register', code?: string) => {
    try {
      return await codes.confirm({ email: address, intent, challengeId, code: code ?? delivery.lastDemoCode(address, intent)! })
    } catch (error) {
      const response = (error as { response?: { code?: string; authFlow?: { step: string; continuationToken: string } } }).response
      if (response?.code !== 'AUTH_FLOW_REQUIRED' || response.authFlow?.step !== 'password') throw error
      // Email verification alone must not issue a registration session.
      return await identity.completeAuthFlow({ continuationToken: response.authFlow.continuationToken,
        password: 'disposable test password 123!' }) as Awaited<ReturnType<EmailCodeService['confirm']>>
    }
  }
  const age = async (challengeId: string) => db.query('UPDATE app.email_code_challenges SET created_at=$1 WHERE id=$2', [new Date(Date.now() - 61_000), challengeId])

  it('registers only after verification, stores a hash, persists consent and issues a real session', async () => {
    const address = email(), challenge = await signup(address)
    expect(challenge).toMatchObject({ accepted: true, retryAfter: 60, expiresIn: 600 })
    expect(challenge).not.toHaveProperty('code')
    const code = delivery.lastDemoCode(address, 'register')!
    expect(code).toMatch(/^\d{6}$/)
    const [row] = await db.query('SELECT user_id,code_hash FROM app.email_code_challenges WHERE id=$1', [challenge.challengeId])
    expect(row.code_hash.toString()).not.toBe(code)
    expect(await db.getRepository(LoginIdentity).findOneBy({ userId: row.user_id, kind: 'email' })).toMatchObject({ state: 'pending' })
    const session = await confirm(address.toUpperCase(), challenge.challengeId, 'register', code)
    expect(session.emailVerified).toBe(true)
    expect(await identity.getSessionViewByToken(session.token)).toMatchObject({ userId: row.user_id, emailVerified: true })
    const accepted = await db.query('SELECT document_type FROM app.consents WHERE user_id=$1 AND granted=true', [row.user_id])
    expect(accepted).toHaveLength(2)
    await expect(confirm(address, challenge.challengeId)).rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_CODE_INVALID' } })
  })

  it('logs in existing users with codes and preserves the desktop link path', async () => {
    const address = email(), registered = await signup(address)
    await confirm(address, registered.challengeId)
    await age(registered.challengeId)
    const challenge = await codes.request({ email: address, intent: 'login' })
    const session = await confirm(address, challenge.challengeId, 'login')
    expect(session.emailVerified).toBe(true)
    await identity.requestEmailLogin(address)
    expect(await identity.confirmEmailLogin(delivery.lastDemoToken(address, 'email_login')!)).toMatchObject({ userId: session.userId })
  })

  it('rejects missing registration consent before creating an account', async () => {
    const address = email()
    await expect(codes.request({ email: address, intent: 'register' })).rejects.toThrow()
    expect(await db.getRepository(LoginIdentity).findOneBy({ identifierHash: crypto.hashIdentifier(address), kind: 'email' })).toBeNull()
  })

  it('does not reveal or create an account for an unknown login address', async () => {
    const address = email(), challenge = await codes.request({ email: address, intent: 'login' })
    expect(challenge).toMatchObject({ accepted: true, retryAfter: 60, expiresIn: 600 })
    expect(delivery.lastDemoCode(address, 'login')).toBeUndefined()
    await expect(confirm(address, challenge.challengeId, 'login', '000000')).rejects.toThrow()
    expect(await db.getRepository(LoginIdentity).findOneBy({ identifierHash: crypto.hashIdentifier(address), kind: 'email' })).toBeNull()
  })

  it('limits failed guesses to five across requests and rejects expired codes', async () => {
    const address = email(), challenge = await signup(address)
    const correct = delivery.lastDemoCode(address, 'register')!
    const wrong = correct === '000000' ? '000001' : '000000'
    for (let i=0;i<5;i++) await expect(confirm(address, challenge.challengeId, 'register', wrong)).rejects.toThrow()
    const [row] = await db.query('SELECT attempts,consumed_at FROM app.email_code_challenges WHERE id=$1', [challenge.challengeId])
    expect(row.attempts).toBe(5); expect(row.consumed_at).not.toBeNull()
    await expect(confirm(address, challenge.challengeId, 'register', correct)).rejects.toThrow()
    const other = email(), expired = await signup(other)
    await db.query('UPDATE app.email_code_challenges SET expires_at=$1 WHERE id=$2', [new Date(Date.now() - 1_000), expired.challengeId])
    await expect(confirm(other, expired.challengeId)).rejects.toThrow()
  })

  it('enforces the resend interval across form modes and invalidates the old code on resend', async () => {
    const address = email(), first = await signup(address)
    const original = delivery.lastDemoCode(address, 'register')!
    await expect(codes.request({ email: address, intent: 'login' })).rejects.toMatchObject({ status: 429 })
    await age(first.challengeId)
    const next = await signup(address)
    await expect(confirm(address, first.challengeId, 'register', original)).rejects.toThrow()
    expect((await confirm(address, next.challengeId)).emailVerified).toBe(true)
  })

  it('binds codes to the email, challenge and form intent', async () => {
    const address = email(), challenge = await signup(address), correct = delivery.lastDemoCode(address, 'register')!
    await expect(confirm(email(), challenge.challengeId, 'register', correct)).rejects.toThrow()
    await expect(confirm(address, challenge.challengeId, 'login', correct)).rejects.toThrow()
    await expect(confirm(address, randomUUID(), 'register', correct)).rejects.toThrow()
    expect((await confirm(address, challenge.challengeId, 'register', correct)).emailVerified).toBe(true)
  })

  it('commits only one concurrent verification and one concurrent resend', async () => {
    const address = email(), challenge = await signup(address)
    const results = await Promise.allSettled([confirm(address, challenge.challengeId), confirm(address, challenge.challengeId)])
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    await age(challenge.challengeId)
    const resends = await Promise.allSettled([codes.request({ email: address, intent: 'login' }), codes.request({ email: address, intent: 'login' })])
    expect(resends.filter(row => row.status === 'fulfilled')).toHaveLength(1)
  })

  it('preserves the previous code when delivery of a replacement fails', async () => {
    const address = email(), first = await signup(address), original = delivery.lastDemoCode(address, 'register')!
    await age(first.challengeId)
    jest.spyOn(delivery, 'sendEmailCode').mockRejectedValueOnce(new Error('Test delivery unavailable'))
    await expect(signup(address)).rejects.toThrow('Test delivery unavailable')
    expect((await confirm(address, first.challengeId, 'register', original)).emailVerified).toBe(true)
  })

  it('rejects a code after the identity is revoked or the account is closed', async () => {
    const address = email(), challenge = await signup(address)
    const [row] = await db.query('SELECT user_id FROM app.email_code_challenges WHERE id=$1', [challenge.challengeId])
    await db.query(`UPDATE app.login_identities SET state='revoked',verified_at=now(),revoked_at=now() WHERE user_id=$1`, [row.user_id])
    await expect(confirm(address, challenge.challengeId)).rejects.toThrow()
    const other = email(), closed = await signup(other)
    const [second] = await db.query('SELECT user_id FROM app.email_code_challenges WHERE id=$1', [closed.challengeId])
    await db.query(`UPDATE app.users SET status='closed',closed_at=now() WHERE id=$1`, [second.user_id])
    await expect(confirm(other, closed.challengeId)).rejects.toThrow()
  })

  it('serves validated HTTP registration and confirmation contracts with a real session', async () => {
    const address = email()
    const post = (path: string, body: unknown) => fetch(`${base}/v1/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const sent = await post('email-code/request', { email: address, intent: 'register', locale: 'zh-CN', consents })
    expect(sent.status).toBe(201)
    const challenge = await sent.json()
    const limited = await post('email-code/request', { email: address, intent: 'register', consents })
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    const malformed = await post('email-code/confirm', { email: address, intent: 'register', challengeId: challenge.challengeId, code: '12345' })
    expect(malformed.status).toBe(400)
    const invalid = await post('email-code/confirm', { email: address, intent: 'register', challengeId: challenge.challengeId, code: '999999', userId: randomUUID() })
    expect(invalid.status).toBe(400)
    const verified = await post('email-code/confirm', { email: address, intent: 'register', challengeId: challenge.challengeId,
      code: delivery.lastDemoCode(address, 'register'), device: { name: 'h5-mobile' } })
    expect(verified.status).toBe(409)
    const pending = await verified.json()
    expect(pending.error.code).toBe('AUTH_FLOW_REQUIRED')
    expect(pending.error.details.authFlow.step).toBe('password')
    expect(pending).not.toHaveProperty('token')
    const completed = await post('flow/complete', { continuationToken: pending.error.details.authFlow.continuationToken,
      password: 'disposable test password 123!' })
    expect(completed.status).toBe(201)
    expect((await completed.json()).emailVerified).toBe(true)
  })

  it('looks up an email for the email-first form: new, unfinished, existing with password, unavailable', async () => {
    const address = email()
    expect(await codes.lookup(address)).toEqual({ account: 'new', password: false, passkey: false })
    const challenge = await signup(address)
    // An unverified signup is still "new" so the owner can finish it with a fresh code.
    expect(await codes.lookup(address.toUpperCase())).toEqual({ account: 'new', password: false, passkey: false })
    await confirm(address, challenge.challengeId)
    expect(await codes.lookup(` ${address} `)).toEqual({ account: 'existing', password: true, passkey: false })
    const [row] = await db.query('SELECT user_id FROM app.email_code_challenges WHERE id=$1', [challenge.challengeId])
    // An active passkey is announced so the form can offer it first; a revoked one is not.
    await db.query(`INSERT INTO app.passkey_credentials (id,user_id,credential_id,public_key,counter,transports,label,state,revoked_at) VALUES ($1,$2,$3,$4,0,'{}','Passkey','revoked',now())`, [randomUUID(), row.user_id, `cred-${randomUUID()}`, Buffer.from([0])])
    expect((await codes.lookup(address)).passkey).toBe(false)
    await db.query(`INSERT INTO app.passkey_credentials (id,user_id,credential_id,public_key,counter,transports,label,state) VALUES ($1,$2,$3,$4,0,'{}','Passkey','active')`, [randomUUID(), row.user_id, `cred-${randomUUID()}`, Buffer.from([0])])
    expect(await codes.lookup(address)).toEqual({ account: 'existing', password: true, passkey: true })
    await db.query(`UPDATE app.users SET status='closed',closed_at=now() WHERE id=$1`, [row.user_id])
    expect(await codes.lookup(address)).toEqual({ account: 'unavailable', password: false, passkey: false })
    const response = await fetch(`${base}/v1/auth/email/lookup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }) })
    expect(response.status).toBe(400)
  })
})
