import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from '../../identity/identity-crypto.service'
import { WalletNetworkRegistry } from '../wallet-network.registry'
import { WalletService } from '../wallet.service'
import { DepositPoolService } from './deposit-pool.service'
import { TronClientService } from './tron-client.service'

const SCAN_OVERLAP_MS = 10 * 60_000

/**
 * Free TRON polling watcher for manual custody. Three passes per tick:
 * 1. Detect incoming TRC-20 USDT transfers on assigned deposit addresses.
 * 2. Advance deposit confirmations and credit balances once ready.
 * 3. Track broadcast withdrawals to confirmation, settlement, or failure.
 */
@Injectable()
export class ChainWatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(ChainWatcherService.name)
  private readonly enabled: boolean
  private readonly pollMs: number
  private readonly depositBatch: number
  private readonly confirmationBatch: number
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly wallet: WalletService,
    private readonly pools: DepositPoolService,
    private readonly tron: TronClientService,
    private readonly networks: WalletNetworkRegistry,
    private readonly crypto: IdentityCrypto,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const adapterMode = (config.get<string>('WALLET_CUSTODY_ADAPTER') ?? 'stub').toLowerCase()
    this.enabled = config.get<string>('WALLET_CHAIN_WATCHER_ENABLED') === 'true' && adapterMode === 'manual'
    if (config.get<string>('WALLET_CHAIN_WATCHER_ENABLED') === 'true' && adapterMode !== 'manual') {
      this.log.warn('Chain watcher is enabled but the custody adapter is not "manual"; watcher stays off.')
    }
    this.pollMs = boundedInteger(config.get<string>('WALLET_CHAIN_WATCHER_POLL_MS'), 120_000, 15_000, 900_000)
    this.depositBatch = boundedInteger(config.get<string>('WALLET_CHAIN_WATCHER_DEPOSIT_BATCH'), 8, 1, 50)
    this.confirmationBatch = boundedInteger(config.get<string>('WALLET_CHAIN_WATCHER_CONFIRMATION_BATCH'), 25, 1, 100)
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
    this.log.log(`Chain watcher started (poll ${this.pollMs}ms, deposit batch ${this.depositBatch}).`)
    this.timer = setInterval(() => void this.tick(), this.pollMs)
    this.timer.unref()
    void this.tick()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async runOnce(): Promise<{ depositsDetected: number; depositsConfirmed: number; withdrawalsUpdated: number }> {
    const depositsDetected = await this.detectDeposits()
    let nowBlockNumber: number | null = null
    try {
      nowBlockNumber = await this.tron.getNowBlockNumber()
    } catch (error) {
      this.log.warn(`Chain watcher could not read the latest block: ${safeError(error)}`)
    }
    const depositsConfirmed = nowBlockNumber === null ? 0 : await this.confirmDeposits(nowBlockNumber)
    const withdrawalsUpdated = nowBlockNumber === null ? 0 : await this.progressWithdrawals(nowBlockNumber)
    return { depositsDetected, depositsConfirmed, withdrawalsUpdated }
  }

  private async detectDeposits(): Promise<number> {
    const candidates = await this.pools.listForScan(this.depositBatch)
    let detected = 0
    for (const candidate of candidates) {
      try {
        const cursorMs = candidate.cursorMs ?? candidate.createdAtMs
        const transfers = await this.tron.listIncomingTransfers(candidate.address, {
          minTimestampMs: Math.max(0, cursorMs - SCAN_OVERLAP_MS),
          limit: 100,
        })
        let maxSeen = candidate.cursorMs
        for (const transfer of transfers) {
          if (transfer.decimals !== 6) continue
          if (this.tron.usdtContract && transfer.contractAddress && transfer.contractAddress !== this.tron.usdtContract) continue
          await this.wallet.recordDepositObservation({
            network: 'tron',
            transactionHash: transfer.transactionId,
            destinationAddress: candidate.address,
            atomicAmount: transfer.atomicAmount,
            confirmations: 0,
            outputIndex: 0,
            riskDecision: 'clear',
            eventId: `tron-watcher:${transfer.transactionId}`,
          })
          detected++
          maxSeen = maxSeen === null ? transfer.blockTimestamp : Math.max(maxSeen, transfer.blockTimestamp)
        }
        await this.pools.markScanned(candidate.id, maxSeen)
      } catch (error) {
        // Leave the scan cursor untouched so this address is retried first next tick.
        this.log.warn(`Deposit scan failed for pool address ${candidate.id}: ${safeError(error)}`)
      }
    }
    return detected
  }

  private async confirmDeposits(nowBlockNumber: number): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT d.id AS "depositId", d.output_index AS "outputIndex", d.atomic_amount AS "atomicAmount",
              c.transaction_hash AS "transactionHash",
              a.network, a.address_ciphertext AS "addressCiphertext", a.encryption_key_version AS "encryptionKeyVersion"
         FROM app.deposits d
         JOIN app.chain_transactions c ON c.id = d.chain_transaction_id
         JOIN app.wallet_addresses a ON a.id = d.wallet_address_id
        WHERE c.network = 'tron' AND d.state IN ('detected', 'confirming')
        ORDER BY d.detected_at ASC
        LIMIT $1`,
      [this.confirmationBatch],
    ) as Array<Record<string, unknown>>
    let confirmed = 0
    for (const row of rows) {
      try {
        const info = await this.tron.getTransactionInfo(row.transactionHash as string)
        if (!info) continue
        if (info.receiptResult && info.receiptResult !== 'SUCCESS') {
          await this.dataSource.query(
            `UPDATE app.deposits SET state = 'rejected', reason_code = 'chain_transaction_failed'
              WHERE id = $1 AND state IN ('detected', 'confirming')`,
            [row.depositId],
          )
          continue
        }
        const confirmations = Math.max(0, nowBlockNumber - info.blockNumber + 1)
        const destinationAddress = this.crypto.decrypt(
          Buffer.isBuffer(row.addressCiphertext) ? row.addressCiphertext : Buffer.from(row.addressCiphertext as Uint8Array),
          Number(row.encryptionKeyVersion),
        )
        await this.wallet.recordDepositObservation({
          network: 'tron',
          transactionHash: row.transactionHash as string,
          destinationAddress,
          atomicAmount: row.atomicAmount as string,
          confirmations,
          outputIndex: Number(row.outputIndex ?? 0),
          blockNumber: String(info.blockNumber),
          riskDecision: 'clear',
          eventId: `tron-watcher-confirm:${row.transactionHash as string}`,
        })
        confirmed++
      } catch (error) {
        this.log.warn(`Deposit confirmation failed for ${row.transactionHash as string}: ${safeError(error)}`)
      }
    }
    return confirmed
  }

  private async progressWithdrawals(nowBlockNumber: number): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT w.id AS "withdrawalId", c.transaction_hash AS "transactionHash"
         FROM app.chain_transactions c
         JOIN app.withdrawals w ON w.chain_transaction_id = c.id
        WHERE c.network = 'tron' AND w.state IN ('broadcast', 'confirming') AND c.state IN ('detected', 'confirming')
        ORDER BY c.first_seen_at ASC
        LIMIT $1`,
      [this.confirmationBatch],
    ) as Array<Record<string, unknown>>
    const required = this.networks.get('tron').requiredConfirmations
    let updated = 0
    for (const row of rows) {
      const transactionHash = row.transactionHash as string
      try {
        const info = await this.tron.getTransactionInfo(transactionHash)
        if (!info) continue
        if (info.receiptResult && info.receiptResult !== 'SUCCESS') {
          await this.wallet.applyWithdrawalStatusFromChain(`tron-watcher:${transactionHash}`, {
            withdrawalId: row.withdrawalId as string,
            network: 'tron',
            transactionHash,
            confirmations: 0,
            state: 'failed',
            blockNumber: String(info.blockNumber),
            reasonCode: 'tron_transaction_failed',
          })
          updated++
          continue
        }
        const confirmations = Math.max(0, nowBlockNumber - info.blockNumber + 1)
        await this.wallet.applyWithdrawalStatusFromChain(`tron-watcher:${transactionHash}`, {
          withdrawalId: row.withdrawalId as string,
          network: 'tron',
          transactionHash,
          confirmations,
          state: confirmations >= required ? 'confirmed' : 'confirming',
          blockNumber: String(info.blockNumber),
        })
        updated++
      } catch (error) {
        this.log.warn(`Withdrawal confirmation failed for ${transactionHash}: ${safeError(error)}`)
      }
    }
    return updated
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.error(`Chain watcher tick failed: ${safeError(error)}`)
    } finally {
      this.running = false
    }
  }
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown chain watcher error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 300)
}
