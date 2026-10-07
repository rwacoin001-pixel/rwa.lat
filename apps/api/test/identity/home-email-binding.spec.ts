import { ConfigService } from '@nestjs/config'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { AuthFlowService } from '../../src/identity/auth-flow.service'
import { IdentityService } from '../../src/identity/identity.service'
import * as providerEmail from '../../src/identity/google-email'

function fixture() {
  const crypto = new IdentityCrypto(new ConfigService({ IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64) }))
  const rows = new Map<string, any>(), emails: any[] = [], sessions: any[] = []
  const match = (row: any, where: any) => Object.entries(where).every(([key, value]: any) => row[key]?.equals ? row[key].equals(value) : value?.constructor?.name === 'FindOperator' ? row[key] == null : row[key] === value)
  const identities = {
    findOne: async ({ where }: any) => emails.find(row => match(row, where)) ?? null,
    save: async (row: any) => { const at = emails.findIndex(old => old.id === row.id); if (at >= 0) emails[at] = row; else emails.push(row); return row },
    update: async (where: any, patch: any) => { for (const row of emails) if (match(row, where)) Object.assign(row, patch) },
  }
  const query = async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT payload_ciphertext')) return [...rows.values()].filter(row => row.user_id === p[0])
    if (sql.startsWith('SELECT * FROM app.auth_flows')) return rows.has(p[0].toString('hex')) ? [rows.get(p[0].toString('hex'))] : []
    if (sql.includes('SELECT u.status')) return [{ status: 'active', version: 0, password_required: false, password_hash: null }]
    if (sql.startsWith('SELECT locale')) return [{ locale: 'zh-CN' }]
    if (sql.startsWith('INSERT INTO app.auth_flows')) rows.set(p[0].toString('hex'), { user_id: p[1], payload_ciphertext: p[2], encryption_key_version: p[3], expires_at: p[4], attempts: 0, consumed_at: null })
    if (sql.startsWith('UPDATE app.auth_flows SET payload')) Object.assign(rows.get(p[0].toString('hex')), { payload_ciphertext: p[1], encryption_key_version: p[2] })
    if (sql.startsWith('UPDATE app.auth_flows SET attempts')) { const row = rows.get(p[0].toString('hex')); row.attempts++; if (p[1] || row.attempts >= 5) row.consumed_at = new Date() }
    if (sql.startsWith('INSERT INTO app.login_identities') && !emails.some(row => row.kind === 'email' && (row.userId === p[1] || row.identifierHash.equals(p[2])))) emails.push({ id: p[0], userId: p[1], kind: 'email', state: 'verified', identifierHash: p[2], identifierCiphertext: p[3], encryptionKeyVersion: p[4], verifiedAt: new Date(), revokedAt: null })
    return []
  }
  const manager: any = { query, getRepository: () => identities }
  const db: any = { manager, transaction: async (run: any) => run(manager) }
  const delivery = { sendEmailCode: jest.fn(async (_: any) => undefined) }
  const flows: any = new AuthFlowService(db, crypto, delivery as any)
  const sessionRepo = { findOne: async ({ where }: any) => sessions.find(row => match(row, where)) ?? null, save: jest.fn(async row => row) }
  const service: any = Object.assign(Object.create(IdentityService.prototype), { authFlows: flows, crypto, sessions: sessionRepo, loginIdentities: identities, config: new ConfigService(), accountLabel: async () => null })
  for (const userId of ['A', 'B']) sessions.push({ id: `${userId}-session`, userId, state: 'active', tokenHash: crypto.hashToken(`${userId}-token`), expiresAt: new Date(Date.now() + 600_000) })
  const finish = jest.fn(async () => ({ token: 'must-not-be-issued' }))
  service.createSession = finish
  return { crypto, flows, service, finish, rows, emails, sessions, manager, identities, delivery }
}

