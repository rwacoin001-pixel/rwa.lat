import { ConfigService } from '@nestjs/config'
import { validate } from 'class-validator'
import { NotificationDeliveryService } from '../../src/notification/notification-delivery.service'
import { CreateNotificationDto } from '../../src/notification/notification.dto'
import { EmailDeliveryClient } from '../../src/common/email-delivery.client'
import * as emailTemplates from '../../src/common/email-template'
import { renderNotificationEmail } from '../../src/common/notification-email'

const ID = '00000000-0000-4000-8000-000000000001'
const config = new ConfigService({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'no-reply@example.test', RESEND_API_KEY: 'test-placeholder', NOTIFICATION_DELIVERY_WORKER_ENABLED: 'true' })

function harness(over: Record<string, unknown> = {}, preference = { locale: 'en', channels: { email: true }, communication_consent: true }, userLocale = 'en') {
  const note: any = { id: ID, recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Account notice', body: 'Code 001234\nAmount 100.00 SGD', payload: { content: {} }, ...over }
  const jobs = { claim: jest.fn().mockResolvedValue([{ id: ID, payload: { notificationId: ID }, createdAt: new Date() }]), ack: jest.fn(), nack: jest.fn().mockResolvedValue({ state: 'pending' }) }
  const ds = { query: jest.fn(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM app.notifications')) return [note]
    if (sql.includes('login_identities')) return [{ identifier_ciphertext: 'encrypted', encryption_key_version: 1 }]
    if (sql.includes('app.preferences') && sql.includes('app.users')) return [{ preference_locale: preference.locale, user_locale: userLocale }]
    if (sql.includes('FROM app.preferences')) return [preference]
    if (sql.includes('FROM app.users')) return [{ locale: userLocale }]
    if (sql.includes('sent_at=COALESCE')) note.sent_at = new Date()
    return []
  }) }
  const service = new NotificationDeliveryService(ds as any, config, { decrypt: () => 'recipient@example.test' } as any, jobs as any)
  const send = jest.spyOn((service as any).email as EmailDeliveryClient, 'send').mockResolvedValue(undefined)
  return { service, send, ds, jobs, note }
}

