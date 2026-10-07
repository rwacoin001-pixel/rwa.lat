import { afterEach, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  bindingAfterSend, bindingAfterStart, bindingKey, classifyBindError, clearBinding, clearOtherBindings, completeEmailBind,
  isPlausibleEmail, loadBinding, resendEmailBindCode, resendWait, saveBinding, sendEmailBindCode, startEmailBind,
  type StoredBinding,
} from '../lib/api/email-binding'
import { homeEmailBindingCopy } from '../lib/home-email-binding-copy'

const USER = 'user-A'
const SESSION = JSON.stringify({ sessionToken: 'tok-A', sessionId: 's-1', userId: USER, loggedInAt: '2026-10-08T00:00:00.000Z' })
const originals = new Map(['window', 'location', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))

let local: Map<string, string>
let session: Map<string, string>
let localWrites: string[]
let events: string[]
let assigns: string[]
let requests: Array<{ path: string; method?: string; auth: string | null; body: unknown }>
let reply: (path: string) => { status: number; body: unknown }

function storage(map: Map<string, string>, writes?: string[]) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, String(value)); writes?.push(key) },
    removeItem: (key: string) => { map.delete(key); writes?.push(key) },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  }
}

beforeEach(() => {
  local = new Map([['rwa.session', SESSION], ['rwa-session-token', 'tok-A'], ['auth_token', 'tok-A']])
  session = new Map(); localWrites = []; events = []; assigns = []; requests = []
  reply = () => ({ status: 200, body: {} })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event: Event) => { events.push(event.type); return true }, location: { pathname: '/', search: '', assign: (url: string) => assigns.push(url) } } })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://rwa.lat' } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage(local, localWrites) })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage(session) })
  mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    const path = String(input)
    const headers = new Headers(init?.headers)
    requests.push({ path, method: init?.method, auth: headers.get('Authorization'), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const { status, body } = reply(path)
    return new Response(JSON.stringify(body), { status })
  })
})

afterEach(() => {
  mock.restoreAll()
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete (globalThis as Record<string, unknown>)[key]
  }
})

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const stored = (overrides: Partial<StoredBinding> = {}): StoredBinding => ({ continuationToken: 'ct-1', sent: true, emailMasked: 'sa***@example.com', expiresAt: Date.now() + 600_000, resendAt: Date.now() + 30_000, ...overrides })

test('stale account UI never starts binding for a different current session user', async () => {
  local.set('rwa.session', JSON.stringify({sessionToken:'tok-B', userId:'user-B'}))
  const result = await startEmailBind(USER)
  assert.equal(result.ok, false)
  assert.equal(requests.length, 0)
})

test('start/send/resend/complete call the real bind endpoints with the current session bearer', async () => {
  reply = path => path.endsWith('/start') ? { status: 200, body: { userId: USER, continuationToken: 'ct-1', step: 'email', expiresIn: 600, emailRequired: true } }
    : path.endsWith('/send') ? { status: 200, body: { continuationToken: 'ct-2', step: 'email', emailRequired: false, email: 'sa***@example.com', expiresIn: 600, retryAfter: 60 } }
      : path.endsWith('/resend') ? { status: 200, body: { retryAfter: 60 } }
        : { status: 200, body: { userId: USER, emailVerified: true } }

  const start = await startEmailBind(USER)
  assert.deepEqual(start, { ok: true, data: { verified: false, continuationToken: 'ct-1', expiresIn: 600 } })
  const send = await sendEmailBindCode('ct-1', '  sample@example.com ', USER)
  assert.deepEqual(send, { ok: true, data: { continuationToken: 'ct-2', emailMasked: 'sa***@example.com', expiresIn: 600, retryAfter: 60 } })
  assert.deepEqual(await resendEmailBindCode('ct-2', USER), { ok: true, data: { retryAfter: 60 } })
  assert.deepEqual(await completeEmailBind('ct-2', '１２３456', USER), { ok: true, data: { userId: USER } })

  assert.deepEqual(requests.map(r => [r.method, r.path, r.auth]), [
    ['POST', '/v1/auth/email/bind/start', 'Bearer tok-A'],
    ['POST', '/v1/auth/email/bind/send', 'Bearer tok-A'],
    ['POST', '/v1/auth/email/bind/resend', 'Bearer tok-A'],
    ['POST', '/v1/auth/email/bind/complete', 'Bearer tok-A'],
  ])
  assert.deepEqual(requests.map(r => r.body), [{userId:USER}, {userId:USER, continuationToken: 'ct-1', email: 'sample@example.com' }, {userId:USER, continuationToken: 'ct-2' }, {userId:USER, continuationToken: 'ct-2', code: '123456' }])
  assert.ok(requests.every(r => !r.path.includes('register')))
})

