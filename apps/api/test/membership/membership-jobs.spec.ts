import { enqueueMembershipChange, MEMBERSHIP_QUEUE } from '../../src/membership/membership-events'
import { MembershipRunner } from '../../src/membership/membership.runner'

describe('membership jobs',()=>{
  it('queues changes without awaiting the queue or propagating queue failure',async()=>{
    const db={query:jest.fn().mockRejectedValue(new Error('offline'))}
    expect(enqueueMembershipChange(db as never,'deposit','source')).toBeUndefined()
    await new Promise(resolve=>setImmediate(resolve))
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.job_queue'),[MEMBERSHIP_QUEUE,JSON.stringify({type:'change',source:'deposit',sourceId:'source'})])
  })
  it('reads the committed source and updates the user and uplines through the service',async()=>{
    const db={query:jest.fn(async(sql:string)=>sql.includes('to_regclass')?[{ready:true}]:[{user_id:'owner'}])}
    const jobs={enqueue:jest.fn(),claim:jest.fn().mockResolvedValue([{id:'j',payload:{type:'change',source:'quant',sourceId:'committed',userId:'attacker'}}]),ack:jest.fn(),nack:jest.fn()}
    const membership={recomputeAffected:jest.fn()}
    const runner=new MembershipRunner(db as never,jobs as never,membership as never,{} as never)
    await runner.tick(new Date('2026-11-04T00:00:00Z'))
    expect(membership.recomputeAffected).toHaveBeenCalledWith('owner')
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('app.quant_orders'),['committed'])
    expect(jobs.ack).toHaveBeenCalled()
    expect(jobs.nack).not.toHaveBeenCalled()
  })
  it('schedules one daily cycle at Shanghai 02:00 and one snapshot per hour',async()=>{
    const db={query:jest.fn().mockResolvedValue([{ready:true}])}
    const jobs={enqueue:jest.fn(),claim:jest.fn().mockResolvedValue([])}
    const runner=new MembershipRunner(db as never,jobs as never,{} as never,{} as never)
    await runner.tick(new Date('2026-11-03T17:59:00Z'))
    await runner.tick(new Date('2026-11-03T18:00:00Z'))
    await runner.tick(new Date('2026-11-03T18:00:05Z'))
    expect(jobs.enqueue.mock.calls.map(([v])=>v.dedupKey)).toEqual(['membership-daily:2026-11-03','membership-rank:2026-11-04T01','membership-daily:2026-11-04','membership-rank:2026-11-04T02'])
  })
})
