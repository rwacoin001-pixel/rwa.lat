/**
 * 收益条款（利率）结构化模型 —— 存储在 products.yield_terms_json。
 * 说明：bps = 基点（100 bps = 1%）。金额为 USDT 展示值（非 atomic）。
 */

export type RateType = 'fixed' | 'floating' | 'tiered' | 'profit_share'
export type PayoutFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'at_maturity'
export type PayoutMode = 'interest' | 'principal_plus_interest' | 'profit_share'

export type YieldTier = { minAmount: string; maxAmount?: string; annualRateBps: number }
export type YieldProjection = { label: string; annualizedBps: number; note?: string }

export type YieldTerms = {
  version?: number
  rateType?: RateType
  annualRateBps?: number
  benchmark?: string
  spreadBps?: number
  floorBps?: number
  capBps?: number
  tiers?: YieldTier[]
  investorShareBps?: number
  termDays?: number
  payoutFrequency?: PayoutFrequency
  payoutMode?: PayoutMode
  compounding?: boolean
  settlementCycle?: string
  fees?: {
    subscriptionBps?: number
    managementAnnualBps?: number
    performanceBps?: number
    redemptionBps?: number
  }
  earlyRedemption?: { allowed?: boolean; penaltyBps?: number; lockDays?: number }
  projections?: YieldProjection[]
  worstCase?: YieldProjection
  notes?: string
  [key: string]: unknown
}

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  fixed: '固定利率',
  floating: '浮动利率',
  tiered: '分档利率',
  profit_share: '收益分成',
}

export const PAYOUT_FREQUENCY_LABELS: Record<PayoutFrequency, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
  semiannual: '每半年',
  annual: '每年',
  at_maturity: '到期一次性',
}

export const PAYOUT_MODE_LABELS: Record<PayoutMode, string> = {
  interest: '按期付息',
  principal_plus_interest: '到期还本付息',
  profit_share: '按利润分成',
}

export const PAYOUTS_PER_YEAR: Record<PayoutFrequency, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
  at_maturity: 1,
}

export function bpsToPctString(bps: number | null | undefined, digits = 2): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return ''
  const value = bps / 100
  const fixed = value.toFixed(digits)
  return fixed.replace(/\.?0+$/, '') || '0'
}

export function pctToBps(pct: string | number | null | undefined): number | undefined {
  if (pct === '' || pct === null || pct === undefined) return undefined
  const value = Number(pct)
  if (!Number.isFinite(value)) return undefined
  return Math.round(value * 100)
}

/** 列表行用的摘要，例如：固定利率 6.5% · 每月 · 90 天 */
export function describeYield(terms: YieldTerms | null | undefined): string {
  if (!terms || !terms.rateType) return '未配置'
  const parts: string[] = []
  const rateType = terms.rateType as RateType
  parts.push(RATE_TYPE_LABELS[rateType] ?? rateType)
  if (rateType === 'fixed' && terms.annualRateBps != null) parts.push(`${bpsToPctString(terms.annualRateBps)}%`)
  if (rateType === 'floating' && terms.spreadBps != null) parts.push(`基准+${bpsToPctString(terms.spreadBps)}%`)
  if (rateType === 'tiered' && Array.isArray(terms.tiers) && terms.tiers.length) parts.push(`${terms.tiers.length} 档`)
  if (rateType === 'profit_share' && terms.investorShareBps != null) parts.push(`投资者 ${bpsToPctString(terms.investorShareBps, 0)}%`)
  if (terms.payoutFrequency) parts.push(PAYOUT_FREQUENCY_LABELS[terms.payoutFrequency] ?? terms.payoutFrequency)
  if (terms.termDays) parts.push(`${terms.termDays} 天`)
  return parts.join(' · ')
}

export type YieldPreview = {
  annualRatePct: number
  periodsPerYear: number
  perPeriodGross: number
  annualInterest: number
  termInterest: number
  entryFee: number
  managementFee: number
  redemptionFee: number
  netAtMaturity: number
  worstCaseAnnualPct: number | null
}

/** 投资者视角预览（简化计算，用于运营参考，不构成披露） */
export function computePreview(terms: YieldTerms, amount: number): YieldPreview {
  const ratePct = terms.annualRateBps != null ? terms.annualRateBps / 100 : 0
  const frequency = (terms.payoutFrequency ?? 'at_maturity') as PayoutFrequency
  const periodsPerYear = PAYOUTS_PER_YEAR[frequency] ?? 1
  const annualInterest = (amount * ratePct) / 100
  const effectiveTermDays = terms.termDays && terms.termDays > 0 ? terms.termDays : 365
  const termInterest = annualInterest * (effectiveTermDays / 365)
  const fees = terms.fees ?? {}
  const entryFee = (amount * (fees.subscriptionBps ?? 0)) / 10_000
  const managementFee = ((amount * (fees.managementAnnualBps ?? 0)) / 10_000) * (effectiveTermDays / 365)
  const redemptionFee = (amount * (fees.redemptionBps ?? 0)) / 10_000
  const netAtMaturity = amount + termInterest - entryFee - managementFee - redemptionFee
  return {
    annualRatePct: ratePct,
    periodsPerYear,
    perPeriodGross: annualInterest / periodsPerYear,
    annualInterest,
    termInterest,
    entryFee,
    managementFee,
    redemptionFee,
    netAtMaturity,
    worstCaseAnnualPct: terms.worstCase?.annualizedBps != null ? terms.worstCase.annualizedBps / 100 : null,
  }
}

export function formatUsdt(value: number, digits = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
