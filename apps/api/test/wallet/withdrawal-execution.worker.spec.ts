import { WithdrawalExecutionWorker } from '../../src/wallet/withdrawal-execution.worker'

function buildWorker() {
  const job = {
    id: 'job-1',
    payload: { withdrawalId: 'withdrawal-1' },
  }
  const queue = {
    claim: jest.fn().mockResolvedValue([job]),
    ack: jest.fn(),
    nack: jest.fn(),
  }
  const wallet = {
    canProcessExecutionQueue: jest.fn().mockResolvedValue(true),
    executeQueuedWithdrawal: jest.fn(),
  }
  const config = { get: (key: string) => {
    if (key === 'WALLET_EXECUTION_QUEUE_LEASE_SECONDS') return '300'
    if (key === 'WALLET_EXECUTION_WORKER_POLL_MS') return '5000'
    return 'false'
  } }
  return {
    worker: new WithdrawalExecutionWorker(queue as never, wallet as never, config as never),
    queue,
    wallet,
  }
}

describe('WithdrawalExecutionWorker', () => {
  it('executes one leased job serially and acknowledges it', async () => {
    const { worker, queue, wallet } = buildWorker()

    await expect(worker.runOnce()).resolves.toBe(1)

    expect(wallet.executeQueuedWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1', expect.any(String), 'withdrawal-worker:job-1',
    )
    expect(queue.ack).toHaveBeenCalledWith('job-1', expect.any(Date), expect.any(String))
    expect(queue.nack).not.toHaveBeenCalled()
  })

  it('returns failed execution to the leased retry/dead-letter path', async () => {
    const { worker, queue, wallet } = buildWorker()
    wallet.executeQueuedWithdrawal.mockRejectedValue(new Error('provider timeout'))

    await expect(worker.runOnce()).resolves.toBe(1)

    expect(queue.nack).toHaveBeenCalledWith(
      'job-1', expect.stringContaining('provider timeout'), expect.any(Date), expect.any(String),
    )
    expect(queue.ack).not.toHaveBeenCalled()
  })

  it('does not claim any job while the operational funds switch is paused', async () => {
    const { worker, queue, wallet } = buildWorker()
    wallet.canProcessExecutionQueue.mockResolvedValue(false)

    await expect(worker.runOnce()).resolves.toBe(0)

    expect(queue.claim).not.toHaveBeenCalled()
  })
})
