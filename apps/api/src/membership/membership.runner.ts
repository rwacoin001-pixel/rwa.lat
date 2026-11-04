import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { JobQueueService } from '../job-queue/job-queue.service'
import { MembershipService } from './membership.service'
import { RankingService } from './ranking.service'
import { MEMBERSHIP_QUEUE, MEMBERSHIP_SOURCES, type MembershipSource } from './membership-events'
import { shanghaiDate } from './membership-rules'

@Injectable()
export class MembershipRunner implements OnApplicationBootstrap,OnApplicationShutdown {
  private readonly log=new Logger(MembershipRunner.name)
  private readonly workerId=`membership:${randomUUID()}`
  private timer?:ReturnType<typeof setInterval>
  private running=false
  private ready=false
  private daily=''
  private hourly=''
  constructor(private readonly db:DataSource,private readonly jobs:JobQueueService,
    private readonly membership:MembershipService,private readonly ranks:RankingService) {}
  onApplicationBootstrap() {
    if(process.env.NODE_ENV==='test')return
    this.timer=setInterval(()=>void this.tick(),5000);this.timer.unref();void this.tick()
  }
  onApplicationShutdown() { if(this.timer)clearInterval(this.timer) }
  async tick(now=new Date()) {
    if(this.running)return
    this.running=true
    try {
      if(!this.ready) {
        const [row]=await this.db.query("SELECT to_regclass('app.member_level_settings') IS NOT NULL AS ready")
        if(!row?.ready)return
        this.ready=true
      }
      // Catch up the latest due 02:00 run on startup; persistent keys survive restarts/replicas.
      const local=new Date(now.getTime()+8*3600000),hour=local.toISOString().slice(0,13)
      const day=shanghaiDate(new Date(now.getTime()-(local.getUTCHours()<2?86400000:0)))
      if(this.daily!==day) {
        await this.jobs.enqueue({queueName:MEMBERSHIP_QUEUE,payload:{type:'daily',day},dedupKey:`membership-daily:${day}`})
        this.daily=day
      }
      if(this.hourly!==hour) {
        await this.jobs.enqueue({queueName:MEMBERSHIP_QUEUE,payload:{type:'rank'},dedupKey:`membership-rank:${hour}`})
        this.hourly=hour
      }
      const jobs=await this.jobs.claim(MEMBERSHIP_QUEUE,1,new Date(),{workerId:this.workerId,leaseSeconds:300})
      for(const job of jobs) {
        const heartbeat=setInterval(()=>{void this.jobs.heartbeat(job.id,this.workerId,300).catch(()=>this.log.warn('Membership execution lease could not be renewed'))},60000)
        heartbeat.unref()
        try {
          await this.execute(job.payload)
          await this.jobs.ack(job.id,new Date(),this.workerId)
        } catch {
          this.log.warn('Membership job failed; queued for retry')
          await this.jobs.nack(job.id,'Membership computation failed',new Date(),this.workerId)
        } finally { clearInterval(heartbeat) }
      }
    } catch { this.log.warn('Membership queue could not be processed') }
    finally { this.running=false }
  }
  private async execute(payload:Record<string,unknown>) {
    if(payload.type==='change') {
      if(typeof payload.source!=='string'||!Object.prototype.hasOwnProperty.call(MEMBERSHIP_SOURCES,payload.source)||typeof payload.sourceId!=='string')throw new Error('Invalid membership source')
      const [row]=await this.db.query(MEMBERSHIP_SOURCES[payload.source as MembershipSource],[payload.sourceId])
      if(row)await this.membership.recomputeAffected(row.user_id)
    } else if(payload.type==='rank') {
      await this.ranks.generate(await this.membership.settings())
    } else if(payload.type==='daily') {
      if(typeof payload.day!=='string'||(payload.after!==undefined&&typeof payload.after!=='string'))throw new Error('Invalid membership batch')
      const rows=await this.db.query('SELECT id FROM app.users WHERE ($1::uuid IS NULL OR id>$1::uuid) ORDER BY id LIMIT 250',[payload.after??null])
      await this.membership.recompute(rows.map((r:any)=>r.id))
      if(rows.length===250) {
        const after=rows[rows.length-1].id
        await this.jobs.enqueue({queueName:MEMBERSHIP_QUEUE,payload:{type:'daily',day:payload.day,after},dedupKey:`membership-daily:${payload.day}:${after}`})
      }
    } else throw new Error('Invalid membership job')
  }
}
