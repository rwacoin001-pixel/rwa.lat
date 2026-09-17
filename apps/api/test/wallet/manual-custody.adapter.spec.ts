import { createHash } from 'node:crypto'
import type { ConfigService } from '@nestjs/config'
import { ManualCustodyAdapter } from '../../src/wallet/manual/manual-custody.adapter'
import { generateTronKeypair } from '../../src/wallet/manual/tron-address.util'
import { recoverTronAddressFromSignature } from '../../src/wallet/manual/tron-signer'
import type { TronClientService } from '../../src/wallet/manual/tron-client.service'
import type { DepositPoolService } from '../../src/wallet/manual/deposit-pool.service'

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService
}

interface FakeTron {
  transfers: Array<{ transactionId: string; from: string; to: string; atomicAmount: string; decimals: number; contractAddress: string; blockTimestamp: number }>
  infos: Record<string, { blockNumber: number; blockTimestamp: number; receiptResult: string | null } | null>
  buildResult: { txId: string; rawDataHex: string; transaction: Record<string, unknown> }
  broadcastResult: { ok: boolean; txid: string | null; code: string | null; message: string | null }
  lastListInput: { address: string; minTimestampMs: number } | null
  lastBroadcast: Record<string, unknown> | null
}

function fakeTron(): FakeTron {
  const state: FakeTron = {
    transfers: [],
    infos: {},
    buildResult: { txId: '', rawDataHex: '', transaction: {} },
    broadcastResult: { ok: true, txid: null, code: null, message: null },
    lastListInput: null,
    lastBroadcast: null,
  }
  Object.assign(state, {
    listOutgoingTransfers: async (address: string, input: { minTimestampMs: number }) => {
      state.lastListInput = { address, minTimestampMs: input.minTimestampMs }
      return state.transfers
    },
    getTransactionInfo: async (transactionId: string) => state.infos[transactionId] ?? null,
    buildTrc20Transfer: async () => state.buildResult,
    broadcastTransaction: async (transaction: Record<string, unknown>) => {
      state.lastBroadcast = transaction
      return state.broadcastResult
    },
  })
  return state
}

function fakePools(assigned: { id: string; address: string } | null) {
  const calls: Array<{ network: string; userId: string }> = []
  return {
    calls,
    assignForUser: async (network: string, userId: string) => {
      calls.push({ network, userId })
      return assigned
    },
  }
}

