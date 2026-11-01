/**
 * Daily card draw, points and fee coupons (stage 3, 2026-11-01; design docs/design/community-stage3-daily-draw.md).
 * The server decides everything: eligibility, the prize, the discount. The client only sends a coupon id.
 * Every /v1/rewards route answers 404 while the feature is not live for this user, so the UI hides itself.
 */
import { request } from '@/lib/api/_http'

export type CouponKind = 'prediction_place_fee' | 'withdrawal_fee'
export type Coupon = {
  id: string; kind: CouponKind; maxDiscountAtomic: string; assetCode: string; assetDecimals: number
  state: 'available' | 'locked' | 'used' | 'expired' | 'frozen'; source: 'draw' | 'exchange'; expiresAt: string; createdAt: string; usedAt: string | null
}
export type DrawPrize = { kind: 'points'; points: number } | { kind: 'coupon'; coupon: Coupon }
export type Draw = { id: string; sgDate: string; state: 'granted' | 'frozen'; prize: DrawPrize; createdAt: string }
export type DrawReason = 'ok' | 'no_card_today' | 'too_new' | 'drawn' | 'frozen'
export type RewardToday = { sgDate: string; eligible: boolean; reason: DrawReason; draw: Draw | null }
export type RewardWallet = {
  points: number; coupons: Coupon[]; today: RewardToday
  exchange: { pointsPerCoupon: number; couponKind: CouponKind; maxDiscountAtomic: string; canExchange: boolean }
}
export type PointsRow = { id: string; delta: number; reason: 'draw' | 'exchange' | 'admin'; createdAt: string }

const fail = (code: string) => { throw new Error(code) }
const key = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** null = not live for this user (404/405). */
export async function getRewardToday(): Promise<RewardToday | null> {
  const result = await request<RewardToday>('/v1/rewards/today', { loading: 'silent' })
  if (!result.ok) { if ([401, 404, 405].includes(result.error.status)) return null; return fail(result.error.code ?? result.error.message) }
  return result.data
}
export async function getRewardWallet(): Promise<RewardWallet | null> {
  const result = await request<RewardWallet>('/v1/rewards/wallet', { loading: 'silent' })
  if (!result.ok) { if ([401, 404, 405].includes(result.error.status)) return null; return fail(result.error.code ?? result.error.message) }
  return result.data
}
/** For useQuery: a 404 lands in `.error`, so `.data` is only set when the feature is live. */
export const rewardWalletQuery = () => request<RewardWallet>('/v1/rewards/wallet', { loading: 'silent' })
export async function drawToday(): Promise<Draw> {
  const result = await request<Draw>('/v1/rewards/draw', { method: 'POST', idempotencyKey: key(), body: '{}' })
  return result.ok ? result.data : fail(result.error.code ?? result.error.message)
}
export async function exchangePoints(): Promise<{ points: number; coupon: Coupon }> {
  const result = await request<{ points: number; coupon: Coupon }>('/v1/rewards/points/exchange', { method: 'POST', idempotencyKey: key(), body: '{}' })
  return result.ok ? result.data : fail(result.error.code ?? result.error.message)
}
export async function getPointsHistory(cursor?: string | null) {
  const result = await request<{ rows: PointsRow[]; nextCursor: string | null }>(`/v1/rewards/points${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { loading: 'silent' })
  return result.ok ? result.data : fail(result.error.code ?? result.error.message)
}

/** The coupon a checkout would use: the usable one of this kind that expires first. */
export function bestCoupon(wallet: RewardWallet | null | undefined, kind: CouponKind): Coupon | null {
  const now = Date.now()
  return wallet?.coupons.filter(c => c.kind === kind && c.state === 'available' && Date.parse(c.expiresAt) > now)
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))[0] ?? null
}
/** Display-only estimate; the server computes the real discount. */
export const discountOn = (coupon: Coupon | null, feeAtomic: bigint) => coupon ? (BigInt(coupon.maxDiscountAtomic) < feeAtomic ? BigInt(coupon.maxDiscountAtomic) : feeAtomic) : BigInt(0)

/** Opens the draw sheet from anywhere (the composer posts, the host in the shell listens). */
export const REWARD_DRAW_EVENT = 'rwa:reward-draw'
export const offerDraw = () => window.dispatchEvent(new CustomEvent(REWARD_DRAW_EVENT))
