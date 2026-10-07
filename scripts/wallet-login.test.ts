import { afterEach, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { beginWalletLogin, completeWalletLogin } from '../lib/api/auth'
import * as http from '../lib/api/_http'

// A mobile provider returned by the connector, without any browser extension.
const address = '0x2222222222222222222222222222222222222222'
const originalGlobals = new Map(['window', 'location', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let writes: Map<string, string>
let calls: Array<{ method: string; params?: unknown[] }>
let requests: Array<{ path: string; body: Record<string, unknown> }>
let activeAddress: string
let chain: unknown
let accountError: unknown
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
  if (args.method === 'eth_requestAccounts' || args.method === 'eth_accounts') {
    if (accountError) throw accountError
    return [activeAddress]
  }
  if (args.method === 'eth_chainId') return chain
  if (args.method === 'personal_sign') {
    if (signatureError) throw signatureError
    return '0x' + 'a'.repeat(130)
  }
  throw new Error(`Unexpected wallet method: ${args.method}`)
} }

beforeEach(() => {
  writes = new Map(); calls = []; requests = []
  activeAddress = address; chain = '0x1'; signatureError = null; accountError = null
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

test('wallet login reports checking, signing and server verification in order', async () => {
  const started = await beginWalletLogin(provider)
  if (!started.ok) throw Error('challenge missing')
  const stages: string[] = []
  await (completeWalletLogin as Function)(started.data, [], (stage: string) => stages.push(stage))
  assert.deepEqual(stages, ['checking', 'signing', 'verifying'])
})

test('existing wallet login does not wait for an in-flight referral attribution fetch', async () => {
  let release: (response: Response) => void = () => {}
  const oldFetch = globalThis.fetch
  mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => String(input) === '/api/referral/attribution'
    ? new Promise<Response>(resolve => { release = resolve }) : oldFetch(input as Request, init))
  const preload = (http as unknown as { prefetchAuthAttribution: () => Promise<string | null> }).prefetchAuthAttribution()
  const started = await beginWalletLogin(provider)
  if (!started.ok) throw Error('challenge missing')
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([completeWalletLogin(started.data), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('wallet waited for referral')), 500) })])
  clearTimeout(timer); release(new Response(JSON.stringify({ token: 'signed-attribution' }))); await preload
  assert.equal(result.ok, true)
})

test('new wallet registration retains server-signed referral attribution', async () => {
  registrationRequired = true
  let header: string | null = null
  const oldFetch = globalThis.fetch
  mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    if (String(input) === '/api/referral/attribution') return new Response(JSON.stringify({ token: 'signed-attribution' }))
    if (String(input).endsWith('/wallet/verify')) header = new Headers(init?.headers).get('x-referral-attribution')
    return oldFetch(input as Request, init)
  })
  const started = await beginWalletLogin(provider)
  if (!started.ok) throw Error('challenge missing')
  assert.equal((await completeWalletLogin(started.data)).ok, true)
  assert.equal(header, 'signed-attribution')
})

test('WalletConnect numeric chain IDs sign in instead of immediately reporting cancellation', async () => {
  // UniversalProvider 2.23.7 returns the chain as a number, unlike injected EIP-1193 providers.
  chain = 1
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  assert.equal(requests[0].body.chainId, 1)
  assert.equal((await completeWalletLogin(started.data)).ok, true)
  assert.equal(writes.get('rwa-session-token'), 'test-session')
})

test('numeric chain IDs remain valid when rechecking an existing login challenge', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  chain = 1
  assert.equal((await completeWalletLogin(started.data)).ok, true)
  assert.equal(writes.get('rwa-session-token'), 'test-session')
})

test('invalid chain IDs never request a challenge or sign a message', async () => {
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '0x20000000000000', '', null]) {
    chain = invalid
    const started = await beginWalletLogin(provider)
    assert.equal(started.ok, false)
    if (!started.ok) assert.equal(started.error.code, 'WALLET_CHAIN_INVALID')
  }
  assert.equal(requests.length, 0)
  assert.equal(calls.some(call => call.method === 'personal_sign'), false)
})

test('account RPC failures are distinguished from explicit user rejection', async () => {
  accountError = { code: -32603, message: 'Internal error' }
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, false)
  if (!started.ok) {
    assert.equal(started.error.code, 'WALLET_CONNECTION_FAILED')
    assert.equal(started.error.details?.providerCode, -32603)
  }
  assert.equal(requests.length, 0)
})

test('explicit account permission rejection remains cancellation', async () => {
  for (const code of [4001, 5000]) {
    accountError = { code }
    const started = await beginWalletLogin(provider)
    assert.equal(started.ok, false)
    if (!started.ok) assert.equal(started.error.code, 'WALLET_CANCELLED')
  }
  assert.equal(requests.length, 0)
})

test('signature transport failures do not claim that the user cancelled', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  signatureError = { code: -32000, message: 'Transport failed' }
  const result = await completeWalletLogin(started.data)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'WALLET_SIGNATURE_FAILED')
  assert.equal(requests.length, 1)
  assert.equal(writes.has('rwa.session'), false)
})

test('a disconnected provider while rechecking accounts is a connection failure', async () => {
  const started = await beginWalletLogin(provider)
  assert.equal(started.ok, true)
  if (!started.ok) return
  accountError = { code: 4900 }
  const result = await completeWalletLogin(started.data)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'WALLET_CONNECTION_FAILED')
  assert.equal(requests.length, 1)
  assert.equal(calls.some(call => call.method === 'personal_sign'), false)
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
