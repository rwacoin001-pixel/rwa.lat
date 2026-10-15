import { ConfigService } from '@nestjs/config'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'

const sendMail = jest.fn()
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail, close: jest.fn() })) }))

function service(fromName?: string) {
  return new IdentityDeliveryService(new ConfigService({ AUTH_ADAPTER: 'production', PUBLIC_APP_URL: 'https://a-reit.com',
    EMAIL_PROVIDER: 'smtp', EMAIL_FROM: 'no-reply@a-reit.com', EMAIL_FROM_NAME:fromName, SMTP_HOST: 'smtp.example.com', SMTP_AUTH_MODE: 'none' }))
}

describe('Branded identity emails', () => {
  beforeEach(() => { sendMail.mockReset(); jest.useFakeTimers().setSystemTime(new Date('2026-10-06T06:00:00Z')) })
  afterEach(() => jest.useRealTimers())

  it.each(['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'])('renders %s with public images and selectable six-digit code', async locale => {
    const input = { email: 'user@example.com', intent: 'login' as const, code: '012345', locale, expiresAt: new Date(Date.now() + 90_000) }
    await service().sendEmailCode(input)
    const email = sendMail.mock.calls[0][0]
    expect(email.html).toContain(`lang="${locale}"`)
    expect(email.html).toContain('https://api.a-reit.com/v1/media/email-v2/logo-lockup.png')
    expect(email.html).not.toContain('identity-envelope.jpg')
    expect(email.html).toContain('012345')
    expect(email.text).toContain('012345')
    expect(email.html).not.toMatch(/\{\{|localhost|PREVIEW_NOT_A_VALID_TOKEN|token=/)
    expect(email.text).toContain('1.5')
    expect(email.html).toContain(locale === 'ar' ? 'dir="rtl"' : 'dir="ltr"')
  })

  it.each(['RWA.LAT','rwa.lat'])('normalizes an old configured sender display name %s without changing the sender address',async name=>{
    await service(name).sendEmailCode({email:'user@example.com',intent:'login',code:'012345',locale:'en',expiresAt:new Date(Date.now()+60_000)})
    expect(sendMail.mock.calls[0][0].from).toEqual({name:'A-REIT',address:'no-reply@a-reit.com'})
  })

  it('distinguishes registration, reset, binding and email-change from login', async () => {
    const subjects = []
    for (const purpose of ['register', 'login', 'reset', 'email_bind', 'email_change'] as const) {
      const input = { email: 'user@example.com', intent: purpose === 'register' ? 'register' as const : 'login' as const,
        purpose, code: '012345', locale: 'zh-CN', expiresAt: new Date(Date.now() + 60_000) }
      await service().sendEmailCode(input)
      subjects.push(sendMail.mock.calls.at(-1)[0].subject)
    }
    expect(new Set(subjects).size).toBe(5)
  })

  it('preserves recovery link routing and translates its real remaining expiry', async () => {
    const input = { email: 'user@example.com', purpose: 'account_recovery' as const, token: 'token<&"', locale: 'fr',
      expiresAt: new Date(Date.now() + 120_000) }
    await service().sendOneTimeLink(input)
    const message = sendMail.mock.calls[0][0]
    expect(message.html).toContain('lang="fr"')
    expect(message.text).toContain('https://a-reit.com/recovery?token=token%3C%26%22')
    expect(message.text).toContain('2 min')
    expect(message.html).not.toMatch(/\{\{|PREVIEW_NOT_A_VALID_TOKEN/)
  })

  it('does not send an expired challenge', async () => {
    const input = { email: 'user@example.com', intent: 'login' as const, code: '012345', locale: 'en', expiresAt: new Date(Date.now() - 1) }
    await expect(service().sendEmailCode(input)).rejects.toMatchObject({ response: { code: 'AUTH_DELIVERY_FAILED' } })
    expect(sendMail).not.toHaveBeenCalled()
  })
})