describe('authenticated Home email binding', () => {
  it('rejects stale visible user before creating or mutating another account flow', async () => {
    const f = fixture()
    await expect(f.service.startEmailBinding('B-token', 'A')).rejects.toMatchObject({response:{code:'AUTH_ACCOUNT_CHANGED'}})
    expect(f.rows.size).toBe(0)
    const flow = await f.service.startEmailBinding('B-token', 'B')
    await expect(f.service.sendEmailBinding('B-token', flow.continuationToken, 'new@example.com', 'A')).rejects.toMatchObject({response:{code:'AUTH_ACCOUNT_CHANGED'}})
    await expect(f.service.resendEmailBinding('B-token', flow.continuationToken, 'A')).rejects.toMatchObject({response:{code:'AUTH_ACCOUNT_CHANGED'}})
    await expect(f.service.completeEmailBinding('B-token', flow.continuationToken, '123456', 'A')).rejects.toMatchObject({response:{code:'AUTH_ACCOUNT_CHANGED'}})
    expect(f.delivery.sendEmailCode).not.toHaveBeenCalled();expect(f.emails).toHaveLength(0)
  })
  it('does not bypass email cooldown by changing address or starting another flow', async () => {
    const f = fixture(), first = await f.service.startEmailBinding('A-token')
    await f.service.sendEmailBinding('A-token', first.continuationToken, 'first@example.com')
    await expect(f.service.sendEmailBinding('A-token', first.continuationToken, 'second@example.com')).rejects.toMatchObject({ status: 429 })
    const second = await f.service.startEmailBinding('A-token')
    await expect(f.service.sendEmailBinding('A-token', second.continuationToken, 'third@example.com')).rejects.toMatchObject({ status: 429 })
    expect(f.delivery.sendEmailCode).toHaveBeenCalledTimes(1)
  })
  it('caps fresh binding flows per account', async () => {
    const f = fixture()
    for (let i = 0; i < 5; i++) await f.service.startEmailBinding('A-token')
    await expect(f.service.startEmailBinding('A-token')).rejects.toMatchObject({ status: 429 })
  })
  it('binds email to the signed-in user without replacing or issuing a session', async () => {
    const f = fixture(), start = await f.service.startEmailBinding('A-token')
    const sent = await f.service.sendEmailBinding('A-token', start.continuationToken, ' new@example.com ')
    expect(sent).toMatchObject({ emailRequired: false, retryAfter: 60 })
    const code = f.delivery.sendEmailCode.mock.calls[0][0].code
    expect(await f.service.completeEmailBinding('A-token', start.continuationToken, code)).toEqual({ userId: 'A', emailVerified: true })
    expect(f.emails).toEqual([expect.objectContaining({ userId: 'A', kind: 'email', state: 'verified' })])
    expect(f.sessions).toHaveLength(2); expect(f.finish).not.toHaveBeenCalled()
    await expect(f.service.completeEmailBinding('A-token', start.continuationToken, code)).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
  })
  it('requires an active session and rejects another account token at send, resend and completion', async () => {
    const f = fixture(), start = await f.service.startEmailBinding('A-token')
    await expect(f.service.startEmailBinding('bad')).rejects.toThrow()
    await expect(f.service.sendEmailBinding('B-token', start.continuationToken, 'new@example.com')).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
    await expect(f.service.resendEmailBinding('B-token', start.continuationToken)).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
    await expect(f.service.completeEmailBinding('B-token', start.continuationToken, '123456')).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
    expect(f.delivery.sendEmailCode).not.toHaveBeenCalled(); expect(f.emails).toHaveLength(0)
  })
  it('rejects expired flows, limits wrong codes, and enforces resend cooldown', async () => {
    const f = fixture(), start = await f.service.startEmailBinding('A-token')
    await f.service.sendEmailBinding('A-token', start.continuationToken, 'new@example.com')
    await expect(f.service.resendEmailBinding('A-token', start.continuationToken)).rejects.toMatchObject({ status: 429 })
    const code = f.delivery.sendEmailCode.mock.calls[0][0].code
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await expect(f.service.completeEmailBinding('A-token', start.continuationToken, wrong)).rejects.toMatchObject({ response: { code: 'AUTH_CODE_INVALID' } })
    await expect(f.service.completeEmailBinding('A-token', start.continuationToken, code)).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
    const next = await f.service.startEmailBinding('A-token')
    f.rows.get(f.crypto.hashToken(next.continuationToken).toString('hex')).expires_at = new Date(0)
    await expect(f.service.sendEmailBinding('A-token', next.continuationToken, 'new@example.com')).rejects.toThrow()
    expect(f.emails).toHaveLength(0); expect(f.finish).not.toHaveBeenCalled()
  })
  it('rejects a foreign-owned address and never modifies the other account', async () => {
    const f = fixture(), hash = f.crypto.hashIdentifier('taken@example.com')
    f.emails.push({ id: 'owned', userId: 'B', kind: 'email', state: 'verified', identifierHash: hash })
    const start = await f.service.startEmailBinding('A-token')
    await expect(f.service.sendEmailBinding('A-token', start.continuationToken, 'taken@example.com')).rejects.toMatchObject({ response: { code: 'IDENTITY_EMAIL_TAKEN' } })
    expect(f.emails).toHaveLength(1); expect(f.emails[0].userId).toBe('B'); expect(f.delivery.sendEmailCode).not.toHaveBeenCalled()
  })
  it('does not use the inline completion endpoint for a password or email-change flow', async () => {
    const f = fixture(), start = await f.service.startEmailBinding('A-token')
    const row = f.rows.get(f.crypto.hashToken(start.continuationToken).toString('hex'))
    const payload = JSON.parse(f.crypto.decrypt(row.payload_ciphertext, row.encryption_key_version)); payload.purpose = 'email_change'
    const encrypted = f.crypto.encrypt(JSON.stringify(payload)); Object.assign(row, { payload_ciphertext: encrypted.ciphertext, encryption_key_version: encrypted.keyVersion })
    await expect(f.service.completeEmailBinding('A-token', start.continuationToken, '123456')).rejects.toMatchObject({ response: { code: 'AUTH_FLOW_INVALID' } })
    expect(f.finish).not.toHaveBeenCalled()
  })
})

