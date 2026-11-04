import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { moneyBand, periodStart, teamDepth, type MemberConfig } from './membership-rules'
import { rankValuesSql } from './membership-sql'

export const RANK_BOARDS=['score','invest','team','invite'] as const
export type RankBoard=typeof RANK_BOARDS[number]
export const rankBand=(board:string,value:string)=>board==='invite'?value.split('.')[0]:moneyBand(value)

@Injectable()
export class RankingService {
  constructor(private readonly db:DataSource) {}
  async generate(config:MemberConfig,now=new Date()) {
    await this.db.transaction('REPEATABLE READ',async m=>{
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended('membership-rank-snapshots',0))")
      for(const period of ['week','month'] as const) {
        const start=periodStart(period,now)
        await m.query('DELETE FROM app.rank_snapshots WHERE period=$1 AND period_start=$2',[period,start])
        await m.query(`INSERT INTO app.rank_snapshots(board,period,period_start,user_id,rank,value,generated_at)
          SELECT board,$5,$1::date,user_id,position,value,$3 FROM (
            SELECT v.user_id,b.board,b.value,row_number() OVER(PARTITION BY b.board ORDER BY b.value DESC,v.user_id) AS position
            FROM (${rankValuesSql()}) v CROSS JOIN LATERAL (VALUES ('score',v.score::numeric),('invest',v.invest::numeric),
              ('team',v.team::numeric),('invite',v.invite::numeric)) b(board,value)
          ) ranked WHERE position<=100 AND value>0`,[start,teamDepth(config),now,config.windows.activeDays,period])
      }
    })
  }
  async read(board='score',period='week',userId?:string,now=new Date()) {
    if(!RANK_BOARDS.includes(board as RankBoard)||!['week','month'].includes(period))throw new BadRequestException('Invalid rank board or period')
    const start=periodStart(period as 'week'|'month',now)
    return this.db.transaction('REPEATABLE READ',async m=>{
      const [stamp]=await m.query('SELECT max(generated_at) AS generated_at FROM app.rank_snapshots WHERE board=$1 AND period=$2 AND period_start=$3',[board,period,start])
      const rows=await m.query(`SELECT s.rank,s.value::text,p.handle,p.display_name,p.avatar_url,p.id::text AS avatar_seed,coalesce(l.level,1) AS level
        FROM app.rank_snapshots s JOIN app.community_profiles p ON p.user_id=s.user_id LEFT JOIN app.member_levels l ON l.user_id=s.user_id
        WHERE s.board=$1 AND s.period=$2 AND s.period_start=$3 AND NOT p.hide_from_rank AND p.identity_configured AND p.is_active AND p.handle<>''
        ORDER BY s.rank LIMIT 100`,[board,period,start])
      let me:{rank:number|null;band:string;hidden:boolean}|null=null
      if(userId) {
        const [profile]=await m.query('SELECT hide_from_rank,handle,identity_configured,is_active FROM app.community_profiles WHERE user_id=$1',[userId])
        const hidden=profile?.hide_from_rank??false
        const [snapshot]=hidden?[]:await m.query(`SELECT rank,value::text FROM app.rank_snapshots WHERE board=$1 AND period=$2 AND period_start=$3 AND user_id=$4`,[board,period,start,userId])
        let value=snapshot?.value
        if(value===undefined) {
          const [settings]=await m.query('SELECT config FROM app.member_level_settings WHERE active')
          if(!settings)throw new ServiceUnavailableException('Membership settings are not available')
          const config:MemberConfig=settings.config
          const [own]=await m.query(rankValuesSql(true),[start,teamDepth(config),now,config.windows.activeDays,userId])
          value=own?.[board]??'0'
        }
        me={rank:!hidden&&profile?.identity_configured&&profile.handle&&profile.is_active?snapshot?.rank??null:null,band:rankBand(board,value),hidden}
      }
      return {board,period,periodStart:start,generatedAt:stamp?.generated_at??null,
        items:rows.map((r:any)=>({rank:r.rank,handle:r.handle,displayName:r.display_name,avatarUrl:r.avatar_url??null,avatarSeed:r.avatar_seed,level:r.level,band:rankBand(board,r.value)})),me}
    })
  }
}
