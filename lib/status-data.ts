/**
 * System status data layer — health + capability snapshot via Core API.
 */
import { apiClient } from './api-client'

export type HealthResponse = {
  status: 'ok' | 'ready'
  service: string
  requestId?: string
  timestamp: string
}

export type CapabilityState = {
  status: 'enabled' | 'paused'
  reasonCode: string | null
  allowedActions: string[]
  requiredActions: string[]
  lastUpdated: string | null
}

export type CapabilitySnapshot = {
  updatedAt: string
  capabilities: Record<string, CapabilityState>
}

export async function getLiveness(): Promise<HealthResponse> {
  const { data } = await apiClient.axios.get('/v1/health')
  return data
}

export async function getReadiness(): Promise<HealthResponse> {
  const { data } = await apiClient.axios.get('/v1/health/ready')
  return data
}

export async function getCapabilities(): Promise<CapabilitySnapshot> {
  const { data } = await apiClient.axios.get('/v1/capabilities')
  return data
}

/** 能力开关的中文名 */
export const CAPABILITY_LABELS: Record<string, string> = {
  'prediction.betting': '预测市场交易',
  'basket.subscriptions': '组合申购',
  'basket.redemptions': '组合赎回',
  'orders.creation': '订单创建',
  'deposits.credit': '充值入账',
  'withdrawals.execution': '提现执行',
  'kyc.approval': 'KYC 审批',
  'identity.sessions': '身份会话',
  'community.posting': '社区发帖',
}
const CAPABILITY_LABELS_EN: Record<string, string> = {
  'prediction.betting': 'Prediction market trading',
  'basket.subscriptions': 'Basket subscriptions',
  'basket.redemptions': 'Basket redemptions',
  'orders.creation': 'Order creation',
  'deposits.credit': 'Deposit crediting',
  'withdrawals.execution': 'Withdrawal execution',
  'kyc.approval': 'KYC approval',
  'identity.sessions': 'Identity sessions',
  'community.posting': 'Community posting',
}

export function capabilityLabel(key: string, locale = 'en'): string {
  const labels = locale === 'zh-CN' ? CAPABILITY_LABELS : CAPABILITY_LABELS_EN
  return labels[key] ?? key
}

/** reason code 的中文说明 */
export const REASON_LABELS: Record<string, string> = {
  OPERATIONAL_SWITCH_DISABLED: '运维开关已关闭（可恢复）',
  ENVIRONMENT_DISABLED: '当前环境未启用该能力',
}
const REASON_LABELS_EN: Record<string, string> = {
  OPERATIONAL_SWITCH_DISABLED: 'Operational switch is disabled',
  ENVIRONMENT_DISABLED: 'This capability is not enabled in this environment',
}

export function reasonLabel(code: string, locale = 'en'): string {
  const labels = locale === 'zh-CN' ? REASON_LABELS : REASON_LABELS_EN
  return labels[code] ?? (locale === 'zh-CN' ? '暂停' : 'Paused')
}
