import { NotificationDeliveryService } from '../../src/notification/notification-delivery.service'
import { ReferralPurchaseWorker } from '../../src/referral/referral-purchase.worker'
import { enqueueReferralPurchase } from '../../src/referral/referral-purchase'
import { isOptionalNotification } from '../../src/common/notification-email'

describe('referral purchase notifications',()=>{
  function setup(product='quant') {
    const saved:any[]=[]; const keys=new Map<string,any>()
    const tx={query:jest.fn(async(sql:string,args:any[])=>{
      if(sql.includes('pg_advisory')) return []
      if(sql.includes('SELECT n.*')) return keys.has(args[0])?[keys.get(args[0])]:[]
      if(sql.includes('preferences')) return [{communication_consent:true,channels:{in_app:true}}]
      if(sql.includes('INSERT INTO app.job_queue')) {keys.set(args[3],saved[saved.length-1]);return []}
      throw new Error(sql)
    }),create:(_entity:any,value:any)=>value,save:async(_entity:any,value:any)=>{const note={id:String(saved.length+1),...value};saved.push(note);return note}}
    const delivery=new NotificationDeliveryService({transaction:async(run:any)=>run(tx)} as never,{get:()=>undefined} as never,{} as never,{} as never)
    const source={userId:'abcdef01-0000-4000-8000-000000000000',amountAtomic:'123456789',occurredAt:new Date(1)}
    const db={query:jest.fn(async(sql:string,args:any[])=>{
      if(sql.includes('SELECT n.id')) return keys.has(args[0])?[{id:'exists'}]:[]
      if(sql.includes('WITH RECURSIVE')) return [1,2,3,4].map(level=>({userId:`up${level}`,level,locale:level===1?'zh-CN':'fr',rewardAtomic:level===1?'1000000':null}))
      return [source]
    })}
    const jobs={claim:jest.fn().mockResolvedValue([{id:'job',payload:{product,sourceId:'source'}}]),ack:jest.fn(),nack:jest.fn()}
    const worker=new ReferralPurchaseWorker(db as never,delivery,jobs as never,{get:()=>undefined} as never)
    return {worker,saved,keys,tx,db,jobs,source}
  }
  it.each(['quant','rwa','prediction'])('fans out %s to levels 1–3 and deduplicates retries through delivery',async product=>{
    const {worker,saved,keys,jobs,db,source}=setup(product)
    await worker.tick(); await worker.tick()
    expect(saved).toHaveLength(3)
    expect(keys.size).toBe(3)
    expect(saved.map(n=>n.recipient_user_id)).toEqual(['up1','up2','up3'])
    expect(saved[0].title).toContain('你邀请的用户 abcdef01 买入了 123.46 USDT')
    expect(saved[0].body).toBe('第 1 级 · 你获得奖励 1.00 USDT')
    expect(saved[1].body).toBe('Level 2')
    expect(saved[1].title).toContain('Your invitee abcdef01 bought')
    expect(saved[2].payload.content).toEqual({memberLabel:'abcdef01',level:3,product,amountAtomic:'123456789',rewardAtomic:null,route:'/community?tab=invite&member=abcdef01'})
    expect(jobs.nack).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('u.level<3'),[source.userId,source.occurredAt,product,'source'])
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('e.bound_at<=$2'),expect.any(Array))
  })
  it.each([
    {communication_consent:false,channels:{in_app:true}},
    undefined,
  ])('is an account notice, delivered in-app without marketing consent (%j)',async preference=>{
    expect(isOptionalNotification('referral.invitee.purchase')).toBe(false)
    const {worker,saved,tx,jobs}=setup()
    const original=tx.query.getMockImplementation()!
    tx.query.mockImplementation(async(sql,args)=>sql.includes('preferences')?(preference?[preference]:[]):original(sql,args))
    await worker.tick()
    expect(saved.length).toBeGreaterThan(0)
    expect(jobs.ack).toHaveBeenCalled()
    expect(jobs.nack).not.toHaveBeenCalled()
  })
  it.each(['quant','rwa','prediction'])('skips missing or ineligible %s source records',async product=>{
    const {worker,saved,db,jobs}=setup(product)
    db.query.mockResolvedValueOnce([])
    await worker.tick()
    expect(saved).toHaveLength(0)
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(jobs.ack).toHaveBeenCalledTimes(1)
    expect(jobs.nack).not.toHaveBeenCalled()
  })
  it('keeps an already delivered intent when language or rewards change before retry',async()=>{
    const {worker,saved,db}=setup()
    await worker.tick()
    const original=db.query.getMockImplementation()!
    db.query.mockImplementation(async(sql,args)=>sql.includes('WITH RECURSIVE')
      ? [{userId:'up1',level:1,locale:'en',rewardAtomic:'2000000'}] : original(sql,args))
    await worker.tick()
    expect(saved).toHaveLength(3)
    expect(saved[0].body).toBe('第 1 级 · 你获得奖励 1.00 USDT')
  })
  it('does not accept a user id or amount supplied in a queued event',async()=>{
    const {worker,saved,jobs,db}=setup()
    jobs.claim.mockResolvedValue([{id:'job',payload:{product:'quant',sourceId:'source',userId:'attacker',amountAtomic:'999'}}])
    await worker.tick()
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM app.quant_orders WHERE id=$1'),['source'])
    expect(saved[0].payload.amountAtomic).toBe('123456789')
    expect(saved[0].payload.memberLabel).toBe('abcdef01')
  })
  it('logs a synchronous enqueue failure without throwing into the purchase path',async()=>{
    const db={query:jest.fn(()=>{throw new Error('offline')})}
    expect(enqueueReferralPurchase(db as never,'rwa','source')).toBeUndefined()
    await new Promise(resolve=>setImmediate(resolve))
    expect(db.query).toHaveBeenCalledTimes(1)
  })
  it('retries partial failures without sending successful recipients twice',async()=>{
    const {worker,saved,tx,jobs}=setup()
    const original=tx.query.getMockImplementation()!
    let failed=false
    tx.query.mockImplementation(async(sql,args)=>{
      if(Array.isArray(args)&&JSON.stringify(args).includes('up2')&&!failed){failed=true;throw new Error('unavailable')}
      return original(sql,args)
    })
    await worker.tick(); await worker.tick()
    expect(saved.map(n=>n.recipient_user_id).sort()).toEqual(['up1','up2','up3'])
    expect(jobs.nack).toHaveBeenCalledTimes(1)
  })
  it('never rejects or waits for delivery on the purchase path',async()=>{
    const db={query:jest.fn().mockRejectedValue(new Error('offline'))}
    expect(enqueueReferralPurchase(db as never,'quant','source')).toBeUndefined()
    await new Promise(resolve=>setImmediate(resolve))
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (dedup_key) DO NOTHING'),expect.arrayContaining(['referral-purchase:quant:source']))
  })
})
