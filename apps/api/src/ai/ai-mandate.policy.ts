import { AI_LOCALES } from './ai-knowledge.dto'

export const AI_MANDATE_TERMS_VERSION = 'rwa-ai-2026-09-30.v1'
export const AI_RISK_BANDS = ['conservative', 'balanced', 'growth', 'aggressive'] as const
export type AiRiskBand = typeof AI_RISK_BANDS[number]
export interface ManagedPositionInput { positionId: string; quantityAtomic: string }
export interface AiMandateContent {
  allowedProductIds: string[]; positions: ManagedPositionInput[]; cashBudgetAtomic: string; cashReserveAtomic: string; maxManagedValueAtomic: string
  maxActionAtomic: string; maxDailyTurnoverAtomic: string; maxTotalTurnoverAtomic: string
  riskBand: AiRiskBand; maxProductWeightBps: number; maxUnrealizedLossBps: number; horizonDays: number; maxLockDays: number
  maxFeeBps: number; maxFeeAtomic: string; allowBuy: boolean; allowRedeem: boolean; reinvestProceeds: boolean
  scheduleIntervalMinutes: number; minTradeIntervalMinutes: number; rebalanceThresholdBps: number
  effectiveAt: string; expiresAt: string; goals: string; locale: string; notifications: string[]
}
export interface AiExecutionRule {
  productId: string; riskBand: AiRiskBand; lockDays: number; buyFeeBps: number; buyFeeFixedAtomic: string
  redeemFeeBps: number; redeemFeeFixedAtomic: string; revision: number
}
export interface AiAutomaticAllocation {
  cashBps: number; explanation: string; allocations: Array<{ productId: string; weightBps: number; reason: string }>
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function atomic(value: unknown, positive = false): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value) || (positive && BigInt(value) <= 0n)) throw new Error('A valid integer atomic amount is required')
  return BigInt(value)
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error('A valid explicit integer limit is required')
  return value
}
function uuid(value: unknown): string { if (typeof value !== 'string' || !UUID.test(value)) throw new Error('Invalid scope identifier'); return value.toLowerCase() }
function date(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('A valid explicit date is required'); return new Date(value).toISOString() }
export function riskRank(band: string): number { const rank = (AI_RISK_BANDS as readonly string[]).indexOf(band); if (rank < 0) throw new Error('Unknown risk classification'); return rank }

/** No financial limit or permission has a fallback value. */
export function normalizeMandate(value: unknown): AiMandateContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Mandate terms are required')
  const input = value as Record<string, any>
  if (!Array.isArray(input.allowedProductIds) || input.allowedProductIds.length < 1 || input.allowedProductIds.length > 30) throw new Error('An explicit product scope is required')
  const allowedProductIds = input.allowedProductIds.map(uuid).sort()
  if (new Set(allowedProductIds).size !== allowedProductIds.length) throw new Error('Duplicate product scope')
  if (!Array.isArray(input.positions) || input.positions.length > 30) throw new Error('An explicit position scope is required')
  const positions = input.positions.map((position: any) => ({ positionId: uuid(position?.positionId), quantityAtomic: atomic(position?.quantityAtomic, true).toString() })).sort((a: ManagedPositionInput, b: ManagedPositionInput) => a.positionId.localeCompare(b.positionId))
  if (new Set(positions.map((position: ManagedPositionInput) => position.positionId)).size !== positions.length) throw new Error('Duplicate position scope')
  const amounts: Record<string, string> = {}
  for (const key of ['cashBudgetAtomic', 'cashReserveAtomic', 'maxManagedValueAtomic', 'maxActionAtomic', 'maxDailyTurnoverAtomic', 'maxTotalTurnoverAtomic', 'maxFeeAtomic']) amounts[key] = atomic(input[key], ['maxManagedValueAtomic', 'maxActionAtomic', 'maxDailyTurnoverAtomic', 'maxTotalTurnoverAtomic'].includes(key)).toString()
  if (atomic(amounts.cashBudgetAtomic) > atomic(amounts.maxManagedValueAtomic) || atomic(amounts.maxActionAtomic) > atomic(amounts.maxDailyTurnoverAtomic) || atomic(amounts.maxActionAtomic) > atomic(amounts.maxManagedValueAtomic) || atomic(amounts.maxDailyTurnoverAtomic) > atomic(amounts.maxTotalTurnoverAtomic)) throw new Error('Financial limits are inconsistent')
  riskRank(input.riskBand)
  for (const key of ['allowBuy', 'allowRedeem', 'reinvestProceeds']) if (typeof input[key] !== 'boolean') throw new Error('Explicit action permissions are required')
  if ((!input.allowBuy && !input.allowRedeem) || (input.reinvestProceeds && (!input.allowBuy || !input.allowRedeem))) throw new Error('Action permissions are inconsistent')
  const effectiveAt = date(input.effectiveAt), expiresAt = date(input.expiresAt)
  if (Date.parse(expiresAt) <= Date.parse(effectiveAt)) throw new Error('Expiry must follow the effective date')
  if (typeof input.goals !== 'string' || !input.goals.trim() || input.goals.length > 2000 || !AI_LOCALES.includes(input.locale)) throw new Error('Explicit goals and language are required')
  if (!Array.isArray(input.notifications) || !input.notifications.includes('in_app') || input.notifications.some((channel: unknown) => !['in_app', 'email'].includes(channel as string)) || new Set(input.notifications).size !== input.notifications.length) throw new Error('Select valid notifications including the account notification record')
  const horizonDays = integer(input.horizonDays, 1, 3650), maxLockDays = integer(input.maxLockDays, 0, horizonDays)
  return {
    allowedProductIds, positions, ...(amounts as Pick<AiMandateContent, 'cashBudgetAtomic' | 'cashReserveAtomic' | 'maxManagedValueAtomic' | 'maxActionAtomic' | 'maxDailyTurnoverAtomic' | 'maxTotalTurnoverAtomic' | 'maxFeeAtomic'>),
    riskBand: input.riskBand, maxProductWeightBps: integer(input.maxProductWeightBps, 1, 10000), maxUnrealizedLossBps: integer(input.maxUnrealizedLossBps, 1, 10000), horizonDays, maxLockDays,
    maxFeeBps: integer(input.maxFeeBps, 0, 10000), allowBuy: input.allowBuy, allowRedeem: input.allowRedeem, reinvestProceeds: input.reinvestProceeds,
    scheduleIntervalMinutes: integer(input.scheduleIntervalMinutes, 15, 10080), minTradeIntervalMinutes: integer(input.minTradeIntervalMinutes, 15, 43200), rebalanceThresholdBps: integer(input.rebalanceThresholdBps, 1, 10000),
    effectiveAt, expiresAt, goals: input.goals.trim(), locale: input.locale, notifications: [...input.notifications].sort(),
  }
}

