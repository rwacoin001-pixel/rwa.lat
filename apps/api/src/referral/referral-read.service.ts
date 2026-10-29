import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'

@Injectable()
export class ReferralReadService {
  constructor(private readonly db: DataSource) {}
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
      const counts=await m.query(`WITH RECURSIVE team AS (
        SELECT invitee_user_id,1 AS level FROM app.referral_edges WHERE inviter_user_id=$1
        UNION ALL SELECT e.invitee_user_id,t.level+1 FROM app.referral_edges e JOIN team t ON e.inviter_user_id=t.invitee_user_id WHERE t.level<3
      ) SELECT level,count(*)::int AS count FROM team GROUP BY level ORDER BY level`,[userId])
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
  async invitees(userId: string,page?:string,pageSize?:string,level='all') {
    await this.requireInstalled()
    const p=this.page(page,pageSize)
    if (!['all','1','2','3'].includes(level)) throw new BadRequestException('Invalid level')
    const cte=`WITH RECURSIVE team AS (SELECT invitee_user_id,bound_at,1 AS level FROM app.referral_edges WHERE inviter_user_id=$1
      UNION ALL SELECT e.invitee_user_id,e.bound_at,t.level+1 FROM app.referral_edges e JOIN team t ON e.inviter_user_id=t.invitee_user_id WHERE t.level<3)`
    return this.db.transaction('REPEATABLE READ',async m=>{
      const [count]=await m.query(`${cte} SELECT count(*)::int AS total FROM team WHERE ($2='all' OR level::text=$2)`,[userId,level])
      const items=await m.query(`${cte} SELECT substr(invitee_user_id::text,1,8) AS "memberLabel",level,bound_at AS "boundAt" FROM team
        WHERE ($2='all' OR level::text=$2) ORDER BY bound_at DESC,invitee_user_id LIMIT $3 OFFSET $4`,[userId,level,p.pageSize,p.offset])
      return {items,total:count.total,page:p.page,pageSize:p.pageSize}
    })
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
