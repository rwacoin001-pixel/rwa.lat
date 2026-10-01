export type PredictionBetEstimateInput = {
  stakeAtomic: string | null
  decimals: number
  price: number | null
  placeFeeRate: number
  payoutFeeRate: number
}

export function estimatePredictionBet({
  stakeAtomic,
  decimals,
  price,
  placeFeeRate,
  payoutFeeRate,
}: PredictionBetEstimateInput) {
  const stake = stakeAtomic ? BigInt(stakeAtomic) : null
  const placeFeeAtomic = stake !== null && placeFeeRate > 0
    ? (stake * BigInt(Math.round(placeFeeRate * 10_000))) / BigInt(10_000)
    : BigInt(0)
  const risk = stake === null ? null : stake - placeFeeAtomic
  const shares = risk !== null && risk > BigInt(0) && decimals >= 0
    && price !== null && Number.isFinite(price) && price > 0
    ? Number(risk) / (10 ** decimals) / price
    : null
  const grossPayout = shares
  const payoutFee = shares !== null ? shares * payoutFeeRate : null
  const netPayout = shares !== null && payoutFee !== null ? shares - payoutFee : null
  const stakeAmount = stake !== null && decimals >= 0 ? Number(stake) / (10 ** decimals) : null

  return { stakeAmount, placeFeeAtomic, shares, grossPayout, payoutFee, netPayout }
}
