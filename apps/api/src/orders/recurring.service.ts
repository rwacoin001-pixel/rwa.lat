import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { OrdersService } from './orders.service'
import { CreateRecurringDto } from './recurring.dto'
import { randomUUID } from 'node:crypto'

export function nextRecurringDate(current: Date, anchor: Date, frequency: string): Date {
  if (frequency === 'daily' || frequency === 'weekly') return new Date(current.getTime() + (frequency === 'daily' ? 1 : 7) * 86400000)
  const year = current.getUTCFullYear(), month = current.getUTCMonth() + 1
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  return new Date(Date.UTC(year, month, day, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()))
}

@Injectable()
export class RecurringService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(RecurringService.name)
  private timer: NodeJS.Timeout | null = null
  private running = false
  constructor(private readonly db: DataSource, private readonly orders: OrdersService, private readonly config: ConfigService) {}
  private enabled() { return this.config.get<string>('RECURRING_INVESTMENT_WORKER_ENABLED') === 'true' }
  onApplicationBootstrap() {
    if (!this.enabled()) return
    this.timer = setInterval(() => void this.tick(), 30000); this.timer.unref()
    void this.tick()
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); this.timer = null }

  async list(userId: string) {
    return this.db.query(`SELECT r.id,r.product_id AS "productId",p.display_name AS "productName",r.amount_atomic::text AS "amountAtomic",
      r.frequency,r.next_run_at AS "nextRunAt",r.state,r.consented_at AS "consentedAt",
      COALESCE((SELECT jsonb_agg(x) FROM (SELECT state,order_id AS "orderId",failure_code AS "failureCode",scheduled_at AS "scheduledAt"
        FROM app.recurring_investment_runs WHERE plan_id=r.id ORDER BY scheduled_at DESC LIMIT 10) x),'[]'::jsonb) AS runs
      FROM app.recurring_investments r JOIN app.products p ON p.id=r.product_id WHERE r.user_id=$1 ORDER BY r.created_at DESC`, [userId])
  }
  async create(userId: string, input: CreateRecurringDto, key: string): Promise<{ id: string; replay: boolean }> {
    if (!this.enabled()) throw new ServiceUnavailableException('定投调度尚未启用')
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new BadRequestException('缺少有效的幂等编号')
    const [existing] = await this.db.query('SELECT * FROM app.recurring_investments WHERE user_id=$1 AND idempotency_key=$2', [userId,key])
    const first = new Date(input.firstRunAt)
    if (existing) {
      if (existing.product_id !== input.productId || BigInt(existing.amount_atomic) !== BigInt(input.amountAtomic) || existing.frequency !== input.frequency || new Date(existing.anchor_at).getTime() !== first.getTime()) throw new ConflictException('该编号已用于不同定投计划')
      return { id: existing.id, replay: true }
    }
    if (!Number.isFinite(first.getTime()) || first.getTime() <= Date.now()) throw new BadRequestException('首次执行时间必须在未来')
    const [product] = await this.db.query(`SELECT id FROM app.products WHERE id=$1 AND state='published' AND asset_class_id <> 'prediction'`, [input.productId])
    if (!product) throw new BadRequestException('请选择已发布的普通投资产品')
    const inserted = await this.db.query(`INSERT INTO app.recurring_investments (user_id,product_id,amount_atomic,frequency,anchor_at,next_run_at,idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$5,$6) ON CONFLICT (user_id,idempotency_key) DO NOTHING RETURNING id`, [userId,input.productId,input.amountAtomic,input.frequency,first,key])
    if (!inserted.length) return this.create(userId,input,key)
    return { id: inserted[0].id, replay: false }
  }
  async changeState(userId: string, id: string, state: string) {
    return this.db.transaction(async em => {
      const [plan] = await em.query('SELECT * FROM app.recurring_investments WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])
      if (!plan) throw new NotFoundException('计划不存在')
      if (plan.state === 'cancelled' && state !== 'cancelled') throw new ConflictException('已取消计划不能恢复')
      if (state === 'active' && !this.enabled()) throw new ServiceUnavailableException('定投调度尚未启用')
      let next = new Date(plan.next_run_at)
      // Resuming never retroactively debits missed installments.
      if (state === 'active' && plan.state === 'paused') while (next.getTime() <= Date.now()) next = nextRecurringDate(next,new Date(plan.anchor_at),plan.frequency)
      await em.query('UPDATE app.recurring_investments SET state=$2,next_run_at=$3,updated_at=now() WHERE id=$1',[id,state,next])
      return { id,state,nextRunAt:next }
    })
  }

  async runDue(now = new Date()) {
    if (!this.enabled()) return 0
    let count = 0
    for (; count < 20; count++) {
      const result = await this.db.transaction(async em => {
        const [plan] = await em.query(`SELECT * FROM app.recurring_investments WHERE state='active' AND next_run_at <= $1 ORDER BY next_run_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [now])
        if (!plan) return null
        const scheduled = new Date(plan.next_run_at)
        const next = nextRecurringDate(scheduled,new Date(plan.anchor_at),plan.frequency)
        const key = `recurring:${plan.id}:${scheduled.getTime()}`
        let orderId: string | null = null, failure: string | null = null
        const [priorOrder] = await em.query('SELECT id FROM app.orders WHERE user_id=$1 AND idempotency_key=$2',[plan.user_id,key])
        if (priorOrder) orderId = priorOrder.id
        else if (next <= now) failure = 'SCHEDULE_MISSED'
        else {
          try { orderId = (await this.orders.create(plan.user_id,{ productId:plan.product_id,atomicAmount:String(plan.amount_atomic) },key,key)).id }
          catch (error) {
            // The order may have committed before a response/notification failed.
            const [committed] = await em.query('SELECT id FROM app.orders WHERE user_id=$1 AND idempotency_key=$2',[plan.user_id,key])
            if (committed) orderId = committed.id
            else if (error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() < 500) {
              const response = error.getResponse()
              failure = typeof response === 'object' && 'code' in response ? String(response.code).slice(0,100) : 'ORDER_REJECTED'
            } else if ((error as { code?: string })?.code === '23514') failure = 'INSUFFICIENT_BALANCE'
            else throw error
          }
        }
        const [run] = await em.query(`INSERT INTO app.recurring_investment_runs (plan_id,scheduled_at,state,order_id,failure_code) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [plan.id,scheduled,orderId ? 'submitted' : 'failed',orderId,failure])
        await em.query('UPDATE app.recurring_investments SET next_run_at=$2,updated_at=now() WHERE id=$1',[plan.id,next])
        return { runId:run.id,userId:plan.user_id,planId:plan.id,orderId,failure }
      })
      if (!result) break
    }
    await this.deliverNotices()
    return count
  }

  private async deliverNotices() {
    await this.db.transaction(async em => {
      const rows = await em.query(`SELECT r.*,p.user_id FROM app.recurring_investment_runs r JOIN app.recurring_investments p ON p.id=r.plan_id
        WHERE r.notified_at IS NULL ORDER BY r.completed_at LIMIT 20 FOR UPDATE OF r SKIP LOCKED`)
      for (const row of rows) {
        await em.query(`INSERT INTO app.notifications
          (id,recipient_user_id,channel,kind,title,body,payload)
          VALUES ($1,$2,'in_app',$3,$4,$5,$6::jsonb)`, [
          randomUUID(), row.user_id, `recurring.${row.state}`,
          row.state === 'failed' ? 'Recurring investment failed' : 'Recurring investment submitted',
          row.state === 'failed' ? 'This installment was not charged. Your next installment remains scheduled.' : 'Your investment request was submitted and is awaiting execution.',
          JSON.stringify({ planId:row.plan_id,runId:row.id,orderId:row.order_id,failureCode:row.failure_code }),
        ])
        await em.query('UPDATE app.recurring_investment_runs SET notified_at=now() WHERE id=$1',[row.id])
      }
    })
  }
  private async tick() {
    if (this.running) return
    this.running = true
    try { await this.runDue() } catch { this.log.warn('Recurring processing failed; uncommitted work will retry with the same order key.') }
    finally { this.running=false }
  }
}
