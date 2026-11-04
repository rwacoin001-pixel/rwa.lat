import type { ReferralInviteesResponse, ReferralTeamOverview } from '../../src/referral/referral-team.types'

/** Front-end fixtures: an opted-in member, a hidden member, and a third-level member. */
export const mockTeamInvitees: ReferralInviteesResponse = {
  items: [
    { memberLabel:'a12bc345',level:1,boundAt:'2026-11-04T08:00:00.000Z',displayName:'小林',
      avatarUrl:'/v1/community/media/11111111-1111-4111-8111-111111111111',memberLevel:4,active30d:true,teamSize:2 },
    { memberLabel:'b23cd456',level:2,boundAt:'2026-11-03T08:00:00.000Z',displayName:null,
      avatarUrl:null,memberLevel:1,active30d:false,teamSize:1 },
    { memberLabel:'c34de567',level:3,boundAt:'2026-10-30T08:00:00.000Z',displayName:'River',
      avatarUrl:null,memberLevel:2,active30d:true,teamSize:0 },
  ],
  total:3,page:1,pageSize:20,
}
export const mockTeamOverview: ReferralTeamOverview = {
  members:3,byLevel:[{level:1,count:1},{level:2,count:1},{level:3,count:1}],active30d:2,joinedThisMonth:2,
  teamPurchaseMonthAtomic:'1250000000',teamPurchaseTotalAtomic:'4800000000',decimals:6,currency:'USDT',
  asOf:'2026-11-05T00:00:00.000Z',
}
