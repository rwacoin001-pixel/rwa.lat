import { request } from './_http'
import { useQuery } from './_query'

export type QuantPoint = { tradeDate: string; grossReturnPct: string; netReturnPct: string; indexAfter: string }
export type QuantWindow = { pct: number | null; coveredDays: number; days: number }
export type QuantFeeTier = { maxDays: number; bps: number }
export type QuantOrder = { id: string; kind: 'subscription' | 'redemption'; status: string; amountAtomic: string | null; effectiveDate: string; createdAt: string }
export type QuantPosition = {
  principalAtomic: string; investedAtomic: string; waitingAtomic: string; totalPaidAtomic: string; totalNetAtomic: string; totalFeesAtomic: string
  lastDay: { tradeDate: string; netAtomic: string; paidAtomic: string } | null
  pendingOrders: QuantOrder[]
}
export type QuantProduct = {
  id: string; slug: string; name: string; summary: string | null; status: string; open: boolean; cutoffTime: string; timezone: string
  fees: { managementBps: number; performanceBps: number; redemptionTiers: QuantFeeTier[] }
  minSubscriptionAtomic: string; minRedemptionAtomic: string
  target: { annualMinPct: string; annualMaxPct: string } | null
  performance: { index: string; indexNetOf: 'management_fee'; sinceInceptionPct: number | null; last7d: QuantWindow; last30d: QuantWindow; maxDrawdownPct: number | null; lastSettledDate: string | null; days: number }
  history: QuantPoint[]
  disclosureId: string | null
  position?: QuantPosition
}
export type QuantPayout = { tradeDate: string; principalBeforeAtomic: string; grossAtomic: string; managementFeeAtomic: string; performanceFeeAtomic: string; netAtomic: string; paidAtomic: string }
export type QuantSubscriptionPreview = { tradeDate: string; effectiveDate: string; firstSettlementDate: string; cutoffTime: string; timezone: string; afterCutoff: boolean; localDate: string }
export type QuantRedemptionPreview = { tradeDate: string; estimate: true; principalAtomic: string; redeemableAtomic: string; waitingAtomic: string; redeemAtomic: string; feeAtomic: string; payoutAtomic: string; minRedemptionAtomic: string }
export type QuantDisclosure = { id: string; version: number; title: string; content: string; effectiveFrom: string }

export const listQuantProducts = () => request<QuantProduct[]>('/v1/quant/products')
export const getQuantProduct = (slug: string) => request<QuantProduct>(`/v1/quant/products/${encodeURIComponent(slug)}`)
export const getQuantDisclosure = () => request<QuantDisclosure | null>('/v1/quant/disclosure')
export const getQuantSubscriptionPreview = (slug: string) => request<QuantSubscriptionPreview>(`/v1/quant/products/${encodeURIComponent(slug)}/subscription-preview`)
export const getQuantRedemptionPreview = (slug: string, input: { amountUsd?: string; all?: boolean }) =>
  request<QuantRedemptionPreview>(`/v1/quant/me/products/${encodeURIComponent(slug)}/redemption-preview?${new URLSearchParams({ ...(input.amountUsd ? { amountUsd: input.amountUsd } : {}), ...(input.all ? { all: 'true' } : {}) })}`)
export const listQuantPayouts = (slug: string, limit = 30) => request<QuantPayout[]>(`/v1/quant/me/products/${encodeURIComponent(slug)}/payouts?limit=${limit}`)
export const subscribeQuant = (slug: string, amountUsd: string, idempotencyKey: string) =>
  request<{ duplicate?: boolean; order: QuantOrder }>(`/v1/quant/products/${encodeURIComponent(slug)}/subscriptions`, { method: 'POST', body: JSON.stringify({ amountUsd }), idempotencyKey })
export const redeemQuant = (slug: string, input: { amountUsd?: string; all?: boolean }, idempotencyKey: string) =>
  request<{ duplicate?: boolean; order: QuantOrder }>(`/v1/quant/products/${encodeURIComponent(slug)}/redemptions`, { method: 'POST', body: JSON.stringify(input), idempotencyKey })

/** The single Koala Quant product, or undefined until it is open (draft products are not listed by the API). */
export function useQuantProducts() {
  return useQuery('quant:products', listQuantProducts, { staleTime: 5 * 60_000, loading: 'silent' })
}

/** The dock shows the quant tab only once an operator has opened a product, so shipping the app early shows nothing. */
export function useQuantListed(): boolean {
  const result = useQuantProducts()
  return Boolean(result.data && result.data.length > 0)
}
