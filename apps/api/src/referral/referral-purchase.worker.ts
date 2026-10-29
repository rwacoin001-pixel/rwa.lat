import { ConflictException, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { JobQueueService } from '../job-queue/job-queue.service'
import { NotificationDeliveryService } from '../notification/notification-delivery.service'
import { usdt } from '../quant/quant-notices'
import { REFERRAL_PURCHASE_QUEUE, type ReferralPurchaseProduct } from './referral-purchase'

const SOURCES:Record<ReferralPurchaseProduct,string>={
  quant:`SELECT user_id AS "userId",amount_atomic::text AS "amountAtomic",coalesce(settled_at,created_at) AS "occurredAt"
    FROM app.quant_orders WHERE id=$1 AND kind='subscription' AND status IN ('accepted','settled')`,
  rwa:`SELECT user_id AS "userId",filled_atomic_amount::text AS "amountAtomic",coalesce(completed_at,processed_at,submitted_at) AS "occurredAt"
    FROM app.orders WHERE id=$1 AND side='buy' AND state IN ('filled','partially_filled') AND filled_atomic_amount>0
      AND settlement_asset_code='USDT' AND settlement_asset_decimals=6`,
  prediction:`SELECT user_id AS "userId",stake_atomic::text AS "amountAtomic",created_at AS "occurredAt"
    FROM app.prediction_bets WHERE id=$1 AND status IN ('placed','won','lost')`,
}

@Injectable()
export class ReferralPurchaseWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log=new Logger(ReferralPurchaseWorker.name)
  private readonly workerId=`referral-purchase:${randomUUID()}`
  private timer?:NodeJS.Timeout
  private running=false
  constructor(private readonly db:DataSource,private readonly delivery:NotificationDeliveryService,
    private readonly jobs:JobQueueService,private readonly config:ConfigService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV==='test' || this.config.get('REFERRAL_PURCHASE_NOTIFICATIONS_DISABLED')==='true') return
    this.timer=setInterval(()=>void this.tick(),5_000)
    this.timer.unref()
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer) }

  async tick() {
    if(this.running) return
    this.running=true
    try {
      const jobs=await this.jobs.claim(REFERRAL_PURCHASE_QUEUE,1,new Date(),{workerId:this.workerId,leaseSeconds:120})
      for(const job of jobs) {
        try {
          const {product,sourceId}=job.payload
          if(typeof product!=='string' || !Object.prototype.hasOwnProperty.call(SOURCES,product) || typeof sourceId!=='string') throw new Error('Invalid purchase event')
          await this.deliver(product as ReferralPurchaseProduct,sourceId)
          await this.jobs.ack(job.id,new Date(),this.workerId)
        } catch {
          this.log.warn('Referral purchase notice delivery failed; queued for retry')
          await this.jobs.nack(job.id,'Referral purchase notice delivery failed',new Date(),this.workerId)
        }
      }
    } catch { this.log.warn('Referral purchase notice queue could not be processed') }
    finally { this.running=false }
  }

  private async deliver(product:ReferralPurchaseProduct,sourceId:string) {
    // Never trust a queued user or amount: read the committed business record.
    const [source]=await this.db.query(SOURCES[product],[sourceId])
    if(!source) return
    const uplines=await this.db.query(`WITH RECURSIVE up AS (
      SELECT inviter_user_id AS user_id,1 AS level,ARRAY[invitee_user_id,inviter_user_id] AS path FROM app.referral_edges
        WHERE invitee_user_id=$1 AND bound_at<=$2
      UNION ALL SELECT e.inviter_user_id,u.level+1,u.path||e.inviter_user_id FROM up u JOIN app.referral_edges e ON e.invitee_user_id=u.user_id
        WHERE u.level<3 AND e.bound_at<=$2 AND NOT e.inviter_user_id=ANY(u.path)
    ) SELECT up.user_id AS "userId",up.level,coalesce(p.locale,u.locale) AS locale,
      (SELECT sum(r.amount_atomic)::text FROM app.referral_rewards r WHERE r.user_id=up.user_id AND r.source_user_id=$1
        AND r.asset_code='USDT' AND r.asset_decimals=6 AND (
          ($3='quant' AND r.source_type='quant_subscription' AND r.source_id=$4::uuid) OR
          ($3='rwa' AND r.source_type='order' AND r.source_id=$4::uuid) OR
          ($3='prediction' AND r.source_type='prediction_fee' AND r.source_id IN (
            SELECT e.id FROM app.ledger_entries e JOIN app.ledger_transactions t ON t.id=e.transaction_id
            WHERE t.transaction_type='prediction_stake' AND t.reference_id=$4::uuid)))) AS "rewardAtomic"
      FROM up JOIN app.users u ON u.id=up.user_id LEFT JOIN app.preferences p ON p.user_id=up.user_id
      WHERE u.status NOT IN ('closed','suspended') ORDER BY up.level`,[source.userId,source.occurredAt,product,sourceId])
    const seen=new Set<string>([source.userId])
    let failed=false
    for(const up of uplines) {
      if(!Number.isInteger(up.level)||up.level<1||up.level>3||seen.has(up.userId)) continue
      seen.add(up.userId)
      try {
        const actor=`referral-purchase:${product}:${sourceId}`
        // A retry must keep the first intent even if the recipient changes language later.
        const [existing]=await this.db.query(`SELECT n.id FROM app.notifications n JOIN app.job_queue j ON j.payload->>'notificationId'=n.id::text WHERE j.dedup_key=$1`,[`notification:${actor}:${up.userId}`])
        if(existing) continue
        const memberLabel=source.userId.slice(0,8),zh=(up.locale??'').toLowerCase().startsWith('zh')
        const name=product==='quant'?(zh?'考拉量化':'Koala Quant'):product==='prediction'?(zh?'预测市场':'prediction'):(zh?'组合':'a basket')
        const amount=usdt(BigInt(source.amountAtomic)),reward=up.rewardAtomic===null?null:usdt(BigInt(up.rewardAtomic))
        await this.delivery.enqueue({recipient_user_id:up.userId,channel:'in_app',kind:'referral.invitee.purchase',idempotencyKey:up.userId,
          title:zh?`你邀请的用户 ${memberLabel} 买入了 ${amount} USDT ${name}`:`Your invitee ${memberLabel} bought ${amount} USDT of ${name}`,
          body:zh?`第 ${up.level} 级${reward===null?'':` · 你获得奖励 ${reward} USDT`}`:`Level ${up.level}${reward===null?'':` · You earned ${reward} USDT`}`,
          payload:{memberLabel,level:up.level,product,amountAtomic:source.amountAtomic,rewardAtomic:up.rewardAtomic,route:`/community?tab=invite&member=${memberLabel}`}},actor)
      } catch(error) {
        if(error instanceof ConflictException && (error.getResponse() as {code?:string}).code==='NOTIFICATION_CONSENT_REQUIRED') continue
        failed=true
      }
    }
    if(failed) throw new Error('Referral purchase recipients pending')
  }
}
