import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReferralReadService } from '../../src/referral/referral-read.service'
import { ReferralUserFoundationController } from '../../src/referral/referral-http.module'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'

describe('referral member detail',()=>{
  const member={memberLabel:'abcdef01',userId:'abcdef01-0000-4000-8000-000000000000',level:2,boundAt:new Date(1),registeredAt:new Date(0)}
  function setup(matches:unknown[]=[member]) {
    const query=jest.fn().mockResolvedValueOnce(matches)
    const db={query:jest.fn().mockResolvedValue([{installed:true}]),transaction:jest.fn(async(_isolation,run)=>run({query}))}
    return {read:new ReferralReadService(db as never),query,db}
  }
  it.each(['outside the tree','at level 4'])('returns 404 for a member %s before reading financial data',async()=>{
    const {read,query}=setup([])
    await expect(read.invitee('viewer','abcdef01')).rejects.toBeInstanceOf(NotFoundException)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE t.level<3'),['viewer','abcdef01'])
    expect(query.mock.calls[0][0]).toContain('WHERE inviter_user_id=$1')
  })
  it('does not disclose a colliding label',async()=>{
    const {read,query}=setup([member,{...member,userId:'abcdef01-1111-4000-8000-000000000000'}])
    await expect(read.invitee('viewer','abcdef01')).rejects.toBeInstanceOf(NotFoundException)
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('validates the exact list label format',async()=>{
    const {read,db}=setup()
    await expect(read.invitee('viewer','abcdef01-extra')).rejects.toBeInstanceOf(BadRequestException)
    expect(db.transaction).not.toHaveBeenCalled()
  })
  it('returns atomic aggregates without rounding or exposing the member id',async()=>{
    const {read,query}=setup()
    const deposits={totalAtomic:'9007199254740993000001',count:2,lastAt:new Date(3)}
    const purchases={quantAtomic:'1000000',rwaAtomic:'250000',predictionAtomic:'100001',totalAtomic:'1350001',count:3,lastAt:new Date(4)}
    const rewards={totalAtomic:'30',earnedAtomic:'20',claimedAtomic:'10'}
    query.mockResolvedValueOnce([deposits]).mockResolvedValueOnce([purchases]).mockResolvedValueOnce([rewards])
    const result=await read.invitee('viewer','abcdef01')
    expect(result).toEqual({memberLabel:member.memberLabel,level:2,boundAt:member.boundAt,registeredAt:member.registeredAt,deposits,purchases,rewardsToMe:rewards,currency:'USDT',decimals:6})
    expect(JSON.stringify(result)).not.toContain(member.userId)
    const depositSql=query.mock.calls[1][0]
    expect(depositSql).toContain("state='credited'")
    expect(depositSql).toContain("state='posted'")
    expect(depositSql).toContain('recipient_user_id=$1')
    expect(depositSql).toContain('power(10::numeric,6-asset_decimals)')
    const purchaseSql=query.mock.calls[2][0]
    expect(purchaseSql).toContain("status IN ('accepted','settled')")
    expect(purchaseSql).toContain("state IN ('filled','partially_filled')")
    expect(purchaseSql).toContain('filled_atomic_amount')
    expect(purchaseSql).toContain("status IN ('placed','won','lost')")
    expect(query.mock.calls[3][0]).toContain('user_id=$1 AND source_user_id=$2')
    expect(query.mock.calls[3][1]).toEqual(['viewer',member.userId])
    expect(query.mock.calls[1][1]).toEqual([member.userId])
    expect(query.mock.calls[2][1]).toEqual([member.userId])
    expect(query.mock.calls[3][0]).toContain("kind IN ('purchase','fee')")
  })
  it.each([1,2,3])('returns zero totals and null dates for an inactive level-%s member',async level=>{
    const {read,query,db}=setup([{...member,level}])
    const deposits={totalAtomic:'0',count:0,lastAt:null}
    const purchases={quantAtomic:'0',rwaAtomic:'0',predictionAtomic:'0',totalAtomic:'0',count:0,lastAt:null}
    const rewardsToMe={totalAtomic:'0',earnedAtomic:'0',claimedAtomic:'0'}
    query.mockResolvedValueOnce([deposits]).mockResolvedValueOnce([purchases]).mockResolvedValueOnce([rewardsToMe])
    await expect(read.invitee('viewer',member.memberLabel)).resolves.toEqual({memberLabel:member.memberLabel,level,boundAt:member.boundAt,registeredAt:member.registeredAt,deposits,purchases,rewardsToMe,currency:'USDT',decimals:6})
    expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ',expect.any(Function))
  })
  it('binds the viewer to the session in the controller',async()=>{
    expect(Reflect.getMetadata(GUARDS_METADATA,ReferralUserFoundationController)).toContain(SessionAuthGuard)
    const read={invitee:jest.fn().mockResolvedValue({})}
    const controller=new ReferralUserFoundationController({} as never,read as never,{} as never,{} as never)
    await (controller as any).invitee({auth:{userId:'session-user'},body:{userId:'attacker'}},'abcdef01')
    expect(read.invitee).toHaveBeenCalledWith('session-user','abcdef01')
  })
})
