import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { DataSource } from 'typeorm'
import { EmailDeliveryClient } from '../common/email-delivery.client'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { JobQueueService } from '../job-queue/job-queue.service'
import { Notification } from './notification.entity'
import type { CreateNotificationDto } from './notification.dto'

const QUEUE = 'notification-email'

@Injectable()
export class NotificationDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly email: EmailDeliveryClient
  private readonly log = new Logger(NotificationDeliveryService.name)
  private readonly workerId = `notification:${randomUUID()}`
  private timer?: NodeJS.Timeout
  private running = false
  constructor(private readonly ds: DataSource, private readonly config: ConfigService,
    private readonly crypto: IdentityCrypto, private readonly jobs: JobQueueService) {
    this.email = new EmailDeliveryClient(config)
  }
  channels() {
    return { in_app: true, email: this.email.configured && this.config.get('NOTIFICATION_DELIVERY_WORKER_ENABLED') === 'true', sms: false, push: false }
  }
  onModuleInit() {
    if (!this.channels().email) return
    this.timer = setInterval(() => { void this.runDue().catch(() => this.log.warn('Notification delivery queue could not be processed')) }, 5_000)
    this.timer.unref()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.email.close() }

  async enqueue(input: CreateNotificationDto, actorId: string) {
    if (!this.channels()[input.channel]) throw new ServiceUnavailableException({ code: 'NOTIFICATION_CHANNEL_UNAVAILABLE', message: 'This notification delivery channel is not configured.' })
    if (input.channel === 'email') await this.emailFor(input.recipient_user_id)
    const key = `notification:${actorId}:${input.idempotencyKey ?? randomUUID()}`
    return this.ds.transaction(async tx => {
      // Serialize an intent before checking it so concurrent retries share one record.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key])
      const [existing] = await tx.query(`SELECT n.* FROM app.notifications n JOIN app.job_queue j ON j.payload->>'notificationId' = n.id::text WHERE j.dedup_key=$1`, [key])
      if (existing) {
        if (existing.recipient_user_id !== input.recipient_user_id || existing.channel !== input.channel || existing.kind !== input.kind || existing.title !== input.title || (existing.body ?? '') !== (input.body ?? '') || !isDeepStrictEqual(existing.payload?.content ?? {}, input.payload ?? {})) {
          throw new ConflictException({ code: 'NOTIFICATION_INTENT_CHANGED', message: 'This request key already belongs to a different notification.' })
        }
        return Object.assign(new Notification(), existing)
      }
      if (['marketing', 'product_update'].includes(input.kind)) {
        const [preference] = await tx.query('SELECT channels,communication_consent FROM app.preferences WHERE user_id=$1', [input.recipient_user_id])
        if (!preference?.communication_consent || !preference.channels?.[input.channel]) throw new ConflictException({ code: 'NOTIFICATION_CONSENT_REQUIRED', message: 'The recipient has not consented to updates on this channel.' })
      }
      const note = await tx.save(Notification, tx.create(Notification, { recipient_user_id: input.recipient_user_id,
        channel: input.channel, kind: input.kind, title: input.title, body: input.body,
        payload: { ...input.payload, content: input.payload ?? {}, delivery: { state: input.channel === 'email' ? 'queued' : 'delivered' } },
        sent_at: input.channel === 'in_app' ? new Date() : undefined }))
      await tx.query(`INSERT INTO app.job_queue (queue_name,payload,state,dedup_key,max_attempts,completed_at)
        VALUES ($1,$2::jsonb,$3,$4,5,$5)`, [input.channel === 'email' ? QUEUE : 'notification-in-app', JSON.stringify({ notificationId: note.id }), input.channel === 'email' ? 'pending' : 'completed', key, input.channel === 'email' ? null : new Date()])
      return note
    })
  }

  async runDue() {
    if (this.running || !this.channels().email) return 0
    this.running = true
    try {
      // Claim one message at a time so waiting messages do not lose their lease during a slow send.
      const jobs = await this.jobs.claim(QUEUE, 1, new Date(), { workerId: this.workerId, leaseSeconds: 900 })
      await this.ds.query(`UPDATE app.notifications n SET payload=jsonb_set(n.payload,'{delivery}','{"state":"failed"}'::jsonb)
        FROM app.job_queue j WHERE j.queue_name=$1 AND j.state='dead' AND j.payload->>'notificationId'=n.id::text
        AND n.sent_at IS NULL AND n.payload->'delivery'->>'state' IS DISTINCT FROM 'failed'`, [QUEUE])
      for (const job of jobs) {
        const id = String(job.payload.notificationId)
        try {
          const [note] = await this.ds.query('SELECT * FROM app.notifications WHERE id=$1', [id])
          if (!note) throw new Error('Notification missing')
          if (!note.sent_at) {
            if (['marketing', 'product_update'].includes(note.kind)) {
              const [preference] = await this.ds.query('SELECT channels,communication_consent FROM app.preferences WHERE user_id=$1', [note.recipient_user_id])
              if (!preference?.communication_consent || !preference.channels?.email) {
                await this.ds.query(`UPDATE app.notifications SET payload=jsonb_set(payload,'{delivery}','{"state":"canceled","reason":"consent_withdrawn"}'::jsonb) WHERE id=$1`, [id])
                await this.jobs.ack(job.id, new Date(), this.workerId)
                continue
              }
            }
            // Provider idempotency is bounded in time; expired attempts require review.
            if (new Date(job.createdAt).getTime() < Date.now() - 23 * 60 * 60 * 1000) throw new Error('Delivery intent expired')
            await this.email.send({ to: await this.emailFor(note.recipient_user_id), subject: note.title, text: note.body || note.title, idempotencyKey: `notification:${id}` })
          }
          // A previous worker may have delivered successfully before its queue acknowledgement failed.
          await this.ds.query(`UPDATE app.notifications SET sent_at=COALESCE(sent_at,now()), payload=jsonb_set(payload,'{delivery}', '{"state":"provider_accepted"}'::jsonb) WHERE id=$1`, [id])
          await this.jobs.ack(job.id, new Date(), this.workerId)
        } catch {
          const result = await this.jobs.nack(job.id, 'Notification delivery failed; check channel configuration and recipient.', new Date(), this.workerId)
          await this.ds.query(`UPDATE app.notifications SET payload=jsonb_set(payload,'{delivery}',$2::jsonb) WHERE id=$1 AND sent_at IS NULL`, [id, JSON.stringify({ state: result.state === 'dead' ? 'failed' : 'retrying' })])
        }
      }
      return jobs.length
    } finally { this.running = false }
  }

  private async emailFor(userId: string) {
    const [row] = await this.ds.query(`SELECT i.identifier_ciphertext,i.encryption_key_version FROM app.login_identities i JOIN app.users u ON u.id=i.user_id
      WHERE i.user_id=$1 AND i.kind='email' AND i.state='verified' AND u.status='active' ORDER BY i.verified_at DESC LIMIT 1`, [userId])
    if (!row?.identifier_ciphertext) throw new ConflictException({ code: 'NOTIFICATION_EMAIL_UNVERIFIED', message: 'The recipient has no verified email address.' })
    return this.crypto.decrypt(row.identifier_ciphertext, row.encryption_key_version)
  }
}
