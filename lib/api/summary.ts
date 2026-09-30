import { request } from './_http'

export type Summary = {
  balance: { asset: string; availableAtomic: string; decimals: number; availableUsd: string | null }
  basket: { portfolioCount: number; positions: unknown[] }
  notifications: { unread: number }
  updatedAt: string | null
}

type SummaryDto = Partial<Summary> & { balances?: Summary['balance']; unreadCount?: number }
export function mapSummary(dto: SummaryDto): Summary {
  const balance = dto.balance ?? dto.balances
  return {
    balance: { asset: balance?.asset ?? '—', availableAtomic: balance?.availableAtomic ?? '0', decimals: balance?.decimals ?? 0, availableUsd: balance?.availableUsd ?? null },
    basket: { portfolioCount: dto.basket?.portfolioCount ?? 0, positions: Array.isArray(dto.basket?.positions) ? dto.basket.positions : [] },
    notifications: { unread: dto.notifications?.unread ?? dto.unreadCount ?? 0 },
    updatedAt: dto.updatedAt ?? null,
  }
}
export async function getSummary() {
  const result = await request<SummaryDto>('/v1/summary')
  return result.ok ? { ok: true as const, data: mapSummary(result.data) } : result
}
