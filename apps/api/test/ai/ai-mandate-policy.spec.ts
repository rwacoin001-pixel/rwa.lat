import { normalizeMandate, parseAutomaticAllocation, validateAction } from '../../src/ai/ai-mandate.policy'

const productId = 'c8e05dbd-3e90-46c4-90e6-e1b3625b26ac'
const mandate = {
  allowedProductIds: [productId], positions: [], cashBudgetAtomic: '100000000', cashReserveAtomic: '10000000', maxManagedValueAtomic: '200000000',
  maxActionAtomic: '40000000', maxDailyTurnoverAtomic: '80000000', maxTotalTurnoverAtomic: '1000000000',
  riskBand: 'balanced', maxProductWeightBps: 6000, maxUnrealizedLossBps: 2000, horizonDays: 365, maxLockDays: 30,
  maxFeeBps: 100, maxFeeAtomic: '500000', allowBuy: true, allowRedeem: true, reinvestProceeds: true,
  scheduleIntervalMinutes: 60, minTradeIntervalMinutes: 120, rebalanceThresholdBps: 500,
  effectiveAt: '2026-09-30T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z', goals: '现金与分散投资', locale: 'zh-CN', notifications: ['in_app'],
}
const rule = { productId, riskBand: 'balanced', lockDays: 0, buyFeeBps: 50, buyFeeFixedAtomic: '0', redeemFeeBps: 50, redeemFeeFixedAtomic: '0', revision: 1 }

describe('User-confirmed mandate and untrusted dynamic allocation', () => {
  it('requires explicit complete financial limits and exact product scopes', () => {
    expect(normalizeMandate(mandate)).toMatchObject({ cashBudgetAtomic: '100000000', positions: [] })
    for (const patch of [{ maxActionAtomic: undefined }, { allowRedeem: 'yes' }, { cashBudgetAtomic: '1.0' }, { maxFeeBps: undefined }, { allowedProductIds: [productId, productId] }, { expiresAt: mandate.effectiveAt }, { maxLockDays: 366 }]) expect(() => normalizeMandate({ ...mandate, ...patch })).toThrow()
  })
  it('rejects invented IDs, concentration breaches, wrong sums and proposed executable commands', () => {
    const valid = { cashBps: 4000, allocations: [{ productId, weightBps: 6000, reason: '分散与流动性' }], explanation: '保留现金' }
    expect(parseAutomaticAllocation(JSON.stringify(valid), mandate as any, [rule] as any)).toMatchObject(valid)
    for (const value of [{ ...valid, cashBps: 3999 }, { ...valid, allocations: [{ productId, weightBps: 7000, reason: '超限' }], cashBps: 3000 }, { ...valid, allocations: [{ productId: 'other', weightBps: 6000, reason: '不存在' }] }, { ...valid, execute: 'withdraw' }, { ...valid, allocations: [...valid.allocations, ...valid.allocations] }]) expect(() => parseAutomaticAllocation(JSON.stringify(value), mandate as any, [rule] as any)).toThrow()
  })
  it('checks remaining budgets, actual cash reserve, fees, risk and lock conditions', () => {
    const action = { kind: 'buy', productId, notionalAtomic: '20000000', availableAtomic: '100000000', managedCashAtomic: '100000000', spentDailyAtomic: '0', spentTotalAtomic: '0', now: new Date('2026-10-01T00:00:00Z') }
    expect(validateAction(mandate as any, rule as any, action as any)).toMatchObject({ feeAtomic: '100000' })
    for (const [rulePatch, actionPatch] of [[{}, { notionalAtomic: '50000000' }], [{ riskBand: 'aggressive' }, {}], [{ lockDays: 31 }, {}], [{ buyFeeBps: 101 }, {}], [{ buyFeeFixedAtomic: undefined }, {}], [{}, { availableAtomic: '25000000' }], [{}, { managedCashAtomic: '19000000' }], [{}, { spentDailyAtomic: '70000000' }], [{}, { now: new Date('2027-01-01') }]]) expect(() => validateAction(mandate as any, { ...rule, ...rulePatch } as any, { ...action, ...actionPatch } as any)).toThrow()
  })
  it('requires a verified unlock date and separate permissions for redemptions and reinvestment', () => {
    const action = { kind: 'redeem', productId, notionalAtomic: '20000000', availableAtomic: '0', managedCashAtomic: '0', spentDailyAtomic: '0', spentTotalAtomic: '0', now: new Date('2026-10-01T00:00:00Z') }
    expect(() => validateAction(mandate as any, { ...rule, lockDays: 1 } as any, action as any)).toThrow()
    expect(() => validateAction({ ...mandate, allowRedeem: false } as any, rule as any, action as any)).toThrow()
    expect(validateAction(mandate as any, { ...rule, lockDays: 1 } as any, { ...action, unlockAt: '2026-09-30T12:00:00Z' } as any)).toMatchObject({ feeAtomic: '100000' })
  })
  it('counts fixed fees toward the effective rate and uses all-in buy amounts without charging twice', () => {
    const action = { kind: 'buy', productId, notionalAtomic: '20000000', availableAtomic: '30000000', managedCashAtomic: '20000000', spentDailyAtomic: '0', spentTotalAtomic: '0', now: new Date('2026-10-01T00:00:00Z') }
    expect(validateAction(mandate as any, { ...rule, buyFeeFixedAtomic: '100000' } as any, action as any)).toEqual({ feeAtomic: '200000' })
    expect(() => validateAction(mandate as any, { ...rule, buyFeeFixedAtomic: '100001' } as any, action as any)).toThrow('Fees exceed')
    expect(() => validateAction(mandate as any, rule as any, { ...action, availableAtomic: '29999999' } as any)).toThrow('cash reserve')
  })
})
