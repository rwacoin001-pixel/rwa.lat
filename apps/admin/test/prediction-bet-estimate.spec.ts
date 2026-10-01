import { estimatePredictionBet } from '../../../lib/prediction-bet-estimate'

describe('prediction bet estimate', () => {
  it('shows estimated shares and net winnings for a valid stake independently of wallet balance', () => {
    const estimate = estimatePredictionBet({
      stakeAtomic: '100000000',
      decimals: 6,
      price: 0.8,
      placeFeeRate: 0.03,
      payoutFeeRate: 0.03,
    })

    expect(estimate.placeFeeAtomic).toBe(3_000_000n)
    expect(estimate.shares).toBeCloseTo(121.25, 8)
    expect(estimate.grossPayout).toBeCloseTo(121.25, 8)
    expect(estimate.payoutFee).toBeCloseTo(3.6375, 8)
    expect(estimate.netPayout).toBeCloseTo(117.6125, 8)
  })
})
