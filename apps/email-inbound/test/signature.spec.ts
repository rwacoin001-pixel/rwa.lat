import { createHmac, randomBytes, webcrypto } from 'node:crypto'
import { signInbound } from '../src/signature'
const { describe, it, expect } = require('@jest/globals')

Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
describe('inbound signer', () => {
  it('signs the exact UTF-8 body and timestamp with HMAC-SHA256', async () => {
    const secret = randomBytes(32).toString('hex')
    const body = JSON.stringify({ subject: '客服邮件', text: 'a\nb' })
    const t = 1793232000
    expect(await signInbound(body, secret, t)).toBe(`t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`)
    expect(await signInbound(body + ' ', secret, t)).not.toBe(await signInbound(body, secret, t))
  })
})
