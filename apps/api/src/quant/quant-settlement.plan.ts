import { format18, parse18 } from '../basket/basket.decimals'
import { aggregateByUser, applyDay, dailyManagementRate, planRedemptions, stepIndex, type FeeTier, type IndexStep, type LotDay, type QuantLot, type RedemptionRequest, type RedemptionResult, type UserDay } from './quant.math'

/**
 * One trade date's full result, computed without touching the database. `post` books exactly this plan and the
 * admin preview shows exactly this plan, so what the operator sees before approving is what gets posted.
 */
export type SettlementPlanInput = {
  tradeDate: string
  grossReturnPct: string
  product: { mgmtFeeBps: number; perfFeeBps: number; indexValue: string; hwmIndex: string; redemptionFeeTiers: FeeTier[] }
  /** Lots already earning on the trade date (principal > 0, effective on or before it). */
  lots: QuantLot[]
  /** Pending redemptions due on or before the trade date, in queue order. */
  requests: RedemptionRequest[]
}

export type SettlementTotals = {
  usersCount: number
  principal: bigint
  gross: bigint
  mgmtFee: bigint
  perfFee: bigint
  paid: bigint
  principalLoss: bigint
  redemptionPrincipal: bigint
  redemptionFee: bigint
}

export type SettlementPlan = {
  indexBefore: bigint
  step: IndexStep
  /** Net return in percentage points at the stored precision (numeric(14,8)). */
  netReturnPct: string
  lotDays: LotDay[]
  users: UserDay[]
  redemption: { results: RedemptionResult[]; lotsAfter: Map<string, bigint> }
  /** Final principal per lot after the day's return and the redemptions. */
  principalAfter: Map<string, bigint>
  totals: SettlementTotals
}

export function planSettlementDay(input: SettlementPlanInput): SettlementPlan {
  const grossReturn = parse18(input.grossReturnPct) / 100n
  const mgmtDaily = dailyManagementRate(input.product.mgmtFeeBps)
  const indexBefore = parse18(input.product.indexValue)
  const step = stepIndex({ grossReturn, mgmtDaily, perfFeeBps: input.product.perfFeeBps, index: indexBefore, hwm: parse18(input.product.hwmIndex) })
  const lotDays = input.lots.map((lot) => applyDay(lot, grossReturn, mgmtDaily, step.perfFeeRate))
  const users = aggregateByUser(lotDays)
  const afterDay = input.lots.map((lot, i) => ({ ...lot, principal: lotDays[i].principalAfter }))
  const redemption = planRedemptions(afterDay, input.requests, input.tradeDate, input.product.redemptionFeeTiers)
  const principalAfter = new Map(input.lots.map((lot, i) => [lot.id, redemption.lotsAfter.get(lot.id) ?? lotDays[i].principalAfter]))
  const sum = (pick: (u: UserDay) => bigint) => users.reduce((total, u) => total + pick(u), 0n)
  return {
    indexBefore,
    step,
    netReturnPct: roundDecimal(step.netReturn * 100n, 8),
    lotDays,
    users,
    redemption,
    principalAfter,
    totals: {
      usersCount: users.length,
      principal: sum((u) => u.principalBefore),
      gross: sum((u) => u.gross),
      mgmtFee: sum((u) => u.mgmtFee),
      perfFee: sum((u) => u.perfFee),
      paid: sum((u) => u.paid),
      principalLoss: sum((u) => u.principalLoss),
      redemptionPrincipal: redemption.results.reduce((t, r) => t + r.principal, 0n),
      redemptionFee: redemption.results.reduce((t, r) => t + r.fee, 0n),
    },
  }
}

/** 18-decimal fixed point → decimal text with `places` digits, rounded half away from zero (as Postgres numeric does), trailing zeros trimmed. */
export function roundDecimal(value18: bigint, places: number): string {
  const unit = 10n ** BigInt(18 - places)
  const negative = value18 < 0n
  const abs = negative ? -value18 : value18
  const rounded = ((abs + unit / 2n) / unit) * unit
  return trimDecimal(format18(negative && rounded > 0n ? -rounded : rounded))
}

export function trimDecimal(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
