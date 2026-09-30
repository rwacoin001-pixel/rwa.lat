import assert from 'node:assert/strict'
import { test } from 'node:test'
import { idempotencyKeyForIntent } from '../lib/api/idempotency'
import { fromAtomic, toAtomic } from '../lib/money'

test('uncertain retries reuse the same intent key; edits and success create a new intent', () => {
  const keys = new Map<string, string>()
  let count = 0
  const key = (amount: string) => idempotencyKeyForIntent(keys, 'POST', '/v1/wallet/transfers', { amount }, () => String(++count))
  assert.equal(key('1'), key('1'))
  assert.notEqual(key('1'), key('2'))
  const original = key('1')
  keys.clear()
  assert.notEqual(key('1'), original)
})

test('atomic money keeps values beyond floating point precision and rejects excess decimals', () => {
  assert.equal(toAtomic('9007199254740993.123456', 6), '9007199254740993123456')
  assert.equal(fromAtomic('9007199254740993123456', 6), '9007199254740993.123456')
  assert.equal(toAtomic('0.0000001', 6), null)
  assert.equal(BigInt(toAtomic('0.1', 6)!) + BigInt(toAtomic('0.2', 6)!), BigInt(toAtomic('0.3', 6)!))
})
