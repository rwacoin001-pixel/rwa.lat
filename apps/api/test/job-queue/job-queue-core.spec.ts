import { JobQueueService } from '../../src/job-queue/job-queue.service'

function repositories() {
  const jobs = {
    findOne: jest.fn(),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn((value: object) => Promise.resolve(value)),
    find: jest.fn().mockResolvedValue([]),
  }
  const callbacks = {
    findOne: jest.fn(),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn((value: object) => Promise.resolve(value)),
    find: jest.fn().mockResolvedValue([]),
  }
  return { jobs, callbacks }
}

describe('JobQueueService execution leases', () => {
  it('maps the flat PostgreSQL RETURNING rows and records a bounded worker lease', async () => {
    const { jobs, callbacks } = repositories()
    const query = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'job-1', queue_name: 'wallet-withdrawal-execution', payload: { withdrawalId: 'withdrawal-1' },
        state: 'running', attempts: 1, max_attempts: 10, last_error: null,
        dedup_key: 'withdrawal-execution:withdrawal-1', run_at: new Date(), created_at: new Date(),
        completed_at: null, locked_at: new Date(), lease_expires_at: new Date(Date.now() + 300_000),
        worker_id: 'worker-1',
      }])
    const ds = { transaction: (handler: (tx: { query: jest.Mock }) => unknown) => handler({ query }) }
    const service = new JobQueueService(jobs as never, callbacks as never, ds as never)

    const claimed = await service.claim('wallet-withdrawal-execution', 1, new Date(), {
      workerId: 'worker-1', leaseSeconds: 300,
    })

    expect(claimed).toHaveLength(1)
    expect(claimed[0]).toMatchObject({ id: 'job-1', workerId: 'worker-1', state: 'running' })
    expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining([1, 300, 'worker-1']))
  })

  it('refuses acknowledgement after worker ownership is lost', async () => {
    const { jobs, callbacks } = repositories()
    jobs.findOne.mockResolvedValue({
      id: 'job-1', state: 'running', workerId: 'other-worker', leaseExpiresAt: new Date(Date.now() + 60_000),
    })
    const service = new JobQueueService(jobs as never, callbacks as never, {} as never)

    await expect(service.ack('job-1', new Date(), 'worker-1')).rejects.toMatchObject({
      code: 'job_queue.job.lease_lost',
    })
    expect(jobs.save).not.toHaveBeenCalled()
  })

  it('returns the winning job when concurrent deduplicated inserts race', async () => {
    const { jobs, callbacks } = repositories()
    const winner = { id: 'job-winner', dedupKey: 'same-key' }
    jobs.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner)
    jobs.save.mockRejectedValue({ code: '23505' })
    const service = new JobQueueService(jobs as never, callbacks as never, {} as never)

    await expect(service.enqueue({ queueName: 'queue', payload: {}, dedupKey: 'same-key' })).resolves.toBe(winner)
  })
})
