import { request } from './_http'

/** One invited member, as their upline sees them (GET /v1/referral/invitees/:memberLabel; 404 outside the user's tree). */
export type ReferralInviteeDetail = {
  memberLabel: string; level: number; boundAt: string; registeredAt: string
  deposits: { totalAtomic: string; count: number; lastAt: string | null }
  purchases: { quantAtomic: string; rwaAtomic: string; predictionAtomic: string; totalAtomic: string; count: number; lastAt: string | null }
  rewardsToMe: { totalAtomic: string; earnedAtomic: string; claimedAtomic: string }
  currency: string; decimals: number
}
export const referralInvitee = (memberLabel: string) => request<ReferralInviteeDetail>(`/v1/referral/invitees/${encodeURIComponent(memberLabel)}`, { loading: 'silent' })
