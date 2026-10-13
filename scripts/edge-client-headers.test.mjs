import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { withClientHeaders } from '../lib/edge-client-headers.mjs'

// Load the API's verifier from source so the Worker's signature is checked by the exact code that runs in production.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(resolve('apps/api/src/common/edge-client.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const api = { exports: {} }
new Function('module', 'exports', 'require', compiled)(api, api.exports, require)
const { verifyEdgeClient } = api.exports

const SECRET = 'k'.repeat(48)
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0)

function visitor({ ip = '203.0.113.7', country = 'JP', extra = {} } = {}) {
  const request = new Request('https://a-reit.com/v1/auth/register/email', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json', ...extra },
    body: '{"email":"a@example.com"}',
  })
  Object.defineProperty(request, 'cf', { value: { country } })
  return request
}

const headersOf = (request) => Object.fromEntries(request.headers.entries())

test('the API verifies what the Worker signs', async () => {
  const signed = await withClientHeaders(visitor(), SECRET, NOW)
  assert.deepEqual(verifyEdgeClient(headersOf(signed), SECRET, NOW), { ip: '203.0.113.7', country: 'JP' })
  assert.equal(await signed.text(), '{"email":"a@example.com"}')
})

test('client-supplied values are replaced, never signed', async () => {
  const signed = await withClientHeaders(visitor({ extra: { 'x-client-ip': '198.51.100.1', 'x-client-country': 'KP', 'x-client-sig': 'v1.1.forged' } }), SECRET, NOW)
  assert.equal(signed.headers.get('x-client-ip'), '203.0.113.7')
  assert.equal(signed.headers.get('x-client-country'), 'JP')
  assert.notEqual(signed.headers.get('x-client-sig'), 'v1.1.forged')
})

test('a signature does not verify with another secret, another IP, or after the skew window', async () => {
  const headers = headersOf(await withClientHeaders(visitor(), SECRET, NOW))
  assert.equal(verifyEdgeClient(headers, 'x'.repeat(48), NOW), null)
  assert.equal(verifyEdgeClient({ ...headers, 'x-client-ip': '203.0.113.8' }, SECRET, NOW), null)
  assert.equal(verifyEdgeClient({ ...headers, 'x-client-country': 'US' }, SECRET, NOW), null)
  assert.equal(verifyEdgeClient(headers, SECRET, NOW + 121_000), null)
  assert.ok(verifyEdgeClient(headers, SECRET, NOW + 119_000))
})

test('without a secret the Worker forwards the visitor unsigned; unknown countries are dropped', async () => {
  const unsigned = await withClientHeaders(visitor({ country: 'T1x' }), undefined, NOW)
  assert.equal(unsigned.headers.get('x-client-ip'), '203.0.113.7')
  assert.equal(unsigned.headers.get('x-client-country'), null)
  assert.equal(unsigned.headers.get('x-client-sig'), null)
  const signed = await withClientHeaders(visitor({ country: 'T1x' }), SECRET, NOW)
  assert.deepEqual(verifyEdgeClient(headersOf(signed), SECRET, NOW), { ip: '203.0.113.7', country: null })
})
