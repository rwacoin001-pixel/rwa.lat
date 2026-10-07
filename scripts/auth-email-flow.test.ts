import { afterEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmailCode, usesMobileEmailCode } from '../lib/auth-email-copy'
import { confirmEmailCode, loginEmail, requestEmailCode } from '../lib/api/auth'

afterEach(() => mock.restoreAll())
test('phones and iPadOS use codes while desktop browsers keep links', () => {
  assert.equal(usesMobileEmailCode('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile', 5), true)
  assert.equal(usesMobileEmailCode('Mozilla/5.0 (Linux; Android 15)', 5), true)
  assert.equal(usesMobileEmailCode('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5), true)
  assert.equal(usesMobileEmailCode('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0), false)
  assert.equal(usesMobileEmailCode('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 10), false)
})
test('code entry accepts pasted and full-width digits without changing leading zeros', () => {
  assert.equal(normalizeEmailCode('０１２ ３４５'), '012345')
  assert.equal(normalizeEmailCode('01 23-45'), '012345')
  assert.equal(normalizeEmailCode('abc1234567'), '123456')
})
test('mobile challenges carry form intent; failed code confirmations never save a session', async () => {
  const calls: Array<{ path: string; body: unknown }> = []
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) })
    const confirmation = String(input).endsWith('/confirm')
    return new Response(JSON.stringify(confirmation ? { error: { code: 'AUTH_EMAIL_CODE_INVALID', message: 'Invalid' } }
      : { accepted: true, challengeId: 'challenge', retryAfter: 60, expiresIn: 600 }), { status: confirmation ? 401 : 201 })
  })
  const consents = [{ documentType: 'terms' as const, version: 'v1', accepted: true as const }]
  await requestEmailCode('user@example.com', 'register', 'zh-CN', consents)
  assert.deepEqual(calls[0].body, { email: 'user@example.com', intent: 'register', locale: 'zh-CN', consents })
  const result = await confirmEmailCode('user@example.com', 'register', 'challenge', '012345')
  assert.equal(result.ok, false)
  const confirmation = calls[1].body as { device: { name: string; fingerprint: string } }
  assert.match(confirmation.device.fingerprint, /^[a-f0-9-]{36}$/)
  assert.equal(confirmation.device.name, 'Web browser')
  assert.deepEqual(calls[1].body, { email: 'user@example.com', intent: 'register', challengeId: 'challenge', code: '012345', device: confirmation.device })
  await loginEmail('user@example.com')
  assert.equal(calls[2].path, '/v1/auth/login/email')
})
