import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import ts from 'typescript'

function load(path, overrides = {}) {
  const filename = resolve(path), exports = {}, require = createRequire(filename)
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', code)(id => {
    if (id in overrides) return overrides[id]
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (id.startsWith('.') || id.startsWith('@/')) {
      const base = id.startsWith('@/') ? resolve(id.slice(2)) : resolve(dirname(filename), id)
      for (const suffix of ['.ts', '.tsx']) if (existsSync(base + suffix)) return load(base + suffix, overrides)
    }
    return require(id)
  }, exports)
  return exports
}

const { onDeviceClock } = load('lib/prediction-clock.ts')
const { predictionQuote } = load('lib/prediction-quote.ts')
const { contentBatches } = load('lib/use-content-translation.ts', { react: { useEffect() {}, useState() { return [] }, useCallback(f) { return f } }, './i18n': { useI18n: () => ({ locale: 'zh-CN' }) }, './api/_http': { request() {} } })
const { pulseSides } = load('components/maison/PredictionPulse.tsx', { '@/lib/i18n': { useI18n: () => ({ locale: 'zh-CN' }) }, './motion': { Figure: () => null }, './primitives': { maison: {} } })

const book = (fetchedAt) => ({ asks: [{ price: 0.5, size: 1000 }], bids: [], fetchedAt })

test('a device clock that runs slow no longer turns a fresh quote into "expired"', () => {
  const server = Date.UTC(2026, 9, 14, 2, 0, 0)
  const slowDevice = server - 8_000 // phone clock 8 s behind
  const raw = book(new Date(server - 1_000).toISOString()) // fetched 1 s before the server answered
  assert.equal(predictionQuote(raw, 0.5, 1, slowDevice).reason, 'expired') // the bug
  const timed = onDeviceClock(raw, new Date(server).toISOString(), slowDevice)
  assert.equal(predictionQuote(timed, 0.5, 1, slowDevice).reason, null)
  assert.equal(Date.parse(timed.fetchedAt), slowDevice - 1_000)
})

test('a genuinely old book still expires, and missing server time leaves the book unchanged', () => {
  const server = Date.UTC(2026, 9, 14, 2, 0, 0)
  const old = onDeviceClock(book(new Date(server - 200_000).toISOString()), new Date(server).toISOString(), server + 30_000)
  assert.equal(predictionQuote(old, 0.5, 1, server + 30_000).reason, 'expired')
  const raw = book(new Date(server).toISOString())
  assert.equal(onDeviceClock(raw, undefined), raw)
  assert.equal(onDeviceClock(null, new Date(server).toISOString()), null)
})

test('translation batches stay within 30 texts and the character budget', () => {
  const short = Array.from({ length: 95 }, (_, i) => `Outcome ${i}`)
  const batches = contentBatches(short)
  assert.deepEqual(batches.map((b) => b.length), [30, 30, 30, 5])
  const long = ['a'.repeat(3500), 'b'.repeat(3500), 'c'.repeat(100), 'd'.repeat(5000)]
  assert.deepEqual(contentBatches(long).map((b) => b.map((t) => t[0]).join('')), ['a', 'bc', 'd'])
  assert.ok(contentBatches(long).every((b) => b.length === 1 || b.reduce((n, t) => n + t.length, 0) <= 6000))
})

test('BTC round card reads Up and Down by label and its percentages add up to 100', () => {
  assert.deepEqual(pulseSides({ outcomes: [{ label: 'Down', impliedProbability: 0.4 }, { label: 'Up', impliedProbability: 0.6 }] }), [60, 40])
  assert.deepEqual(pulseSides({ outcomes: [{ label: 'Up', impliedProbability: 0.505 }, { label: 'Down', impliedProbability: 0.495 }] }), [51, 49])
  assert.deepEqual(pulseSides({ outcomes: [{ label: 'Up', impliedProbability: 0.6 }, { label: 'Down', impliedProbability: 0.45 }] }), [57, 43])
})
