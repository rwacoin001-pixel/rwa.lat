import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatUsdt, previewAdjustment } from '../src/lib/user-balances.ts'

test('formats exact large and fractional USDT amounts without floating-point rounding', () => {
  assert.equal(formatUsdt('9007199254740993000001'), '9,007,199,254,740,993.000001')
  assert.equal(formatUsdt('1'), '0.000001')
  assert.equal(formatUsdt(null), '不可用')
  assert.equal(formatUsdt('-1000001'), '−1.000001')
})
test('shows precise credit, deduction and target-zero previews', () => {
  assert.deepEqual(previewAdjustment('credit', '0.000001', '1000000', '测试调整'), { before: '1000000', delta: '1', after: '1000001' })
  assert.deepEqual(previewAdjustment('debit', '1', '2000000', '测试调整'), { before: '2000000', delta: '-1000000', after: '1000000' })
  assert.deepEqual(previewAdjustment('set', '0', '2000000', '测试调整'), { before: '2000000', delta: '-2000000', after: '0' })
})
test('blocks unsupported amounts, empty reasons, missing balances, no-op and overdraft', () => {
  for (const amount of ['1e6', '-1', '.5', '01', '1.0000001', 'NaN']) assert.throws(() => previewAdjustment('credit', amount, '0', '测试调整'))
  assert.throws(() => previewAdjustment('credit', '1', null, '测试调整'))
  assert.throws(() => previewAdjustment('credit', '1', '0', ''))
  assert.throws(() => previewAdjustment('set', '1', '1000000', '测试调整'))
  assert.throws(() => previewAdjustment('debit', '2', '1000000', '测试调整'))
})
