import { afterEach, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { beginWalletLogin, completeWalletLogin } from '../lib/api/auth'

// A mobile provider returned by the connector, without any browser extension.
const address = '0x2222222222222222222222222222222222222222'
const originalGlobals = new Map(['window', 'location', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let writes: Map<string, string>
let calls: Array<{ method: string; params?: unknown[] }>
let requests: Array<{ path: string; body: Record<string, unknown> }>
let activeAddress: string
let chain: string
let signatureError: unknown
let responseOrigin: string
let responseExpiry: number
let verificationStatus: number
let registrationRequired: boolean

function message() {
  const now = Date.now()
  return `${responseOrigin} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to RWA.LAT. This does not authorize a transaction.\n\nURI: ${responseOrigin}/login\nVersion: 1\nChain ID: 1\nNonce: abcdef12345678\nIssued At: ${new Date(now - 1000).toISOString()}\nExpiration Time: ${new Date(now + responseExpiry).toISOString()}`
}
const provider = { async request(args: { method: string; params?: unknown[] }) {
  calls.push(args)
  if (args.method === 'eth_requestAccounts' || args.method === 'eth_accounts') return [activeAddress]
  if (args.method === 'eth_chainId') return chain
  if (args.method === 'personal_sign') {
    if (signatureError) throw signatureError
    return '0x' + 'a'.repeat(130)
  }
  throw new Error(`Unexpected wallet method: ${args.method}`)
} }

beforeEach(() => {
  writes = new Map(); calls = []; requests = []
  activeAddress = address; chain = '0x1'; signatureError = null
  responseOrigin = 'https://rwa.lat'; responseExpiry = 240000
  verificationStatus = 200; registrationRequired = false
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent() {} } })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://rwa.lat' } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => writes.get(key) ?? null,
    setItem: (key: string, value: string) => writes.set(key, value),
    removeItem: (key: string) => writes.delete(key),
  } })
  mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    const path = String(input)
    requests.push({ path, body: JSON.parse(String(init?.body)) })
    const challenge = path.endsWith('/challenge')
    return new Response(JSON.stringify(challenge ? { address, nonce: message(), registrationRequired }
      : verificationStatus === 200 ? { sessionToken: 'test-session', userId: 'test-user' }
        : { code: 'INVALID_WALLET_SIGNATURE', message: 'Rejected' }), { status: challenge ? 201 : verificationStatus })
  })
})
afterEach(() => {
  mock.restoreAll()
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test('a mobile connector provider signs in without window.ethereum', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  const result = await completeWalletLogin(started.data)
  assert.equal(result.ok, true)
  assert.equal(writes.get('rwa-session-token'), 'test-session')
  assert.deepEqual(calls.map(call => call.method), ['eth_requestAccounts', 'eth_chainId', 'eth_chainId', 'eth_accounts', 'personal_sign'])
  assert.equal(requests[0].body.chainId, 1)
  assert.equal(requests[1].body.nonce, started.data.nonce)
  assert.equal(Buffer.from(String(calls.at(-1)?.params?.[0]).slice(2), 'hex').toString(), started.data.nonce)
})
test('registration waits for consent and signs with the same selected provider', async () => {
  registrationRequired = true
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  assert.equal(started.data.registrationRequired, true)
  assert.equal(requests.length, 1)
  ;(window as Window & { ethereum?: unknown }).ethereum = { request() { throw Error('Wrong wallet') } }
  const consents = [{ documentType: 'terms' as const, version: 'v1', accepted: true as const }]
  assert.equal((await completeWalletLogin(started.data, consents)).ok, true)
  assert.deepEqual(requests[1].body.consents, consents)
})
test('an account switch never signs or submits the original account challenge', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  activeAddress = '0x3333333333333333333333333333333333333333'
  const result = await completeWalletLogin(started.data)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'WALLET_NONCE_MISMATCH')
  assert.equal(calls.some(call => call.method === 'personal_sign'), false)
  assert.equal(requests.length, 1)
})
test('a network switch never signs the original challenge', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  chain = '0x89'
  assert.equal((await completeWalletLogin(started.data)).ok, false)
  assert.equal(requests.length, 1)
  assert.equal(calls.some(call => call.method === 'personal_sign'), false)
})
test('wrong origins and expired challenges cannot reach a signature prompt', async () => {
  for (const [origin, expiry] of [['https://other.example', 240000], ['https://rwa.lat', -1000]] as const) {
    responseOrigin = origin; responseExpiry = expiry
    assert.equal((await beginWalletLogin(provider)).ok, false)
  }
  assert.equal(calls.some(call => call.method === 'personal_sign'), false)
})
test('rejected signatures do not submit verification or save a session', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  signatureError = { code: 4001 }
  const result = await completeWalletLogin(started.data)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'WALLET_CANCELLED')
  assert.equal(requests.length, 1)
  assert.equal(writes.has('rwa.session'), false)
})
test('server rejection never creates a client login session', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  verificationStatus = 401
  assert.equal((await completeWalletLogin(started.data)).ok, false)
  assert.equal(writes.has('rwa.session'), false)
})
