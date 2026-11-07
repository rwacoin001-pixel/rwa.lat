import { ConfigService } from '@nestjs/config'
import { PredictionSettlementWorker } from '../../src/prediction/prediction-settlement.worker'
import { PredictionSettlementMonitorService } from '../../src/prediction/prediction-settlement-monitor.service'

function setup() {
  const prediction = { settleMarket: jest.fn().mockResolvedValue({ settled: true }) }
  const resolution = { mode: 'apply', syncMarket: jest.fn().mockResolvedValue({ status: 'applied' }) }
  const monitor = {
    seed: jest.fn(), claim: jest.fn().mockResolvedValue([]), finish: jest.fn(), beat: jest.fn().mockResolvedValue(undefined),
    reconcile: jest.fn(), confirmed: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true), alreadySettled: jest.fn().mockResolvedValue(false), beginSettlement: jest.fn().mockResolvedValue(true),
  }
  const worker = new PredictionSettlementWorker(prediction as never, new ConfigService({ PREDICTION_SETTLEMENT_WORKER_ENABLED: 'true' }), resolution as never, monitor as never)
  const job = { id: 'job-a', payload: { marketId: 'market-a' }, attempts: 1, worker_id: 'worker' }
  return { prediction, resolution, monitor, worker, job }
}

describe('Durable prediction settlement worker', () => {
  it('processes a healthy market even when another market fails, and persists a retry', async () => {
    const s = setup()
    const second = { ...s.job, id: 'job-b', payload: { marketId: 'market-b' } }
    s.monitor.claim.mockResolvedValueOnce([s.job, second])
    s.resolution.syncMarket.mockRejectedValueOnce(new Error('unavailable'))
    expect(await s.worker.runOnce()).toBe(1)
    expect(s.monitor.finish).toHaveBeenCalledWith(s.job, 'failed', 'settlement-task-failed')
    expect(s.prediction.settleMarket).toHaveBeenCalledTimes(1)
    expect(s.prediction.settleMarket).toHaveBeenCalledWith('market-b')
  })

  it.each(['pending', 'review', 'retry'])('never pays money for a %s result', async status => {
    const s = setup()
    s.monitor.claim.mockResolvedValueOnce([s.job])
    s.resolution.syncMarket.mockResolvedValue({ status })
    await s.worker.runOnce()
    expect(s.prediction.settleMarket).not.toHaveBeenCalled()
    expect(s.monitor.finish).toHaveBeenCalled()
  })

  it('requires the persisted confirmed result before settlement', async () => {
    const s = setup()
    s.monitor.claim.mockResolvedValueOnce([s.job])
    s.monitor.confirmed.mockResolvedValue(false)
    await s.worker.runOnce()
    expect(s.prediction.settleMarket).not.toHaveBeenCalled()
    expect(s.monitor.finish).toHaveBeenCalledWith(s.job, 'review', 'confirmed-result-missing')
  })

  it('recovers a crash after money was settled but before the queue acknowledgement', async () => {
    const s = setup()
    s.monitor.claim.mockResolvedValueOnce([s.job])
    s.monitor.alreadySettled.mockResolvedValue(true)
    await s.worker.runOnce()
    expect(s.prediction.settleMarket).not.toHaveBeenCalled()
    expect(s.monitor.finish).toHaveBeenCalledWith(s.job, 'settled')
  })

  it('does not start a money operation after losing its execution lease', async () => {
    const s = setup()
    s.monitor.claim.mockResolvedValueOnce([s.job])
    s.monitor.beginSettlement.mockResolvedValue(false)
    await s.worker.runOnce()
    expect(s.prediction.settleMarket).not.toHaveBeenCalled()
  })

  it('can finish an already confirmed result while the result provider is unavailable', async () => {
    const s = setup()
    s.monitor.claim.mockResolvedValueOnce([s.job])
    s.monitor.confirmed.mockReset().mockResolvedValue(true)
    s.resolution.syncMarket.mockRejectedValue(new Error('provider offline'))
    expect(await s.worker.runOnce()).toBe(1)
    expect(s.resolution.syncMarket).not.toHaveBeenCalled()
  })

  it('keeps reconciliation failures visible in the persisted heartbeat', async () => {
    const s = setup()
    s.monitor.reconcile.mockRejectedValue(new Error('db unavailable'))
    await s.worker.tick()
    expect(s.monitor.beat).toHaveBeenCalledWith(true, { auditError: true })
  })
})

describe('Prediction task persistence', () => {
  it('claims with an expiring lease and skips rows owned by another worker', async () => {
    const query = jest.fn().mockResolvedValue([])
    const service = new PredictionSettlementMonitorService({ transaction: (fn: (tx: unknown) => unknown) => fn({ query }) } as never)
    await service.claim('worker-a')
    expect(query.mock.calls[2][0]).toContain('FOR UPDATE OF j SKIP LOCKED')
    expect(query.mock.calls[2][0]).toContain('j.lease_expires_at<=now()')
    expect(query.mock.calls[2][0]).toContain('LIMIT greatest(0,2-')
    expect(query.mock.calls[2][1]).toEqual(['prediction_settlement', 'worker-a'])
  })

  it('persists exponential backoff and prevents a stale worker from acknowledging a reclaimed job', async () => {
    const query = jest.fn().mockResolvedValue([])
    const service = new PredictionSettlementMonitorService({ query } as never)
    await service.finish({ id: 'a', worker_id: 'old-worker', attempts: 4, payload: { marketId: 'm' } }, 'failed', 'provider-unavailable')
    expect(query.mock.calls[0][1].slice(2, 6)).toEqual(['pending', 480, true, 'provider-unavailable'])
    expect(query.mock.calls[0][0]).toContain("state='running' AND worker_id=$2 AND lease_expires_at>now()")
  })

  it('requires operator intervention after the retry budget is exhausted', async () => {
    const query = jest.fn().mockResolvedValue([])
    const service = new PredictionSettlementMonitorService({ query } as never)
    await service.finish({ id: 'a', worker_id: 'worker', attempts: 8, payload: { marketId: 'm' } }, 'failed')
    expect(query.mock.calls[0][1][2]).toBe('dead')
  })
})
