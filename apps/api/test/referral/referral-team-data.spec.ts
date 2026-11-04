import { BadRequestException, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { Test } from '@nestjs/testing'
import { ReferralReadService } from '../../src/referral/referral-read.service'
import { ReferralUserFoundationController } from '../../src/referral/referral-http.module'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { SessionAuthService } from '../../src/security/session-auth.service'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { PATH_METADATA } from '@nestjs/common/constants'
import { ReferralBindingService } from '../../src/referral/referral-binding.service'
import { ReferralClaimService } from '../../src/referral/referral-claim.service'
import { ReferralTeamService } from '../../src/referral/referral-team.service'
import { ReferralModule } from '../../src/referral/referral.module'
import { ObjectStorageModule } from '../../src/object-storage/object-storage.module'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'

@Global()
@Module({providers:[
  {provide:DataSource,useValue:{entityMetadatas:[],options:{type:'postgres'},getRepository:()=>({})}},
  {provide:ConfigService,useValue:new ConfigService({OBJECT_STORAGE_ENABLED:'false',AUTH_ADAPTER:'demo',
    IDENTITY_HMAC_KEY:'ab'.repeat(32),IDENTITY_ENC_KEY:'cd'.repeat(32)})},
],exports:[DataSource,ConfigService]})
class TeamModuleTestDependencies {}

describe('referral team contract and cache',()=>{
  const overview={members:1,l1:1,l2:0,l3:0,active30d:1,joinedThisMonth:1,
    teamPurchaseMonthAtomic:'10',teamPurchaseTotalAtomic:'20',asOf:new Date('2026-11-05T00:00:00Z')}
  const setup=()=>{
    const query=jest.fn(async(sql:string)=>sql.includes('to_regclass')?[{installed:true}]:[overview])
    return {query,read:new ReferralReadService({query} as never)}
  }
  it.each(['bad','ACTIVE','level desc','',null,[],['recent','active']])('rejects invalid sort %j before any query',async sort=>{
    const {read,query}=setup()
    await expect(read.invitees('viewer',undefined,undefined,undefined,sort as never)).rejects.toBeInstanceOf(BadRequestException)
    expect(query).not.toHaveBeenCalled()
  })
  it.each([['0','20','all'],['1','101','all'],['1','20','4']])('retains validation for pagination and depth %j',async(page,size,level)=>{
    await expect(setup().read.invitees('viewer',page,size,level)).rejects.toBeInstanceOf(BadRequestException)
  })
  it('caches aggregates per user for 60 seconds and retries failures',async()=>{
    const time=jest.spyOn(Date,'now').mockReturnValue(1000)
    try {
      const {read,query}=setup()
      const first=await read.teamOverview('a')
      expect(first.asOf).toBe('2026-11-05T00:00:00.000Z')
      time.mockReturnValue(60999)
      expect(await read.teamOverview('a')).toBe(first)
      expect(query).toHaveBeenCalledTimes(2)
      await read.teamOverview('b');expect(query).toHaveBeenCalledTimes(4)
      time.mockReturnValue(61000)
      await read.teamOverview('a');expect(query).toHaveBeenCalledTimes(6)
      query.mockRejectedValueOnce(new Error('temporary'))
      await expect(read.teamOverview('c')).rejects.toThrow('temporary')
      await expect(read.teamOverview('c')).resolves.toMatchObject({members:1})
    } finally {time.mockRestore()}
  })
  it('uses the summary guard, binds only the session user, and wires the sort query',async()=>{
    expect(Reflect.getMetadata(GUARDS_METADATA,ReferralUserFoundationController)).toContain(SessionAuthGuard)
    expect(Reflect.getMetadata(PATH_METADATA,ReferralUserFoundationController.prototype.teamOverview)).toBe('team-overview')
    const read={teamOverview:jest.fn(),invitees:jest.fn()}
    const controller=new ReferralUserFoundationController({} as never,read as never,{} as never,{} as never)
    const req={auth:{userId:'session-user'},query:{userId:'attacker'}} as never
    await controller.teamOverview(req);expect(read.teamOverview).toHaveBeenCalledWith('session-user')
    await controller.invitees(req,'2','10','1','active')
    expect(read.invitees).toHaveBeenCalledWith('session-user','2','10','1','active')
  })
  it('resolves the shared storage provider without a referral/identity module cycle',async()=>{
    const module=await Test.createTestingModule({imports:[TeamModuleTestDependencies,ReferralModule,ObjectStorageModule]}).compile()
    try {
      expect(module.get(ReferralReadService)).toBeInstanceOf(ReferralReadService)
      expect(new Set(module.get(ObjectStorageService,{each:true})).size).toBe(1)
    } finally {await module.close()}
  })
  it('rejects signed-out HTTP requests and invalid sort with 400',async()=>{
    const {read}=setup()
    const module=await Test.createTestingModule({controllers:[ReferralUserFoundationController],providers:[
      {provide:ReferralReadService,useValue:read},
      {provide:ReferralBindingService,useValue:{}},{provide:ReferralClaimService,useValue:{}},{provide:ReferralTeamService,useValue:{}},
      {provide:SessionAuthService,useValue:{authenticate:jest.fn(async()=>({userId:'viewer'}))}},
    ]}).compile()
    const app=module.createNestApplication({logger:false});app.setGlobalPrefix('v1')
    await app.listen(0,'127.0.0.1')
    try {
      const base=await app.getUrl()
      for (const path of ['team-overview','invitees']) expect((await fetch(`${base}/v1/referral/${path}`)).status).toBe(401)
      expect((await fetch(`${base}/v1/referral/invitees?sort=bad`,{headers:{authorization:'Bearer test'}})).status).toBe(400)
      const response=await fetch(`${base}/v1/referral/team-overview`,{headers:{authorization:'Bearer test'}})
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(await response.json()).toMatchObject({members:1,teamPurchaseMonthAtomic:'10',asOf:'2026-11-05T00:00:00.000Z'})
    } finally {await app.close()}
  })
})
