import { ConfigService } from '@nestjs/config'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'

const mockSendMail = jest.fn()
const mockFetch = jest.spyOn(globalThis, 'fetch')

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}))

describe('IdentityDeliveryService', () => {
  beforeEach(() => {
    mockSendMail.mockReset()
    mockFetch.mockReset()
  })

  afterAll(() => mockFetch.mockRestore())

  it('keeps plaintext one-time tokens only in the explicitly enabled Demo outbox', async () => {
    const delivery = new IdentityDeliveryService(new ConfigService({ AUTH_ADAPTER: 'demo' }))

    await delivery.sendOneTimeLink({
      email: 'User@Example.com', purpose: 'email_verification', token: 'demo-token',
    })

    expect(delivery.lastDemoToken('user@example.com', 'email_verification')).toBe('demo-token')
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('sends a production one-time URL through the configured TLS SMTP transport', async () => {
    const delivery = new IdentityDeliveryService(new ConfigService({
      AUTH_ADAPTER: 'production',
      PUBLIC_APP_URL: 'https://app.rwa.lat',
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@rwa.lat',
      EMAIL_FROM_NAME: 'RWA.LAT',
      SMTP_HOST: 'smtp.rwa.lat',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_AUTH_MODE: 'plain',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'secret',
    }))

    await delivery.sendOneTimeLink({
      email: 'user@example.com', purpose: 'account_recovery', token: 'one-time-token',
    })

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      subject: expect.stringContaining('Recover'),
      text: expect.stringContaining('https://app.rwa.lat/recover?token=one-time-token'),
    }))
    expect(delivery.lastDemoToken('user@example.com', 'account_recovery')).toBeUndefined()
  })

  it('fails closed without exposing provider details when SMTP delivery fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP authentication failed with secret detail'))
    const delivery = new IdentityDeliveryService(new ConfigService({
      AUTH_ADAPTER: 'production', PUBLIC_APP_URL: 'https://app.rwa.lat',
      EMAIL_PROVIDER: 'smtp', EMAIL_FROM: 'no-reply@rwa.lat',
      SMTP_HOST: 'smtp.rwa.lat', SMTP_PORT: '465', SMTP_SECURE: 'true',
      SMTP_AUTH_MODE: 'none',
    }))

    await expect(delivery.sendOneTimeLink({
      email: 'user@example.com', purpose: 'email_verification', token: 'token',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AUTH_DELIVERY_FAILED' }) })
  })

  it('sends production links through the reviewed Resend HTTPS adapter', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response)
    const delivery = new IdentityDeliveryService(new ConfigService({
      AUTH_ADAPTER: 'production',
      PUBLIC_APP_URL: 'https://rwa.lat',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'no-reply@rwa.lat',
      EMAIL_FROM_NAME: 'RWA.LAT',
      RESEND_API_KEY: `re_${'a'.repeat(32)}`,
      RESEND_HTTP_TIMEOUT_MS: '5000',
    }))

    await delivery.sendOneTimeLink({
      email: 'user@example.com', purpose: 'email_verification', token: 'verify-token',
    })

    expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: expect.stringMatching(/^Bearer re_/) }),
    }))
    const request = mockFetch.mock.calls[0][1] as RequestInit
    expect(JSON.parse(request.body as string)).toEqual(expect.objectContaining({
      from: 'RWA.LAT <no-reply@rwa.lat>',
      to: ['user@example.com'],
      text: expect.stringContaining('https://rwa.lat/verify-email?token=verify-token'),
    }))
  })
})
