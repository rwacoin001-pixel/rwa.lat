import { ConfigService } from '@nestjs/config'
import { MailService, replyRecipients } from '../../src/mail/mail.service'
import type { InboundMailDto } from '../../src/mail/mail.dto'

const input: InboundMailDto = { messageId: '<hello@example.com>', from: 'Person@example.com', to: ['support@a-reit.com'], cc: [], subject: 'Re: Hello', text: 'hello', html: '<p onclick="bad()">hello</p>', references: [], attachments: [] }
function fixture(answer: (sql: string, args: any[]) => any = () => []) {
  const query = jest.fn(async (sql: string, args: any[] = []) => answer(sql, args))
  const ds = { query, transaction: (work: any) => work({ query }) }
  const service = new MailService(ds as any, new ConfigService({ MAIL_DELIVERY_WORKER_ENABLED: 'true' }))
  return { query, service }
}
describe('mail storage and replies', () => {
  it('deduplicates Message-ID under a transaction lock without inserting or resetting unread', async () => {
    const { service, query } = fixture(sql => sql.includes('WHERE message_id=$1') ? [{ id: 'm', thread_id: 't' }] : [])
    await expect(service.receive(input)).resolves.toEqual({ id: 'm', threadId: 't', replay: true })
    expect(query.mock.calls.map(c => c[0]).join()).not.toMatch(/INSERT|UPDATE/)
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
  })
  it('threads by references first and stores sanitized body and hashed attachment atomically', async () => {
    const { service, query } = fixture(sql => sql.includes('JOIN app.mail_messages') ? [{ id: 'thread' }] : sql.includes('INSERT INTO app.mail_messages') ? [{ id: 'message' }] : [])
    await service.receive({ ...input, references: ['<prior@example.com>'], attachments: [{ filename: 'a.txt', contentType: 'text/plain', size: 3, content: Buffer.from('abc').toString('base64'), dropped: false }] })
    expect(query.mock.calls.find(c => c[0].includes('JOIN app.mail_messages'))?.[1]).toEqual([['<prior@example.com>'], 'person@example.com'])
    expect(query.mock.calls.find(c => c[0].includes('INSERT INTO app.mail_messages'))?.[1]?.[6]).toBe('<p>hello</p>')
    const attachment = query.mock.calls.find(c => c[0].includes('INSERT INTO app.mail_attachments'))![1]!
    expect(attachment[4]).toEqual(Buffer.from('abc'))
    expect(attachment[5]).toMatch(/^[0-9a-f]{64}$/)
    expect(query.mock.calls.at(-1)![0]).toContain('unread=true,archived=false')
  })
  it('uses a 30-day normalized-subject fallback and creates a new thread only when needed', async () => {
    const { service, query } = fixture(sql => sql.includes('INSERT INTO app.mail_threads') ? [{ id: 'new' }] : sql.includes('INSERT INTO app.mail_messages') ? [{ id: 'm' }] : [])
    await service.receive(input)
    expect(query.mock.calls.find(c => c[0].includes("interval '30 days'"))?.[1]).toEqual(['hello', 'person@example.com'])
    expect(query.mock.calls.filter(c => c[0].includes('INSERT INTO app.mail_threads'))).toHaveLength(1)
  })
  it('rejects inconsistent attachment content and accepts metadata for dropped files', async () => {
    const { service, query } = fixture(sql => sql.includes('WHERE message_id=$1') ? [{ id: 'm', thread_id: 't' }] : [])
    await expect(service.receive({ ...input, attachments: [{ filename: 'a', contentType: 'text/plain', size: 2, content: 'YWJj', dropped: false }] })).rejects.toThrow('Invalid attachment')
    expect(query).not.toHaveBeenCalled()
    await expect(service.receive({ ...input, attachments: [{ filename: 'a', contentType: 'text/plain', size: 5242881, dropped: true }] })).resolves.toMatchObject({ replay: true })
  })
  it('deduplicates reply-all recipients and excludes routed internal addresses', () => {
    const parent = { from_address: 'A@example.com', to_addresses: ['support@a-reit.com', 'b@example.com'], cc_addresses: ['B@example.com', 'a@example.com', 'alias@a-reit.com'] }
    expect(replyRecipients(parent, true)).toEqual({ to: ['a@example.com'], cc: ['b@example.com'] })
    expect(replyRecipients(parent, false)).toEqual({ to: ['a@example.com'], cc: [] })
  })
  it('queues a reply with thread headers, session attribution and an audit record', async () => {
    const { service, query } = fixture(sql => sql.includes("direction='in'") ? [{ from_address: 'a@example.com', to_addresses: ['support@a-reit.com'], cc_addresses: [], subject: 'Hello', references_ids: ['<older@example.com>'], message_id: '<parent@example.com>' }] : sql.includes('INSERT INTO app.mail_messages') ? [{ id: 'out' }] : [])
    await expect(service.reply('thread', { text: 'Answer', replyAll: true, requestKey: 'key' }, 'session')).resolves.toEqual({ id: 'out', deliveryState: 'queued' })
    const args = query.mock.calls.find(c => c[0].includes('INSERT INTO app.mail_messages'))![1]!
    expect(args[1]).toBe('A-REIT Support <support@a-reit.com>')
    expect(args[7]).toBe('<parent@example.com>')
    expect(JSON.parse(args[8])).toEqual(['<older@example.com>', '<parent@example.com>'])
    expect(args[10]).toBe('session')
    expect(query.mock.calls.some(c => c[0].includes('INSERT INTO app.job_queue'))).toBe(true)
    expect(query.mock.calls.at(-1)![1]).toEqual(['session', 'admin.mail.reply_queued', 'thread', JSON.stringify({ messageId: 'out', replyAll: true })])
  })
  it('replays a matching reply intent and rejects reusing it for another actor or body', async () => {
    const { service, query } = fixture(sql => sql.includes('WHERE request_key') ? [{ id: 'out', thread_id: 'thread', actor_id: 'session', text_body: 'Answer', spam_verdict: 'reply', delivery_state: 'sent' }] : [])
    const reply = { text: 'Answer', replyAll: false, requestKey: 'key' }
    await expect(service.reply('thread', reply, 'session')).resolves.toMatchObject({ deliveryState: 'sent' })
    await expect(service.reply('thread', reply, 'someone-else')).rejects.toThrow()
    await expect(service.reply('thread', { ...reply, text: 'changed' }, 'session')).rejects.toThrow()
    expect(query.mock.calls.map(c => c[0]).join()).not.toContain('INSERT')
  })
  it('assigns only the authenticated actor and audits attachment downloads', async () => {
    const { service, query } = fixture(sql => sql.startsWith('UPDATE') ? [{ id: 'thread' }] : sql.includes('SELECT filename') ? [{ filename: 'a.bin', content_type: 'application/octet-stream', content: Buffer.from([0,255]) }] : [])
    await service.state('thread', { assign: 'me', unread: false, archived: true }, 'session')
    expect(query.mock.calls[0][1]).toEqual(['thread', false, true, 'me', 'session'])
    await expect(service.attachment('attachment', 'session')).resolves.toMatchObject({ content: 'AP8=' })
    expect(query.mock.calls.at(-1)![1]![1]).toBe('admin.mail.attachment_downloaded')
  })
  it('returns chronological bounded message pages with an explicit continuation offset', async () => {
    const { service, query } = fixture(sql => sql.includes('FROM app.mail_threads WHERE id') ? [{ id: 'thread' }]
      : sql.includes('SELECT EXISTS') ? [{ more: true }]
      : sql.includes('SELECT m.id') ? [{ id: 'newer' }, { id: 'older' }] : [])
    await expect(service.thread('thread', 10)).resolves.toEqual({ thread: { id: 'thread' }, messages: [{ id: 'older' }, { id: 'newer' }], offset: 10, nextOffset: 12 })
    expect(query.mock.calls.find(c => c[0].includes('SELECT m.id'))?.[1]).toEqual(['thread', 10])
    expect(query.mock.calls.find(c => c[0].includes('SELECT m.id'))?.[0]).toContain('LIMIT 10 OFFSET $2')
  })
})
