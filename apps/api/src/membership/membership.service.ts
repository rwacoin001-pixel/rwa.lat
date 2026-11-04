import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { applyGrace, decimal, memberScore, micro, money, selectLevel, teamDepth, type MemberComponents, type MemberConfig } from './membership-rules'
import { COMPONENTS_SQL } from './membership-sql'

@Injectable()
export class MembershipService {
  constructor(private readonly db:DataSource) {}
  async settings():Promise<MemberConfig> {
    const [row]=await this.db.query('SELECT config FROM app.member_level_settings WHERE active')
    if(!row)throw new ServiceUnavailableException('Membership settings are not available')
    return row.config
  }
  async recompute(userIds:string[],config?:MemberConfig) {
    const ids=[...new Set(userIds)].sort()
    if(!ids.length)return
    const rules=config??await this.settings()
    await this.db.transaction(async m=>{
      // Serialize overlapping daily/incremental/on-demand batches, including users with no row yet.
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended('membership:'||id::text,0)) FROM unnest($1::uuid[]) t(id) ORDER BY id`,[ids])
      const now=new Date()
      const previous=await m.query('SELECT user_id,level,grace_until::text FROM app.member_levels WHERE user_id=ANY($1::uuid[])',[ids])
      const old=new Map<string,any>(previous.map((r:any)=>[r.user_id,r]))
      const rows=await m.query(COMPONENTS_SQL,[ids,teamDepth(rules),now,rules.windows.purchaseDays,rules.windows.activeDays])
      const values=rows.map((r:any)=>{
        const components:MemberComponents={deposits:r.deposits,purchases:r.purchases,team:{l1:r.l1,l2:r.l2,l3:r.l3},tasks:r.tasks,
          firstDeposit:r.first_deposit,members:{direct:r.direct,team:r.team,directActive:r.direct_active,teamActive:r.team_active}}
        const score=memberScore(components,rules),stored=old.get(r.user_id)
        const grace=applyGrace(selectLevel(score,components,rules).index,stored?{level:stored.level,graceUntil:stored.grace_until}:undefined,now)
        return {user_id:r.user_id,level:grace.level,score,components,grace_until:grace.graceUntil}
      })
      const payload=JSON.stringify(values)
      await m.query(`INSERT INTO app.member_level_history(user_id,from_level,to_level,score)
        SELECT v.user_id,coalesce(o.level,1),v.level,v.score FROM jsonb_to_recordset($1::jsonb) AS v(user_id uuid,level smallint,score numeric)
        LEFT JOIN app.member_levels o ON o.user_id=v.user_id WHERE coalesce(o.level,1)<>v.level`,[payload])
      await m.query(`INSERT INTO app.member_levels(user_id,level,score,components,grace_until,computed_at)
        SELECT user_id,level,score,components,grace_until,$2 FROM jsonb_to_recordset($1::jsonb)
          AS v(user_id uuid,level smallint,score numeric,components jsonb,grace_until date)
        ON CONFLICT(user_id) DO UPDATE SET level=excluded.level,score=excluded.score,components=excluded.components,
          grace_until=excluded.grace_until,computed_at=excluded.computed_at`,[payload,now])
    })
  }
  async recomputeAffected(userId:string) {
    const config=await this.settings()
    const rows=await this.db.query(`WITH RECURSIVE up AS (
      SELECT $1::uuid AS user_id,0 AS depth,ARRAY[$1::uuid] AS path
      UNION ALL SELECT e.inviter_user_id,u.depth+1,u.path||e.inviter_user_id FROM up u JOIN app.referral_edges e ON e.invitee_user_id=u.user_id
      WHERE u.depth<LEAST($2::int,3) AND NOT e.inviter_user_id=ANY(u.path)
    ) SELECT user_id FROM up`,[userId,teamDepth(config)])
    await this.recompute(rows.map((r:any)=>r.user_id),config)
  }
  async me(userId:string) {
    const config=await this.settings()
    let [row]=await this.db.query('SELECT *,grace_until::text AS grace_until FROM app.member_levels WHERE user_id=$1',[userId])
    if(!row) {
      await this.recompute([userId],config)
      ;[row]=await this.db.query('SELECT *,grace_until::text AS grace_until FROM app.member_levels WHERE user_id=$1',[userId])
    }
    if(!row)throw new NotFoundException('Member not found')
    const c:MemberComponents=row.components,level=config.levels.find(l=>l.index===row.level)??config.levels[0]
    const target=config.levels.find(l=>l.index===level.index+1)
    const missing:Record<string,string|number|boolean>={score:money(decimal(target&&micro(target.threshold)>micro(row.score)?micro(target.threshold)-micro(row.score):0n))}
    if(target?.requires.directActive!==undefined)missing.directActive=Math.max(0,target.requires.directActive-c.members.directActive)
    if(target?.requires.teamActive!==undefined)missing.teamActive=Math.max(0,target.requires.teamActive-c.members.teamActive)
    if(target?.requires.firstDeposit)missing.firstDeposit=!c.firstDeposit
    return {level:{index:level.index,key:level.key},score:money(row.score),
      components:{deposits:money(c.deposits),purchases:money(c.purchases),team:{l1:money(c.team.l1),l2:money(c.team.l2),l3:money(c.team.l3)},members:c.members,tasks:money(c.tasks)},
      next:target?{index:target.index,key:target.key,threshold:Number(target.threshold),missing}:null,
      graceUntil:row.grace_until??null,updatedAt:row.computed_at,
      levels:config.levels.map(l=>({...l,threshold:Number(l.threshold)}))}
  }
  async visibility(userId:string,hidden:boolean) {
    if(typeof hidden!=='boolean')throw new BadRequestException('hidden must be a boolean')
    // Match community's bootstrap identity. Hidden preference can be set before the first community visit.
    await this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`community-member:${userId}`])
      const rows=await m.query('UPDATE app.community_profiles SET hide_from_rank=$2 WHERE user_id=$1 RETURNING id',[userId,hidden])
      if(!rows.length)await m.query(`INSERT INTO app.community_profiles(user_id,handle,display_name,kind,hide_from_rank)
        VALUES($1::uuid,left('u'||replace($1::uuid::text,'-',''),32),'Member '||right(left('u'||replace($1::uuid::text,'-',''),32),6),'member',$2)`,[userId,hidden])
    })
    return {hidden}
  }
}
