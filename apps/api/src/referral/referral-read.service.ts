import { Injectable, BadRequestException, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { MONEY_CTES } from '../membership/membership-sql'
import { inviterProfiles } from '../community/inviter-profile'
import { ObjectStorageService } from '../object-storage/object-storage.service'
import type { ReferralInviteesResponse, ReferralInviteeRow, ReferralTeamOverview } from './referral-team.types'

// Shared three-level viewer window. Paths also guard against malformed cyclic data.
const TEAM_CTE = `team AS (
  SELECT invitee_user_id,bound_at,1 AS level,ARRAY[$1::uuid,invitee_user_id] AS path
    FROM app.referral_edges WHERE inviter_user_id=$1 AND invitee_user_id<>$1
  UNION ALL SELECT e.invitee_user_id,e.bound_at,t.level+1,t.path||e.invitee_user_id
    FROM app.referral_edges e JOIN team t ON e.inviter_user_id=t.invitee_user_id
    WHERE t.level<3 AND NOT e.invitee_user_id=ANY(t.path)
)`
const TEAM_MONEY_CTES = `${TEAM_CTE},scope AS (SELECT DISTINCT invitee_user_id AS user_id FROM team),${MONEY_CTES},
  active AS (
    SELECT user_id FROM deposits WHERE credited AND at>=now()-interval '30 days' AND at<=now()
    UNION SELECT user_id FROM purchases WHERE at>=now()-interval '30 days' AND at<=now()
  )`

@Injectable()
export class ReferralReadService {
  constructor(private readonly db: DataSource, @Optional() private readonly storage?: ObjectStorageService) {}
  private readonly teamOverviewCache = new Map<string, { expiresAt: number; result: ReferralTeamOverview }>()
  private async requireInstalled() {
    const [row]=await this.db.query("SELECT to_regclass('app.referral_rewards') IS NOT NULL AS installed")
    if(!row.installed) throw new ServiceUnavailableException('Referral service is being prepared')
  }
  private page(page = '1', pageSize = '20') {
    if (!/^[1-9]\d{0,5}$/.test(page) || !/^[1-9]\d{0,2}$/.test(pageSize) || Number(pageSize)>100) throw new BadRequestException('Invalid pagination')
    return {page:Number(page),pageSize:Number(pageSize),offset:(Number(page)-1)*Number(pageSize)}
  }
  async summary(userId: string) {
    await this.requireInstalled()
    return this.db.transaction('REPEATABLE READ',async m=> {
      // Purchase and fee rewards are earned immediately and claimable at once (app.referral_rewards).
      const [balances]=await m.query(`SELECT coalesce(sum(amount_atomic) FILTER(WHERE state='earned'),0)::text AS available,
        coalesce(sum(amount_atomic) FILTER(WHERE state='claimed'),0)::text AS claimed,
        coalesce(sum(amount_atomic),0)::text AS total FROM app.referral_rewards WHERE user_id=$1`,[userId])
      const counts=await m.query(`WITH RECURSIVE ${TEAM_CTE} SELECT level,count(*)::int AS count FROM team GROUP BY level ORDER BY level`,[userId])
      const [settings]=await m.query('SELECT * FROM app.referral_settings ORDER BY version DESC LIMIT 1')
      const [installed]=await m.query("SELECT to_regclass('app.referral_team_activation') IS NOT NULL AS ready")
      const [team]=installed.ready?await m.query(`SELECT a.activated_at,s.config FROM app.referral_team_activation a JOIN app.referral_settings s
        ON s.version=(SELECT version FROM app.referral_settings WHERE team_effective_at<=now() OR version=a.settings_version
          ORDER BY CASE WHEN version=a.settings_version THEN a.activated_at ELSE team_effective_at END DESC,version DESC LIMIT 1)`):[]
      return {stage:1,payoutsEnabled:true,currency:'USDT',decimals:6,balances,levels:[1,2,3].map(level=>({level,count:counts.find((r:any)=>r.level===level)?.count??0})),
        rules:{version:settings.version,feeRatesBps:settings.config.feeRatesBps,holdingRatesBps:settings.config.holdingRatesBps,teamTiers:settings.config.teamTiers,
          effectiveAt:{fee:settings.fee_effective_at,holding:settings.holding_effective_at,team:settings.team_effective_at}},
        purchaseRewardsEnabled:settings.config.holdingEnabled===true,feeRewardsEnabled:settings.config.feeEnabled===true,
        firstQuantPurchaseOnly:true,teamSettlementEnabled:team?.config.teamEnabled===true,teamActivatedAt:team?.activated_at??null}
    })
  }
  async invitees(userId: string,page?:string,pageSize?:string,level='all',sort='recent'): Promise<ReferralInviteesResponse> {
    const p=this.page(page,pageSize)
    if (!['all','1','2','3'].includes(level)) throw new BadRequestException('Invalid level')
    if (!['recent','active','level'].includes(sort)) throw new BadRequestException('Invalid sort')
    await this.requireInstalled()
    const order=sort==='active'?'"active30d" DESC,':sort==='level'?'"memberLevel" DESC,':''
    return this.db.transaction('REPEATABLE READ',async m=>{
      const [count]=await m.query(`WITH RECURSIVE ${TEAM_CTE} SELECT count(*)::int AS total FROM team WHERE ($2='all' OR level::text=$2)`,[userId,level])
      const rows: Array<Omit<ReferralInviteeRow,'boundAt'|'displayName'|'avatarUrl'> & { userId: string; boundAt: Date }> = await m.query(`WITH RECURSIVE ${TEAM_MONEY_CTES},
        sizes AS (SELECT ancestor,count(*)::int AS count FROM team t
          CROSS JOIN LATERAL unnest(t.path[2:t.level]) AS ancestor GROUP BY ancestor)
        SELECT t.invitee_user_id AS "userId",substr(t.invitee_user_id::text,1,8) AS "memberLabel",t.level,t.bound_at AS "boundAt",
          coalesce(ml.level,1)::int AS "memberLevel",a.user_id IS NOT NULL AS "active30d",coalesce(s.count,0)::int AS "teamSize"
        FROM team t LEFT JOIN app.member_levels ml ON ml.user_id=t.invitee_user_id
          LEFT JOIN active a ON a.user_id=t.invitee_user_id LEFT JOIN sizes s ON s.ancestor=t.invitee_user_id
        WHERE ($2='all' OR t.level::text=$2) ORDER BY ${order}t.bound_at DESC,t.invitee_user_id LIMIT $3 OFFSET $4`,[userId,level,p.pageSize,p.offset])
      const profiles=await inviterProfiles(m,rows.map(row=>row.userId),this.storage)
      const items=rows.map(({userId:memberId,boundAt,...row})=>({ ...row,boundAt:boundAt.toISOString(),
        ...(profiles.get(memberId)??{displayName:null,avatarUrl:null}) }))
      return {items,total:count.total,page:p.page,pageSize:p.pageSize}
    })
  }
  async teamOverview(userId: string): Promise<ReferralTeamOverview> {
    const cached=this.teamOverviewCache.get(userId)
    if (cached && cached.expiresAt>Date.now()) return cached.result
    await this.requireInstalled()
    const [row]=await this.db.query(`WITH RECURSIVE ${TEAM_MONEY_CTES},
      clock AS (SELECT date_trunc('month',now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS month_start),
      counts AS (SELECT count(*)::int AS members,
        count(*) FILTER(WHERE level=1)::int AS l1,count(*) FILTER(WHERE level=2)::int AS l2,count(*) FILTER(WHERE level=3)::int AS l3,
        count(*) FILTER(WHERE EXISTS(SELECT 1 FROM active a WHERE a.user_id=t.invitee_user_id))::int AS "active30d",
        count(*) FILTER(WHERE bound_at>=(SELECT month_start FROM clock) AND bound_at<=now())::int AS "joinedThisMonth" FROM team t)
      SELECT counts.*,
        trunc(coalesce((SELECT sum(amount) FROM purchases WHERE at>=(SELECT month_start FROM clock) AND at<=now()),0)*1000000)::text AS "teamPurchaseMonthAtomic",
        trunc(coalesce((SELECT sum(amount) FROM purchases WHERE at<=now()),0)*1000000)::text AS "teamPurchaseTotalAtomic",now() AS "asOf" FROM counts`,[userId])
    const result: ReferralTeamOverview={members:row.members,byLevel:([1,2,3] as const).map(level=>({level,count:row[`l${level}`]})),
      active30d:row.active30d,joinedThisMonth:row.joinedThisMonth,teamPurchaseMonthAtomic:row.teamPurchaseMonthAtomic,
      teamPurchaseTotalAtomic:row.teamPurchaseTotalAtomic,decimals:6,currency:'USDT',asOf:row.asOf.toISOString()}
    // Bounded per-process cache. Only aggregate data is cached; profile visibility is always read afresh.
    this.teamOverviewCache.delete(userId)
    if(this.teamOverviewCache.size>=1000)this.teamOverviewCache.delete(this.teamOverviewCache.keys().next().value!)
    this.teamOverviewCache.set(userId,{expiresAt:Date.now()+60_000,result})
    return result
  }
  async invitee(userId:string,memberLabel:string) {
    if (!/^[a-f0-9]{8}$/.test(memberLabel)) throw new BadRequestException('Invalid member label')
    await this.requireInstalled()
    return this.db.transaction('REPEATABLE READ',async m=>{
      const members=await m.query(`WITH RECURSIVE team AS (
        SELECT invitee_user_id,bound_at,1 AS level FROM app.referral_edges WHERE inviter_user_id=$1
        UNION ALL SELECT e.invitee_user_id,e.bound_at,t.level+1 FROM app.referral_edges e JOIN team t ON e.inviter_user_id=t.invitee_user_id WHERE t.level<3
      ) SELECT substr(t.invitee_user_id::text,1,8) AS "memberLabel",t.invitee_user_id AS "userId",t.level,t.bound_at AS "boundAt",u.created_at AS "registeredAt"
        FROM team t JOIN app.users u ON u.id=t.invitee_user_id WHERE substr(t.invitee_user_id::text,1,8)=$2 LIMIT 2`,[userId,memberLabel])
      // The list's short label can collide. Never guess which member's finances to disclose.
      if (members.length!==1) throw new NotFoundException('Member not found')
      const member=members[0]
      const [deposits]=await m.query(`WITH credited AS (
        SELECT trunc(atomic_amount*power(10::numeric,6-asset_decimals)) AS amount,credited_at AS at FROM app.deposits
          WHERE user_id=$1 AND state='credited' AND asset_code='USDT'
        UNION ALL SELECT trunc(atomic_amount*power(10::numeric,6-asset_decimals)),posted_at FROM app.internal_transfers
          WHERE recipient_user_id=$1 AND state='posted' AND asset_code='USDT'
      ) SELECT coalesce(sum(amount),0)::text AS "totalAtomic",count(*)::int AS count,max(at) AS "lastAt" FROM credited`,[member.userId])
      const [purchases]=await m.query(`WITH purchases AS (
        SELECT 'quant' AS product,amount_atomic AS amount,coalesce(settled_at,created_at) AS at FROM app.quant_orders
          WHERE user_id=$1 AND kind='subscription' AND status IN ('accepted','settled')
        UNION ALL SELECT 'rwa',filled_atomic_amount,coalesce(completed_at,processed_at,submitted_at) FROM app.orders
          WHERE user_id=$1 AND side='buy' AND state IN ('filled','partially_filled') AND filled_atomic_amount>0
            AND settlement_asset_code='USDT' AND settlement_asset_decimals=6
        UNION ALL SELECT 'prediction',stake_atomic,created_at FROM app.prediction_bets WHERE user_id=$1 AND status IN ('placed','won','lost')
      ) SELECT coalesce(sum(amount) FILTER(WHERE product='quant'),0)::text AS "quantAtomic",
        coalesce(sum(amount) FILTER(WHERE product='rwa'),0)::text AS "rwaAtomic",
        coalesce(sum(amount) FILTER(WHERE product='prediction'),0)::text AS "predictionAtomic",
        coalesce(sum(amount),0)::text AS "totalAtomic",count(*)::int AS count,max(at) AS "lastAt" FROM purchases`,[member.userId])
      // Team awards are progressive totals per beneficiary/month, without persisted per-member shares.
      const [rewardsToMe]=await m.query(`SELECT coalesce(sum(amount_atomic),0)::text AS "totalAtomic",
        coalesce(sum(amount_atomic) FILTER(WHERE state='earned'),0)::text AS "earnedAtomic",
        coalesce(sum(amount_atomic) FILTER(WHERE state='claimed'),0)::text AS "claimedAtomic"
        FROM app.referral_rewards WHERE user_id=$1 AND source_user_id=$2 AND kind IN ('purchase','fee') AND asset_code='USDT' AND asset_decimals=6`,[userId,member.userId])
      return {memberLabel:member.memberLabel,level:member.level,boundAt:member.boundAt,registeredAt:member.registeredAt,deposits,purchases,rewardsToMe,currency:'USDT',decimals:6}
    })
  }
  async rewards(userId:string,page?:string,pageSize?:string) {
    await this.requireInstalled()
    const p=this.page(page,pageSize)
    return this.db.transaction('REPEATABLE READ',async m=>{
      const [count]=await m.query('SELECT count(*)::int AS total FROM app.referral_rewards WHERE user_id=$1',[userId])
      const items=await m.query(`SELECT id,kind,level,state,amount_atomic::text AS "amountAtomic",base_atomic::text AS "baseAtomic",rate_bps AS "rateBps",
        asset_code AS currency,asset_decimals AS decimals,earned_at AS "occurredAt",claimed_at AS "claimedAt",settings_version AS "settingsVersion",
        substr(source_user_id::text,1,8) AS "memberLabel"
        FROM app.referral_rewards WHERE user_id=$1 ORDER BY earned_at DESC,id LIMIT $2 OFFSET $3`,[userId,p.pageSize,p.offset])
      return {items,total:count.total,page:p.page,pageSize:p.pageSize}
    })
  }
  async overview(page?:string,pageSize?:string) {
    await this.requireInstalled()
    const p=this.page(page,pageSize)
    return this.db.transaction('REPEATABLE READ',async m=>{
      const [counts]=await m.query(`SELECT (SELECT count(*)::int FROM app.referral_edges) AS bindings,
        (SELECT count(*)::int FROM app.referral_rewards) AS rewards,
        (SELECT coalesce(sum(amount_atomic),0)::text FROM app.referral_rewards) AS "rewardsAtomic",
        (SELECT coalesce(sum(amount_atomic) FILTER(WHERE state='earned'),0)::text FROM app.referral_rewards) AS "unclaimedAtomic",
        (SELECT coalesce(sum(amount_atomic),0)::text FROM app.referral_reward_claims) AS "claimedAtomic",
        (SELECT count(*)::int FROM app.referral_audit) AS total`)
      const items=await m.query('SELECT id,action,actor_id AS "actorId",object_id AS "objectId",created_at AS "createdAt" FROM app.referral_audit ORDER BY created_at DESC,id LIMIT $1 OFFSET $2',[p.pageSize,p.offset])
      return {counts,audit:{items,total:counts.total,page:p.page,pageSize:p.pageSize},stage:1,payoutsEnabled:true}
    })
  }
  /**
   * Invitation funnel (2026-10-28): how often the link was opened (one attribution per browser — first click wins),
   * how many signed up through it, and how many of them made a first Koala Quant subscription. Direct invitees only.
   * Counts only; never who. `userId` null = the whole platform (admin).
   */
  async funnel(userId: string | null) {
    await this.requireInstalled()
    const [ready]=await this.db.query("SELECT to_regclass('app.referral_quant_first_subscriptions') IS NOT NULL AS ready")
    const scope=(column:string)=>userId?`${column}=$1`:'true'
    const args=userId?[userId]:[]
    const count=(sql:string)=>this.db.query(sql,args).then((rows:any[])=>({last30d:Number(rows[0].recent),all:Number(rows[0].total)}))
    const window=(column:string)=>`count(*) FILTER (WHERE ${column}>now()-interval '30 days')::int AS recent,count(*)::int AS total`
    const [opened,registered,subscribed]=await Promise.all([
      count(`SELECT ${window('clicked_at')} FROM app.referral_attributions WHERE ${scope('inviter_user_id')}`),
      count(`SELECT ${window('bound_at')} FROM app.referral_edges WHERE ${scope('inviter_user_id')}`),
      ready.ready
        ? count(`SELECT ${window('f.recorded_at')} FROM app.referral_quant_first_subscriptions f JOIN app.referral_edges e ON e.invitee_user_id=f.user_id WHERE ${scope('e.inviter_user_id')}`)
        : Promise.resolve({last30d:0,all:0}),
    ])
    return {opened,registered,subscribed}
  }

}
