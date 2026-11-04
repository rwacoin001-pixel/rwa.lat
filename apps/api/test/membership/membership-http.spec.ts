import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { MembershipController, RankingController } from '../../src/membership/membership.module'
import { MembershipService } from '../../src/membership/membership.service'
import { RankingService } from '../../src/membership/ranking.service'
import { SessionAuthService } from '../../src/security/session-auth.service'

describe('membership HTTP auth and validation',()=>{
  let app:INestApplication,base:string
  const membership={me:jest.fn(async(userId:string)=>({level:{index:1,key:'stardust'},score:'0.00',owner:userId})),visibility:jest.fn(async(_userId:string,hidden:boolean)=>({hidden}))}
  const ranking={read:jest.fn(async(board?:string,period?:string,userId?:string)=>({board:board??'score',period:period??'week',items:[],me:userId?{rank:null,band:'0-1k',hidden:false}:null}))}
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[MembershipController,RankingController],providers:[
      {provide:MembershipService,useValue:membership},{provide:RankingService,useValue:ranking},
      {provide:SessionAuthService,useValue:{authenticate:async(token:string)=>{if(token!=='valid')throw new UnauthorizedException();return {userId:'member',sessionId:'session',deviceId:null}}}},
    ]}).compile()
    app=module.createNestApplication();app.setGlobalPrefix('v1')
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}))
    await app.listen(0,'127.0.0.1');base=await app.getUrl()
  })
  afterAll(async()=>{await app?.close()})
  it('requires a session for both membership endpoints',async()=>{
    expect((await fetch(`${base}/v1/membership/me`)).status).toBe(401)
    expect((await fetch(`${base}/v1/membership/rank-visibility`,{method:'PUT',headers:{'content-type':'application/json'},body:'{"hidden":true}'})).status).toBe(401)
    const result=await fetch(`${base}/v1/membership/me`,{headers:{authorization:'Bearer valid'}})
    expect(result.status).toBe(200);expect(membership.me).toHaveBeenCalledWith('member')
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it('accepts only a boolean visibility value',async()=>{
    const update=(body:unknown)=>fetch(`${base}/v1/membership/rank-visibility`,{method:'PUT',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)})
    expect((await update({hidden:'false'})).status).toBe(400)
    expect((await update({})).status).toBe(400)
    expect((await update({hidden:true,userId:'other'})).status).toBe(400)
    const response=await update({hidden:true});expect(response.status).toBe(200);expect(await response.json()).toEqual({hidden:true})
    expect(membership.visibility).toHaveBeenCalledWith('member',true)
  })
  it('allows anonymous rank reads, treats stale sessions as anonymous, and marks responses private',async()=>{
    for(const token of ['', 'stale','valid']) {
      const response=await fetch(`${base}/v1/rank?board=invest&period=month`,{headers:token?{authorization:`Bearer ${token}`}:{}})
      expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect((await response.json() as {me:unknown}).me===null).toBe(token!=='valid')
    }
    expect(ranking.read).toHaveBeenCalledWith('invest','month','member')
  })
})
