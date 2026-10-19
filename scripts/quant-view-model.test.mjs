import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'

const code = ts.transpileModule(fs.readFileSync('lib/quant-view-model.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const vm = await import('data:text/javascript,' + encodeURIComponent(code))

test('ticks mark gain, loss, flat, missing and today, and skip days before the first settlement', () => {
  const ticks = vm.buildTicks(
    [{ date: '2026-10-14', value: 0.3 }, { date: '2026-10-15', value: -0.2 }, { date: '2026-10-16', value: 0 }, { date: '2026-10-18', value: 0.1 }],
    { today: '2026-10-19', count: 10 },
  )
  assert.deepEqual(ticks.map((t) => [t.date, t.kind]), [
    ['2026-10-14', 'gain'], ['2026-10-15', 'loss'], ['2026-10-16', 'flat'], ['2026-10-17', 'missing'], ['2026-10-18', 'gain'], ['2026-10-19', 'today'],
  ])
})

test('a missing day is never drawn as zero and the scale is shared across the window', () => {
  const ticks = vm.buildTicks([{ date: '2026-10-17', value: 0.5 }, { date: '2026-10-19', value: -0.25 }], { today: '2026-10-20', count: 4 })
  const scale = vm.tickScale(ticks)
  assert.equal(scale, 0.5)
  const byDate = Object.fromEntries(ticks.map((t) => [t.date, vm.tickHeight(t, scale)]))
  assert.equal(byDate['2026-10-17'], 1)
  assert.equal(byDate['2026-10-18'], 0)
  assert.equal(ticks.find((t) => t.date === '2026-10-18').kind, 'missing')
  assert.equal(byDate['2026-10-19'], 0.5)
})

test('percent formatting uses a real minus and never shows -0.00%', () => {
  assert.equal(vm.formatPct(0.314), '+0.31%')
  assert.equal(vm.formatPct(-1.2), '−1.20%')
  assert.equal(vm.formatPct(-0.001), '0.00%')
  assert.equal(vm.formatPct(null), '—')
  assert.equal(vm.formatPct('abc'), '—')
})

test('subscription timeline uses the dates the API returned, even when they are not consecutive', () => {
  assert.deepEqual(vm.subscriptionTimeline({ localDate: '2026-10-19', effectiveDate: '2026-10-20', firstSettlementDate: '2026-10-20' }).map((s) => s.date), ['2026-10-19', '2026-10-20', '2026-10-20'])
  assert.deepEqual(vm.subscriptionTimeline({ localDate: '2026-10-23', effectiveDate: '2026-10-26', firstSettlementDate: '2026-10-27' }).map((s) => s.date), ['2026-10-23', '2026-10-26', '2026-10-27'])
  assert.equal(vm.windowLabel(4, 7).partial, true)
  assert.equal(vm.windowLabel(7, 7).partial, false)
})

test('audience: visitor, holder (incl. waiting funds), pending-only, ex-holder', () => {
  const none = { principalAtomic: '0', pendingOrders: [], lastDay: null }
  assert.equal(vm.quantAudience(undefined), 'visitor')
  assert.equal(vm.quantAudience(none), 'visitor')
  assert.equal(vm.quantAudience({ ...none, principalAtomic: '5000000' }), 'holder')
  assert.equal(vm.quantAudience({ ...none, pendingOrders: [{}] }), 'pending')
  assert.equal(vm.quantAudience({ ...none, lastDay: { tradeDate: '2026-10-18' } }), 'ex-holder')
  assert.equal(vm.quantAudience({ principalAtomic: '1', pendingOrders: [{}], lastDay: {} }), 'holder')
})

test('pending count caps at the API limit', () => {
  assert.equal(vm.pendingCount(0), '0')
  assert.equal(vm.pendingCount(9), '9')
  assert.equal(vm.pendingCount(10), '10+')
})

test('redemption bands: exclusive upper bounds, sorted, ending free', () => {
  assert.deepEqual(vm.redemptionBands([{ maxDays: 30, bps: 50 }, { maxDays: 7, bps: 150 }]), [
    { from: 0, to: 7, bps: 150 }, { from: 7, to: 30, bps: 50 }, { from: 30, to: null, bps: 0 },
  ])
  assert.deepEqual(vm.redemptionBands([]), [{ from: 0, to: null, bps: 0 }])
})
