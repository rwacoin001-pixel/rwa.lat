import {
  calculateProductQuantityAtomic,
  calculateSettlementPayoutAtomic,
  isUsdUsdtEquivalent,
} from '../../src/financial/amounts'

describe('order amount precision conversions', () => {
  it('uses settlement, product, and quote decimal scales when calculating quantity', () => {
    // 2.469 USDT buys 2 units at 1.2345 USD per unit.
    expect(calculateProductQuantityAtomic(2_469_000n, 6, 2, 4, 12_345n)).toBe(200n)
  })

  it('returns settlement atomics with the configured scale when redeeming', () => {
    // 2 units at 1.2345 USD per unit returns 2.469 USDT.
    expect(calculateSettlementPayoutAtomic(200n, 2, 4, 6, 12_345n)).toBe(2_469_000n)
  })

  it('allows only the explicitly approved USD and USDT 1:1 quote currencies', () => {
    expect(isUsdUsdtEquivalent('USD')).toBe(true)
    expect(isUsdUsdtEquivalent('USDT')).toBe(true)
    expect(isUsdUsdtEquivalent('EUR')).toBe(false)
  })
})
