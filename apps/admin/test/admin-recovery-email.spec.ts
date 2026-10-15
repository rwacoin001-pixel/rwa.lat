import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import type { DataSource } from 'typeorm'
import { AdminTotpService } from '../src/admin-totp.service'
import { AdminRateLimiter } from '../src/admin-edge.middleware'
import { AdminTotpController } from '../src/admin-totp.controller'
import { renderAdminRecoveryEmail } from '../src/admin-recovery-email'
import { validate } from 'class-validator'

const key = Buffer.alloc(32, 7)
const originalFetch = global.fetch
const eligible = { id: 'admin-1', email: 'operator@example.com', disabled_at: null, mfa_state: 'enabled' }

function setup(user: object | null = eligible, limits = { count: 0, last: null as Date | null }) {
  const statements: { sql: string; params: any[] }[] = []
  const query = jest.fn(async (sql: string, params: any[] = []) => {
    statements.push({ sql, params })
    if (sql.startsWith('SELECT id,email,disabled_at,mfa_state')) return user ? [user] : []
    if (sql.includes('SELECT count(*)')) return [limits]
    return []
  })
  const ds = { query, transaction: async (run: (em: object) => Promise<unknown>) => run({ query }) }
  const service = new AdminTotpService(ds as unknown as DataSource, new ConfigService({
    ADMIN_LOGIN_MODE: 'totp', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-provider-key',
    EMAIL_FROM: 'security@example.com', ADMIN_MFA_ENCRYPTION_KEY: key.toString('base64'),
  }))
  let delivered: any
  let deliveryHeaders: Record<string, string> = {}
  global.fetch = jest.fn(async (_url, options) => {
    delivered = JSON.parse(String(options?.body))
    deliveryHeaders = options?.headers as Record<string, string>
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  const controller = new AdminTotpController(service)
  const request = (email: string, locale?: string) => controller.request({ email, locale })
  return { request, service, statements, query, delivery: () => delivered, headers: () => deliveryHeaders }
}

afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks() })

