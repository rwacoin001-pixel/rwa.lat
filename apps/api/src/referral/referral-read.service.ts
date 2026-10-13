import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
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
      return {stage:1,payoutsEnabled:true,currency:'USDT',decimals:6,balances,levels:[1,2,3].map(level=>({level,count:counts.find((r:any)=>r.level===level)?.count??0})),
        rules:{version:settings.version,feeRatesBps:settings.config.feeRatesBps,holdingRatesBps:settings.config.holdingRatesBps,teamTiers:settings.config.teamTiers,
          effectiveAt:{fee:settings.fee_effective_at,holding:settings.holding_effective_at,team:settings.team_effective_at}},
        purchaseRewardsEnabled:settings.config.holdingEnabled===true,feeRewardsEnabled:settings.config.feeEnabled===true,teamSettlementEnabled:false}
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
}
