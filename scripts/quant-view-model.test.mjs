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

test('subscription timeline: submit, first counted day, first payout day', () => {
  assert.deepEqual(vm.subscriptionTimeline({ localDate: '2026-10-19', effectiveDate: '2026-10-20' }).map((s) => s.date), ['2026-10-19', '2026-10-20', '2026-10-21'])
  assert.equal(vm.windowLabel(4, 7).partial, true)
  assert.equal(vm.windowLabel(7, 7).partial, false)
})
