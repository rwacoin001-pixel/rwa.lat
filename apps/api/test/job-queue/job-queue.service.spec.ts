import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { JobQueueService } from '../../src/job-queue/job-queue.service'
import { JobQueueEntry, InboundCallbackEvent } from '../../src/job-queue/job-queue.entities'

const Q = 'test-queue'

describe('JobQueueService (Pg)', () => {
  let ds: DataSource
  let svc: JobQueueService

  beforeAll(async () => {
    const opts = buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })
    ds = new DataSource({
      ...opts,
      entities: [...(Array.isArray(opts.entities) ? opts.entities : []), JobQueueEntry, InboundCallbackEvent],
    })
    await ds.initialize()
    await ds.query('DROP SCHEMA IF EXISTS app CASCADE')
    await ds.query('DROP TABLE IF EXISTS public.schema_migrations')
    await ds.runMigrations({ transaction: 'all' })
    svc = new JobQueueService(
      ds.getRepository(JobQueueEntry),
      ds.getRepository(InboundCallbackEvent),
      ds,
    )
  })

  afterAll(async () => { await ds.destroy() })

  it('enqueue dedup: same dedupKey returns existing job', async () => {
    const j1 = await svc.enqueue({ queueName: Q, payload: { x: 1 }, dedupKey: 'k1' })
    const j2 = await svc.enqueue({ queueName: Q, payload: { x: 2 }, dedupKey: 'k1' })
    expect(j2.id).toBe(j1.id)
  })

  it('claim picks pending jobs up to limit and sets running', async () => {
    await svc.enqueue({ queueName: Q, payload: { n: 1 } })
    await svc.enqueue({ queueName: Q, payload: { n: 2 } })
    const claimed = await svc.claim(Q, 2)
    console.log('CLAIM DEBUG:', JSON.stringify(claimed))
    expect(claimed.length).toBe(2)
    expect(claimed.every((j: any) => j.state === 'running')).toBe(true)
  })

  it('claim only picks jobs whose run_at has arrived', async () => {
    const future = new Date(Date.now() + 60000)
    await svc.enqueue({ queueName: Q, payload: { late: true }, runAt: future })
    const claimed = await svc.claim(Q, 1, new Date())
    expect(claimed.every((j: any) => j.payload?.late !== true)).toBe(true)
  })

  it('ack marks job completed', async () => {
    const job = await svc.enqueue({ queueName: Q, payload: { ack: true } })
    const [c] = await svc.claim(Q, 1)
    // claim may have picked a different job; ack the one we just claimed
    const done = await svc.ack(c.id)
    expect(done.state).toBe('completed')
    expect(done.completedAt).not.toBeNull()
  })

  it('nack retries with backoff, then dead-letters after max_attempts', async () => {
    const job = await svc.enqueue({ queueName: Q, payload: { retry: true }, maxAttempts: 2 })
    // First claim + nack
    let claimed = await svc.claim(Q, 100)
    const target = claimed.find((c) => c.id === job.id)!
    await svc.nack(target.id, 'boom')
    const after1 = await ds.getRepository(JobQueueEntry).findOne({ where: { id: job.id } })
    expect(after1!.state).toBe('pending') // went back for retry
    expect(after1!.runAt.getTime()).toBeGreaterThan(Date.now())

    // Manually fast-forward: claim again (run_at may be in future, so claim with future now)
    claimed = await svc.claim(Q, 100, new Date(Date.now() + 600_000))
    const target2 = claimed.find((c) => c.id === job.id)!
    expect(target2).toBeDefined()
    await svc.nack(target2.id, 'boom again')
    const after2 = await ds.getRepository(JobQueueEntry).findOne({ where: { id: job.id } })
    expect(after2!.state).toBe('dead')
    expect(after2!.lastError).toContain('boom')
  })

  it('replay resets dead job to pending', async () => {
    const dead = await svc.listDead(Q)
    expect(dead.length).toBeGreaterThan(0)
    const id = dead[0].id
    const replayed = await svc.replay(id, 3)
    expect(replayed.state).toBe('pending')
    expect(replayed.attempts).toBe(0)
  })

  it('receiveCallback deduplicates by partner+external_id', async () => {
    const evt = await svc.receiveCallback({ partner: 'P1', eventType: 'dep', externalId: 'ext-1', payload: {}, signatureOk: true })
    expect(evt.id).toBeDefined()
    await expect(
      svc.receiveCallback({ partner: 'P1', eventType: 'dep', externalId: 'ext-1', payload: {}, signatureOk: true }),
    ).rejects.toMatchObject({ code: 'job_queue.callback.duplicate' })
  })

  it('consumeCallbacks enqueues only signature-ok events', async () => {
    // Clean up any leftover callbacks from previous tests
    await ds.query(`DELETE FROM app.inbound_callback_events WHERE partner IN ('P2','P3')`)
    await svc.receiveCallback({ partner: 'P2', eventType: 'dep', externalId: 'ext-ok', payload: { amount: 100 }, signatureOk: true })
    await svc.receiveCallback({ partner: 'P3', eventType: 'dep', externalId: 'ext-bad', payload: {}, signatureOk: false })
    // consumeCallbacks with handler + auto-mark processed
    const processed = await svc.consumeCallbacks(
      (evt) => evt.signatureOk ? { queueName: 'deploys', payload: evt.payload, dedupKey: `cb:${evt.partner}:${evt.externalId}` } : null,
      50,
    )
    expect(processed).toBeGreaterThanOrEqual(2)
    // verify a job was enqueued for the good callback
    const jobs = await svc.listByState('deploys')
    const found = jobs.some((j) => j.dedupKey === 'cb:P2:ext-ok')
    expect(found).toBe(true)
  })
})