describe('Branded notification queue emails', () => {
  it('escapes arbitrary content while preserving code and amount text in both alternatives', async () => {
    const { service, send, jobs } = harness({ title: '<img src=x onerror=alert(1)>', body: '<script>bad()</script>\nCode 001234\nAmount 100.00 SGD' })
    await service.runDue()
    const message = send.mock.calls[0][0]
    expect(message.html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
    expect(message.html).not.toContain('<script>')
    expect(message.html).not.toContain('<img src=x')
    expect(message.html).toContain('001234')
    expect(message.html).toContain('100.00 SGD')
    expect(message.text).toContain('Code 001234\nAmount 100.00 SGD')
    expect(message.idempotencyKey).toBe(`notification:${ID}`)
    expect(jobs.ack).toHaveBeenCalledTimes(1)
  })

  it.each(['zh-CN', 'zh_CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'])('uses persisted explicit %s locale ahead of preferences', async locale => {
    const { service, send } = harness({ locale }, { locale: 'fr', channels: { email: true }, communication_consent: true }, 'es')
    await service.runDue()
    expect(send.mock.calls[0][0].html).toContain(`lang="${locale.replace('_', '-')}"`)
    expect(send.mock.calls[0][0].html).toContain(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`)
  })

  it.each([
    [{ locale: undefined }, 'fr', 'es', 'fr'],
    [{ locale: 'unsupported' }, 'pt', 'es', 'pt'],
    [{ locale: undefined }, undefined, 'ar', 'ar'],
    [{ locale: undefined }, undefined, 'unsupported', 'en'],
  ])('resolves the first supported saved locale', async (note, preferenceLocale, userLocale, expected) => {
    const { service, send } = harness(note, { locale: preferenceLocale as any, channels: { email: true }, communication_consent: true }, userLocale)
    await service.runDue()
    expect(send.mock.calls[0][0].html).toContain(`lang="${expected}"`)
  })

  it('maps only the exact event kind with a complete contract to the rich template', async () => {
    const { service, send } = harness({ kind: 'deposit_received', payload: { content: { amount: '001.2300', currency: 'SGD', network: 'Bank', reference: 'Ref<1>', time: '2026-10-15 10:00 UTC', actionUrl: 'https://a-reit.com/assets/activity' } } })
    await service.runDue()
    const message = send.mock.calls[0][0]
    expect(message.subject).toBe('Deposit credited · A-REIT')
    expect(message.html).toContain('001.2300 SGD')
    expect(message.html).toContain('Ref&lt;1&gt;')
    expect(message.text).toContain('001.2300 SGD')
  })

  it('propagates operational template failures instead of claiming a successful generic render', () => {
    const error = new Error('ENOENT: missing production template asset')
    const render = jest.spyOn(emailTemplates, 'renderEmailTemplate').mockImplementation(() => { throw error })
    try {
      expect(() => renderNotificationEmail({ kind: 'kyc-approved', title: 'Notice', payload: { content: { reference: 'Ref1', time: '2026-10-15 10:00 UTC', actionUrl: 'https://a-reit.com/kyc' } } }, 'en')).toThrow(error)
    } finally { render.mockRestore() }
  })

  it('keeps a valid queued scenario unsent and retryable when production template assets fail', async () => {
    const { service, send, jobs, note } = harness({ kind: 'kyc-approved', payload: { content: { reference: 'Ref1', time: '2026-10-15 10:00 UTC', actionUrl: 'https://a-reit.com/kyc' } } })
    const render = jest.spyOn(emailTemplates, 'renderEmailTemplate').mockImplementation(() => { throw new Error('Corrupt production template asset') })
    try {
      await service.runDue()
      expect(send).not.toHaveBeenCalled()
      expect(note.sent_at).toBeUndefined()
      expect(jobs.ack).not.toHaveBeenCalled()
      expect(jobs.nack).toHaveBeenCalledTimes(1)
    } finally { render.mockRestore() }
    await service.runDue()
    expect(send).toHaveBeenCalledTimes(1)
    expect(jobs.ack).toHaveBeenCalledTimes(1)
    expect(note.sent_at).toBeTruthy()
  })

  it.each([
    ['deposit', { amount: '10', currency: 'SGD' }],
    ['deposit_received', { amount: '10', currency: 'SGD' }],
    ['system', { templateId: 'deposit-received', amount: '10', currency: 'SGD' }],
    ['login-code', { code: '123456', expiryMinutes: '10' }],
    ['deposit_received', { amount: '10', currency: 'SGD', network: 'Bank', reference: 'x', time: 'now', actionUrl: 'https://a-reit.com.evil.test/assets' }],
  ])('falls back without fabricating %s fields or financial intent', async (kind, content) => {
    const { service, send } = harness({ kind, title: 'Original title', body: 'Original body', payload: { content } })
    await service.runDue()
    const message = send.mock.calls[0][0]
    expect(message.subject).toContain('Original title')
    expect(message.html).toContain('Original body')
    expect(message.html).not.toContain('Deposit credited')
    expect(message.html).not.toContain('evil.test')
    expect(message.text).not.toContain('expiryMinutes')
  })

  it.each(['marketing', 'product_update', 'product-update'])('uses a real preference control without claiming one-click unsubscribe for %s', async kind => {
    const { service, send } = harness({ kind, payload: { content: { actionUrl: 'https://evil.test', unsubscribeUrl: 'https://a-reit.com/unsubscribe/fake' } } })
    await service.runDue()
    const message = send.mock.calls[0][0]
    expect(message.html).toContain('https://a-reit.com/profile/marketing')
    expect(message.text).toContain('Manage email preferences')
    expect(message.html).not.toContain('/unsubscribe')
    expect(message.html).not.toContain('evil.test')
  })

  it('preserves consent withdrawal cancellation', async () => {
    const { service, send, jobs, ds } = harness({ kind: 'marketing' }, { locale: 'en', channels: { email: true }, communication_consent: false })
    await service.runDue()
    expect(send).not.toHaveBeenCalled()
    expect(jobs.ack).toHaveBeenCalledTimes(1)
    expect(ds.query.mock.calls.some(([sql]) => sql.includes('consent_withdrawn'))).toBe(true)
  })

  it('retries provider errors with the same key, and does not resend an accepted note', async () => {
    const { service, send, jobs } = harness()
    send.mockRejectedValueOnce(new Error('Unavailable'))
    await service.runDue()
    expect(jobs.nack).toHaveBeenCalledTimes(1)
    expect(jobs.ack).not.toHaveBeenCalled()
    await service.runDue()
    await service.runDue()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.map(([message]) => message.idempotencyKey)).toEqual([`notification:${ID}`, `notification:${ID}`])
  })

  it('keeps expired provider intents unsent', async () => {
    const { service, send, jobs } = harness()
    jobs.claim.mockResolvedValue([{ id: ID, payload: { notificationId: ID }, createdAt: new Date(Date.now() - 24 * 3600_000) }])
    await service.runDue()
    expect(send).not.toHaveBeenCalled()
    expect(jobs.nack).toHaveBeenCalledTimes(1)
  })

  it('accepts locale through DTO validation and persists the normalized explicit locale', async () => {
    const input = Object.assign(new CreateNotificationDto(), { recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Notice', locale: 'zh_CN' })
    expect(await validate(input, { whitelist: true })).toEqual([])
    expect((input as any).locale).toBe('zh_CN')
    const { service, ds } = harness()
    const save = jest.fn(async (_entity, value) => ({ id: ID, ...value }))
    ;(ds as any).transaction = async (run: any) => run({ query: async () => [], create: (_entity: any, value: any) => value, save })
    await service.enqueue(input, ID)
    expect(save.mock.calls[0][1].locale).toBe('zh-CN')
  })

  it('snapshots the preferred locale so later preference edits cannot change a retried provider payload', async () => {
    const { service, ds } = harness()
    const save = jest.fn(async (_entity, value) => ({ id: ID, ...value }))
    ;(ds as any).transaction = async (run: any) => run({ query: async (sql: string) => sql.includes('AS preference_locale') ? [{ preference_locale: 'fr', user_locale: 'es' }] : [], create: (_entity: any, value: any) => value, save })
    await service.enqueue({ recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Notice' }, ID)
    expect(save.mock.calls[0][1].locale).toBe('fr')
    expect(save.mock.calls[0][1].payload.email_locale_override).toBeNull()
  })

  it('compares the explicit locale intent without confusing a saved preference snapshot with an override', async () => {
    const { service, ds } = harness()
    const existing = { id: ID, recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Notice', locale: 'fr', payload: { content: {}, email_locale_override: null } }
    ;(ds as any).transaction = async (run: any) => run({ query: async (sql: string) => sql.includes('n.*') ? [existing] : [] })
    await expect(service.enqueue({ recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Notice' }, ID)).resolves.toMatchObject({ id: ID })
    await expect(service.enqueue({ recipient_user_id: ID, channel: 'email', kind: 'system', title: 'Notice', locale: 'fr' }, ID)).rejects.toThrow('different notification')
  })
})
