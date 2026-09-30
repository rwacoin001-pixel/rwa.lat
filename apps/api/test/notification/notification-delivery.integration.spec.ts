import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { JobQueueEntry, InboundCallbackEvent } from '../../src/job-queue/job-queue.entities'
import { JobQueueService } from '../../src/job-queue/job-queue.service'
import { NotificationDeliveryService } from '../../src/notification/notification-delivery.service'
import type { CreateNotificationDto } from '../../src/notification/notification.dto'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Notification delivery against isolated PostgreSQL', () => {
  let db: DataSource
  let service: NotificationDeliveryService
  let user: string
  let jobs: JobQueueService
  const actor = randomUUID()
  const config = new ConfigService({ IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64), EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'no-reply@example.test', RESEND_API_KEY: 'test-only-placeholder', NOTIFICATION_DELIVERY_WORKER_ENABLED: 'true' })
  const crypto = new IdentityCrypto(config)
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations()
    jobs = new JobQueueService(db.getRepository(JobQueueEntry), db.getRepository(InboundCallbackEvent), db)
  })
  beforeEach(async () => {
    ;[{ id: user }] = await db.query('INSERT INTO app.users DEFAULT VALUES RETURNING id')
    const email = `${user}@example.test`
    const encrypted = crypto.encrypt(email)
    await db.query(`INSERT INTO app.login_identities (user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at) VALUES ($1,'email','verified',$2,$3,$4,now())`, [user, crypto.hashIdentifier(email), encrypted.ciphertext, encrypted.keyVersion])
    service = new NotificationDeliveryService(db, config, crypto, jobs)
  })
  afterEach(async () => {
    service.onModuleDestroy()
    await db.query(`DELETE FROM app.job_queue WHERE payload->>'notificationId' IN (SELECT id::text FROM app.notifications WHERE recipient_user_id=$1)`, [user])
    await db.query('DELETE FROM app.notifications WHERE recipient_user_id=$1', [user])
    await db.query('DELETE FROM app.login_identities WHERE user_id=$1', [user])
    await db.query('DELETE FROM app.preferences WHERE user_id=$1', [user])
    await db.query('DELETE FROM app.users WHERE id=$1', [user])
    jest.restoreAllMocks()
  })
  afterAll(async () => { await db?.destroy() })
  const input = (channel: 'email' | 'in_app' = 'email'): CreateNotificationDto => ({ recipient_user_id: user, channel, kind: 'system', title: 'Test notification', body: 'An isolated test.', payload: { route: '/profile/security', test: true }, idempotencyKey: randomUUID() })

  it('concurrent retries share one durable notification and job', async () => {
    const intent = input()
    const [first, second] = await Promise.all([service.enqueue(intent, actor), service.enqueue(intent, actor)])
    expect(first.id).toBe(second.id)
    const [counts] = await db.query('SELECT count(*)::int AS count FROM app.notifications WHERE recipient_user_id=$1', [user])
    expect(counts.count).toBe(1)
    await expect(service.enqueue({ ...intent, body: 'Changed body' }, actor)).rejects.toThrow('different notification')
  })
  it('marks delivered only after provider acceptance and passes a stable provider key', async () => {
    const note = await service.enqueue(input(), actor)
    const send = jest.spyOn((service as any).email, 'send').mockResolvedValue(undefined)
    await service.runDue()
    const [stored] = await db.query('SELECT sent_at,payload FROM app.notifications WHERE id=$1', [note.id])
    expect(stored.sent_at).toBeTruthy()
    expect(stored.payload.delivery.state).toBe('provider_accepted')
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: `${user}@example.test`, idempotencyKey: `notification:${note.id}` }))
    await service.runDue()
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('keeps failed delivery unsent and queues a retry without creating another notification', async () => {
    const note = await service.enqueue(input(), actor)
    jest.spyOn((service as any).email, 'send').mockRejectedValue(new Error('Provider unavailable'))
    await service.runDue()
    const [stored] = await db.query('SELECT sent_at,payload FROM app.notifications WHERE id=$1', [note.id])
    expect(stored.sent_at).toBeNull()
    expect(stored.payload.delivery.state).toBe('retrying')
    const [job] = await db.query(`SELECT state,attempts FROM app.job_queue WHERE payload->>'notificationId'=$1`, [note.id])
    expect(job).toMatchObject({ state: 'pending', attempts: 1 })
  })
  it('recovers acknowledgement failure without resending an accepted email', async () => {
    const note = await service.enqueue(input(), actor)
    const send = jest.spyOn((service as any).email, 'send').mockResolvedValue(undefined)
    const ack = jest.spyOn(jobs, 'ack').mockRejectedValueOnce(new Error('Temporary database failure'))
    await service.runDue()
    const [accepted] = await db.query('SELECT sent_at,payload FROM app.notifications WHERE id=$1', [note.id])
    expect(accepted.sent_at).toBeTruthy()
    expect(accepted.payload.delivery.state).toBe('provider_accepted')
    await db.query(`UPDATE app.job_queue SET run_at=now()-interval '1 second' WHERE payload->>'notificationId'=$1`, [note.id])
    await service.runDue()
    expect(send).toHaveBeenCalledTimes(1)
    expect(ack).toHaveBeenCalledTimes(2)
    const [job] = await db.query(`SELECT state FROM app.job_queue WHERE payload->>'notificationId'=$1`, [note.id])
    expect(job.state).toBe('completed')
  })
  it('rejects unavailable channels and unverified recipients before persisting', async () => {
    await expect(service.enqueue({ ...input(), channel: 'sms' }, actor)).rejects.toThrow('not configured')
    await db.query(`UPDATE app.login_identities SET state='pending',verified_at=NULL WHERE user_id=$1`, [user])
    await expect(service.enqueue(input(), actor)).rejects.toThrow('verified email')
    const [row] = await db.query('SELECT count(*)::int AS count FROM app.notifications WHERE recipient_user_id=$1', [user])
    expect(row.count).toBe(0)
  })

  it('applies saved consent and channel preferences to optional updates', async () => {
    const intent = { ...input('in_app'), kind: 'marketing' }
    await expect(service.enqueue(intent, actor)).rejects.toThrow('consented')
    await db.query(`INSERT INTO app.preferences (user_id,channels,communication_consent) VALUES ($1,'{"in_app":true,"email":false}'::jsonb,true)`, [user])
    expect((await service.enqueue(intent, actor)).id).toBeTruthy()
    await expect(service.enqueue({ ...input(), kind: 'marketing' }, actor)).rejects.toThrow('consented')
    await db.query('DELETE FROM app.preferences WHERE user_id=$1', [user])
  })

  it('does not send an optional email after consent is withdrawn while queued', async () => {
    await db.query(`INSERT INTO app.preferences (user_id,channels,communication_consent) VALUES ($1,'{"email":true}'::jsonb,true)`, [user])
    const note = await service.enqueue({ ...input(), kind: 'product_update' }, actor)
    await db.query('UPDATE app.preferences SET communication_consent=false WHERE user_id=$1', [user])
    const send = jest.spyOn((service as any).email, 'send').mockResolvedValue(undefined)
    await service.runDue()
    expect(send).not.toHaveBeenCalled()
    const [stored] = await db.query('SELECT sent_at,payload FROM app.notifications WHERE id=$1', [note.id])
    expect(stored.sent_at).toBeNull()
    expect(stored.payload.delivery).toMatchObject({ state: 'canceled', reason: 'consent_withdrawn' })
    const [job] = await db.query(`SELECT state FROM app.job_queue WHERE payload->>'notificationId'=$1`, [note.id])
    expect(job.state).toBe('completed')
  })

  it('exposes an exhausted lease as failed without sending again', async () => {
    const note = await service.enqueue(input(), actor)
    await db.query(`UPDATE app.job_queue SET state='running',attempts=max_attempts,lease_expires_at=now()-interval '1 second'
      WHERE payload->>'notificationId'=$1`, [note.id])
    const send = jest.spyOn((service as any).email, 'send').mockResolvedValue(undefined)
    await service.runDue()
    expect(send).not.toHaveBeenCalled()
    const [stored] = await db.query('SELECT sent_at,payload FROM app.notifications WHERE id=$1', [note.id])
    expect(stored.sent_at).toBeNull()
    expect(stored.payload.delivery.state).toBe('failed')
  })
})