export function parseAutomaticAllocation(text: string, mandate: AiMandateContent, candidates: AiExecutionRule[]): AiAutomaticAllocation {
  if (text.length > 16000) throw new Error('Allocation is too large')
  let input: any
  try { input = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1')) } catch { throw new Error('Allocation must be JSON') }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['cashBps', 'explanation', 'allocations'].includes(key))) throw new Error('Invalid allocation fields')
  integer(input.cashBps, 0, 10000)
  if (typeof input.explanation !== 'string' || !input.explanation.trim() || input.explanation.length > 2000 || !Array.isArray(input.allocations) || input.allocations.length > 8) throw new Error('Invalid allocation explanation')
  const allowed = new Set(mandate.allowedProductIds), verified = new Map(candidates.map(rule => [rule.productId, rule]))
  const seen = new Set<string>()
  const allocations = input.allocations.map((allocation: any) => {
    const id = uuid(allocation?.productId), rule = verified.get(id)
    if (!allowed.has(id) || !rule || seen.has(id) || riskRank(rule.riskBand) > riskRank(mandate.riskBand) || rule.lockDays > mandate.maxLockDays) throw new Error('Product is outside the verified mandate scope')
    seen.add(id)
    const weightBps = integer(allocation.weightBps, 1, mandate.maxProductWeightBps)
    if (Object.keys(allocation).some(key => !['productId', 'weightBps', 'reason'].includes(key)) || typeof allocation.reason !== 'string' || !allocation.reason.trim() || allocation.reason.length > 1000) throw new Error('Invalid allocation reason')
    return { productId: id, weightBps, reason: allocation.reason.trim() }
  })
  if (input.cashBps + allocations.reduce((sum: number, row: { weightBps: number }) => sum + row.weightBps, 0) !== 10000) throw new Error('Cash and product proportions must total 100%')
  return { cashBps: input.cashBps, allocations, explanation: input.explanation.trim() }
}

export interface AiActionContext {
  kind: 'buy' | 'redeem'; productId: string; notionalAtomic: string; availableAtomic: string; managedCashAtomic: string
  spentDailyAtomic: string; spentTotalAtomic: string; now: Date; unlockAt?: string
}
export function validateAction(mandate: AiMandateContent, rule: AiExecutionRule, action: AiActionContext): { feeAtomic: string } {
  const now = action.now.getTime()
  if (!Number.isFinite(now) || Date.parse(mandate.effectiveAt) > now || Date.parse(mandate.expiresAt) <= now) throw new Error('Mandate is not effective')
  if (!['buy', 'redeem'].includes(action.kind) || !mandate.allowedProductIds.includes(action.productId) || rule.productId !== action.productId) throw new Error('Action is outside the mandate')
  if ((action.kind === 'buy' && !mandate.allowBuy) || (action.kind === 'redeem' && !mandate.allowRedeem)) throw new Error('Action is not authorized')
  if (riskRank(rule.riskBand) > riskRank(mandate.riskBand) || integer(rule.lockDays, 0, 3650) > mandate.maxLockDays || rule.lockDays > mandate.horizonDays) throw new Error('Risk or lock conditions exceed the mandate')
  if (action.kind === 'redeem' && rule.lockDays > 0 && (!action.unlockAt || !Number.isFinite(Date.parse(action.unlockAt)) || Date.parse(action.unlockAt) > now)) throw new Error('A verified unlocked position is required')
  const amount = atomic(action.notionalAtomic, true), daily = atomic(action.spentDailyAtomic), total = atomic(action.spentTotalAtomic)
  if (amount > atomic(mandate.maxActionAtomic) || amount + daily > atomic(mandate.maxDailyTurnoverAtomic) || amount + total > atomic(mandate.maxTotalTurnoverAtomic)) throw new Error('Remaining submission budget is insufficient')
  if (action.kind === 'buy' && (amount > atomic(action.managedCashAtomic) || amount + atomic(mandate.cashReserveAtomic) > atomic(action.availableAtomic))) throw new Error('Managed funds or cash reserve is insufficient')
  const feeBps = integer(action.kind === 'buy' ? rule.buyFeeBps : rule.redeemFeeBps, 0, 10000)
  const fixed = atomic(action.kind === 'buy' ? rule.buyFeeFixedAtomic : rule.redeemFeeFixedAtomic)
  const fee = (amount * BigInt(feeBps) + 9999n) / 10000n + fixed
  if (feeBps > mandate.maxFeeBps || fee > atomic(mandate.maxFeeAtomic) || fee * 10000n > amount * BigInt(mandate.maxFeeBps)) throw new Error('Fees exceed the mandate')
  return { feeAtomic: fee.toString() }
}
