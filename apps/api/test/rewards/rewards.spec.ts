import { randomUUID } from 'node:crypto'
import { RewardsService, eligibilityReason, pickPrize, type Prize } from '../../src/rewards/rewards.service'
import { couponDiscount, finishWithdrawalCoupon } from '../../src/rewards/reward-coupons'
import { WalletNetworkRegistry } from '../../src/wallet/wallet-network.registry'
import type { Draw } from '../../src/rewards/rewards.dto'

const prizes: Prize[] = [
  { code: 'points_10', kind: 'points', points: 10, weight: 60, active: true, coupon_kind: null, coupon_max_atomic: null, daily_cap: null },
  { code: 'points_30', kind: 'points', points: 30, weight: 25, active: true, coupon_kind: null, coupon_max_atomic: null, daily_cap: null },
  { code: 'prediction_fee', kind: 'coupon', points: null, weight: 10, active: true, coupon_kind: 'prediction_place_fee', coupon_max_atomic: '500000', daily_cap: 2 },
  { code: 'withdrawal_fee', kind: 'coupon', points: null, weight: 5, active: true, coupon_kind: 'withdrawal_fee', coupon_max_atomic: null, daily_cap: null },
]
describe('reward prize selection', () => {
  it('assigns exactly 60 / 25 / 10 / 5 integer tickets without depending on balances or card data', () => {
    const counts: Record<string, number> = {}
    for (let ticket = 0; ticket < 100; ticket++) {
      const { prize } = pickPrize(prizes, {}, 0n, 50000000n, 1000000n, max => { expect(max).toBe(100); return ticket })
      counts[prize.code] = (counts[prize.code] ?? 0) + 1
    }
    expect(counts).toEqual({ points_10: 60, points_30: 25, prediction_fee: 10, withdrawal_fee: 5 })
  })
  it('falls back to 10 points on a capped or over-budget coupon, preserving the 30-point weight', () => {
    expect(pickPrize(prizes, { prediction_fee: 2 }, 0n, 50000000n, 1000000n, () => 85).prize.code).toBe('points_10')
    expect(pickPrize(prizes, {}, 49500001n, 50000000n, 1000000n, () => 85).prize.code).toBe('points_10')
    expect(pickPrize(prizes, {}, 49500000n, 50000000n, 1000000n, () => 85).face).toBe(500000n)
    expect(pickPrize(prizes, {}, 50000000n, 50000000n, 1000000n, () => 60).prize.points).toBe(30)
  })
  it('snapshots the withdrawal face and excludes inactive prizes', () => {
    expect(pickPrize(prizes, {}, 0n, 50000000n, 12000000n, () => 95).face).toBe(12000000n)
    expect(pickPrize(prizes, {}, 49000000n, 50000000n, 12000000n, () => 95).prize.points).toBe(10)
    expect(pickPrize(prizes.map(p => ({ ...p, active: p.code !== 'withdrawal_fee' })), {}, 0n, 50000000n, 1n, max => max - 1).prize.code).toBe('prediction_fee')
  })
})
describe('reward eligibility', () => {
  it('gives existing immutable draws priority over age and deleted cards', () => {
    expect(eligibilityReason({ state: 'granted' } as Draw, false, false)).toBe('drawn')
    expect(eligibilityReason({ state: 'frozen' } as Draw, true, false)).toBe('frozen')
    expect(eligibilityReason(null, false, true)).toBe('too_new')
    expect(eligibilityReason(null, true, false)).toBe('no_card_today')
    expect(eligibilityReason(null, true, true)).toBe('ok')
  })
})
describe('points exchange', () => {
  function fixture(points: number, exchanged = false, live = true, issued = '0') {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM app.reward_campaigns')) return [{ live, points_per_coupon: 100, exchange_coupon_max_atomic: '500000', daily_coupon_budget_atomic: '50000000' }]
      if (sql.includes('sum(max_discount_atomic)')) return [{ face: issued }]
      if (sql.includes("SELECT id FROM app.user_points_ledger")) return exchanged ? [{ id: randomUUID() }] : []
      if (sql.includes('sum(delta)')) return [{ points: String(points) }]
      return []
    })
    const service = new RewardsService({ transaction: async (fn: Function) => fn({ query }) } as never, new WalletNetworkRegistry())
    return { query, service }
  }
  it('rejects a low balance before issuing a coupon or debiting points, after taking a user transaction lock', async () => {
    const { service, query } = fixture(99)
    await expect(service.exchange(randomUUID(), 'exchange-low')).rejects.toMatchObject({ response: { code: 'REWARD_POINTS_LOW' } })
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
    expect(query.mock.calls.some(([s]) => s.includes('INSERT'))).toBe(false)
  })
  it('enforces the SG daily limit even when there are enough points', async () => {
    const { service, query } = fixture(200, true)
    await expect(service.exchange(randomUUID(), 'exchange-again')).rejects.toMatchObject({ response: { code: 'REWARD_EXCHANGE_LIMIT' } })
    expect(query.mock.calls.some(([s]) => s.includes('INSERT'))).toBe(false)
  })
  it('hides every service entry point when not live, including missing-key writes', async () => {
    const { service } = fixture(0, false, false), user = randomUUID()
    for (const work of [() => service.today(user), () => service.draw(user, '', null), () => service.wallet(user), () => service.points(user), () => service.exchange(user, '')]) {
      await expect(work()).rejects.toMatchObject({ status: 404 })
    }
  })
  it('does not spend points when the daily face-value budget cannot cover an exchange', async () => {
    const { service, query } = fixture(150, false, true, '49999999')
    await expect(service.exchange(randomUUID(), 'budget')).rejects.toMatchObject({ response: { code: 'REWARD_COUPON_BUDGET_EXHAUSTED' } })
    expect(query.mock.calls.some(([s]) => s.includes('INSERT'))).toBe(false)
  })
})
describe('coupon money boundary', () => {
  it.each([['100000', 100000n], ['500000', 300000n], ['900719925474099312345', 300000n]])('caps face %s by the fee using bigint', async (face, expected) => {
    const query = jest.fn(async () => [{ state: 'available', kind: 'prediction_place_fee', valid: true, max_discount_atomic: face }])
    expect(await couponDiscount({ query } as never, 'owner', 'coupon', 'prediction_place_fee', 300000n)).toBe(expected)
    expect((query.mock.calls as unknown[][])[0][0]).toContain('FOR UPDATE')
  })
  it.each([undefined, { state: 'used', valid: true, kind: 'withdrawal_fee' }, { state: 'available', valid: false, kind: 'withdrawal_fee' }, { state: 'available', valid: true, kind: 'prediction_place_fee' }])('rejects wrong owner, consumed, expired or wrong-kind coupons', async c => {
    await expect(couponDiscount({ query: async () => c ? [c] : [] } as never, 'owner', 'coupon', 'withdrawal_fee', 1000000n)).rejects.toMatchObject({ response: { code: 'REWARD_COUPON_INVALID' } })
  })
  it('records the original fee on completion and returns refunded coupons to available', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('SELECT') ? [{ id: 'coupon' }] : [])
    const w = { id: 'withdrawal', user_id: 'owner', coupon_id: 'coupon', fee_atomic_amount: '0', fee_discount_atomic: '500000' }
    await finishWithdrawalCoupon({ query } as never, w, true)
    expect(query.mock.calls.some(([s]) => s.includes('coupon_redemptions'))).toBe(true)
    expect((query.mock.calls as unknown[][]).find(([s]) => String(s).includes('coupon_redemptions'))?.[1]).toEqual(['coupon', 'owner', 'withdrawal', 'withdrawal', '500000', '500000'])
    query.mockClear()
    await finishWithdrawalCoupon({ query } as never, w, false)
    expect(query.mock.calls.some(([s]) => s.includes("state='available'"))).toBe(true)
    expect(query.mock.calls.some(([s]) => s.includes('coupon_redemptions'))).toBe(false)
  })
})
