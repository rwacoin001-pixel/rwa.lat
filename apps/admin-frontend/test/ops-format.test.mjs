import { test } from 'node:test'
import assert from 'node:assert/strict'
import { faceFor, money, moneyFull, sameEntry, sgDateLabel, waitBucket, waited } from '../src/components/ops/format.ts'
import { topPriority } from '../src/components/ops/queues.ts'

test('money rounds to two decimals half up, groups thousands and keeps the sign', () => {
  assert.equal(money('1234567890'), '1,234.57')
  assert.equal(money('4900000000'), '4,900.00')
  assert.equal(money('5000'), '0.01')
  assert.equal(money('4999'), '0.00')
  assert.equal(money('-1500000'), '-1.50')
  assert.equal(money('386420000000', 6, 0), '386,420')
  assert.equal(money(null), '—')
  assert.equal(money('not a number'), '—')
  assert.equal(moneyFull('1200000001'), '1,200.000001')
  assert.equal(moneyFull('1200000000'), '1,200')
})

test('waits read in plain words and fall into the right bucket', () => {
  const now = Date.parse('2026-11-03T10:00:00Z')
  const at = (min) => new Date(now - min * 60000).toISOString()
  assert.equal(waited(at(0.5), now), '刚刚')
  assert.equal(waited(at(12), now), '12 分钟')
  assert.equal(waited(at(150), now), '2 小时')
  assert.equal(waited(at(60 * 50), now), '2 天')
  assert.equal(waited(null, now), '—')
  assert.deepEqual([5, 15, 45, 61].map((m) => waitBucket(at(m), now)), [0, 1, 2, 3])
  assert.equal(sgDateLabel(Date.parse('2026-11-03T17:00:00Z')), '11 月 4 日 · 周三')
})

test('the same user always gets the same porcelain face', () => {
  const a = faceFor('a1f3c2d4-0001'), b = faceFor('a1f3c2d4-0001')
  assert.equal(a, b)
  assert.match(a, /^\/avatars\/porcelain\/(0[1-9]|1[0-6])\.webp$/)
})

test('typed confirmation accepts the same amount in any common form, nothing else', () => {
  for (const typed of ['1200', '1,200', '1200.00', ' 1200.0 ', '01200']) assert.equal(sameEntry(typed, '1,200.00'), true, typed)
  for (const typed of ['', '120', '12000', '1200.01', 'abc']) assert.equal(sameEntry(typed, '1,200.00'), false, typed)
  assert.equal(sameEntry('-0.120', '-0.12'), true)
  assert.equal(sameEntry('0.12', '-0.12'), false)
  assert.equal(sameEntry('0.35', '0.35'), true)
})

const queue = (count, oldestMin, extra = {}) => ({ count, oldestAt: oldestMin === null ? null : new Date(NOW - oldestMin * 60000).toISOString(), status: 'ok', ...extra })
const NOW = Date.parse('2026-11-03T05:00:00Z') // 13:00 in Singapore
const KEYS = ['withdrawalReview', 'withdrawalExecute', 'kyc', 'quantSettlement', 'communityQueue', 'communityReports', 'supportTickets', 'mail', 'accountClosures', 'ledgerAdjustments', 'approvals', 'teamBatches', 'predictionSettlements', 'deadJobs']
function today(overrides = {}, alerts = []) {
  const queues = Object.fromEntries(KEYS.map((k) => [k, queue(0, null)]))
  queues.quantSettlement = queue(0, null, { state: 'posted', cutoffAt: '2026-11-03T15:00:00+08:00' })
  return { asOf: '', queues: { ...queues, ...overrides }, today: {}, alerts }
}

test('the first thing to do: paused withdrawals, then the quant cutoff, then late withdrawals, then the hot wallet', () => {
  assert.equal(topPriority(null), null)
  assert.equal(topPriority(today(), NOW), null)
  assert.equal(topPriority(today({ withdrawalReview: queue(2, 45) }, [{ code: 'withdrawal_execution_paused', level: 'high', message: '已暂停' }]), NOW).title, '提现执行已暂停')
  const quant = today({ withdrawalReview: queue(2, 45), quantSettlement: queue(1, null, { state: 'none', cutoffAt: '2026-11-03T15:00:00+08:00' }) })
  assert.equal(topPriority(quant, NOW).title, '量化今日结算还没录入')
  assert.equal(topPriority(quant, NOW).detail, '离 15:00 截止还有 120 分钟')
  const later = today({ withdrawalReview: queue(2, 45), quantSettlement: queue(1, null, { state: 'none', cutoffAt: '2026-11-03T17:30:00+08:00' }) })
  assert.equal(topPriority(later, NOW).title, '2 笔提现待审', 'far from the cutoff, a late withdrawal comes first')
  assert.equal(topPriority(today({ withdrawalReview: queue(2, 10) }, [{ code: 'hot_wallet_low', level: 'warn', message: '余额低' }]), NOW).title, '热钱包需要补充')
  assert.equal(topPriority(today({ kyc: queue(3, 20), mail: queue(5, 5) }), NOW).title, '未读邮件 5 件', 'otherwise the largest queue')
  assert.equal(topPriority(today({ kyc: queue(3, 20, { status: 'error' }) }), NOW), null, 'a failed queue is not shown as work')
})
