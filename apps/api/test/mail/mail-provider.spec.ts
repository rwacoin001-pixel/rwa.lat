import { randomBytes } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { EmailDeliveryClient } from '../../src/common/email-delivery.client'

const sendMail = jest.fn().mockResolvedValue(undefined)
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail, close: jest.fn() })) }))
describe('support mail provider headers', () => {
  const original = global.fetch
  afterEach(() => { global.fetch = original; jest.clearAllMocks() })
  const message = { from: 'A-REIT Support <support@a-reit.com>', to: ['a@example.com'], cc: ['b@example.com'], messageId: '<out@a-reit.com>', inReplyTo: '<in@example.com>', references: ['<older@example.com>', '<in@example.com>'], subject: 'Re: Help', text: 'Answer', idempotencyKey: 'mail-intent' }
  it('sends support From, recipient arrays, conversation headers and provider idempotency', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    const client = new EmailDeliveryClient(new ConfigService({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'no-reply@a-reit.com', RESEND_API_KEY: randomBytes(32).toString('hex') }))
    await client.send(message)
    const init = (global.fetch as jest.Mock).mock.calls[0][1]
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ from: message.from, to: message.to, cc: message.cc, headers: { 'Message-ID': message.messageId, 'In-Reply-To': message.inReplyTo, References: message.references.join(' ') } })
    expect(init.headers['idempotency-key']).toBe('mail-intent')
  })
  it('passes the same conversation headers through SMTP and retains existing default From', async () => {
    const client = new EmailDeliveryClient(new ConfigService({ EMAIL_PROVIDER: 'smtp', EMAIL_FROM: 'no-reply@a-reit.com', SMTP_HOST: 'smtp.example.com', SMTP_AUTH_MODE: 'none' }))
    await client.send(message)
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining(message))
    await client.send({ to: 'a@example.com', subject: 'login', text: 'body' })
    expect(sendMail.mock.calls.at(-1)![0].from).toEqual({ name: 'A-REIT', address: 'no-reply@a-reit.com' })
    client.close()
  })
})
