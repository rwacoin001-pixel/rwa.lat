// Run: node scripts/verify-basket-positions.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('../node_modules/typescript')
const root = path.resolve(__dirname, '..')

function load(rel, stubs = {}) {
  const file = path.resolve(root, rel), mod = new Module(file)
  mod.filename = file
  mod.require = (name) => { if (name in stubs) return stubs[name]; throw new Error(`Unstubbed import ${name} from ${rel}`) }
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  mod._compile(out, file)
  return mod.exports
}

let http = async () => ({ ok: false, error: { status: 0, code: 'UNSET', message: 'unset' } })
const httpCalls = []
const api = load('lib/api/basket-positions.ts', { './_http': { request: (...args) => { httpCalls.push(args); return http(...args) } } })

const axiosCalls = []
let productRows = []
const apiClient = { axios: { get: async (url) => {
  axiosCalls.push(url)
  if (url === '/v1/portfolio/positions') return { data: productRows }
  if (url === '/v1/catalog/products') return { data: [{ id: 'prod-1', displayName: 'Treasury Note', assetClassId: 'rwa' }] }
  throw new Error(`unexpected axios call ${url}`)
} } }
const data = load('lib/portfolio-data.ts', { './api-client': { apiClient }, './display/labels': { shortId: (id) => String(id).slice(0, 8) }, './api/basket-positions': api })

const basket = (over = {}) => ({
  portfolioId: 'b1111111-1111-4111-8111-111111111111', portfolioName: 'Core Basket', portfolioStatus: 'active',
  units: '12.345678901234567891', unitsAtomicAmount: '12345678901234567891', unitsDecimals: 18,
  navPerUnit: '1.5', navAtomicAmount: '1500000000000000000', navDecimals: 18,
  marketValueAtomicAmount: '18518518', currency: 'USDT', valuedAt: '2026-10-05T08:00:00.000Z', valuationQuality: 'ok', ...over,
})
const unknown = (id, quality = 'stale') => basket({ portfolioId: id, portfolioName: `Basket ${id}`, navPerUnit: null, navAtomicAmount: null, marketValueAtomicAmount: null, valuedAt: null, valuationQuality: quality })
const product = { productId: 'prod-1', outcomeKey: 'long', assetCode: 'RWA', assetDecimals: 6, quantityAtomicAmount: '2000000', costAtomicAmount: '1900000', cumulativeYieldAtomicAmount: '10000', unitPriceAtomicAmount: '1050000', unitPriceDecimals: 6, currency: 'USD', valuedAt: '2026-10-05T00:00:00.000Z', source: 'catalog' }
const B = (value) => BigInt(value)

