import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from '../../identity/identity-crypto.service'
import { WalletNetworkRegistry } from '../wallet-network.registry'
import { WalletService } from '../wallet.service'
import { DepositPoolService } from './deposit-pool.service'
import { readDepositWatchPolicy, type DepositWatchPolicy } from './deposit-watch.policy'
import { TronClientService, TronRateLimitedError } from './tron-client.service'

const SCAN_OVERLAP_MS = 10 * 60_000
/**
 * Clock tolerance between this server and TRON block timestamps. A transfer stamped earlier than
 * assignment minus this cannot have been sent by the assigned user (they had not seen the address yet),
 * so it is never attributed to them, even when a rescan overlaps back past the assignment.
 */
export const ASSIGNMENT_SKEW_MS = 60_000

/**
 * Free TRON polling watcher for manual custody. Passes per tick:
 * 1. Only while something is in flight: read the latest block, advance deposit
 *    confirmations (crediting once ready) and track broadcast withdrawals.
 * 2. Detect incoming TRC-20 USDT transfers on deposit addresses that are due: frequently while
 *    the user's watch window is open, backing off to an idle sweep (current and retired addresses).
 * A rate-limited provider ends the current pass; skipped work retries next tick.
 */
@Injectable()
export class ChainWatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(ChainWatcherService.name)
  private readonly enabled: boolean
  private readonly policy: DepositWatchPolicy
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
    // WALLET_CHAIN_WATCHER_POLL_MS is superseded: the watcher wakes every tick but only calls TRON
    // for addresses whose own schedule is due (see deposit-watch.policy.ts).
    this.policy = readDepositWatchPolicy(config)
    this.depositBatch = boundedInteger(config.get<string>('WALLET_CHAIN_WATCHER_DEPOSIT_BATCH'), 8, 1, 50)
    this.confirmationBatch = boundedInteger(config.get<string>('WALLET_CHAIN_WATCHER_CONFIRMATION_BATCH'), 25, 1, 100)
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
    this.log.log(`Chain watcher started (tick ${this.policy.tickMs}ms, watch ${this.policy.watchMinutes}min every ${this.policy.watchScanSeconds}s, idle sweep ${this.policy.idleScanMinutes}min, batch ${this.depositBatch}).`)
    this.timer = setInterval(() => void this.tick(), this.policy.tickMs)
    this.timer.unref()
    void this.tick()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async runOnce(): Promise<{ depositsDetected: number; depositsConfirmed: number; withdrawalsUpdated: number }> {
    // Money already in flight first: confirmations and withdrawal tracking must not starve behind address scans.
    let depositsConfirmed = 0
    let withdrawalsUpdated = 0
    if (await this.hasPendingChainWork()) {
      let nowBlockNumber: number | null = null
      try {
        nowBlockNumber = await this.tron.getNowBlockNumber()
      } catch (error) {
        this.log.warn(`Chain watcher could not read the latest block: ${safeError(error)}`)
      }
      if (nowBlockNumber !== null) {
        depositsConfirmed = await this.confirmDeposits(nowBlockNumber)
        withdrawalsUpdated = await this.progressWithdrawals(nowBlockNumber)
      }
    }
    const depositsDetected = await this.detectDeposits()
    return { depositsDetected, depositsConfirmed, withdrawalsUpdated }
  }

  /** The latest block is only needed while a deposit awaits confirmations or a withdrawal is on-chain. */
  private async hasPendingChainWork(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT EXISTS (
                SELECT 1 FROM app.deposits d JOIN app.chain_transactions c ON c.id = d.chain_transaction_id
                 WHERE c.network = 'tron' AND d.state IN ('detected', 'confirming')
              ) OR EXISTS (
                SELECT 1 FROM app.withdrawals w JOIN app.chain_transactions c ON c.id = w.chain_transaction_id
                 WHERE c.network = 'tron' AND w.state IN ('broadcast', 'confirming') AND c.state IN ('detected', 'confirming')
              ) AS "pending"`,
    ) as Array<{ pending: boolean }>
    return rows[0]?.pending === true
  }

  private async detectDeposits(): Promise<number> {
    const cooling = this.tron.cooldownRemaining('index')
    if (cooling > 0) {
      this.log.warn(`Deposit scan skipped: TRON index provider cooling down for ${Math.ceil(cooling / 1000)}s`)
      return 0
    }
    const candidates = await this.pools.listForScan(this.depositBatch)
    let detected = 0
    for (const [position, candidate] of candidates.entries()) {
      try {
        const earliestMs = Math.max(0, candidate.assignedAtMs - ASSIGNMENT_SKEW_MS)
        const transfers = await this.tron.listIncomingTransfers(candidate.address, {
          minTimestampMs: candidate.cursorMs === null ? earliestMs : Math.max(earliestMs, candidate.cursorMs - SCAN_OVERLAP_MS),
          limit: 100,
        })
        let maxSeen = candidate.cursorMs
        for (const transfer of transfers) {
          if (transfer.blockTimestamp < earliestMs) continue
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
        await this.pools.markScanned(candidate.id, maxSeen, {
          watchScanSeconds: this.policy.watchScanSeconds,
          idleScanSeconds: this.policy.idleScanMinutes * 60,
        })
      } catch (error) {
        // Leave the scan cursor untouched so this address is retried first next tick.
        if (error instanceof TronRateLimitedError) {
          this.log.warn(`Deposit scan paused: ${error.message}; ${candidates.length - position} address(es) deferred to a later tick`)
          break
        }
        this.log.warn(`Deposit scan failed for pool address ${candidate.id}: ${safeError(error)}`)
        await this.pools.markScanFailed(candidate.id).catch(() => undefined)
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
        if (error instanceof TronRateLimitedError) {
          this.log.warn(`Deposit confirmation paused: ${error.message}`)
          break
        }
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
        if (error instanceof TronRateLimitedError) {
          this.log.warn(`Withdrawal tracking paused: ${error.message}`)
          break
        }
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
