/** Discovery/purchase visibility only; never apply this to positions or bet history. */
export type PredictionLifecycle = {
  active?: boolean
  archived?: boolean
  closed?: boolean
  resolved?: boolean
  acceptingOrders?: boolean
  endAt?: string | null
  endDate?: string | null
  endDateIso?: string | null
}

export function predictionEndAt(market: PredictionLifecycle): string | null {
  for (const value of [market.endAt, market.endDate, market.endDateIso]) {
    if (value && Number.isFinite(Date.parse(value))) return value
  }
  return null
}

export function hasPredictionEnded(market: PredictionLifecycle, now = Date.now()): boolean {
  if (market.closed === true || market.resolved === true) return true
  const endAt = predictionEndAt(market)
  return endAt !== null && Date.parse(endAt) <= now
}

export function isPredictionDiscoverable(market: PredictionLifecycle, now = Date.now()): boolean {
  return market.active !== false && market.archived !== true && !hasPredictionEnded(market, now)
}

export function isPredictionAcceptingOrders(market: PredictionLifecycle, now = Date.now()): boolean {
  return isPredictionDiscoverable(market, now) && market.acceptingOrders !== false
}

/** Filtering retains the provider's order and never invents an unknown deadline. */
export function openPredictionItems<T extends PredictionLifecycle>(items: readonly T[], now = Date.now()): T[] {
  return items.filter(item => isPredictionDiscoverable(item, now))
}
