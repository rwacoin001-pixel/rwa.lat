/** JSON response types; timestamps serialize to ISO 8601 strings. */
export type ReferralInviteesSort = 'recent' | 'active' | 'level'
export interface ReferralInviteeRow {
  memberLabel: string
  level: 1 | 2 | 3
  boundAt: string
  displayName: string | null
  avatarUrl: string | null
  memberLevel: number
  active30d: boolean
  teamSize: number
}
export interface ReferralInviteesResponse {
  items: ReferralInviteeRow[]
  total: number
  page: number
  pageSize: number
}
export interface ReferralTreeNode {
  memberLabel: string
  depth: 1 | 2 | 3
  boundAt: string
  displayName: string | null
  avatarUrl: string | null
  memberLevel: number
  active30d: boolean
  childCount: number
  teamSize: number
  rewardsToMeAtomic: string
}
export interface ReferralTeamTreeResponse {
  parent: string | null
  depth: 1 | 2 | 3
  items: ReferralTreeNode[]
  total: number
  page: number
  pageSize: number
}
export interface ReferralTeamOverview {
  members: number
  byLevel: Array<{ level: 1 | 2 | 3; count: number }>
  active30d: number
  joinedThisMonth: number
  teamPurchaseMonthAtomic: string
  teamPurchaseTotalAtomic: string
  decimals: 6
  currency: 'USDT'
  asOf: string
}
