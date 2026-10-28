import { request } from './_http'
export type ReferralSummary={stage:number;payoutsEnabled:boolean;purchaseRewardsEnabled?:boolean;feeRewardsEnabled?:boolean;teamSettlementEnabled?:boolean;teamActivatedAt?:string|null;firstQuantPurchaseOnly?:boolean;currency:string;decimals:number;balances:{available:string;claimed:string;total:string};levels:Array<{level:number;count:number}>;rules:{version:number;effectiveAt:{fee:string;holding:string;team:string};feeRatesBps:number[];holdingRatesBps:number[];teamTiers:Array<{fromAtomic:string;toAtomic:string|null;rateBps:number}>}}
export type ReferralMember={memberLabel:string;level:number;boundAt:string}
export type ReferralAward={id:string;kind:'purchase'|'fee';level:number;state:'earned'|'claimed';amountAtomic:string;baseAtomic:string;rateBps:number;currency:string;decimals:number;occurredAt:string;claimedAt:string|null;settingsVersion:number;memberLabel:string}
export type ReferralClaim={claimId:string;amountAtomic:string;rewardCount:number;currency:string;decimals:number;claimedAt:string;replay:boolean}
export type Page<T>={items:T[];total:number;page:number;pageSize:number}
export const referralMe=()=>request<{code:string;payoutsEnabled:boolean}>('/v1/referral/me')
export const referralSummary=()=>request<ReferralSummary>('/v1/referral/summary')
export type ReferralTeamBatch={month:string;status:'pending'|'approved'|'paid';baseAtomic:string;amountAtomic:string;paidAt:string|null;ledgerTransactionId:string|null}
export const referralTeamRewards=()=>request<{enabled:boolean;activatedAt:string|null;items:ReferralTeamBatch[]}>('/v1/referral/team')
export const referralInvitees=(page:number,level:string)=>request<Page<ReferralMember>>(`/v1/referral/invitees?page=${page}&pageSize=20&level=${level}`)
export const referralAwards=(page:number)=>request<Page<ReferralAward>>(`/v1/referral/rewards?page=${page}&pageSize=20`)
export const changeReferralCode=(code:string)=>request<{code:string}>('/v1/referral/code',{method:'POST',body:JSON.stringify({code})})
/** Moves every earned reward into available USDT. Reuse the same key when retrying one claim. */
export const claimReferralRewards=(idempotencyKey:string)=>request<ReferralClaim>('/v1/referral/claim',{method:'POST',body:'{}',idempotencyKey})
export type ReferralFunnelCount={last30d:number;all:number}
/** Link opened (one per browser) → signed up → first Koala Quant subscription; direct invitees, counts only. */
export const referralFunnel=()=>request<{opened:ReferralFunnelCount;registered:ReferralFunnelCount;subscribed:ReferralFunnelCount}>('/v1/referral/funnel')
