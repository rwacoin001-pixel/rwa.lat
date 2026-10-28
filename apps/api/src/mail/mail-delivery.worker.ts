import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { EmailDeliveryClient } from '../common/email-delivery.client'
import { JobQueueService } from '../job-queue/job-queue.service'

@Injectable()
export class MailDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly email: EmailDeliveryClient
  private readonly workerId = `support-mail:${randomUUID()}`
  private readonly log = new Logger(MailDeliveryWorker.name)
  private timer?: NodeJS.Timeout
  private running = false
  constructor(private readonly ds: DataSource, private readonly config: ConfigService, private readonly jobs: JobQueueService) {
    this.email = new EmailDeliveryClient(config)
  }
  onModuleInit() {
    if (this.config.get('MAIL_DELIVERY_WORKER_ENABLED') !== 'true' || !this.email.configured) return
    this.timer = setInterval(() => { void this.runDue().catch(() => this.log.warn('Support mail queue could not be processed')) }, 5000)
    this.timer.unref()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.email.close() }
  async runDue() {
    if (this.running || this.config.get('MAIL_DELIVERY_WORKER_ENABLED') !== 'true' || !this.email.configured) return 0
    this.running = true
    try {
      const jobs = await this.jobs.claim('support-mail', 1, new Date(), { workerId: this.workerId, leaseSeconds: 900 })
      await this.ds.query(`UPDATE app.mail_messages m SET delivery_state='failed' FROM app.job_queue j
        WHERE j.queue_name='support-mail' AND j.state='dead' AND j.payload->>'messageId'=m.id::text AND m.sent_at IS NULL`)
      for (const job of jobs) {
        const id = String(job.payload.messageId)
        try {
          const [m] = await this.ds.query('SELECT * FROM app.mail_messages WHERE id=$1 AND direction=\'out\'', [id])
          if (!m) throw new Error('Message missing')
          if (!m.sent_at) {
            if (new Date(job.createdAt).getTime() < Date.now() - 23 * 60 * 60 * 1000) throw new Error('Delivery intent expired')
            await this.email.send({ from: m.from_address, to: m.to_addresses, cc: m.cc_addresses, subject: m.subject, text: m.text_body,
              messageId: m.message_id, inReplyTo: m.in_reply_to, references: m.references_ids, idempotencyKey: `support-mail:${id}` })
            await this.ds.query(`UPDATE app.mail_messages SET sent_at=COALESCE(sent_at,now()),delivery_state='sent' WHERE id=$1`, [id])
          }
          await this.jobs.ack(job.id, new Date(), this.workerId)
        } catch {
          const result = await this.jobs.nack(job.id, 'Support mail delivery failed; check provider configuration.', new Date(), this.workerId)
          await this.ds.query(`UPDATE app.mail_messages SET delivery_state=$2 WHERE id=$1 AND sent_at IS NULL`, [id, result.state === 'dead' ? 'failed' : 'retrying'])
        }
      }
      return jobs.length
    } finally { this.running = false }
  }
}
