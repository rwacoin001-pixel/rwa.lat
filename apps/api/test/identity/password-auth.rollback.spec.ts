import 'dotenv/config'
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { HttpException } from '@nestjs/common'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from '../../src/identity/identity-passkey-challenge.entity'
import { PasskeyCredential } from '../../src/security/passkey-credential.entity'
import { EmailCodeService } from '../../src/identity/email-code.service'
import { hashPassword } from '../../src/identity/password-hash'
import type { AuthFlowView } from '../../src/identity/auth-flow.service'

// Opt-in: no schema reset, no committed fixture writes. Every test rolls back its own transaction.
const suite = process.env.RUN_AUTH_ROLLBACK === '1' ? describe : describe.skip
suite('password authentication (real PostgreSQL, rollback only)', () => {
  let db: DataSource, runner: QueryRunner, identity: IdentityService, crypto: IdentityCrypto, delivery: IdentityDeliveryService
  let codes: EmailCodeService, userId: string, email: string
  const password = 'test-only long password 928!'
  const config = new ConfigService({ AUTH_ADAPTER: 'demo', IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64), PASSKEY_RP_ID:'localhost', PASSKEY_ORIGIN:'http://localhost:3030' })
  const device = { fingerprint: randomUUID(), name: 'test-only device' }
  async function flow(request: Promise<unknown>, step: string): Promise<AuthFlowView> {
    try { await request } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      const response = (error as HttpException).getResponse() as { code: string; authFlow: AuthFlowView }
      expect(response.code).toBe('AUTH_FLOW_REQUIRED'); expect(response.authFlow.step).toBe(step)
      return response.authFlow
    }
    throw new Error('Expected verification, received a session')
  }
  const finish = (f: AuthFlowView, extra: Record<string, string> = {}) => identity.completeAuthFlow({ continuationToken: f.continuationToken, ...extra })
  beforeAll(async () => {
    const isolated = Boolean(process.env.TEST_DATABASE_URL)
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: isolated ? 'test' : 'development', APP_ENV: isolated ? 'test' : 'development' }))
    const target = new URL(String(db.options.type === 'postgres' ? db.options.url : ''))
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
      || (isolated ? !target.pathname.endsWith('_test') : target.pathname !== '/rwa_lat_dev')) throw new Error('Requires local isolated test or development database')
    await db.initialize()
  })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    const manager = runner.manager
    const scoped = { manager, query: manager.query.bind(manager), transaction: manager.transaction.bind(manager) } as unknown as DataSource
    crypto = new IdentityCrypto(config); delivery = new IdentityDeliveryService(config)
    identity = new IdentityService(manager.getRepository(User), manager.getRepository(LoginIdentity), manager.getRepository(Device),
      manager.getRepository(Session), manager.getRepository(IdentityOneTimeToken), manager.getRepository(PasskeyCredential),
      manager.getRepository(IdentityPasskeyChallenge), crypto, delivery, {} as never, config, scoped)
    codes = new EmailCodeService(scoped, crypto, delivery, identity)
    userId = randomUUID(); email = `auth-${randomUUID()}@example.invalid`
    await manager.getRepository(User).save({ id: userId, status: 'active', locale: 'en' })
    const encrypted = crypto.encrypt(email)
    await manager.getRepository(LoginIdentity).save({ id: randomUUID(), userId, kind: 'email', state: 'verified', verifiedAt: new Date(),
      identifierHash: crypto.hashIdentifier(email), identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
    await manager.query('INSERT INTO app.auth_credentials(user_id,password_hash) VALUES($1,$2)', [userId, await hashPassword(password)])
  })
  afterEach(async () => { delivery?.onModuleDestroy(); if (runner?.isTransactionActive) await runner.rollbackTransaction(); await runner?.release() })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })
  const sessions = () => runner.manager.getRepository(Session).countBy({ userId, state: 'active' })
  async function factor() {
    const secret = crypto.generateTotpSecret(), id = randomUUID(), encrypted = crypto.encrypt(secret)
    await runner.query(`INSERT INTO app.totp_factors(id,user_id,state,label,secret_ciphertext,encryption_key_version,recovery_code_hashes,activated_at)
      VALUES($1,$2,'active','fixture',$3,$4,'[]',now())`, [id, userId, encrypted.ciphertext, encrypted.keyVersion])
    return { id, code: (crypto as any).totpCode(secret, Math.floor(Date.now() / 30000)) as string }
  }
  it('requires email after correct password, commits failed attempts, rejects replay and issues a session only once', async () => {
    const f = await flow(identity.loginPassword(email, password, device), 'email')
    expect(await sessions()).toBe(0)
    await expect(finish(f, { code: 'invalid' })).rejects.toThrow()
    const [row] = await runner.query('SELECT attempts FROM app.auth_flows WHERE token_hash=$1', [crypto.hashToken(f.continuationToken)])
    expect(row.attempts).toBe(1)
    const result = await finish(f, { code: delivery.lastDemoCode(email, 'login')! }) as { token: string }
    expect((await identity.getSessionViewByToken(result.token)).userId).toBe(userId)
    expect(await sessions()).toBe(1)
    await expect(finish(f, { code: delivery.lastDemoCode(email, 'login')! })).rejects.toThrow()
  })
  it('does not distinguish nonexistent email and incorrect password', async () => {
    for (const address of [email, `missing-${email}`]) {
      await expect(identity.loginPassword(address, 'incorrect')).rejects.toMatchObject({ response: { code: 'AUTH_PASSWORD_INVALID' } })
    }
    expect(await sessions()).toBe(0)
  })
  it('requires TOTP for password and email-code entry, and rejects reuse across flows', async () => {
    const totp = await factor()
    const f = await flow(identity.loginPassword(email, password, device), 'totp')
    const challenge = await codes.request({ email, intent: 'login' })
    const alternate = await flow(codes.confirm({ email, intent: 'login', challengeId: challenge.challengeId, code: delivery.lastDemoCode(email, 'login')! }), 'totp')
    expect(await sessions()).toBe(0)
    await finish(f, { code: totp.code })
    await expect(finish(alternate, { code: totp.code })).rejects.toThrow()
    expect(await sessions()).toBe(1)
  })
  it('requires TOTP after email links and account recovery', async () => {
    await factor()
    await identity.requestEmailLogin(email)
    await flow(identity.confirmEmailLogin(delivery.lastDemoToken(email, 'email_login')!), 'totp')
    await identity.recover(email)
    await flow(identity.confirmRecovery(delivery.lastDemoToken(email, 'account_recovery')!), 'totp')
    expect(await sessions()).toBe(0)
  })
  it('resets password, revokes existing sessions and stale recovery links, and requires fresh login without adding a funds hold', async () => {
    const f = await flow(identity.loginPassword(email, password, device), 'email')
    const session = await finish(f, { code: delivery.lastDemoCode(email, 'login')! }) as { token: string }
    await identity.recover(email)
    const reset = await flow(identity.confirmRecovery(delivery.lastDemoToken(email, 'account_recovery')!), 'password')
    await identity.recover(email)
    const stale = delivery.lastDemoToken(email, 'account_recovery')!
    expect(await finish(reset, { password: 'replacement password 123!' })).toEqual({ passwordChanged: true, requiresLogin: true })
    expect(await sessions()).toBe(0)
    await expect(identity.getSessionViewByToken(session.token)).rejects.toThrow()
    await expect(identity.confirmRecovery(stale)).rejects.toThrow()
    await expect(identity.loginPassword(email, password)).rejects.toThrow()
    await flow(identity.loginPassword(email, 'replacement password 123!'), 'email')
    const [user] = await runner.query('SELECT status FROM app.users WHERE id=$1', [userId]); expect(user.status).toBe('active')
  })
  it('requires password setup before issuing the first email-registration session', async () => {
    const address = `new-${email}`
    const requirements = await identity.consentRequirements()
    const consents = requirements.required.map(item => ({ documentType: item.documentType, version: item.version, accepted: true as const }))
    const challenge = await codes.request({ email: address, intent: 'register', consents })
    const f = await flow(codes.confirm({ email: address, intent: 'register', challengeId: challenge.challengeId, code: delivery.lastDemoCode(address, 'register')! }), 'password')
    await expect(finish(f, { password: 'short' })).rejects.toThrow()
    const result = await finish(f, { password }) as { token: string }
    expect((await identity.getSessionViewByToken(result.token)).emailVerified).toBe(true)
  })
  it('fails closed when a factor, password version, or account status changes during a flow', async () => {
    const f = await flow(identity.loginPassword(email, password), 'email')
    await runner.query('UPDATE app.auth_credentials SET version=version+1 WHERE user_id=$1', [userId])
    await expect(finish(f, { code: delivery.lastDemoCode(email, 'login')! })).rejects.toThrow()
    const g = await flow(identity.loginPassword(email, password), 'email'); await factor()
    await expect(finish(g, { code: delivery.lastDemoCode(email, 'login')! })).rejects.toThrow()
    await runner.query("UPDATE app.users SET status='suspended' WHERE id=$1", [userId])
    await expect(identity.loginPassword(email, password)).rejects.toThrow()
    expect(await sessions()).toBe(0)
  })
  it('locks a verification after five bad guesses and rejects expired flows', async () => {
    const f = await flow(identity.loginPassword(email, password), 'email')
    for (let i = 0; i < 5; i++) await expect(finish(f, { code: 'invalid' })).rejects.toThrow()
    await expect(finish(f, { code: delivery.lastDemoCode(email, 'login')! })).rejects.toThrow()
    const g = await flow(identity.loginPassword(email, password), 'email')
    await runner.query("UPDATE app.auth_flows SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [crypto.hashToken(g.continuationToken)])
    await expect(finish(g, { code: delivery.lastDemoCode(email, 'login')! })).rejects.toThrow()
    expect(await sessions()).toBe(0)
  })
  it('lets an authenticated third-party user bind a new email and set a password, without merging an existing account', async () => {
    const f = await flow(identity.loginPassword(email, password), 'email')
    const session = await finish(f, { code: delivery.lastDemoCode(email, 'login')! }) as { token: string }
    // Remove only this test fixture identity inside the rollback transaction.
    await runner.manager.getRepository(LoginIdentity).delete({ userId })
    await expect(identity.managePassword(session.token)).rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_BIND_REQUIRED' } })
    const target = `bound-${email}`
    const verify = await flow(identity.managePassword(session.token, device, target), 'email')
    const set = await flow(finish(verify, { code: delivery.lastDemoCode(target, 'login')! }), 'password')
    expect(await finish(set, { password: 'new bound password 456!' })).toEqual({ passwordChanged: true, requiresLogin: true })
    await flow(identity.loginPassword(target, 'new bound password 456!'), 'email')
    expect((await runner.manager.getRepository(LoginIdentity).findOneBy({ userId }))?.state).toBe('verified')
  })
  it('rejects binding an email already owned by another account', async () => {
    const f = await flow(identity.loginPassword(email, password), 'email')
    const session = await finish(f, { code: delivery.lastDemoCode(email, 'login')! }) as { token: string }
    await runner.manager.getRepository(LoginIdentity).delete({ userId })
    const otherId = randomUUID(), encrypted = crypto.encrypt(email)
    await runner.manager.getRepository(User).save({ id: otherId, status: 'active', locale: 'en' })
    await runner.manager.getRepository(LoginIdentity).save({ id: randomUUID(), userId: otherId, kind: 'email',
      state: 'verified', verifiedAt: new Date(), identifierHash: crypto.hashIdentifier(email),
      identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
    const verify = await flow(identity.managePassword(session.token, device, email), 'email')
    await expect(finish(verify, { code: delivery.lastDemoCode(email, 'login')! }))
      .rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_BIND_CONFLICT' } })
    expect(await runner.manager.getRepository(LoginIdentity).countBy({ userId })).toBe(0)
    expect(await runner.manager.getRepository(LoginIdentity).countBy({ userId: otherId })).toBe(1)
  })
  async function signedIn() {
    const f = await flow(identity.loginPassword(email, password), 'email')
    return await finish(f, { code: delivery.lastDemoCode(email, 'login')! }) as { token: string; sessionId: string }
  }
  const proof = (sessionId: string, extra: Record<string, unknown> = {}) => crypto.signState(JSON.stringify({
    audience: 'rwa-lat-security-step-up', userId, sessionId, method: 'passkey', expiresAt: Date.now() + 60_000, ...extra,
  }))
  it('requires the current account and session proof before changing email or skipping password factors', async () => {
    const session = await signedIn()
    for (const token of ['invalid', proof('another-session'), proof(session.sessionId, { userId: randomUUID() }), proof(session.sessionId, { expiresAt: 0 })]) {
      await expect(identity.changeEmail(session.token, `new-${email}`, token)).rejects.toMatchObject({ response: { code: 'STEP_UP_REQUIRED' } })
      await expect(identity.managePassword(session.token, device, undefined, token)).rejects.toMatchObject({ response: { code: 'STEP_UP_REQUIRED' } })
    }
    const next = await flow(identity.managePassword(session.token, device, undefined, proof(session.sessionId)), 'password')
    expect(await finish(next, { password: 'replacement password 789!' })).toEqual({ passwordChanged: true, requiresLogin: true })
  })
  it('changes email only after the new mailbox code, invalidates old sessions and refuses replay', async () => {
    const session = await signedIn(), target = `new-${email}`
    const previousRecovery = await runner.manager.getRepository(IdentityOneTimeToken).save({
      id: randomUUID(), userId, purpose: 'account_recovery', tokenHash: crypto.hashToken('old-recovery'), expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    })
    const f = await flow(identity.changeEmail(session.token, target, proof(session.sessionId)), 'email')
    await expect(finish(f, { code: 'invalid' })).rejects.toMatchObject({ response: { code: 'AUTH_CODE_INVALID' } })
    expect((await runner.manager.getRepository(LoginIdentity).findOneBy({ userId }))?.identifierHash.equals(crypto.hashIdentifier(email))).toBe(true)
    const code = delivery.lastDemoCode(target, 'login')!
    expect(await finish(f, { code })).toEqual({ emailChanged: true, requiresLogin: true })
    await expect(finish(f, { code })).rejects.toThrow()
    await expect(identity.getSessionViewByToken(session.token)).rejects.toThrow()
    expect((await runner.manager.getRepository(IdentityOneTimeToken).findOneBy({ id: previousRecovery.id }))?.consumedAt).not.toBeNull()
    await expect(identity.loginPassword(email, password)).rejects.toThrow()
    await flow(identity.loginPassword(target, password), 'email')
  })
  it('never merges an existing email account during an email change', async () => {
    const session = await signedIn(), otherId = randomUUID(), target = `taken-${email}`
    const encrypted = crypto.encrypt(target)
    await runner.manager.getRepository(User).save({ id: otherId, status: 'active', locale: 'en' })
    await runner.manager.getRepository(LoginIdentity).save({ id: randomUUID(), userId: otherId, kind: 'email', state: 'verified',
      identifierHash: crypto.hashIdentifier(target), identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion, verifiedAt: new Date() })
    await expect(identity.changeEmail(session.token, target, proof(session.sessionId))).rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_BIND_CONFLICT' } })
    expect(await sessions()).toBe(1)
  })
  it('continues a verified OAuth signup after consent without repeating provider authorization', async () => {
    const verifiedEmail = `google-${email}`
    const exchange = jest.fn().mockResolvedValue({ subject: `provider-${randomUUID()}`, intent: 'login', verifiedEmail })
    ;(identity as any).oauthProvider = { exchange }
    const f = await flow(identity.exchangeOAuthCode('google', 'test-code', 'test-state', undefined, device), 'consent')
    const requirements = await identity.consentRequirements()
    await expect(identity.completeAuthFlow({ continuationToken: f.continuationToken })).rejects.toThrow()
    const result = await identity.completeAuthFlow({ continuationToken: f.continuationToken,
      consents: requirements.required.map(item => ({ documentType: item.documentType, version: item.version, accepted: true })) }) as { token: string; userId: string }
    expect(await identity.getSessionViewByToken(result.token)).toMatchObject({ userId: result.userId, emailVerified: true })
    const linkedEmail = await runner.manager.getRepository(LoginIdentity).findOneBy({ userId: result.userId, kind: 'email' })
    expect(linkedEmail?.state).toBe('verified')
    expect(crypto.decrypt(linkedEmail!.identifierCiphertext, linkedEmail!.encryptionKeyVersion)).toBe(verifiedEmail)
    expect(exchange).toHaveBeenCalledTimes(1)
    await expect(identity.completeAuthFlow({ continuationToken: f.continuationToken })).rejects.toThrow()
  })
  async function googleSignIn(verifiedEmail: string) {
    const subject = `provider-${userId}`
    const encrypted = crypto.encrypt(`google:${subject}`)
    const repo = runner.manager.getRepository(LoginIdentity)
    if (!await repo.findOneBy({ userId, kind: 'google' })) {
      await repo.save({ id: randomUUID(), userId, kind: 'google', state: 'verified', verifiedAt: new Date(),
        identifierHash: crypto.hashIdentifier(`google:${subject}`), identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
    }
    ;(identity as any).oauthProvider = { exchange: jest.fn().mockResolvedValue({ subject, verifiedEmail, intent: 'login' }) }
    return identity.exchangeOAuthCode('google', 'test-code', 'test-state', undefined, device)
  }

  it('repairs a legacy Google account without changing its ID and persists a single verified email', async () => {
    await runner.manager.getRepository(LoginIdentity).delete({ userId, kind: 'email' })
    const target = `google-${email}`
    const result = await googleSignIn(target)
    expect(result).toMatchObject({ userId, emailVerified: true })
    expect(await identity.getSessionViewByToken(result.token)).toMatchObject({ userId, emailVerified: true })
    expect((await runner.manager.getRepository(LoginIdentity).findOneBy({ userId, kind: 'email' }))?.state).toBe('verified')
    expect((await googleSignIn(target)).userId).toBe(userId)
    expect(await runner.manager.getRepository(LoginIdentity).countBy({ userId, kind: 'email' })).toBe(1)
  })

  it('does not merge a Google account with another account that already owns its email', async () => {
    await runner.manager.getRepository(LoginIdentity).delete({ userId, kind: 'email' })
    const otherId = randomUUID(), target = `taken-${email}`, encrypted = crypto.encrypt(target)
    await runner.manager.getRepository(User).save({ id: otherId, status: 'active', locale: 'en' })
    await runner.manager.getRepository(LoginIdentity).save({ id: randomUUID(), userId: otherId, kind: 'email', state: 'verified', verifiedAt: new Date(),
      identifierHash: crypto.hashIdentifier(target), identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
    const result = await googleSignIn(target)
    expect(result).toMatchObject({ userId, emailVerified: true })
    const view = await identity.getSessionViewByToken(result.token)
    expect(view.emailVerified).toBe(true)
    expect(view.accountLabel).toContain('@example.invalid')
    expect(view.accountLabel).not.toContain(target.split('@')[0])
    expect(await runner.manager.getRepository(LoginIdentity).countBy({ userId, kind: 'email' })).toBe(0)
    expect((await runner.manager.getRepository(LoginIdentity).findOneBy({ kind: 'email', identifierHash: crypto.hashIdentifier(target) }))?.userId).toBe(otherId)
  })

  it('preserves a separately changed account email after signing in with Google again', async () => {
    const result = await googleSignIn(`google-${email}`)
    expect(result.emailVerified).toBe(true)
    const stored = await runner.manager.getRepository(LoginIdentity).findOneBy({ userId, kind: 'email' })
    expect(crypto.decrypt(stored!.identifierCiphertext, stored!.encryptionKeyVersion)).toBe(email)
  })

  it('enforces the per-account password attempt limit independently of IP', async () => {
    await runner.query(`INSERT INTO app.auth_password_attempts(identifier_hash,attempts,expires_at) VALUES($1,10,now()+interval '15 minutes')`, [crypto.hashIdentifier(email)])
    await expect(identity.loginPassword(email, password)).rejects.toMatchObject({ response: { code: 'AUTH_PASSWORD_RATE_LIMIT' } })
    expect(await sessions()).toBe(0)
  })
  it('verifies a real WebAuthn signature, requires device verification and rejects origin mismatch and replay', async () => {
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const jwk = keys.publicKey.export({ format: 'jwk' })
    const cose = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x!, 'base64url'), Buffer.from('225820', 'hex'), Buffer.from(jwk.y!, 'base64url')])
    const credentialId = randomBytes(32).toString('base64url')
    await runner.manager.getRepository(PasskeyCredential).save({ id: randomUUID(), userId, credentialId,
      publicKey: cose, counter: 0, transports: ['internal'], label: 'cryptographic test fixture', state: 'active' })
    const assertion = (challenge: Record<string, unknown>, origin: string, verified: boolean, id = credentialId) => {
      const data = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: challenge.challenge, origin, crossOrigin: false }))
      const counter = Buffer.alloc(4); counter.writeUInt32BE(1)
      const auth = Buffer.concat([createHash('sha256').update('localhost').digest(), Buffer.from([verified ? 5 : 1]), counter])
      return { id, rawId: id, type: 'public-key', response: {
        clientDataJSON: data.toString('base64url'), authenticatorData: auth.toString('base64url'),
        signature: sign('sha256', Buffer.concat([auth, createHash('sha256').update(data).digest()]), keys.privateKey).toString('base64url'),
      }, clientExtensionResults: {} }
    }
    const a = await identity.beginPasskeyLogin(email)
    const otherId = randomUUID(), otherCredentialId = randomBytes(32).toString('base64url')
    await runner.manager.getRepository(User).save({ id: otherId, status: 'active', locale: 'en' })
    await runner.manager.getRepository(PasskeyCredential).save({ id: randomUUID(), userId: otherId, credentialId: otherCredentialId,
      publicKey: cose, counter: 0, transports: ['internal'], label: 'other account fixture', state: 'active' })
    await expect(identity.finishPasskeyLogin(a.challengeId, assertion(a.options, 'http://localhost:3030', true, otherCredentialId)))
      .rejects.toMatchObject({ response: { code: 'INVALID_VERIFICATION_TOKEN' } })
    expect(await runner.manager.getRepository(Session).countBy({ userId: otherId })).toBe(0)
    await expect(identity.finishPasskeyLogin(a.challengeId, assertion(a.options, 'https://wrong.invalid', true))).rejects.toThrow()
    await expect(identity.finishPasskeyLogin(a.challengeId, assertion(a.options, 'http://localhost:3030', false))).rejects.toThrow()
    expect(await sessions()).toBe(0)
    const response = assertion(a.options, 'http://localhost:3030', true)
    const result = await identity.finishPasskeyLogin(a.challengeId, response, device)
    expect((await identity.getSessionViewByToken(result.token)).userId).toBe(userId)
    await expect(identity.finishPasskeyLogin(a.challengeId, response, device)).rejects.toThrow()
    expect(await sessions()).toBe(1)
  })

  it('looks up active and revoked passkeys without announcing pending or suspended accounts', async () => {
    expect(await codes.lookup(email)).toEqual({ account: 'existing', password: true, passkey: false })
    const passkey = await runner.manager.getRepository(PasskeyCredential).save({ id: randomUUID(), userId,
      credentialId: randomBytes(32).toString('base64url'), publicKey: Buffer.from([0]), counter: 0,
      transports: [], label: 'lookup fixture', state: 'active' })
    expect(await codes.lookup(` ${email.toUpperCase()} `)).toEqual({ account: 'existing', password: true, passkey: true })
    await runner.manager.getRepository(PasskeyCredential).update(passkey.id, { state: 'revoked', revokedAt: new Date() })
    expect((await codes.lookup(email)).passkey).toBe(false)
    await runner.manager.getRepository(LoginIdentity).update({ userId, kind: 'email' }, { state: 'pending', verifiedAt: null })
    expect(await codes.lookup(email)).toEqual({ account: 'new', password: false, passkey: false })
    await runner.manager.getRepository(User).update(userId, { status: 'suspended' })
    expect(await codes.lookup(email)).toEqual({ account: 'unavailable', password: false, passkey: false })
  })
})
