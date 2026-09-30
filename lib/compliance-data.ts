/**
 * Compliance data layer — KYC status, eligibility, screening via Core API.
 * API-first, no mock fallback.
 */
import { apiClient } from './api-client'

export type KycCaseState =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'expired'

export type KycCaseView = {
  id: string
  userId: string
  state: KycCaseState
  provider: string
  reasonCode?: string | null
  submittedAt?: string | null
  decidedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export type EligibilityDecision = 'browse_only' | 'ineligible' | 'eligible' | 'manual_review'

export type EligibilityView = {
  id: string
  userId: string
  policyVersion: string
  productScope: string
  decision: EligibilityDecision
  reasonCodes: string[]
  evidenceReferences: Record<string, unknown>
  decidedAt: string
  expiresAt?: string | null
}

export async function getKycStatus(): Promise<KycCaseView | null> {
  const { data } = await apiClient.axios.get('/v1/compliance/kyc/status')
  return data ?? null
}

export async function getEligibility(productScope: string): Promise<EligibilityView> {
  const { data } = await apiClient.axios.get(`/v1/compliance/eligibility/${encodeURIComponent(productScope)}`)
  return data
}

export async function evaluateEligibility(input: { productScope: string; region?: string }): Promise<EligibilityView> {
  const { data } = await apiClient.axios.post('/v1/compliance/eligibility/evaluate', input)
  return data
}

/** KYC 状态展示文案（7 态） */
export const KYC_STATE_LABELS: Record<KycCaseState, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  submitted: '审核中',
  needs_information: '待补充材料',
  approved: '已认证',
  rejected: '未通过',
  expired: '已过期',
}

export const KYC_STATE_TONE: Record<KycCaseState, 'info' | 'warn' | 'ok' | 'error' | 'mute'> = {
  not_started: 'mute',
  in_progress: 'info',
  submitted: 'info',
  needs_information: 'warn',
  approved: 'ok',
  rejected: 'error',
  expired: 'warn',
}

/** 资格决策展示文案（4 决策） */
export const ELIGIBILITY_LABELS: Record<EligibilityDecision, string> = {
  eligible: '可投资',
  browse_only: '仅可浏览',
  ineligible: '不可投资',
  manual_review: '人工审核中',
}

export const ELIGIBILITY_TONE: Record<EligibilityDecision, 'ok' | 'warn' | 'error' | 'info'> = {
  eligible: 'ok',
  browse_only: 'warn',
  ineligible: 'error',
  manual_review: 'info',
}

/** 常见 reason code 的中文解释 */
export const REASON_CODE_LABELS: Record<string, string> = {
  region_blocked: '您所在地区暂不支持该产品',
  kyc_not_approved: '需先完成身份认证',
  sanctions_match: '触发合规复核',
  sanctions_review: '合规复核中',
  risk_flag_open: '账户存在未处理的风险标记',
  risk_profile_missing: '需先完成风险评估问卷',
}
