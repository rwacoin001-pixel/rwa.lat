/**
 * Withdrawal address book data layer — via Core API wallet module.
 * API-first, no mock fallback.
 */
import { apiClient } from './api-client'

export type WithdrawalAddressState = 'pending' | 'active' | 'revoked'

export type WithdrawalAddress = {
  id: string
  network: string
  assetCode: string
  label: string
  destination: string
  state: WithdrawalAddressState
  riskState: string
  reasonCode?: string | null
  cooldownUntil: string
  createdAt: string
  activatedAt?: string | null
  revokedAt?: string | null
}

export type AddressBookView = {
  entries: WithdrawalAddress[]
  policy: {
    cooldownSeconds: number
    financialMode: string
  }
}

export async function listWithdrawalAddresses(): Promise<AddressBookView> {
  const { data } = await apiClient.axios.get('/v1/wallet/withdrawal-addresses')
  return data
}

export async function addWithdrawalAddress(input: {
  network: string
  destination: string
  label: string
  reauthentication: string
}): Promise<WithdrawalAddress> {
  const { data } = await apiClient.axios.post('/v1/wallet/withdrawal-addresses', input)
  return data
}

export async function revokeWithdrawalAddress(id: string, reauthentication: string): Promise<unknown> {
  const { data } = await apiClient.axios.put(`/v1/wallet/withdrawal-addresses/${encodeURIComponent(id)}/revoke`, { reauthentication })
  return data
}

export const ADDRESS_STATE_LABELS: Record<WithdrawalAddressState, string> = {
  pending: '冷却中',
  active: '已启用',
  revoked: '已撤销',
}

export const ADDRESS_STATE_TONE: Record<WithdrawalAddressState, 'info' | 'ok' | 'mute'> = {
  pending: 'info',
  active: 'ok',
  revoked: 'mute',
}

/** 已知网络（与后端 wallet-network.registry 对齐的常用项） */
export const ADDRESS_NETWORKS = ['TRON', 'Ethereum', 'Arbitrum'] as const

/** 脱敏显示地址 */
export function maskAddress(address: string): string {
  if (!address || address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

/** 冷却剩余毫秒 */
export function cooldownRemainingMs(cooldownUntil: string): number {
  const until = new Date(cooldownUntil).getTime()
  if (Number.isNaN(until)) return 0
  return Math.max(0, until - Date.now())
}
