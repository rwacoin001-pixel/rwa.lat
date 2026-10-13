import type { ConfigService } from '@nestjs/config'
import { TronClientService, TronRateLimitedError } from '../../src/wallet/manual/tron-client.service'
import { generateTronKeypair } from '../../src/wallet/manual/tron-address.util'

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService
}

type Call = { url: string; headers: Record<string, string> }
const BLOCK = { block_header: { raw_data: { number: 123 } } }

function mockFetch(responder: (url: string) => { status: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = []
  const spy = jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
    const reply = responder(url)
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status, headers: reply.headers })
  })
  return { calls, spy }
}

afterEach(() => jest.restoreAllMocks())

const fast = { TRON_NODE_MIN_INTERVAL_MS: '0', TRON_INDEX_MIN_INTERVAL_MS: '0' }

describe('TronClientService provider routing', () => {
  it('sends full-node calls to TRON_NODE_URL and indexed /v1 queries to TRON_INDEX_URL', async () => {
    const { calls } = mockFetch((url) => ({ status: 200, body: url.includes('/v1/') ? { data: [] } : BLOCK }))
    const client = new TronClientService(config({
      ...fast,
      TRON_NODE_URL: 'https://go.getblock.io/secret-token/',
      TRON_INDEX_URL: 'https://api.trongrid.io',
    }))
    await client.getNowBlockNumber()
    await client.listIncomingTransfers('TXYZ', { minTimestampMs: 0 })
    expect(calls[0].url).toBe('https://go.getblock.io/secret-token/wallet/getnowblock')
    expect(calls[1].url.startsWith('https://api.trongrid.io/v1/accounts/TXYZ/transactions/trc20?')).toBe(true)
  })

  it('falls back to TRON_API_BASE_URL for both providers', async () => {
    const { calls } = mockFetch((url) => ({ status: 200, body: url.includes('/v1/') ? { data: [] } : BLOCK }))
    const client = new TronClientService(config({ ...fast, TRON_API_BASE_URL: 'https://node.example.com' }))
    await client.getNowBlockNumber()
    await client.listIncomingTransfers('TXYZ', { minTimestampMs: 0 })
    expect(calls.map((call) => new URL(call.url).host)).toEqual(['node.example.com', 'node.example.com'])
  })

  it('sends the TronGrid API key only to TronGrid hosts, never to a GetBlock node', async () => {
    const { calls } = mockFetch((url) => ({ status: 200, body: url.includes('/v1/') ? { data: [] } : BLOCK }))
    const client = new TronClientService(config({
      ...fast,
      TRON_API_KEY: 'grid-key',
      TRON_NODE_URL: 'https://go.getblock.io/secret-token',
      TRON_INDEX_URL: 'https://api.trongrid.io',
    }))
    await client.getNowBlockNumber()
    await client.listIncomingTransfers('TXYZ', { minTimestampMs: 0 })
    expect(calls[0].headers['TRON-PRO-API-KEY']).toBeUndefined()
    expect(calls[1].headers['TRON-PRO-API-KEY']).toBe('grid-key')
  })
})

