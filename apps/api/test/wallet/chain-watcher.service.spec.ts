import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { ChainWatcherService } from '../../src/wallet/manual/chain-watcher.service'
import { TronRateLimitedError, type TronClientService } from '../../src/wallet/manual/tron-client.service'
import type { DepositPoolService, ScanCandidate } from '../../src/wallet/manual/deposit-pool.service'
import type { WalletService } from '../../src/wallet/wallet.service'
import type { WalletNetworkRegistry } from '../../src/wallet/wallet-network.registry'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService
}

const candidate = (id: string, extra: Partial<ScanCandidate> = {}): ScanCandidate => ({ id, network: 'tron', address: `T${id}`, cursorMs: null, assignedAtMs: 0, ...extra })

function setup(options: { pending?: boolean; candidates?: ScanCandidate[]; failScanAt?: number; indexCooldown?: number; transfers?: Array<{ transactionId: string; blockTimestamp: number }> } = {}) {
  const events: string[] = []
  const scanned: string[] = []
  let scanCalls = 0
  const tron = {
    cooldownRemaining: (kind: string) => (kind === 'index' ? options.indexCooldown ?? 0 : 0),
    getNowBlockNumber: jest.fn(async () => { events.push('nowBlock'); return 1000 }),
    getTransactionInfo: jest.fn(async () => null),
    listIncomingTransfers: jest.fn(async () => {
      events.push('scan')
      if (options.failScanAt !== undefined && scanCalls++ === options.failScanAt) throw new TronRateLimitedError('index', 5_000)
      return (options.transfers ?? []).map((t) => ({ ...t, from: 'Tsender', to: 'Ta', atomicAmount: '5000000', decimals: 6, contractAddress: '' }))
    }),
  } as unknown as TronClientService
  const pools = {
    listForScan: jest.fn(async () => options.candidates ?? []),
    markScanned: jest.fn(async (id: string) => { scanned.push(id) }),
  } as unknown as DepositPoolService
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('AS "pending"')) { events.push('pendingCheck'); return [{ pending: options.pending ?? false }] }
      if (sql.includes('FROM app.deposits d')) { events.push('confirmDeposits'); return [] }
      if (sql.includes('FROM app.chain_transactions c')) { events.push('progressWithdrawals'); return [] }
      return []
    }),
  } as unknown as DataSource
  const wallet = { recordDepositObservation: jest.fn(async (_input: { transactionHash: string }) => undefined) }
  const watcher = new ChainWatcherService(
    wallet as unknown as WalletService,
    pools,
    tron,
    { get: () => ({ requiredConfirmations: 20 }) } as unknown as WalletNetworkRegistry,
    {} as IdentityCrypto,
    dataSource,
    config({ WALLET_CHAIN_WATCHER_ENABLED: 'true', WALLET_CUSTODY_ADAPTER: 'manual' }),
  )
  return { watcher, tron, pools, events, scanned, wallet }
}

describe('ChainWatcherService', () => {
  it('does not read the latest block when nothing is awaiting confirmation', async () => {
    const { watcher, tron, events } = setup({ pending: false, candidates: [candidate('a')] })
    await watcher.runOnce()
    expect(tron.getNowBlockNumber).not.toHaveBeenCalled()
    expect(events).toEqual(['pendingCheck', 'scan'])
  })

  it('handles in-flight deposits and withdrawals before scanning addresses', async () => {
    const { watcher, events } = setup({ pending: true, candidates: [candidate('a')] })
    await watcher.runOnce()
    expect(events).toEqual(['pendingCheck', 'nowBlock', 'confirmDeposits', 'progressWithdrawals', 'scan'])
  })

  it('stops the scan batch on a rate limit and leaves unscanned cursors untouched', async () => {
    const { watcher, events, scanned } = setup({ candidates: [candidate('a'), candidate('b'), candidate('c')], failScanAt: 1 })
    await watcher.runOnce()
    expect(scanned).toEqual(['a'])
    expect(events.filter((event) => event === 'scan')).toHaveLength(2)
  })

  it('skips the scan entirely while the index provider is cooling down', async () => {
    const { watcher, pools, events } = setup({ candidates: [candidate('a')], indexCooldown: 30_000 })
    await watcher.runOnce()
    expect(pools.listForScan).not.toHaveBeenCalled()
    expect(events).toEqual(['pendingCheck'])
  })

  it('starts the first scan at assignment, not upload, and never credits earlier transfers', async () => {
    const assignedAtMs = Date.UTC(2026, 9, 13, 12, 0, 0)
    const { watcher, tron, wallet, pools } = setup({
      candidates: [candidate('a', { assignedAtMs })],
      transfers: [
        { transactionId: 'before-upload-window', blockTimestamp: assignedAtMs - 5 * 60_000 },
        { transactionId: 'within-clock-skew', blockTimestamp: assignedAtMs - 30_000 },
        { transactionId: 'after-assignment', blockTimestamp: assignedAtMs + 90_000 },
      ],
    })
    await watcher.runOnce()
    expect(tron.listIncomingTransfers).toHaveBeenCalledWith('Ta', { minTimestampMs: assignedAtMs - 60_000, limit: 100 })
    expect(wallet.recordDepositObservation.mock.calls.map(([input]) => input.transactionHash))
      .toEqual(['within-clock-skew', 'after-assignment'])
    expect(pools.markScanned).toHaveBeenCalledWith('a', assignedAtMs + 90_000, expect.anything())
  })

  it('keeps the rescan overlap from reaching back past the assignment', async () => {
    const assignedAtMs = Date.UTC(2026, 9, 13, 12, 0, 0)
    const { watcher, tron } = setup({ candidates: [candidate('a', { assignedAtMs, cursorMs: assignedAtMs + 2 * 60_000 })] })
    await watcher.runOnce()
    expect(tron.listIncomingTransfers).toHaveBeenCalledWith('Ta', { minTimestampMs: assignedAtMs - 60_000, limit: 100 })
    const later = setup({ candidates: [candidate('a', { assignedAtMs, cursorMs: assignedAtMs + 60 * 60_000 })] })
    await later.watcher.runOnce()
    expect(later.tron.listIncomingTransfers).toHaveBeenCalledWith('Ta', { minTimestampMs: assignedAtMs + 50 * 60_000, limit: 100 })
  })
})