test('start on an already verified account reports verified only for the same user', async () => {
  reply = () => ({ status: 200, body: { userId: USER, emailVerified: true } })
  assert.deepEqual(await startEmailBind(USER), { ok: true, data: { verified: true } })
  reply = () => ({ status: 200, body: { userId: 'someone-else', emailVerified: true } })
  const other = await startEmailBind(USER)
  assert.equal(other.ok, false)
  if (!other.ok) assert.equal(classifyBindError(other.error), 'mismatch')
})

test('malformed bind responses are rejected as unavailable', async () => {
  reply = () => ({ status: 200, body: { step: 'email' } })
  for (const result of [await startEmailBind(USER), await sendEmailBindCode('ct', 'a@b.co', USER), await completeEmailBind('ct', '123456', USER)]) {
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(classifyBindError(result.error), 'unavailable')
  }
})

test('a successful bind never touches the canonical session or session events', async () => {
  const before = JSON.stringify([...local])
  reply = () => ({ status: 200, body: { userId: USER, emailVerified: true, sessionToken: 'tok-NEW' } })
  const result = await completeEmailBind('ct-1', '123456', USER)
  assert.equal(result.ok, true)
  assert.equal(JSON.stringify([...local]), before)
  assert.deepEqual(localWrites, [])
  assert.deepEqual(events, [])
})

test('a different or unverified result is a failure and is never saved as a session', async () => {
  const before = JSON.stringify([...local])
  for (const body of [{ userId: 'user-B', emailVerified: true, sessionToken: 'tok-B' }, { userId: USER, emailVerified: false }]) {
    reply = () => ({ status: 200, body })
    const result = await completeEmailBind('ct-1', '123456', USER)
    assert.equal(result.ok, false)
  }
  const mismatch = await (async () => { reply = () => ({ status: 200, body: { userId: 'user-B', emailVerified: true } }); return completeEmailBind('ct-1', '123456', USER) })()
  assert.equal(mismatch.ok === false && classifyBindError(mismatch.error), 'mismatch')
  assert.equal(JSON.stringify([...local]), before)
  assert.deepEqual(localWrites, [])
  assert.deepEqual(events, [])
})

test('an invalid code keeps the session: no logout, no redirect, no storage writes', async () => {
  const before = JSON.stringify([...local])
  reply = () => ({ status: 401, body: { error: { code: 'AUTH_CODE_INVALID', message: 'Invalid code' } } })
  const result = await completeEmailBind('ct-1', '654321', USER)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(classifyBindError(result.error), 'invalidCode')
  assert.equal(JSON.stringify([...local]), before)
  assert.deepEqual(localWrites, [])
  assert.deepEqual(events, [])
  assert.deepEqual(assigns, [])
})

test('a malformed code is rejected locally without any request', async () => {
  const result = await completeEmailBind('ct-1', '12', USER)
  assert.equal(result.ok, false)
  assert.equal(requests.length, 0)
})

