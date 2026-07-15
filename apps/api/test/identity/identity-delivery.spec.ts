import { ConfigService } from '@nestjs/config'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'

const mockSendMail = jest.fn()

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}))

describe('IdentityDeliveryService', () => {
  beforeEach(() => mockSendMail.mockReset())

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
})