describe('administrator recovery email', () => {
  it.each([
    ['zh-CN', 'A-REIT 管理员验证器恢复', '10 分钟', 'ltr'],
    ['en', 'A-REIT administrator authenticator recovery', '10 minutes', 'ltr'],
    ['hi', 'A-REIT व्यवस्थापक ऑथेंटिकेटर रिकवरी', '10 मिनट', 'ltr'],
    ['es', 'A-REIT: recuperación del autenticador de administrador', '10 minutos', 'ltr'],
    ['ar', 'A-REIT: استعادة تطبيق المصادقة للمسؤول', '10 دقائق', 'rtl'],
    ['fr', 'A-REIT : récupération de l’authentificateur administrateur', '10 minutes', 'ltr'],
    ['pt', 'A-REIT: recuperação do autenticador de administrador', '10 minutos', 'ltr'],
  ])('delivers matching localized HTML and text for %s', async (locale, subject, expiry, direction) => {
    const fixture = setup()
    await fixture.request(eligible.email, locale)
    const mail = fixture.delivery()
    expect(mail.subject).toBe(subject)
    expect(mail.html).toContain('<html lang="' + locale + '" dir="' + direction + '">')
    expect(mail.html).toContain('https://api.a-reit.com/v1/media/email-v2/logo-lockup.png')
    expect(mail.html).toContain('prefers-color-scheme:dark')
    expect(mail.html).toContain(expiry)
    expect(mail.text).toContain(expiry)
    const code = mail.text.match(/\b\d{6}\b/)?.[0]
    expect(code).toMatch(/^\d{6}$/)
    expect(mail.html).toContain('>' + code + '</div>')
    expect(mail.html).not.toMatch(/<a\b|<button\b|<script\b/)
    expect(mail.text).not.toContain('undefined')
    const inserted = fixture.statements.find(row => row.sql.includes('INSERT INTO app.admin_mfa_recovery'))!
    expect(inserted.sql).toContain("now()+interval '10 minutes'")
    expect(inserted.params[2]).toEqual(createHmac('sha256', key).update('admin-recovery:' + inserted.params[0] + ':' + code).digest())
    expect(fixture.headers()['Idempotency-Key']).toBe('admin-recovery-' + inserted.params[0])
    expect(fixture.statements.find(row => row.sql.includes('INSERT INTO app.audit_logs'))?.params[4]).toBe('{}')
  })

  it.each([undefined, 'xx', '"><script>', 'zh<script>'])('falls back to English for missing/unsupported locale %s', async locale => {
    const fixture = setup()
    await fixture.request(eligible.email, locale)
    expect(fixture.delivery().subject).toBe('A-REIT administrator authenticator recovery')
    expect(fixture.delivery().html).toContain('<html lang="en" dir="ltr">')
  })

  it.each([['zh_CN', 'zh-CN'], ['zh-Hans', 'zh-CN'], ['EN_us', 'en'], ['pt-BR', 'pt'], ['ar-SA', 'ar']])('normalizes declared language %s to %s', async (locale, expected) => {
    const fixture = setup()
    await fixture.request(eligible.email, locale)
    expect(fixture.delivery().html).toContain('<html lang="' + expected + '"')
  })

  it.each(['12345', '1234567', '<12345', '１２３４５６'])('refuses a malformed recovery code in the renderer', code => {
    expect(() => renderAdminRecoveryEmail(code, eligible.email, 'en')).toThrow('Invalid administrator recovery code')
  })

  it('validates the optional locale field at the recovery request boundary', async () => {
    const Dto = Reflect.getMetadata('design:paramtypes', AdminTotpController.prototype, 'request')[0]
    for (const locale of [undefined, 'fr-FR', 'unsupported']) {
      expect(await validate(Object.assign(new Dto(), { email: eligible.email, locale }))).toEqual([])
    }
    for (const locale of [42, {}, 'x'.repeat(33)]) {
      expect((await validate(Object.assign(new Dto(), { email: eligible.email, locale }))).map(error => error.property)).toContain('locale')
    }
  })

  it('uses the declared interface locale and escapes account content in HTML only', async () => {
    const fixture = setup({ ...eligible, email: 'ops<&"\'@example.com' })
    await fixture.request(eligible.email, 'zh-CN')
    expect(fixture.delivery().html).toContain('ops&lt;&amp;&quot;&#39;@example.com')
    expect(fixture.delivery().html).not.toContain('ops<&')
    expect(fixture.delivery().text).toContain('ops<&"\'@example.com')
    expect(fixture.delivery().text).toContain('完成绑定后')
  })

  it.each([null, { ...eligible, disabled_at: new Date() }, { ...eligible, mfa_state: 'disabled' }])('preserves the same response for ineligible accounts', async user => {
    const fixture = setup(user)
    await expect(fixture.request(eligible.email, 'ar')).resolves.toEqual({ status: 'sent_if_eligible', retryAfterSeconds: 60 })
    expect(fixture.delivery()).toBeUndefined()
    expect(fixture.statements.some(row => row.sql.startsWith('INSERT'))).toBe(false)
  })

  it.each([{ count: 5, last: null }, { count: 1, last: new Date() }])('does not bypass recovery cooldown or account limits', async limits => {
    const fixture = setup(eligible, limits)
    await expect(fixture.request(eligible.email, 'fr')).resolves.toEqual({ status: 'sent_if_eligible', retryAfterSeconds: 60 })
    expect(fixture.delivery()).toBeUndefined()
    expect(fixture.statements.some(row => row.sql.startsWith('INSERT'))).toBe(false)
  })

  it.each(['response', 'network'])('consumes the new challenge if delivery fails: %s', async failure => {
    const fixture = setup()
    global.fetch = jest.fn(async () => { if (failure === 'network') throw Error('offline'); return new Response('{}', { status: 500 }) }) as typeof fetch
    await expect(fixture.request(eligible.email, 'hi')).rejects.toThrow('Recovery email delivery unavailable')
    const inserted = fixture.statements.find(row => row.sql.includes('INSERT INTO app.admin_mfa_recovery'))!
    expect(fixture.statements.at(-1)).toEqual({ sql: 'UPDATE app.admin_mfa_recovery SET consumed_at=now() WHERE id=$1', params: [inserted.params[0]] })
  })

  it('keeps recovery endpoints within the existing shared five-request IP limit', () => {
    const limiter = new AdminRateLimiter()
    for (const action of ['request', 'verify', 'confirm', 'request', 'verify']) {
      expect(limiter.consume({ method: 'POST', path: '/v1/admin/auth/recovery/' + action, ip: '203.0.113.45', now: 1_000 }).allowed).toBe(true)
    }
    expect(limiter.consume({ method: 'POST', path: '/v1/admin/auth/recovery/request', ip: '203.0.113.45', now: 1_000 }).allowed).toBe(false)
  })
})
