import { request } from './_http'
export type ReferralSummary={stage:number;payoutsEnabled:boolean;purchaseRewardsEnabled?:boolean;feeRewardsEnabled?:boolean;teamSettlementEnabled?:boolean;teamActivatedAt?:string|null;firstQuantPurchaseOnly?:boolean;currency:string;decimals:number;balances:{available:string;claimed:string;total:string};levels:Array<{level:number;count:number}>;rules:{version:number;effectiveAt:{fee:string;holding:string;team:string};feeRatesBps:number[];holdingRatesBps:number[];teamTiers:Array<{fromAtomic:string;toAtomic:string|null;rateBps:number}>}}
/** 2026-11-05 team page: name/avatar only when the member allows inviters to see them (else null → masked id). */
export type ReferralMember={memberLabel:string;level:number;boundAt:string;displayName?:string|null;avatarUrl?:string|null;memberLevel?:number;active30d?:boolean;teamSize?:number}
export type ReferralTeamSort='recent'|'active'|'level'
export type ReferralTeamOverview={members:number;byLevel:Array<{level:1|2|3;count:number}>;active30d:number;joinedThisMonth:number;teamPurchaseMonthAtomic:string;teamPurchaseTotalAtomic:string;decimals:6;currency:'USDT';asOf:string}
export type ReferralMemberDetail=ReferralMember&{registeredAt:string;deposits:{totalAtomic:string;count:number;lastAt:string|null};purchases:{quantAtomic:string;rwaAtomic:string;predictionAtomic:string;totalAtomic:string;count:number;lastAt:string|null};rewardsToMe:{totalAtomic:string;earnedAtomic:string;claimedAtomic:string};currency:'USDT';decimals:6}
export type ReferralAward={id:string;kind:'purchase'|'fee';level:number;state:'earned'|'claimed';amountAtomic:string;baseAtomic:string;rateBps:number;currency:string;decimals:number;occurredAt:string;claimedAt:string|null;settingsVersion:number;memberLabel:string}
export type ReferralClaim={claimId:string;amountAtomic:string;rewardCount:number;currency:string;decimals:number;claimedAt:string;replay:boolean}
export type Page<T>={items:T[];total:number;page:number;pageSize:number}
/** inviterBound: this account has an inviter (added 2026-11-05; absent on older API builds). */
export const referralMe=()=>request<{code:string;payoutsEnabled:boolean;inviterBound?:boolean}>('/v1/referral/me')
export const referralMeQuiet=()=>request<{code:string;payoutsEnabled:boolean;inviterBound?:boolean}>('/v1/referral/me',{loading:'silent',timeoutMs:4000})
export const referralSummary=()=>request<ReferralSummary>('/v1/referral/summary')
export type ReferralTeamBatch={month:string;status:'pending'|'approved'|'paid';baseAtomic:string;amountAtomic:string;paidAt:string|null;ledgerTransactionId:string|null}
export const referralTeamRewards=()=>request<{enabled:boolean;activatedAt:string|null;items:ReferralTeamBatch[]}>('/v1/referral/team')
export const referralInvitees=(page:number,level:string,sort:ReferralTeamSort='recent')=>request<Page<ReferralMember>>(`/v1/referral/invitees?page=${page}&pageSize=20&level=${level}&sort=${sort}`)
/** 2026-11-05 team tree: one node's direct invitees inside my three-level team (no parent = my own invitees). */
export type ReferralTreeNode={memberLabel:string;depth:1|2|3;boundAt:string;displayName:string|null;avatarUrl:string|null;memberLevel:number;active30d:boolean;childCount:number;teamSize:number;rewardsToMeAtomic:string}
export type ReferralTeamTree={parent:string|null;depth:1|2|3;items:ReferralTreeNode[];total:number;page:number;pageSize:number}
export const referralTeamTree=(parent:string|null,page=1)=>request<ReferralTeamTree>(`/v1/referral/team-tree?${parent?`parent=${encodeURIComponent(parent)}&`:''}page=${page}&pageSize=50`,{loading:'silent'})
export const referralTeamOverview=()=>request<ReferralTeamOverview>('/v1/referral/team-overview',{loading:'silent'})
export const referralInvitee=(memberLabel:string)=>request<ReferralMemberDetail>(`/v1/referral/invitees/${encodeURIComponent(memberLabel)}`)
export const referralAwards=(page:number)=>request<Page<ReferralAward>>(`/v1/referral/rewards?page=${page}&pageSize=20`)
export const changeReferralCode=(code:string)=>request<{code:string}>('/v1/referral/code',{method:'POST',body:JSON.stringify({code})})
/** Moves every earned reward into available USDT. Reuse the same key when retrying one claim. */
export const claimReferralRewards=(idempotencyKey:string)=>request<ReferralClaim>('/v1/referral/claim',{method:'POST',body:'{}',idempotencyKey})
export type ReferralFunnelCount={last30d:number;all:number}
/** Link opened (one per browser) → signed up → first Koala Quant subscription; direct invitees, counts only. */
export const referralFunnel=()=>request<{opened:ReferralFunnelCount;registered:ReferralFunnelCount;subscribed:ReferralFunnelCount}>('/v1/referral/funnel')
