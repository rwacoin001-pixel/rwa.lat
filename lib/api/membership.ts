'use client'

/**
 * Galaxy membership (2026-11-04): a level per member from their own deposits and purchases, their invite team (three
 * levels, never deeper) and team size; plus read-only rankings. Contract in D:/rwa-lat-builds/briefs/
 * 2026-11-04-galaxy-membership-phase1.md. Amounts are USDT strings; rankings never carry ids, emails or exact money.
 */
import { request, type ApiResult } from './_http'

export const LEVEL_KEYS = ['stardust', 'planet', 'star', 'cluster', 'nebula', 'galaxy', 'milkyway'] as const
export type LevelKey = typeof LEVEL_KEYS[number]

export type LevelPerks = { draws: number; predictionFeeDiscountPct: number; quantFeeDiscountPct: number; honors: string[] }
export type LevelDef = { index: number; key: LevelKey; threshold: number; requires: { firstDeposit?: boolean; directActive?: number; teamActive?: number }; perks: LevelPerks }
export type Membership = {
  level: { index: number; key: LevelKey }
  score: string
  components: { deposits: string; purchases: string; team: { l1: string; l2: string; l3: string }; members: { direct: number; team: number; directActive: number; teamActive: number }; tasks: string }
  next: { index: number; key: LevelKey; threshold: number; missing: { score: string; directActive?: number; teamActive?: number; firstDeposit?: boolean } } | null
  graceUntil: string | null
  updatedAt: string
  levels: LevelDef[]
}

export type RankBoard = 'score' | 'invest' | 'team' | 'invite'
export type RankPeriod = 'week' | 'month'
export type RankRow = { rank: number; handle: string; displayName: string; avatarUrl: string | null; avatarSeed: string | null; level: number; band: string }
export type RankPage = { board: RankBoard; period: RankPeriod; periodStart: string; generatedAt: string | null; items: RankRow[]; me: { rank: number | null; band: string; hidden: boolean } | null }

export const membershipQuery = (): Promise<ApiResult<Membership>> => request<Membership>('/v1/membership/me', { loading: 'silent' })
export const rankQuery = (board: RankBoard, period: RankPeriod): Promise<ApiResult<RankPage>> => request<RankPage>(`/v1/rank?board=${board}&period=${period}`, { loading: 'silent' })
export async function setRankHidden(hidden: boolean) {
  const result = await request<{ hidden: boolean }>('/v1/membership/rank-visibility', { method: 'PUT', body: JSON.stringify({ hidden }) })
  if (!result.ok) throw new Error(result.error.message)
  return result.data.hidden
}

/** 1-based level index → key; anything out of range reads as the first level. */
export const levelKey = (index: number | null | undefined): LevelKey => LEVEL_KEYS[Math.min(LEVEL_KEYS.length, Math.max(1, index ?? 1)) - 1]
