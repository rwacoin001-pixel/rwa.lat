import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import ts from 'typescript'

function load(relative, imports) {
  const file = path.resolve(relative)
  const mod = new Module(file)
  mod.filename = file
  mod.require = name => {
    if (name in imports) return imports[name]
    throw new Error(`Unexpected import ${name}`)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, file)
  return mod.exports
}

let request
const http = { request: (...args) => request(...args) }
const portfolio = load('lib/api/portfolio.ts', { './_http': http })
const baskets = load('lib/api/basket-positions.ts', { './_http': http })
const predictions = load('lib/api/my-predictions.ts', {})
const api = load('lib/api/portfolio-summary.ts', {
  './_http': http, './wallet': { getWalletOverview: () => request('/v1/wallet') },
  './portfolio': portfolio, './basket-positions': baskets, './my-predictions': predictions,
})
const copy = load('lib/asset-valuation-copy.ts', {})
const wallet = {
  asset: { code: 'USDT', decimals: 6 },
  balances: { availableAtomic: '60394050000', lockedAtomic: '0', pendingAtomic: '0', investedAtomic: '14902390000', rewardPayableAtomic: '0' },
}
const quant = [{ principalAtomic: '14902390000', investedAtomic: '14402390000', waitingAtomic: '500000000', totalNetAtomic: '652050000', lastDay: null }]
const basket = (id, value, quality = 'ok') => ({
  portfolioId: id, portfolioName: id, unitsAtomicAmount: '1000000000000000000', unitsDecimals: 18,
  navAtomicAmount: '1000000000000000000', navDecimals: 18,
  marketValueAtomicAmount: value, valuationQuality: quality, currency: 'USDT',
})
const holdings = [basket('foundation', '9372860000'), basket('ai', '1000000000'), basket('balanced', '923720000')]
const bet = (id, overrides = {}) => ({ id, status: 'placed', stakeAtomic: '206910000', feeAtomic: '0', shares: '200', ...overrides })

test('all assets include baskets and quant waiting principal once, without duplicating invested book cost', () => {
  const result = api.summarizeAssets(wallet, [], holdings, quant, [bet('open')], null)
  assert.equal(result.totalAtomic, '86799930000')
  assert.equal(result.breakdown.baskets, '11296580000')
  assert.equal(result.valuationComplete, true)
})

test('locked cash, pending cash, payable rewards and real product valuation are counted once', () => {
  const result = api.summarizeAssets({ ...wallet, balances: { ...wallet.balances, lockedAtomic: '2000000', pendingAtomic: '3000000', rewardPayableAtomic: '4000000' } }, [{
    quantityAtomicAmount: '2000000', assetDecimals: 6, unitPriceAtomicAmount: '3000000', unitPriceDecimals: 6,
    currency: 'USDT', costAtomicAmount: '5000000', cumulativeYieldAtomicAmount: '0',
  }], [], [], [], null)
  assert.equal(result.totalAtomic, '60409050000')
})

test('open predictions use fee-adjusted cost and settled payouts stay in cash', () => {
  const result = api.summarizeAssets(wallet, [], [], [], [bet('open', { stakeAtomic: '100000000', feeAtomic: '3000000' }), bet('won', { status: 'won', payoutFeeAtomic: '6000000' })], null)
  assert.equal(result.breakdown.predictions, '97000000')
  assert.equal(result.predictions.paidAtomic, '194000000')
  assert.equal(result.totalAtomic, '60491050000')
})

test('one stale basket retains other valuations and clearly labels a partial subtotal in every locale', () => {
  const result = api.summarizeAssets(wallet, [], [...holdings, basket('stale', '900000000', 'stale')], quant, [], null)
  assert.equal(result.breakdown.baskets, '11296580000')
  assert.equal(result.valuationComplete, false)
  assert.equal(result.unpricedCount, 1)
  for (const locale of ['zh-CN', 'en', 'es', 'pt', 'fr', 'hi', 'ar']) {
    assert.notEqual(copy.assetValuationCopy(locale, result).label, copy.assetValuationCopy(locale, undefined).label)
    assert.ok(copy.assetValuationCopy(locale, result).note)
  }
})

test('zero assets are valid and amounts above Number precision remain exact', () => {
  const balances = Object.fromEntries(Object.keys(wallet.balances).map(key => [key, '0']))
  assert.equal(api.summarizeAssets({ ...wallet, balances }, [], [], [], [], null).totalAtomic, '0')
  balances.availableAtomic = '90071992547409930001'
  balances.lockedAtomic = '1'
  assert.equal(api.summarizeAssets({ ...wallet, balances }, [], [], [], [], null).totalAtomic, '90071992547409930002')
  assert.throws(() => api.summarizeAssets({ ...wallet, asset: { code: 'USDT', decimals: 18 } }, [], [], [], [], null))
  assert.throws(() => api.summarizeAssets(wallet, [], [], [], [bet('bad', { feeAtomic: 'invalid' })], null))
})

function fixture({ count = 101, fail, duplicate = false, changed = false } = {}) {
  const calls = []
  request = async route => {
    calls.push(route)
    if (route === fail) return { ok: false, error: { status: 503, code: 'READ_FAILED' } }
    let data
    if (route === '/v1/wallet') data = wallet
    else if (route === '/v1/portfolio/positions') data = []
    else if (route === '/v1/basket/me/positions') data = holdings
    else if (route === '/v1/quant/me/positions') data = quant
    else if (route === '/v1/portfolio/summary') data = { totalAtomic: '60394050000', sparkAtomic: ['1', '2'], today: { changeAtomic: '172360000', changePct: '1', basis: 'ledger', since: '2026-11-07' } }
    else {
      const page = Number(new URL(route, 'https://fixture.invalid').searchParams.get('page'))
      data = { total: count + (changed && page > 1 ? 1 : 0), page, limit: 100, items: Array.from({ length: Math.min(100, count - (page - 1) * 100) }, (_, index) => bet(`bet-${duplicate ? index : (page - 1) * 100 + index}`, { stakeAtomic: '1000000' })) }
    }
    return { ok: true, data }
  }
  return calls
}

test('normal entry point loads predictions beyond the first page and removes the book-balance spark', async () => {
  const calls = fixture()
  const result = await api.getPortfolioSummary()
  assert.equal(result.ok, true)
  assert.equal(result.data.predictions.openCount, 101)
  assert.equal(result.data.breakdown.predictions, '101000000')
  assert.ok(calls.includes('/v1/predictions/bets?page=2&limit=100'))
  assert.equal(result.data.sparkAtomic, undefined)
  assert.equal(result.data.today.changePct, null)
})

test('failed reads, duplicate pages and changing pagination never become a complete lower total', async () => {
  for (const options of [{ fail: '/v1/basket/me/positions' }, { duplicate: true }, { changed: true }]) {
    fixture(options)
    assert.equal((await api.getPortfolioSummary()).ok, false)
  }
})

test('long histories have no fixed page cap', async () => {
  const calls = fixture({ count: 2001 })
  const result = await api.getPortfolioSummary()
  assert.equal(result.ok, true)
  assert.equal(result.data.predictions.openCount, 2001)
  assert.ok(calls.includes('/v1/predictions/bets?page=21&limit=100'))
})
