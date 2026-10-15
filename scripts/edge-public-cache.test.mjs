import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPublicRead, servePublicRead } from '../lib/edge-public-cache.mjs'

function memoryCache() {
  const store = new Map()
  return {
    store,
    async match(request) { const hit = store.get(request.url); return hit ? hit.clone() : undefined },
    async put(request, response) { store.set(request.url, response) },
  }
}

function harness(cache = memoryCache()) {
  const tasks = []
  const calls = []
  const deps = (body, init) => ({
    cache,
    waitUntil: (task) => { tasks.push(task) },
    forward: async () => { calls.push(body); return new Response(body, init) },
  })
  return { cache, tasks, calls, deps, settle: () => Promise.all(tasks) }
}

const request = (path) => new Request('https://a-reit.com' + path)

test('only the listed public GET reads are cached; quotes, details and user data never are', () => {
  for (const path of ['/v1/rwa/overview', '/v1/rwa/assets', '/v1/market-context', '/v1/polymarket/public-preview', '/v1/catalog/products', '/v1/basket/portfolios', '/v1/community/topics']) assert.equal(isPublicRead('GET', path), true, path)
  for (const path of ['/v1/catalog/products/abc/quote', '/v1/catalog/products/abc', '/v1/auth/session', '/v1/wallet', '/v1/portfolio/positions', '/v1/basket/me/positions', '/v1/community/feed', '/v1/rwa/assets/gold']) assert.equal(isPublicRead('GET', path), false, path)
  assert.equal(isPublicRead('POST', '/v1/rwa/assets'), false)
})

test('a miss waits for the API and stores a copy; the next visitor gets the copy at once while the API is still asked', async () => {
  const h = harness()
  const first = await servePublicRead(request('/v1/market-context?x=1'), h.deps('v1'))
  assert.equal(await first.text(), 'v1')
  assert.equal(first.headers.get('x-edge-cache'), null)
  await h.settle()
  assert.ok(h.cache.store.has('https://a-reit.com/v1/market-context?x=1'))

  const second = await servePublicRead(request('/v1/market-context?x=1'), h.deps('v2'))
  assert.equal(await second.text(), 'v1', 'served from the edge copy')
  assert.equal(second.headers.get('x-edge-cache'), 'hit')
  assert.equal(second.headers.get('cache-control'), 'no-cache', 'the browser does not keep its own copy')
  await h.settle()
  assert.deepEqual(h.calls, ['v1', 'v2'], 'the API still sees every request (visit log, activity)')
  assert.equal(await (await h.cache.match(request('/v1/market-context?x=1'))).text(), 'v2', 'and the copy is refreshed')
})

test('different query strings are different entries', async () => {
  const h = harness()
  await servePublicRead(request('/v1/rwa/assets?limit=8'), h.deps('eight')); await h.settle()
  const other = await servePublicRead(request('/v1/rwa/assets?limit=40'), h.deps('forty'))
  assert.equal(await other.text(), 'forty')
})

test('errors and responses that set cookies are never stored', async () => {
  const h = harness()
  await servePublicRead(request('/v1/rwa/overview'), h.deps('down', { status: 503 })); await h.settle()
  await servePublicRead(request('/v1/catalog/products'), h.deps('ok', { headers: { 'set-cookie': 'a=b' } })); await h.settle()
  assert.equal(h.cache.store.size, 0)
})

test('without a cache (local dev, tests) it is a plain pass-through', async () => {
  const response = await servePublicRead(request('/v1/rwa/overview'), { forward: async () => new Response('live') })
  assert.equal(await response.text(), 'live')
})