describe('ManualCustodyAdapter', () => {
  const hot = generateTronKeypair()
  const destination = generateTronKeypair().address

  function build(overrides: Record<string, string | undefined> = {}) {
    const tron = fakeTron()
    const pools = fakePools({ id: 'pool-1', address: generateTronKeypair().address })
    const adapter = new ManualCustodyAdapter(
      config({
        TRON_HOT_WALLET_PRIVATE_KEY: hot.privateKeyHex,
        TRON_BROADCAST_RESCUE_WINDOW_MINUTES: '120',
        ...overrides,
      }),
      pools as unknown as DepositPoolService,
      tron as unknown as TronClientService,
    )
    return { adapter, tron, pools }
  }

  it('assigns a deposit address from the operator pool for the wallet owner', async () => {
    const { adapter, pools } = build()
    const result = await adapter.provisionAddress('manual:user-42', 'tron', 'USDT')
    expect(pools.calls).toEqual([{ network: 'tron', userId: 'user-42' }])
    expect(result.memo).toBeNull()
    expect(result.address).toMatch(/^T/)
  })

  it('fails closed when the deposit pool is empty', async () => {
    const tron = fakeTron()
    const adapter = new ManualCustodyAdapter(
      config({ TRON_HOT_WALLET_PRIVATE_KEY: hot.privateKeyHex }),
      fakePools(null) as unknown as DepositPoolService,
      tron as unknown as TronClientService,
    )
    await expect(adapter.provisionAddress('manual:user-42', 'tron', 'USDT'))
      .rejects.toThrow(/No deposit address is currently available/)
  })

  it('signs locally and broadcasts the prepared TRON transaction', async () => {
    const { adapter, tron } = build()
    const txId = createHash('sha256').update('fake-raw-data').digest('hex')
    tron.buildResult = { txId, rawDataHex: '00', transaction: { txID: txId, raw_data_hex: '00', visible: true } }
    tron.broadcastResult = { ok: true, txid: txId, code: null, message: null }
    const result = await adapter.broadcastWithdrawal({
      withdrawalId: 'w-1', network: 'tron', assetCode: 'USDT', atomicAmount: '1000000', destination,
    })
    expect(result.transactionHash).toBe(txId)
    expect(result.providerReference).toBe(`tron:${txId}`)
    const broadcast = tron.lastBroadcast as { signature?: string[] } | null
    expect(broadcast?.signature?.length).toBe(1)
    expect(recoverTronAddressFromSignature(txId, broadcast!.signature![0])).toBe(hot.address)
  })

  it('treats a duplicate broadcast as success and refuses to run without the hot key', async () => {
    const { adapter, tron } = build()
    const txId = createHash('sha256').update('dup-raw').digest('hex')
    tron.buildResult = { txId, rawDataHex: '00', transaction: { txID: txId } }
    tron.broadcastResult = { ok: false, txid: null, code: 'DUP_TRANSACTION_ERROR', message: null }
    const result = await adapter.broadcastWithdrawal({
      withdrawalId: 'w-2', network: 'tron', assetCode: 'USDT', atomicAmount: '1000000', destination,
    })
    expect(result.transactionHash).toBe(txId)

    tron.broadcastResult = { ok: false, txid: null, code: 'SIGERROR', message: 'bad' }
    await expect(adapter.broadcastWithdrawal({
      withdrawalId: 'w-3', network: 'tron', assetCode: 'USDT', atomicAmount: '1000000', destination,
    })).rejects.toThrow(/broadcast failed/i)

    const noKey = build({ TRON_HOT_WALLET_PRIVATE_KEY: '' })
    await expect(noKey.adapter.broadcastWithdrawal({
      withdrawalId: 'w-4', network: 'tron', assetCode: 'USDT', atomicAmount: '1000000', destination,
    })).rejects.toThrow(/hot wallet is not configured/)
  })

  it('surfaces only destination/amount matches as rescue candidates within the configured window', async () => {
    const { adapter, tron } = build({ TRON_BROADCAST_RESCUE_WINDOW_MINUTES: '30' })
    const before = Date.now()
    const matchOld = createHash('sha256').update('old').digest('hex')
    const matchNew = createHash('sha256').update('new').digest('hex')
    const unrelated = createHash('sha256').update('unrelated').digest('hex')
    tron.transfers = [
      { transactionId: matchOld, from: hot.address, to: destination, atomicAmount: '1000000', decimals: 6, contractAddress: '', blockTimestamp: before - 500_000 },
      { transactionId: unrelated, from: hot.address, to: destination, atomicAmount: '5', decimals: 6, contractAddress: '', blockTimestamp: before - 400_000 },
      { transactionId: matchNew, from: hot.address, to: destination, atomicAmount: '1000000', decimals: 6, contractAddress: '', blockTimestamp: before - 300_000 },
    ]
    tron.infos[matchOld] = { blockNumber: 1, blockTimestamp: before - 500_000, receiptResult: 'FAILED' }
    tron.infos[matchNew] = { blockNumber: 2, blockTimestamp: before - 300_000, receiptResult: 'SUCCESS' }
    const candidates = await adapter.findRecentBroadcast({ network: 'tron', destination, atomicAmount: '1000000' })
    expect(candidates.map((candidate) => candidate.transactionHash)).toEqual([matchNew, matchOld])
    expect(candidates[0].receiptResult).toBe('SUCCESS')
    expect(candidates[1].receiptResult).toBe('FAILED')
    const window = before - (tron.lastListInput?.minTimestampMs ?? 0)
    expect(window).toBeGreaterThan(29 * 60_000)
    expect(window).toBeLessThan(31 * 60_000)
  })

  it('reports a null receipt while a candidate is still indeterminate', async () => {
    const { adapter, tron } = build()
    const pending = createHash('sha256').update('pending').digest('hex')
    tron.transfers = [
      { transactionId: pending, from: hot.address, to: destination, atomicAmount: '1000000', decimals: 6, contractAddress: '', blockTimestamp: Date.now() - 1000 },
    ]
    const candidates = await adapter.findRecentBroadcast({ network: 'tron', destination, atomicAmount: '1000000' })
    expect(candidates).toEqual([{ transactionHash: pending, receiptResult: null }])
  })
})