test('error classification covers expired, rate-limit, taken, invalid email and unavailable', () => {
  assert.equal(classifyBindError({ status: 401, code: 'AUTH_CODE_INVALID' }), 'invalidCode')
  assert.equal(classifyBindError({ status: 401, code: 'AUTH_CODE_EXPIRED' }), 'expired')
  assert.equal(classifyBindError({ status: 410, code: 'HTTP_410' }), 'expired')
  assert.equal(classifyBindError({ status: 400, code: 'AUTH_CONTINUATION_INVALID' }), 'expired')
  assert.equal(classifyBindError({ status: 429, code: 'HTTP_429' }), 'rateLimited')
  assert.equal(classifyBindError({ status: 400, code: 'AUTH_EMAIL_RATE_LIMITED' }), 'rateLimited')
  assert.equal(classifyBindError({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' }), 'taken')
  assert.equal(classifyBindError({ status: 409, code: 'HTTP_409' }), 'taken')
  assert.equal(classifyBindError({ status: 400, code: 'INVALID_EMAIL' }), 'invalidEmail')
  assert.equal(classifyBindError({ status: 503, code: 'HTTP_503' }), 'unavailable')
  assert.equal(classifyBindError({ status: 0, code: 'NETWORK_ERROR' }), 'unavailable')
})

test('email validation mirrors the 254 character input cap', () => {
  assert.equal(isPlausibleEmail('sample@example.com'), true)
  assert.equal(isPlausibleEmail('sample@example'), false)
  assert.equal(isPlausibleEmail('sa mple@example.com'), false)
  assert.equal(isPlausibleEmail(`${'a'.repeat(250)}@example.com`), false)
})

test('flow persistence is per user and keeps only token, masked email and timers', () => {
  const polluted = { ...stored(), email: 'sample@example.com', code: '123456' } as StoredBinding
  saveBinding('user-A', polluted)
  const raw = session.get(bindingKey('user-A')) ?? ''
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['continuationToken', 'emailMasked', 'expiresAt', 'resendAt', 'sent'])
  assert.ok(!raw.includes('sample@example.com') && !raw.includes('123456'))
  assert.equal(loadBinding('user-A')?.continuationToken, 'ct-1')
  assert.equal(loadBinding('user-B'), null)
  assert.notEqual(bindingKey('user-A'), bindingKey('user-B'))
  assert.equal(local.get('rwa.session'), SESSION)
})

test('an expired or corrupted stored flow is cleared so the user returns to the input', () => {
  saveBinding('user-A', stored({ expiresAt: Date.now() - 1 }))
  assert.equal(loadBinding('user-A'), null)
  assert.equal(session.has(bindingKey('user-A')), false)
  session.set(bindingKey('user-A'), '{not json')
  assert.equal(loadBinding('user-A'), null)
  assert.equal(session.has(bindingKey('user-A')), false)
  session.set(bindingKey('user-A'), JSON.stringify({ continuationToken: 7, sent: 'yes' }))
  assert.equal(loadBinding('user-A'), null)
})

test('switching accounts clears other users flows without touching the new user or unrelated keys', () => {
  saveBinding('user-A', stored())
  saveBinding('user-B', stored({ continuationToken: 'ct-B' }))
  session.set('unrelated', 'keep')
  clearOtherBindings('user-B')
  assert.equal(loadBinding('user-A'), null)
  assert.equal(loadBinding('user-B')?.continuationToken, 'ct-B')
  assert.equal(session.get('unrelated'), 'keep')
  clearBinding('user-B')
  assert.equal(loadBinding('user-B'), null)
})

test('send and start results become resumable flows with throttle and expiry clocks', () => {
  const now = 1_000_000
  assert.deepEqual(bindingAfterStart({ continuationToken: 'ct-1', expiresIn: 600 }, now), { continuationToken: 'ct-1', sent: false, emailMasked: null, expiresAt: now + 600_000, resendAt: 0 })
  const sent = bindingAfterSend({ continuationToken: 'ct-2', emailMasked: 'sa***@example.com', expiresIn: 600, retryAfter: 60 }, now)
  assert.deepEqual(sent, { continuationToken: 'ct-2', sent: true, emailMasked: 'sa***@example.com', expiresAt: now + 600_000, resendAt: now + 60_000 })
  assert.equal(resendWait(sent, now), 60)
  assert.equal(resendWait(sent, now + 59_001), 1)
  assert.equal(resendWait(sent, now + 61_000), 0)
  assert.equal(resendWait(null, now), 0)
})

test('copy exists for all seven locales with identical keys and placeholders', () => {
  const locales = ['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'] as const
  const keys = (value: Record<string, unknown>): string[] => Object.entries(value).flatMap(([key, item]) => item && typeof item === 'object' ? keys(item as Record<string, unknown>).map(sub => `${key}.${sub}`) : [key])
  const expected = keys(homeEmailBindingCopy.en)
  for (const locale of locales) {
    const copy = homeEmailBindingCopy[locale]
    assert.deepEqual(keys(copy), expected, locale)
    assert.ok(JSON.stringify(copy).indexOf('""') === -1, `${locale} has an empty string`)
    assert.ok(copy.resendIn.includes('{s}'), locale)
    assert.ok(copy.sentTo.includes('{email}'), locale)
  }
  for (const kind of ['invalidCode', 'expired', 'rateLimited', 'taken', 'invalidEmail', 'mismatch', 'unavailable', 'codeFormat'] as const) assert.ok(homeEmailBindingCopy.en.errors[kind])
})

test('the binding code path never registers, logs in, or saves a session', () => {
  for (const file of ['lib/api/email-binding.ts', 'components/home/HomeEmailBinding.tsx', 'lib/home-email-binding-copy.ts']) {
    const text = source(file)
    assert.doesNotMatch(text, /registerEmail|saveSession|clearSession|handleSessionUnauthorized|\/register\/email|from '@\/lib\/api\/auth'|\/login/, file)
  }
  const api = source('lib/api/email-binding.ts')
  assert.match(api, /loading: 'silent'/)
  assert.match(api, /normalizeEmailCode/)
  const component = source('components/home/HomeEmailBinding.tsx')
  assert.match(component, /normalizeEmailCode/)
  assert.match(component, /maxLength=\{254\}/)
  assert.match(component, /maxLength=\{6\}/)
  assert.match(component, /userId/)
})

test('the slot css keeps 44px targets, 16px inputs, focus-visible and logical properties', () => {
  const css = source('components/home/home-email-binding.module.css')
  assert.match(css, /height: 44px/)
  assert.match(css, /font-size: 16px/)
  assert.match(css, /focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
  assert.doesNotMatch(css, /(?:margin|padding)-(?:left|right)|(?:^|[\s;{])(?:left|right):/m)
})

test('the card places the slot between holdings and cash actions and renders it only when provided', () => {
  const card = source('components/home/HomePortfolioCard.tsx')
  assert.match(card, /emailBinding\?: \{ userId: string; onVerified: \(\) => void \}/)
  const foot = card.indexOf('styles.cardFoot')
  const slot = card.indexOf('<HomeEmailBinding')
  const actions = card.indexOf('styles.cardActions')
  assert.ok(foot > 0 && slot > foot && actions > slot)
  assert.match(card, /emailBinding && <HomeEmailBinding/)
  assert.match(card, /key=\{emailBinding\.userId\}/)
})

test('Home focuses the in-place slot instead of navigating, and only refreshes the session view', () => {
  const home = source('components/screens/P04-HomeMaison.tsx')
  assert.doesNotMatch(home, /go\(['"]verifyEmail['"]\)/)
  assert.doesNotMatch(home, /saveSession|clearSession/)
  assert.match(home, /focusHomeEmailBinding\(\)/)
  assert.match(home, /emailBinding=\{/)
  assert.match(home, /const sessionUserId = sessionProbe\.status === 'ok'/)
  assert.match(home, /const portfolioAccount = .*\|\| sessionUserId \? account : null/)
  const cta = home.slice(home.indexOf('const openMainCta'), home.indexOf('const overviewData'))
  assert.match(cta, /verifyEmail/)
  assert.match(cta, /focusHomeEmailBinding/)
})