describe('TronClientService rate limiting', () => {
  it('puts the provider into cooldown on 429 and fails fast without another request', async () => {
    const { calls } = mockFetch(() => ({ status: 429 }))
    const client = new TronClientService(config({ ...fast, TRON_API_BASE_URL: 'https://api.trongrid.io' }))
    await expect(client.getNowBlockNumber()).rejects.toBeInstanceOf(TronRateLimitedError)
    expect(client.cooldownRemaining('node')).toBeGreaterThan(0)
    await expect(client.getNowBlockNumber()).rejects.toBeInstanceOf(TronRateLimitedError)
    expect(calls).toHaveLength(1)
  })

  it('honours Retry-After when it is longer than the backoff', async () => {
    mockFetch(() => ({ status: 429, headers: { 'retry-after': '60' } }))
    const client = new TronClientService(config({ ...fast }))
    await expect(client.getNowBlockNumber()).rejects.toBeInstanceOf(TronRateLimitedError)
    expect(client.cooldownRemaining('node')).toBeGreaterThan(55_000)
  })

  it('cools down node and index independently when they are different hosts', async () => {
    mockFetch((url) => (url.includes('getblock') ? { status: 429 } : { status: 200, body: { data: [] } }))
    const client = new TronClientService(config({
      ...fast,
      TRON_NODE_URL: 'https://go.getblock.io/token',
      TRON_INDEX_URL: 'https://api.trongrid.io',
    }))
    await expect(client.getNowBlockNumber()).rejects.toBeInstanceOf(TronRateLimitedError)
    expect(client.cooldownRemaining('index')).toBe(0)
    await expect(client.listIncomingTransfers('TXYZ', { minTimestampMs: 0 })).resolves.toEqual([])
  })

  it('shares one cooldown when node and index are the same host', async () => {
    mockFetch(() => ({ status: 429 }))
    const client = new TronClientService(config({ ...fast, TRON_API_BASE_URL: 'https://api.trongrid.io' }))
    await expect(client.getNowBlockNumber()).rejects.toBeInstanceOf(TronRateLimitedError)
    expect(client.cooldownRemaining('index')).toBeGreaterThan(0)
  })

  it('still retries 5xx responses and does not cool down for them', async () => {
    let attempts = 0
    mockFetch(() => (++attempts < 2 ? { status: 503 } : { status: 200, body: BLOCK }))
    const client = new TronClientService(config({ ...fast, TRON_API_MAX_RETRIES: '2' }))
    await expect(client.getNowBlockNumber()).resolves.toBe(123)
    expect(attempts).toBe(2)
    expect(client.cooldownRemaining('node')).toBe(0)
  })

  it('spaces consecutive requests to the same provider by the configured interval', async () => {
    mockFetch(() => ({ status: 200, body: BLOCK }))
    const client = new TronClientService(config({ TRON_NODE_MIN_INTERVAL_MS: '200' }))
    const started = Date.now()
    await client.getNowBlockNumber()
    await client.getNowBlockNumber()
    await client.getNowBlockNumber()
    expect(Date.now() - started).toBeGreaterThanOrEqual(380)
  })

  it('never puts the node URL (which may carry an access token) into error messages', async () => {
    mockFetch(() => ({ status: 400 }))
    const client = new TronClientService(config({ ...fast, TRON_NODE_URL: 'https://go.getblock.io/secret-token' }))
    await expect(client.getNowBlockNumber()).rejects.toThrow(/HTTP 400/)
    await client.getNowBlockNumber().catch((error: Error) => expect(error.message).not.toContain('secret-token'))
  })
})

describe('TronClientService balances', () => {
  it('reads a TRC-20 balance from the constant-call result', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: { constant_result: ['0000000000000000000000000000000000000000000000000000000005f5e100'] } }))
    const client = new TronClientService(config({ ...fast }))
    await expect(client.getTrc20Balance(generateTronKeypair().address)).resolves.toBe(100000000n)
    expect(calls[0].url).toMatch(/\/wallet\/triggerconstantcontract$/)
  })

  it('rejects a malformed TRC-20 balance instead of reporting zero', async () => {
    mockFetch(() => ({ status: 200, body: { result: { result: false } } }))
    const client = new TronClientService(config({ ...fast }))
    await expect(client.getTrc20Balance(generateTronKeypair().address)).rejects.toThrow(/invalid TRC-20 balance/)
  })

  it('reads TRX in sun and treats an unactivated account as zero', async () => {
    let body: unknown = { balance: 123456789 }
    mockFetch(() => ({ status: 200, body }))
    const client = new TronClientService(config({ ...fast }))
    await expect(client.getTrxBalance('TXYZ')).resolves.toBe(123456789n)
    body = {}
    await expect(client.getTrxBalance('TXYZ')).resolves.toBe(0n)
  })
})
