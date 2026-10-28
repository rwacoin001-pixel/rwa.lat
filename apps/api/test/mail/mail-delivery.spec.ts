import { ConfigService } from '@nestjs/config'
import { MailDeliveryWorker } from '../../src/mail/mail-delivery.worker'
import { EmailDeliveryClient } from '../../src/common/email-delivery.client'

jest.mock('../../src/common/email-delivery.client', () => ({ EmailDeliveryClient: jest.fn() }))
describe('support mail delivery worker', () => {
  const send = jest.fn()
  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined)
    ;(EmailDeliveryClient as jest.Mock).mockImplementation(() => ({ configured: true, send, close: jest.fn() }))
  })
  function fixture(sent = false, expired = false) {
    const query = jest.fn(async (sql: string) => sql.startsWith('SELECT') ? [{ sent_at: sent ? new Date() : null, from_address: 'A-REIT Support <support@a-reit.com>', to_addresses: ['a@example.com'], cc_addresses: [], subject: 'Re: Hello', text_body: 'answer', message_id: '<out@a-reit.com>', in_reply_to: '<in@example.com>', references_ids: ['<in@example.com>'] }] : [])
    const jobs = { claim: jest.fn().mockResolvedValue([{ id: 'job', createdAt: new Date(Date.now() - (expired ? 86400000 : 0)), payload: { messageId: 'out' } }]), ack: jest.fn(), nack: jest.fn().mockResolvedValue({ state: 'pending' }) }
    const worker = new MailDeliveryWorker({ query } as any, new ConfigService({ MAIL_DELIVERY_WORKER_ENABLED: 'true' }), jobs as any)
    return { query, jobs, worker }
  }
  it('sends threading headers and stable provider idempotency key, then acknowledges', async () => {
    const { worker, jobs, query } = fixture()
    expect(await worker.runDue()).toBe(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ messageId: '<out@a-reit.com>', inReplyTo: '<in@example.com>', references: ['<in@example.com>'], idempotencyKey: 'support-mail:out' }))
    expect(query.mock.calls.some(c => c[0].includes("delivery_state='sent'"))).toBe(true)
    expect(jobs.ack).toHaveBeenCalled()
  })
  it('does not resend after a successful send was persisted but the job ack failed', async () => {
    const { worker, jobs } = fixture(true)
    await worker.runDue()
    expect(send).not.toHaveBeenCalled()
    expect(jobs.ack).toHaveBeenCalled()
  })
  it('retries failures without recording provider errors or marking mail sent', async () => {
    send.mockRejectedValue(new Error('provider private error'))
    const { worker, jobs, query } = fixture()
    await worker.runDue()
    expect(jobs.ack).not.toHaveBeenCalled()
    expect(jobs.nack.mock.calls[0][1]).not.toContain('private')
    expect(query.mock.calls.some(c => c[0].includes("delivery_state='sent'"))).toBe(false)
  })
  it('refuses expired intents beyond the provider deduplication window', async () => {
    const { worker, jobs } = fixture(false, true)
    await worker.runDue()
    expect(send).not.toHaveBeenCalled()
    expect(jobs.nack).toHaveBeenCalled()
  })
})