describe('server-verified GitHub email persistence', () => {
  it('creates a verified email on the SAME GitHub account', async () => {
    const f = fixture(), helper = (providerEmail as any).persistProviderEmail
    await helper(f.manager, f.crypto, { id: 'github', userId: 'A', kind: 'github' }, 'User@Example.com')
    expect(f.emails).toEqual([expect.objectContaining({ userId: 'A', state: 'verified', kind: 'email' })])
    expect(f.crypto.decrypt(f.emails[0].identifierCiphertext, f.emails[0].encryptionKeyVersion)).toBe('user@example.com')
  })
  it('does not claim an email owned by B or infer a verified fallback for A', async () => {
    const f = fixture(); f.emails.push({ id: 'foreign', userId: 'B', kind: 'email', state: 'verified', identifierHash: f.crypto.hashIdentifier('taken@example.com') })
    await (providerEmail as any).persistProviderEmail(f.manager, f.crypto, { id: 'github', userId: 'A', kind: 'github' }, 'taken@example.com')
    expect(f.emails).toHaveLength(1); expect((await f.service.getSessionViewByToken('A-token')).emailVerified).toBe(false)
  })
  it('preserves revoked/changed own email and does not trust missing or noreply addresses', async () => {
    for (const email of [undefined, '', 'not-email', '123@users.noreply.github.com']) {
      const f = fixture(); await (providerEmail as any).persistProviderEmail(f.manager, f.crypto, { id: 'github', userId: 'A', kind: 'github' }, email)
      expect(f.emails).toHaveLength(0)
    }
    const f = fixture(); f.emails.push({ id: 'own', userId: 'A', kind: 'email', state: 'revoked', revokedAt: new Date(), identifierHash: f.crypto.hashIdentifier('old@example.com') })
    await (providerEmail as any).persistProviderEmail(f.manager, f.crypto, { id: 'github', userId: 'A', kind: 'github' }, 'new@example.com')
    expect(f.emails).toHaveLength(1); expect(f.emails[0].state).toBe('revoked')
  })
})
