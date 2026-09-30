import { BadRequestException } from '@nestjs/common'

export const REFERRAL_DEFAULT_SETTINGS = {
  feeEnabled: true, feeRatesBps: [2000, 1000, 500],
  feeComponents: ['prediction_place', 'prediction_payout'],
  holdingEnabled: true, holdingRatesBps: [100, 50, 25], holdingDayCount: 'ACT/365',
  holdingBasis: 'settled_usdt_cost', redemptionStopsAt: 'requested', cashReinvestmentAllowed: true,
  teamEnabled: true, teamDepth: 3,
  teamTiers: [
    { fromAtomic: '0', toAtomic: '10000000000', rateBps: 500 },
    { fromAtomic: '10000000000', toAtomic: '100000000000', rateBps: 1000 },
    { fromAtomic: '100000000000', toAtomic: null, rateBps: 1500 },
  ],
  activeRequirement: 'direct_net_fee_positive', timezone: 'Asia/Shanghai',
  attributionDays: 30, attributionMode: 'first', existingAccountBinding: false,
  claimExclusive: true, idempotencyRequired: true, maxDepth: 3,
  budgetEnforcementEnabled: false, costObservationBps: 5000,
  dailyRiskAtomic: '5000000000', monthlyRiskMultiple: 3,
  zeroBaselineRiskAtomic: '5000000000', withdrawalReviewAtomic: '10000000000',
  pendingCountsForRisk: true, defaultClaimDestination: 'credit', autoApprove: false,
} as const

export type ReferralSettings = typeof REFERRAL_DEFAULT_SETTINGS
const atomic = (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value)
const bps = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10000

/** All immutable safeguards remain on; stage zero has no setting capable of enabling payment. */
export function validateReferralSettings(value: unknown): asserts value is ReferralSettings {
  const fail = () => { throw new BadRequestException('Invalid referral settings or immutable safeguard change') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const c = value as Record<string, unknown>
  if (Object.keys(c).sort().join(',') !== Object.keys(REFERRAL_DEFAULT_SETTINGS).sort().join(',')) return fail()
  for (const key of ['claimExclusive', 'idempotencyRequired', 'pendingCountsForRisk']) if (c[key] !== true) return fail()
  for (const key of ['budgetEnforcementEnabled', 'existingAccountBinding', 'autoApprove']) if (c[key] !== false) return fail()
  if (c.maxDepth !== 3 || !Number.isInteger(c.teamDepth) || Number(c.teamDepth) < 1 || Number(c.teamDepth) > 3) return fail()
  for (const key of ['feeEnabled', 'holdingEnabled', 'teamEnabled', 'cashReinvestmentAllowed']) if (typeof c[key] !== 'boolean') return fail()
  if (c.cashReinvestmentAllowed !== true || c.holdingDayCount !== 'ACT/365' || c.holdingBasis !== 'settled_usdt_cost'
    || c.redemptionStopsAt !== 'requested' || c.activeRequirement !== 'direct_net_fee_positive'
    || c.timezone !== 'Asia/Shanghai' || c.attributionMode !== 'first') return fail()
  if (!Number.isInteger(c.attributionDays) || Number(c.attributionDays) < 1 || Number(c.attributionDays) > 30) return fail()
  if (!bps(c.costObservationBps) || !Number.isInteger(c.monthlyRiskMultiple) || Number(c.monthlyRiskMultiple) < 1 || Number(c.monthlyRiskMultiple) > 100) return fail()
  for (const key of ['dailyRiskAtomic', 'zeroBaselineRiskAtomic', 'withdrawalReviewAtomic']) if (!atomic(c[key]) || BigInt(c[key] as string) <= 0n) return fail()
  if (!['credit', 'cash'].includes(String(c.defaultClaimDestination))) return fail()
  for (const key of ['feeRatesBps', 'holdingRatesBps']) {
    const rates = c[key]
    if (!Array.isArray(rates) || rates.length !== 3 || !rates.every(bps)) return fail()
  }
  if (!Array.isArray(c.feeComponents) || c.feeComponents.length > 2 || new Set(c.feeComponents).size !== c.feeComponents.length
    || c.feeComponents.some(x => !['prediction_place', 'prediction_payout'].includes(x))) return fail()
  if (!Array.isArray(c.teamTiers) || !c.teamTiers.length || c.teamTiers.length > 20) return fail()
  let previous: string | null = '0'
  for (const [index, t] of c.teamTiers.entries()) {
    if (!t || Object.keys(t).sort().join(',') !== 'fromAtomic,rateBps,toAtomic'
      || !atomic(t.fromAtomic) || t.fromAtomic !== previous || !bps(t.rateBps)) return fail()
    if (index === c.teamTiers.length - 1) { if (t.toAtomic !== null) return fail() }
    else if (!atomic(t.toAtomic) || BigInt(t.toAtomic) <= BigInt(t.fromAtomic)) return fail()
    previous = t.toAtomic
  }
}

export type AwardState = 'candidate' | 'pending_review' | 'rejected' | 'approved' | 'available' | 'frozen' | 'claimed_credit' | 'claimed_cash' | 'revoked'
export const AWARD_TRANSITIONS: Record<AwardState, readonly AwardState[]> = {
  candidate: ['pending_review', 'rejected'], pending_review: ['approved', 'rejected'],
  approved: ['available', 'revoked'], available: ['frozen', 'claimed_credit', 'claimed_cash', 'revoked'],
  frozen: ['available', 'revoked'], rejected: [], claimed_credit: [], claimed_cash: [], revoked: [],
}
export function assertAwardTransition(from: AwardState, to: AwardState) {
  if (!AWARD_TRANSITIONS[from]?.includes(to)) throw new BadRequestException('Illegal referral award transition')
}
