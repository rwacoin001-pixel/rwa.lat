import { monthlyWindow, progressiveReward } from '../../src/referral/referral-team.math'
const tiers = [{ fromAtomic: '0', toAtomic: '10000000000', rateBps: 500 }, { fromAtomic: '10000000000', toAtomic: '100000000000', rateBps: 1000 }, { fromAtomic: '100000000000', toAtomic: null, rateBps: 1500 }]
describe('monthly team reward arithmetic', () => {
  it('uses progressive segments rather than the highest rate on all fees', () => {
    expect(progressiveReward(12_000_000_000n, tiers)).toBe(700_000_000n)
    expect(progressiveReward(110_000_000_000n, tiers)).toBe(11_000_000_000n)
    expect(progressiveReward(-1n, tiers)).toBe(0n)
  })
  it('uses Asia/Shanghai month boundaries and refuses unfinished months', () => {
    expect(monthlyWindow('2026-09', new Date('2026-10-01T00:00:00Z'))).toEqual({ start: '2026-08-31T16:00:00.000Z', end: '2026-09-30T16:00:00.000Z' })
    expect(() => monthlyWindow('2026-10', new Date('2026-10-22T00:00:00Z'))).toThrow()
    expect(() => monthlyWindow('2026-13', new Date())).toThrow()
  })
})
