import { MembershipService } from '../../src/membership/membership.service'
import { RankingService } from '../../src/membership/ranking.service'
import { DEFAULT_MEMBER_CONFIG } from '../../src/membership/membership-rules'

describe('membership persistence and rank privacy',()=>{
  it('computes an uninitialized user, stores a batch and serializes only public components',async()=>{
    let stored:any
    const query=jest.fn(async(sql:string,args?:any[])=>{
      if(sql.includes('member_level_settings'))return [{config:DEFAULT_MEMBER_CONFIG}]
      if(sql.includes('pg_advisory'))return []
      if(sql.includes('FROM app.member_levels WHERE'))return stored?[stored]:[]
      if(sql.includes('WITH RECURSIVE roots'))return [{user_id:'u',deposits:'2000',purchases:'0',tasks:'0',first_deposit:true,l1:'0',l2:'0',l3:'0',direct:0,team:0,direct_active:0,team_active:0}]
      if(sql.includes('INSERT INTO app.member_levels')){const [row]=JSON.parse(args![0]);stored={...row,grace_until:row.grace_until,computed_at:new Date()};return []}
      return []
    })
    const db={query,transaction:async(fn:any)=>fn({query})}
    const service=new MembershipService(db as never)
    const result=await service.me('u')
    expect(result.level).toEqual({index:2,key:'planet'})
    expect(result.score).toBe('1000.00')
    expect(result.components).toEqual({deposits:'2000.00',purchases:'0.00',tasks:'0.00',team:{l1:'0.00',l2:'0.00',l3:'0.00'},members:{direct:0,team:0,directActive:0,teamActive:0}})
    expect(result.next).toMatchObject({index:3,key:'star',missing:{score:'9000.00'}})
    expect(result).not.toHaveProperty('userId')
    expect(query.mock.calls.filter(([sql])=>sql.includes('INSERT INTO app.member_levels'))).toHaveLength(1)
  })
  it('never serializes ids, exact values, or email from rank rows',async()=>{
    const query=jest.fn(async(sql:string)=>{
      if(sql.includes('FROM app.rank_snapshots s'))return [{rank:1,handle:'alice',display_name:'Alice',avatar_url:null,avatar_seed:'opaque-avatar',level:4,value:'12345.678900',user_id:'private-user',email:'private@example.com'}]
      if(sql.includes('max(generated_at)'))return [{generated_at:new Date('2026-11-04T00:00:00Z')}]
      return []
    })
    const result=await new RankingService({query,transaction:async(_isolation:any,fn:any)=>fn({query})} as never).read('invest','week')
    expect(result.items).toEqual([{rank:1,handle:'alice',displayName:'Alice',avatarUrl:null,avatarSeed:'opaque-avatar',level:4,band:'10k-50k'}])
    expect(result.me).toBeNull()
    const serialized=JSON.stringify(result)
    expect(serialized).not.toMatch(/private-user|private@example|12345|user_id/)
    expect(query.mock.calls.some(([sql])=>sql.includes('NOT p.hide_from_rank'))).toBe(true)
  })
  it.each([['bad','week'],['score','year']])('rejects invalid rank selectors (%s,%s)',async(board,period)=>{
    await expect(new RankingService({} as never).read(board,period)).rejects.toMatchObject({status:400})
  })
})