;(async () => {
  // Normalisation: one row per portfolio, exact strings, strict about malformed data.
  const rows = api.normalizeBasketPositions([basket(), unknown('b2222222-2222-4222-8222-222222222222')])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].unitsAtomicAmount, '12345678901234567891', '18-decimal units must stay an exact string')
  assert.equal(api.normalizeBasketPositions({ items: [] }), null, 'non-array payload is invalid, not empty')
  assert.equal(api.normalizeBasketPositions([basket(), basket()]), null, 'duplicate portfolio rows are a contract violation, never summed or silently dropped')
  assert.equal(api.normalizeBasketPositions([basket({ unitsAtomicAmount: '12.5' })]), null, 'non-atomic units are invalid')
  assert.equal(api.normalizeBasketPositions([basket({ portfolioId: '' })]), null)
  assert.deepEqual(api.normalizeBasketPositions([]), [], 'a successful empty list is a real zero')

  // Market value: only an ok valuation with a server value is known.
  assert.equal(api.basketMarketValue(basket()), B(18518518))
  assert.equal(api.basketMarketValue(basket({ valuationQuality: 'stale' })), null, 'stale NAV never counts even if a value leaks through')
  assert.equal(api.basketMarketValue(basket({ marketValueAtomicAmount: null })), null)
  assert.equal(api.basketMarketValue(basket({ marketValueAtomicAmount: '1.5' })), null)

  // Totals: exact BigInt sum, unknown/unloaded/unpriced all make the total unavailable.
  const two = [basket({ marketValueAtomicAmount: '1500000' }), basket({ portfolioId: 'b2', marketValueAtomicAmount: '2000000' })]
  assert.equal(api.holdingsTotal(B(5_000_000), 0, two), B(8_500_000))
  assert.equal(api.holdingsTotal(B(5_000_000), 0, []), B(5_000_000), 'loaded empty basket list adds nothing')
  assert.equal(api.holdingsTotal(B(5_000_000), 0, undefined), null, 'basket query not loaded => no complete total')
  assert.equal(api.holdingsTotal(B(5_000_000), 1, two), null, 'unpriced product row => no complete total')
  assert.equal(api.holdingsTotal(B(5_000_000), 0, [...two, unknown('b3')]), null, 'one unknown basket => no complete total')
  assert.equal(api.holdingsTotal(B(0), 0, [basket({ marketValueAtomicAmount: '9007199254740993' }), basket({ portfolioId: 'b2', marketValueAtomicAmount: '1' })]), B('9007199254740994'), 'sum must not lose precision above 2^53')

  // Sorting: known values first (desc), unknown last, deterministic.
  const sorted = api.sortBasketPositions([unknown('bz'), basket({ portfolioId: 'b-small', portfolioName: 'Small', marketValueAtomicAmount: '1' }), basket({ portfolioId: 'b-big', portfolioName: 'Big', marketValueAtomicAmount: '9' })])
  assert.deepEqual(sorted.map((row) => row.portfolioId), ['b-big', 'b-small', 'bz'])

  // Formatting stays decimal-exact and locale aware.
  assert.equal(api.formatAtomicDecimal('1234567890123456789012', 18, 'en-US'), '1,234.567890123456789012')
  assert.equal(api.formatAtomicDecimal('1000000000000000000', 18, 'en-US', 2, 6), '1.00')
  assert.equal(api.formatAtomicDecimal('1023456789000000000', 18, 'en-US', 2, 6), '1.023457', 'display rounding is half-up on the decimal string')
  assert.equal(api.formatAtomicDecimal('1234500000000000000000', 18, 'de-DE'), '1.234,5')
  assert.equal(api.formatAtomicDecimal('0', 18, 'en-US'), '0')
  assert.equal(api.formatAtomicDecimal('0.5', 18, 'en-US'), '—')
  assert.equal(api.formatAtomicDecimal(null, 18, 'en-US'), '—')

  // Shared reader: authenticated path via request(), failures and invalid payloads surface as errors.
  http = async () => ({ ok: true, data: [basket()] })
  const okResult = await api.listBasketPositions()
  assert.equal(httpCalls.at(-1)[0], '/v1/basket/me/positions')
  assert.equal(okResult.ok, true)
  http = async () => ({ ok: false, error: { status: 401, code: 'UNAUTHORIZED', message: 'nope' } })
  const failed = await api.listBasketPositions()
  assert.equal(failed.ok, false); assert.equal(failed.error.status, 401)
  http = async () => ({ ok: true, data: [basket(), basket()] })
  const invalid = await api.listBasketPositions()
  assert.equal(invalid.ok, false); assert.equal(invalid.error.code, 'INVALID_BASKET_POSITIONS')

  // Legacy getPositions merges baskets without touching product entries.
  productRows = [product]
  http = async () => ({ ok: true, data: [] })
  const productOnly = await data.getPositions()
  assert.equal(productOnly.length, 1)
  http = async () => ({ ok: true, data: [basket(), unknown('b2222222-2222-4222-8222-222222222222', 'unavailable')] })
  const merged = await data.getPositions()
  assert.equal(merged.length, 3)
  assert.deepEqual(merged[0], productOnly[0], 'product entry is unchanged by basket merge')
  const view = merged[1]
  assert.equal(view.source, 'basket'); assert.equal(view.productClass, 'basket')
  assert.equal(view.productId, 'b1111111-1111-4111-8111-111111111111'); assert.equal(view.productName, 'Core Basket')
  assert.equal(view.quantityAtomicAmount, '12345678901234567891'); assert.equal(view.assetDecimals, 18)
  assert.equal(view.unitPriceAtomicAmount, '1500000000000000000'); assert.equal(view.unitPriceDecimals, 18)
  assert.equal(view.marketValueAtomicAmount, '18518518', 'server value, not recomputed from floats')
  assert.equal(view.costKnown, false); assert.equal(view.yieldKnown, false)
  assert.equal(view.currency, 'USDT'); assert.equal(view.valuedAt, '2026-10-05T08:00:00.000Z')
  assert.ok(Math.abs(view.marketValue - 18.518518) < 1e-9)
  const missing = merged[2]
  assert.equal(missing.marketValueAtomicAmount, null); assert.equal(missing.marketValue, 0); assert.equal(missing.source, 'basket')
  assert.equal(data.sumPositionMarketValueAtomic(merged), null, 'an unknown basket keeps the legacy total unavailable')
  assert.equal(data.sumPositionMarketValueAtomic(merged.slice(0, 2)), String(B(productOnly[0].marketValueAtomicAmount) + B(18518518)))
  assert.ok(axiosCalls.every((url) => url.startsWith('/v1/portfolio/') || url.startsWith('/v1/catalog/')), 'baskets never go through the product axios endpoints')

  // Basket failure rejects the whole legacy read instead of returning a product-only "total".
  http = async () => ({ ok: false, error: { status: 503, code: 'UPSTREAM', message: 'down' } })
  await assert.rejects(() => data.getPositions(), /down/)
  http = async () => ({ ok: true, data: 'garbage' })
  await assert.rejects(() => data.getPositions())

  // Seven-locale copy.
  const { basketPositionsCopy } = load('lib/maison-basket-positions-copy.ts')
  const locales = ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt']
  const flat = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? flat(item, `${prefix}${key}.`) : [[`${prefix}${key}`, item]])
  const keys = flat(basketPositionsCopy.en).map(([key]) => key).sort()
  assert.ok(keys.length > 8)
  for (const locale of locales) {
    const entries = flat(basketPositionsCopy[locale])
    assert.deepEqual(entries.map(([key]) => key).sort(), keys, `${locale} has the same keys`)
    assert.ok(entries.every(([, text]) => typeof text === 'string' && text.trim().length > 0), `${locale} has no empty strings`)
  }

  // Screen wiring: separate query, basket detail route, nothing basket-shaped reaches product-only flows.
  const screen = fs.readFileSync(path.join(root, 'components/maison/PortfolioScreen.tsx'), 'utf8')
  assert.match(screen, /useQuery\('basket:positions', listBasketPositions/)
  assert.match(screen, /openPath\(`\/basket\/\$\{encodeURIComponent\(/)
  const detail = screen.slice(screen.indexOf('export function PositionDetailScreen'))
  assert.ok(detail.length > 0 && !/basket/i.test(detail), 'product position detail, redemption and history stay basket-free')

  console.log('PASS: basket positions normalisation, exact totals/unknown completeness, legacy merge + failure, formatting, seven-locale copy, screen wiring')
})().catch((error) => { console.error(error); process.exitCode = 1 })
