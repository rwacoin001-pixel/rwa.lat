import { test } from 'node:test'
import assert from 'node:assert/strict'
import { faceFor, money, moneyFull, sameEntry, sgDateLabel, waitBucket, waited } from '../src/components/ops/format.ts'
import { alertText, topPriority } from '../src/components/ops/queues.ts'

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
const CUTOFF = '2026-11-03T07:00:00.000Z' // 15:00 Singapore
function today(overrides = {}, alerts = []) {
  const queues = Object.fromEntries(KEYS.map((k) => [k, queue(0, null)]))
  queues.quantSettlement = queue(0, null, { state: 'posted', tradeDate: '2026-11-01', cutoffAt: CUTOFF, overdue: false })
  return { generatedAt: '', queues: { ...queues, ...overrides }, today: {}, alerts }
}
const due = (state, extra = {}) => queue(1, 13 * 60, { state, tradeDate: '2026-11-02', cutoffAt: CUTOFF, overdue: false, ...extra })

test('the first thing to do: paused withdrawals, then the quant cutoff, then late withdrawals, then the hot wallet', () => {
  assert.equal(topPriority(null), null)
  assert.equal(topPriority(today(), NOW), null)
  assert.equal(topPriority(today({ withdrawalReview: queue(2, 45) }, [{ kind: 'withdrawalExecutionPaused', severity: 'critical', at: null, detail: { reason: '维护' } }]), NOW).title, '提现执行已暂停')
  const quant = today({ withdrawalReview: queue(2, 45), quantSettlement: due('none') })
  assert.equal(topPriority(quant, NOW).title, '量化 2026-11-02 结算还没录入')
  assert.equal(topPriority(quant, NOW).detail, '离截止还有 120 分钟')
  assert.equal(topPriority(today({ quantSettlement: due('draft', { overdue: true }) }), NOW + 3 * 3600000).detail, '已过截止时间')
  assert.equal(topPriority(today({ withdrawalReview: queue(2, 45), quantSettlement: due('none') }), NOW - 3 * 3600000 + 0).title.includes('结算'), false, 'far from the cutoff, a late withdrawal comes first')
  assert.equal(topPriority(today({ withdrawalReview: queue(2, 10) }, [{ kind: 'hotWalletLow', severity: 'warning', at: null, detail: { usdtAtomic: '6120000000', queuedWithdrawalsAtomic: '7000000000', shortUsdt: true } }]), NOW).title, '热钱包需要处理')
  assert.equal(topPriority(today({ kyc: queue(3, 20), mail: queue(5, 5) }), NOW).title, '未读邮件 5 件', 'otherwise the largest queue')
  assert.equal(topPriority(today({ kyc: queue(3, 20, { status: 'error' }) }), NOW), null, 'a failed queue is not shown as work')
})

test('alerts read as one plain line from their detail', () => {
  assert.equal(alertText({ kind: 'hotWalletLow', severity: 'critical', at: null, detail: { usdtAtomic: '6120000000', queuedWithdrawalsAtomic: '7000000000', shortUsdt: true, shortTrx: true } }), '热钱包不足：USDT 余额 6,120.00，少于待执行提现 7,000.00；TRX 不够支付链上手续费')
  assert.equal(alertText({ kind: 'deadJobs', severity: 'warning', at: null, detail: { count: 3 } }), '3 个后台任务失败，需要重试')
  assert.equal(alertText({ kind: 'withdrawalExecutionPaused', severity: 'critical', at: null, detail: { reason: null } }), '提现执行已暂停')
})

test('newArrivals reports only watched queues that grew, and nothing on the first poll', async () => {
  const { newArrivals } = await import('../src/components/ops/queues.ts')
  const day = (q) => ({ queues: Object.fromEntries(Object.entries(q).map(([k, count]) => [k, { count, oldestAt: null, status: count < 0 ? 'error' : 'ok' }])) })
  const a = day({ withdrawalReview: 1, kyc: 2, mail: 0, accountClosures: -1 })
  const b = day({ withdrawalReview: 3, kyc: 2, mail: 5, accountClosures: 4 })
  assert.deepEqual(newArrivals(null, b), [])
  assert.deepEqual(newArrivals(a, b).map((x) => [x.key, x.added]), [['withdrawalReview', 2]])
  assert.deepEqual(newArrivals(b, a), [])
})
