/**
 * Koala Quant settlement arithmetic. Pure functions on BigInt so the same numbers are reproducible in tests,
 * in the posting plan and in the audit trail.
 *
 * Amounts are USDT atomic units (6 decimals); rates are 18-decimal fixed point fractions (0.01 = 1%).
 * Model: every lot keeps a fixed principal. Each day the net return is applied to that principal; a profit is
 * paid out to the user's available balance the same day, a loss reduces the principal.
 */
export const ONE = 10n ** 18n

export type QuantLot = { id: string; userId: string; principal: bigint; effectiveDate: string }
export type FeeTier = { maxDays: number; bps: number }

export type IndexStep = { netReturn: bigint; indexAfter: bigint; hwmAfter: bigint; perfFeeRate: bigint }

/** Daily management fee as a fraction of principal (annual bps / 365). */
export function dailyManagementRate(annualBps: number): bigint {
  return (BigInt(annualBps) * ONE) / (10_000n * 365n)
}

/**
 * Advances the product index by one day. The performance fee is charged only on the part of the move that lifts the
 * index above its previous high-water mark, so a loss has to be recovered before any new performance fee.
 */
export function stepIndex(input: { grossReturn: bigint; mgmtDaily: bigint; perfFeeBps: number; index: bigint; hwm: bigint }): IndexStep {
  const netReturn = input.grossReturn - input.mgmtDaily
  const indexAfter = (input.index * (ONE + netReturn)) / ONE
  if (indexAfter <= 0n) throw new Error('A daily return of -100% or worse is not allowed')
  const base = input.index > input.hwm ? input.index : input.hwm
  let perfFeeRate = 0n
  if (netReturn > 0n && indexAfter > base) {
    perfFeeRate = (BigInt(input.perfFeeBps) * (indexAfter - base) * ONE) / (10_000n * input.index)
  }
  return { netReturn, indexAfter, hwmAfter: indexAfter > input.hwm ? indexAfter : input.hwm, perfFeeRate }
}

export type LotDay = { lotId: string; userId: string; principalBefore: bigint; gross: bigint; mgmtFee: bigint; perfFee: bigint; net: bigint; principalAfter: bigint; paid: bigint }

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

/** One lot's result for the day. `gross` truncates toward zero; fees round up in the platform's favour but never exceed the profit they are charged on. */
export function applyDay(lot: QuantLot, grossReturn: bigint, mgmtDaily: bigint, perfFeeRate: bigint): LotDay {
  const gross = (lot.principal * grossReturn) / ONE
  const mgmtFee = ceilDiv(lot.principal * mgmtDaily, ONE)
  let perfFee = 0n
  const afterMgmt = gross - mgmtFee
  if (perfFeeRate > 0n && afterMgmt > 0n) {
    perfFee = ceilDiv(lot.principal * perfFeeRate, ONE)
    if (perfFee > afterMgmt) perfFee = afterMgmt
  }
  const net = afterMgmt - perfFee
  const principalAfter = net < 0n ? lot.principal + net : lot.principal
  if (principalAfter < 0n) throw new Error('Principal cannot go below zero')
  return { lotId: lot.id, userId: lot.userId, principalBefore: lot.principal, gross, mgmtFee, perfFee, net, principalAfter, paid: net > 0n ? net : 0n }
}

export type UserDay = { userId: string; principalBefore: bigint; gross: bigint; mgmtFee: bigint; perfFee: bigint; net: bigint; paid: bigint; principalLoss: bigint }

export function aggregateByUser(days: LotDay[]): UserDay[] {
  const byUser = new Map<string, UserDay>()
  for (const day of days) {
    const row = byUser.get(day.userId) ?? { userId: day.userId, principalBefore: 0n, gross: 0n, mgmtFee: 0n, perfFee: 0n, net: 0n, paid: 0n, principalLoss: 0n }
    row.principalBefore += day.principalBefore
    row.gross += day.gross
    row.mgmtFee += day.mgmtFee
    row.perfFee += day.perfFee
    row.net += day.net
    row.paid += day.paid
    row.principalLoss += day.principalBefore - day.principalAfter
    byUser.set(day.userId, row)
  }
  return [...byUser.values()]
}

/** Redemption fee for principal held `days` days: the first tier whose `maxDays` is above the holding period. */
export function redemptionFeeBps(tiers: FeeTier[], days: number): number {
  const sorted = [...tiers].sort((a, b) => a.maxDays - b.maxDays)
  return sorted.find((tier) => days < tier.maxDays)?.bps ?? 0
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.max(0, Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000))
}

export type RedemptionRequest = { orderId: string; userId: string; amount: bigint | null }
export type RedemptionResult = { orderId: string; userId: string; principal: bigint; fee: bigint; payout: bigint; consumed: Array<{ lotId: string; amount: bigint }> }

/**
 * Pays redemption requests out of the lots, oldest first. `amount: null` redeems everything the user still holds.
 * A request larger than what is left (after a loss) is capped at what is left.
 */
export function planRedemptions(
  lots: Array<{ id: string; userId: string; principal: bigint; effectiveDate: string }>,
  requests: RedemptionRequest[],
  tradeDate: string,
  tiers: FeeTier[],
): { results: RedemptionResult[]; lotsAfter: Map<string, bigint> } {
  const remaining = new Map(lots.map((lot) => [lot.id, lot.principal]))
  const ordered = [...lots].sort((a, b) => (a.effectiveDate === b.effectiveDate ? a.id.localeCompare(b.id) : a.effectiveDate.localeCompare(b.effectiveDate)))
  const results: RedemptionResult[] = []
  for (const request of requests) {
    const mine = ordered.filter((lot) => lot.userId === request.userId)
    const held = mine.reduce((sum, lot) => sum + (remaining.get(lot.id) ?? 0n), 0n)
    let want = request.amount === null ? held : request.amount < held ? request.amount : held
    const consumed: Array<{ lotId: string; amount: bigint }> = []
    let fee = 0n
    const principal = want
    for (const lot of mine) {
      if (want <= 0n) break
      const left = remaining.get(lot.id) ?? 0n
      if (left <= 0n) continue
      const take = left < want ? left : want
      remaining.set(lot.id, left - take)
      want -= take
      consumed.push({ lotId: lot.id, amount: take })
      fee += ceilDiv(take * BigInt(redemptionFeeBps(tiers, daysBetween(lot.effectiveDate, tradeDate))), 10_000n)
    }
    results.push({ orderId: request.orderId, userId: request.userId, principal, fee, payout: principal - fee, consumed })
  }
  return { results, lotsAfter: remaining }
}

/** Ledger deltas (credit-normal accounts: positive = credit, negative = debit) for one user's day. Sums to zero across treasury, pool, fee and user. */
export function dayDeltas(day: Pick<UserDay, 'net' | 'mgmtFee' | 'perfFee'>): { user: bigint; pool: bigint; fee: bigint; treasury: bigint } {
  const fee = day.mgmtFee + day.perfFee
  const user = day.net > 0n ? day.net : 0n
  const pool = day.net < 0n ? day.net : 0n
  return { user, pool, fee, treasury: -(user + pool + fee) }
}
