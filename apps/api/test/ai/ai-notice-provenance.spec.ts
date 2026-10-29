import { Logger } from '@nestjs/common'
import { validate } from 'class-validator'
import { AiChatDto } from '../../src/ai/dto/ai.dto'
import { AiService } from '../../src/ai/ai.service'
import { AiController } from '../../src/ai/ai.controller'
import { NotificationService } from '../../src/notification/notification.service'
import { QuantService } from '../../src/quant/quant.service'
import { publicModelText } from '../../src/ai/ai-assistant.policy'
import { OWNER, OTHER, RECORD, readFixture } from '../ai-evals/fixtures'

describe('Notice provenance in chat', () => {
  afterEach(()=>jest.restoreAllMocks())
  it('replaces vendor names without swallowing the next word, in English and Chinese',()=>{
    expect(publicModelText('DeepSeek is the provider.','en')).toBe('large model is the provider.')
    expect(publicModelText('使用 DeepSeek-flash。','zh-CN')).toBe('使用 大模型。')
  })
  function fixture() {
    const f = readFixture(), session = {id:RECORD,userId:OWNER,title:'New conversation'}
    const sessions = { create:(v:any)=>v,save:jest.fn(async(v:any)=>({...session,...v})),findOne:jest.fn(async()=>session) }
    const messages = {create:(v:any)=>v,save:jest.fn(async(v:any)=>({...v,createdAt:new Date()})),find:jest.fn(async()=>[]),delete:jest.fn()}
    const model = {configured:true,complete:jest.fn(async(..._args:any[])=>({text:JSON.stringify({reply:'DeepSeek says this is a real settlement; the loss was deducted from principal.',sourceIds:[],questions:[]}),model:'deepseek-flash'}))}
    return {...f,sessions,messages,model,service:new AiService(sessions as any,messages as any,model as any,undefined,undefined,f.tools)}
  }
  it('passes notification ID through the request and inserts server-verified provenance before the final reply', async()=>{
    jest.spyOn(Logger.prototype,'log').mockImplementation(()=>undefined)
    const f = fixture()
    const reply = await new AiController(f.service).chat({message:'Explain this loss',notificationId:RECORD,userId:OTHER} as any,{userId:OWNER} as any)
    expect(f.d.notifications.getForUser).toHaveBeenCalledWith(RECORD,OWNER)
    expect(f.model.complete.mock.calls[0][0]).toContain('SERVER-VERIFIED NOTICE OWNERSHIP')
    expect(f.model.complete.mock.calls[0][0]).toContain('"settlementVerified":true')
    expect(reply.reply).toContain('real settlement')
    expect(reply.reply).toContain('large model says')
    expect(JSON.stringify(reply)).not.toMatch(/deepseek/i)
  })
  it('denies guests and foreign notice IDs before storing messages or calling the model', async()=>{
    const f = fixture()
    await expect(f.service.chat(null,{message:'Explain',notificationId:RECORD})).rejects.toThrow()
    f.d.notifications.getForUser.mockRejectedValue(new Error('Not found'))
    await expect(f.service.chat(OWNER,{message:'Explain',notificationId:OTHER})).rejects.toThrow()
    expect(f.model.complete).not.toHaveBeenCalled()
    expect(f.messages.save).not.toHaveBeenCalled()
  })
  it('validates the notification ID and rejects client identity properties', async()=>{
    expect(await validate(Object.assign(new AiChatDto(),{message:'Explain',notificationId:'not-an-id'}))).toHaveLength(1)
    expect(await validate(Object.assign(new AiChatDto(),{message:'Explain',notificationId:RECORD,userId:OTHER}),{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(1)
  })
  it('loads only an owned in-app notification at the repository boundary', async()=>{
    const repo = {findOne:jest.fn(async()=>null)}, service = new NotificationService(repo as any)
    await expect(service.getForUser(RECORD,OWNER)).rejects.toThrow()
    expect(repo.findOne).toHaveBeenCalledWith({where:{id:RECORD,recipient_user_id:OWNER,channel:'in_app'}})
  })
  it('binds exact quant payout, order and ledger source queries to the session user', async()=>{
    const db = {query:jest.fn(async(..._args:any[])=>[])}, service = new QuantService(db as any,{} as any,{} as any,{} as any)
    jest.spyOn(service,'getProductRow').mockResolvedValue({id:RECORD} as any)
    await service.getMyPayout(OWNER,'koala','2026-10-28')
    expect(db.query.mock.calls[0][1]).toEqual([OWNER,RECORD,'2026-10-28'])
    expect(db.query.mock.calls[0][0]).toContain('user_id=$1')
    await service.getMyOrder(OWNER,RECORD)
    expect(db.query.mock.calls[1][1]).toEqual([OWNER,RECORD])
    expect(db.query.mock.calls[1][0]).toContain('o.user_id=$1')
    await service.getMyNoticeLedgerRecord(OWNER,RECORD)
    expect(db.query.mock.calls[2][0]).toContain('a.user_id=$1')
  })
})
