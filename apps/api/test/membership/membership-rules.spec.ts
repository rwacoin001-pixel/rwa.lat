import { DEFAULT_MEMBER_CONFIG, memberScore, selectLevel, applyGrace, moneyBand, periodStart, money, teamDepth } from '../../src/membership/membership-rules'

describe('membership rules',()=>{
  const components={deposits:'1000',purchases:'2000',team:{l1:'3000',l2:'4000',l3:'5000'},members:{direct:4,team:30,directActive:3,teamActive:20},tasks:'10',firstDeposit:true}
  it('uses every configured coefficient without losing numeric precision',()=>{
    expect(memberScore(components,DEFAULT_MEMBER_CONFIG)).toBe('6260.000000')
    expect(memberScore({...components,deposits:'9007199254740993.123456',purchases:'0',team:{l1:'0',l2:'0',l3:'0'},members:{...components.members,teamActive:0},tasks:'0'},DEFAULT_MEMBER_CONFIG)).toBe('4503599627370496.561728')
    expect(memberScore(components,{...DEFAULT_MEMBER_CONFIG,coefficients:{...DEFAULT_MEMBER_CONFIG.coefficients,ownDeposits:2,taskPoints:2}})).toBe('7770.000000')
  })
  it('selects the highest eligible level and enforces each prerequisite',()=>{
    const pick=(score:string,extra={})=>selectLevel(score,{...components,...extra},DEFAULT_MEMBER_CONFIG).index
    expect(pick('999.999999')).toBe(1)
    expect(pick('1000',{firstDeposit:false})).toBe(1)
    expect(pick('1000')).toBe(2)
    expect(pick('10000')).toBe(3)
    expect(pick('50000',{members:{...components.members,directActive:2}})).toBe(3)
    expect(pick('50000')).toBe(4)
    expect(pick('200000',{members:{...components.members,directActive:5}})).toBe(5)
    expect(pick('1000000')).toBe(6)
    expect(pick('5000000')).toBe(6)
    expect(pick('5000000',{members:{...components.members,teamActive:50}})).toBe(7)
  })
  it('keeps a downgrade through the last Shanghai day of next month, then drops',()=>{
    const stored={level:5,graceUntil:null}
    expect(applyGrace(3,stored,new Date('2026-12-31T16:01:00Z'))).toEqual({level:5,graceUntil:'2027-02-28'})
    expect(applyGrace(3,{level:5,graceUntil:'2026-11-30'},new Date('2026-11-30T15:59:59Z'))).toEqual({level:5,graceUntil:'2026-11-30'})
    expect(applyGrace(3,{level:5,graceUntil:'2026-11-30'},new Date('2026-11-30T16:00:00Z'))).toEqual({level:3,graceUntil:null})
    expect(applyGrace(6,{level:5,graceUntil:'2026-11-30'},new Date())).toEqual({level:6,graceUntil:null})
    expect(applyGrace(5,{level:5,graceUntil:'2026-11-30'},new Date())).toEqual({level:5,graceUntil:null})
  })
  it.each([['0','0-1k'],['999.999999','0-1k'],['1000','1k-5k'],['5000','5k-10k'],['10000','10k-50k'],['50000','50k-100k'],['100000','100k-500k'],['500000','500k-1m'],['1000000','1m+']])('bands %s as %s',(amount,band)=>expect(moneyBand(amount)).toBe(band))
  it('rounds display money without floating point',()=>{expect(money('123.456789')).toBe('123.46');expect(money('9007199254740993.125')).toBe('9007199254740993.13')})
  it('rounds the final score to the stored six decimals, after adding all weighted terms',()=>{
    expect(memberScore({...components,deposits:'0.000001',purchases:'0',team:{l1:'0',l2:'0',l3:'0'},members:{...components.members,teamActive:0},tasks:'0'},DEFAULT_MEMBER_CONFIG)).toBe('0.000001')
  })
  it('caps configured depth at three',()=>{expect(teamDepth(DEFAULT_MEMBER_CONFIG)).toBe(3);expect(teamDepth({...DEFAULT_MEMBER_CONFIG,windows:{...DEFAULT_MEMBER_CONFIG.windows,maxDepth:4}})).toBe(3)})
  it('uses ISO weeks and calendar months in Shanghai at rollover',()=>{
    expect(periodStart('week',new Date('2026-11-01T16:00:00Z'))).toBe('2026-11-02')
    expect(periodStart('month',new Date('2026-10-31T16:00:00Z'))).toBe('2026-11-01')
    expect(periodStart('week',new Date('2027-01-01T00:00:00Z'))).toBe('2026-12-28')
  })
})
