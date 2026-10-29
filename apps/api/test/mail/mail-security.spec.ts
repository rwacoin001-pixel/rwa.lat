import { createHmac, randomBytes } from 'node:crypto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ConfigService } from '@nestjs/config'
import { InboundEmailGuard, verifyInboundSignature } from '../../src/mail/inbound-email.guard'
import { InboundMailDto, MailReplyDto, MailStateDto } from '../../src/mail/mail.dto'
import { sanitizeMailHtml, normalizedSubject } from '../../src/mail/mail-html'
import { MailController } from '../../src/mail/mail.controller'

describe('support mail security', () => {
  const secret = randomBytes(32).toString('hex')
  const now = 1793232000000
  const body = Buffer.from('{"subject":"客服"}')
  const signed = (t = now / 1000, value = body) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.`).update(value).digest('hex')}`
  it('verifies exact raw bytes, both timestamp boundaries and rejects malformed or stale signatures', () => {
    expect(verifyInboundSignature(signed(), body, secret, now)).toBe(true)
    for (const delta of [-300, 300]) expect(verifyInboundSignature(signed(now / 1000 + delta), body, secret, now)).toBe(true)
    for (const delta of [-301, 301]) expect(verifyInboundSignature(signed(now / 1000 + delta), body, secret, now)).toBe(false)
    for (const header of [undefined, '', signed() + ',v1=extra', 't=0,v1=ff']) expect(verifyInboundSignature(header, body, secret, now)).toBe(false)
    expect(verifyInboundSignature(signed(), Buffer.concat([body, Buffer.from(' ')]), secret, now)).toBe(false)
    expect(verifyInboundSignature(signed(), body, undefined, now)).toBe(false)
  })
  it('fails closed before calling the inbound service', () => {
    const guard = new InboundEmailGuard(new ConfigService())
    expect(() => guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ get: () => undefined }) }) } as any)).toThrow('Invalid inbound email signature')
  })
  it('reconstructs safe HTML without active content, attributes or non-HTTPS images', () => {
    const html = sanitizeMailHtml('<p onclick="evil()">A &amp; B</p><script>alert(1)</script><svg onload="evil()"><a href="javascript:evil()">link</a></svg><img src="https://example.com/pixel" onerror="evil()"><img src="data:image/svg+xml,evil"><iframe src="https://example.com"></iframe>')
    expect(html).toContain('<p>A &amp; B</p>')
    expect(html).not.toMatch(/<(script|iframe|svg|a)\b|<[^>]+\bon\w+=|<img[^>]+data:/i)
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(sanitizeMailHtml('<<script>alert(1)</script>')).not.toContain('<script>')
    expect(sanitizeMailHtml('<img src="https://user:pass@example.com">')).toBe('')
    expect(normalizedSubject('Re: 回复： Fwd: Hello ')).toBe('hello')
  })
  it('rejects injected actor IDs, header injection and invalid assignment/reply inputs', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true }
    expect(await validate(plainToInstance(MailStateDto, { assign: 'me', actorId: 'attacker' }), options)).not.toHaveLength(0)
    expect(await validate(plainToInstance(MailReplyDto, { text: ' ', replyAll: true, requestKey: 'bad' }), options)).not.toHaveLength(0)
    expect(await validate(plainToInstance(InboundMailDto, { messageId: '<ok@example.com>', from: 'a@example.com', to: [], cc: [], subject: 'x\r\nBcc: a@example.com', text: '', html: '', references: [], attachments: [] }), options)).not.toHaveLength(0)
  })
  it('checks permissions before every core admin action and attributes changes to the session', async () => {
    const mail = { list: jest.fn(), unreadCount: jest.fn(), thread: jest.fn(), attachment: jest.fn(), state: jest.fn(), reply: jest.fn() }
    const rbac = { assertPermission: jest.fn().mockRejectedValue(new Error('denied')) }
    const controller = new MailController(mail as any, rbac as any)
    const admin = { id: 'session-admin' } as any
    for (const action of [() => controller.list(admin, {}), () => controller.count(admin), () => controller.thread(admin, 'id', {}), () => controller.attachment(admin, 'id'), () => controller.state(admin, 'id', {}), () => controller.reply(admin, 'id', {} as any)]) await expect(action()).rejects.toThrow('denied')
    Object.values(mail).forEach(fn => expect(fn).not.toHaveBeenCalled())
    rbac.assertPermission.mockResolvedValue(undefined)
    await controller.state(admin, 'id', { assign: 'me' })
    expect(mail.state).toHaveBeenCalledWith('id', { assign: 'me' }, 'session-admin')
    await controller.reply(admin, 'id', { text: 'ok', replyAll: false, requestKey: 'key' })
    expect(rbac.assertPermission).toHaveBeenLastCalledWith('session-admin', 'mail.reply')
  })
})
