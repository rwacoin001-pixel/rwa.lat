import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { JobQueueService } from '../../src/job-queue/job-queue.service'
import { PortfolioService } from '../../src/portfolio/portfolio.service'
import { PortfolioSnapshotWorker, PORTFOLIO_SNAPSHOT_QUEUE } from '../../src/portfolio/portfolio-snapshot.worker'

const USER = '66666666-6666-6666-8666-666666666666'

describe('PortfolioSnapshotWorker', () => {
  let queue: {
    enqueue: jest.Mock
    claim: jest.Mock
    ack: jest.Mock
    nack: jest.Mock
  }
  let dataSource: { query: jest.Mock }
  let portfolio: { capturePortfolioSnapshot: jest.Mock }
  let worker: PortfolioSnapshotWorker

  beforeEach(() => {
    queue = {
      enqueue: jest.fn().mockResolvedValue({ state: 'pending' }),
      claim: jest.fn().mockResolvedValue([]),
      ack: jest.fn().mockResolvedValue({ state: 'completed' }),
      nack: jest.fn().mockResolvedValue({ state: 'pending' }),
    }
    dataSource = { query: jest.fn().mockResolvedValue([{ userId: USER }]) }
    portfolio = { capturePortfolioSnapshot: jest.fn().mockResolvedValue({ snapshotCount: 1 }) }
    const config = { get: jest.fn((key: string) => ({
      PORTFOLIO_SNAPSHOT_WORKER_ENABLED: 'true',
      PORTFOLIO_SNAPSHOT_WORKER_POLL_MS: '15000',
      PORTFOLIO_SNAPSHOT_QUEUE_LEASE_SECONDS: '900',
    }[key])) }
    worker = new PortfolioSnapshotWorker(
      queue as unknown as JobQueueService,
      dataSource as unknown as DataSource,
      portfolio as unknown as PortfolioService,
      config as unknown as ConfigService,
    )
  })

  it('schedules each active user for UTC midnight and processes the durable job', async () => {
    const now = new Date('2026-09-25T00:00:10.000Z')
    queue.claim.mockImplementation(async (queueName: string) => {
      const payload = queue.enqueue.mock.calls[0][0].payload
      expect(queueName).toBe(PORTFOLIO_SNAPSHOT_QUEUE)
      return [{ id: 'snapshot-job-1', payload }]
    })

    const processed = await worker.runOnce(now)

    const [enqueue] = queue.enqueue.mock.calls[0]
    expect(enqueue.queueName).toBe(PORTFOLIO_SNAPSHOT_QUEUE)
    expect(enqueue.dedupKey).toBe('portfolio-snapshot:20260925:' + USER)
    expect(enqueue.runAt).toEqual(new Date('2026-09-25T00:00:00.000Z'))
    expect(enqueue.payload.userId).toBe(USER)
    expect(enqueue.payload.snapshotBatchId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(processed).toBe(1)
    expect(portfolio.capturePortfolioSnapshot).toHaveBeenCalledWith(USER, enqueue.payload.snapshotBatchId)
    expect(queue.ack).toHaveBeenCalledWith('snapshot-job-1', expect.any(Date), expect.any(String))
    expect(queue.nack).not.toHaveBeenCalled()
  })

  it('uses UTC schedule day and does not create a late point outside the midnight window', async () => {
    await worker.runOnce(new Date('2026-09-25T00:15:01.000Z'))

    expect(dataSource.query).not.toHaveBeenCalled()
    expect(queue.enqueue).not.toHaveBeenCalled()
    expect(queue.claim).toHaveBeenCalledWith(PORTFOLIO_SNAPSHOT_QUEUE, 5, new Date('2026-09-25T00:15:01.000Z'), expect.any(Object))
  })

  it('does not enqueue the same UTC day twice in one process', async () => {
    await worker.runOnce(new Date('2026-09-25T00:00:00.000Z'))
    await worker.runOnce(new Date('2026-09-25T00:10:00.000Z'))

    expect(dataSource.query).toHaveBeenCalledTimes(1)
    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    expect(queue.claim).toHaveBeenCalledTimes(2)
  })

  it('reuses the queued batch ID through the service and nacks failures for retry', async () => {
    const snapshotBatchId = '77777777-5555-5555-8555-555555555555'
    const job = { id: 'snapshot-job-fail', payload: { userId: USER, snapshotBatchId } }
    queue.claim.mockResolvedValue([job])
    portfolio.capturePortfolioSnapshot.mockRejectedValue(new Error('quote unavailable'))

    await worker.runOnce(new Date('2026-09-25T00:00:00.000Z'))

    expect(portfolio.capturePortfolioSnapshot).toHaveBeenCalledWith(USER, snapshotBatchId)
    expect(queue.nack).toHaveBeenCalledWith('snapshot-job-fail', 'Error: quote unavailable', expect.any(Date), expect.any(String))
    expect(queue.ack).not.toHaveBeenCalled()
  })
})
