import { planRewards, rewardAmount } from '../../src/referral/referral-rewards'

describe('referral reward planning', () => {
  it('floors base × rate / 10000 and rejects invalid rates', () => {
    expect(rewardAmount(100_000_000n, 600)).toBe(6_000_000n)
    expect(rewardAmount(33n, 2000)).toBe(6n)
    expect(rewardAmount(1n, 100)).toBe(0n)
    expect(rewardAmount(100n, 0)).toBe(0n)
    expect(rewardAmount(100n, 10_001)).toBe(0n)
    expect(rewardAmount(-5n, 100)).toBe(0n)
  })

  it('pays each of levels 1–3 once, never the source user, skipping zero amounts', () => {
    const plan = planRewards(1_000_000n, [600, 300, 100], [
      { user_id: 'c', level: 1 }, { user_id: 'b', level: 2 }, { user_id: 'a', level: 3 }, { user_id: 'z', level: 4 },
    ], 'd')
    expect(plan).toEqual([
      { userId: 'c', level: 1, rateBps: 600, amountAtomic: 60_000n },
      { userId: 'b', level: 2, rateBps: 300, amountAtomic: 30_000n },
      { userId: 'a', level: 3, rateBps: 100, amountAtomic: 10_000n },
    ])
    expect(planRewards(1_000_000n, [600, 300, 100], [{ user_id: 'd', level: 1 }], 'd')).toEqual([])
    expect(planRewards(10n, [600, 300, 100], [{ user_id: 'c', level: 1 }], 'd')).toEqual([])
    expect(planRewards(1_000_000n, [600, 300, 100], [{ user_id: 'c', level: 1 }, { user_id: 'c', level: 2 }], 'd')).toHaveLength(1)
  })
})
