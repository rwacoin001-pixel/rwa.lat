/** Exact final evidence only. Closure, expiry and trading prices alone never settle money. */
export type PredictionResolutionMapping = {
  gammaMarketId: string
  conditionId: string | null
  tokens: Array<{ tokenId: string; outcome: string; outcomeIndex: number }>
}
export type PredictionResolution =
  | { status: 'resolved'; winnerTokenId: string }
  | { status: 'pending' | 'review'; reason: string }

export function inspectPredictionResolution(
  payload: Record<string, unknown>, local: PredictionResolutionMapping,
): PredictionResolution {
  if (payload.closed !== true || payload.umaResolutionStatus !== 'resolved') {
    return { status: 'pending', reason: 'upstream-not-final' }
  }
  if (payload.id !== local.gammaMarketId || !local.conditionId || payload.conditionId !== local.conditionId) {
    return { status: 'review', reason: 'market-identity-mismatch' }
  }
  const outcomes = strictStrings(payload.outcomes)
  const ids = strictStrings(payload.clobTokenIds)
  const prices = strictStrings(payload.outcomePrices)
  if (!outcomes || !ids || !prices || ids.length !== 2 || outcomes.length !== 2 || prices.length !== 2
    || new Set(ids).size !== 2 || new Set(outcomes).size !== 2 || local.tokens.length !== 2) {
    return { status: 'review', reason: 'unsupported-or-incomplete-outcomes' }
  }
  for (let i = 0; i < 2; i++) {
    const token = local.tokens.find(t => t.outcomeIndex === i)
    if (!token || token.tokenId !== ids[i] || token.outcome !== outcomes[i]) {
      return { status: 'review', reason: 'token-mapping-mismatch' }
    }
  }
  const exactZero = (v: string) => /^0(?:\.0+)?$/.test(v)
  const exactOne = (v: string) => /^1(?:\.0+)?$/.test(v)
  if (exactOne(prices[0]) && exactZero(prices[1])) return { status: 'resolved', winnerTokenId: ids[0] }
  if (exactZero(prices[0]) && exactOne(prices[1])) return { status: 'resolved', winnerTokenId: ids[1] }
  // Split/invalid/50-50 outcomes need explicit review under the platform's existing void policy.
  return { status: 'review', reason: 'unsupported-final-payout-vector' }
}

function strictStrings(value: unknown): string[] | null {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return null }
  }
  return Array.isArray(parsed) && parsed.every(v => typeof v === 'string' && v.length > 0) ? parsed : null
}
