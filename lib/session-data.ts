/**
 * lib/session-data.ts — Session & KYC data layer（S1 批次 5）
 *
 * GET /v1/auth/session           → 会话级认证状态（emailVerified/authAdapter/expiresAt）
 * GET /v1/compliance/kyc/status  → KYC 真实状态（state 为后端 7 枚举·注意 /compliance 前缀）
 */
import { request, type ApiResult } from './api/_http'

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
  return result.data
}

// ─── Types ───

export type SessionView = import('./api/types').ApiSessionView

export type KycState =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'expired'

export type KycStatusView = {
  id: string
  userId: string
  state: KycState
  provider: string | null
  reasonCode: string | null
  submittedAt: string | null
  decidedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// ─── Fetchers ───

/** 会话视图（未登录/无效 token 抛 401——调用方用 allSettled 处理） */
export async function getSessionView(): Promise<SessionView> {
  return unwrap(await request<SessionView>('/v1/auth/session'))
}

/** KYC 状态（后端返回 case 对象或 null） */
export async function getKycStatus(): Promise<KycStatusView | null> {
  return unwrap(await request<KycStatusView | null>('/v1/compliance/kyc/status'))
}
