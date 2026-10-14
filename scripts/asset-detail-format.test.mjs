import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(path, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'exports', code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  }, exports)
  return exports
}
const money = load('lib/money.ts')
const { fmtAtomic } = load('components/maison/format.ts', { '@/lib/money': money })
const { assetClassLabel, networkLabel } = load('lib/maison-market-copy.ts')
const locales = ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt']

test('unit prices round to cents at or above one unit and keep precision only below it', () => {
  const price = (atomic, decimals = 6) => fmtAtomic(atomic, decimals, 'USD', money.priceDigits(atomic, decimals))
  assert.equal(price('4144600098'), '4,144.60 USD')
  assert.equal(price('1000000'), '1.00 USD')
  assert.equal(price('500000'), '0.50 USD')
  assert.equal(price('12345'), '0.012345 USD')
  assert.equal(money.priceDigits('not-a-number', 6), 2)
})

test('order minimums are USDT spend amounts, matching the invest CTA', () => {
  assert.equal(money.fmtUsdt('10000000'), '10.00 USDT')
  assert.equal(money.fmtUsdt(null, { digits: 0 }), '—')
})

test('asset classes and networks show labels instead of raw ids in every locale', () => {
  assert.equal(assetClassLabel('commodity', 'en'), 'Commodities')
  assert.equal(assetClassLabel('commodity', 'zh-CN'), '大宗商品')
  for (const locale of locales) for (const id of ['commodity', 'fund', 'equity']) assert.notEqual(assetClassLabel(id, locale), id, `${locale}:${id}`)
  assert.equal(assetClassLabel('private_markets', 'en'), 'Private markets')
  assert.equal(networkLabel('ethereum'), 'Ethereum')
  assert.equal(networkLabel('tron'), 'TRON')
  assert.equal(networkLabel(null), '—')
})
