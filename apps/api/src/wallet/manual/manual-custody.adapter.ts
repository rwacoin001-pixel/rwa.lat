import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WALLET_ERROR_CODES } from '../wallet.errors'
import type { WalletNetwork } from '../wallet.entities'
import type {
  AddressScreeningResult,
  BroadcastWithdrawalRequest,
  BroadcastWithdrawalResult,
  CustodyAdapter,
  ProvisionedAddress,
  ProvisionedWallet,
} from '../custody-adapter.interface'
import { DepositPoolService } from './deposit-pool.service'
import { TronClientService } from './tron-client.service'
import { isValidTronAddress, parseTronPrivateKey, tronAddressFromPrivateKey } from './tron-address.util'
import { signTronTransactionHash } from './tron-signer'
import type { RecentBroadcastCandidate } from '../custody-adapter.interface'

const MANUAL_WALLET_PREFIX = 'manual:'

/**
 * Operator-run custody adapter ("manual mode"): deposit addresses come from an
 * operator-managed pool, withdrawals are signed locally with the hot wallet key
 * and broadcast through TronGrid. No MPC or custody vendor is involved.
 */
@Injectable()
export class ManualCustodyAdapter implements CustodyAdapter {
  readonly name = 'manual-custody'
  readonly mode = 'manual' as const
  private readonly log = new Logger(ManualCustodyAdapter.name)
  private readonly hotWalletPrivateKey: string | null
  private readonly hotWalletAddress: string | null
  private readonly rescueWindowMinutes: number

  constructor(
    config: ConfigService,
    private readonly pools: DepositPoolService,
    private readonly tron: TronClientService,
  ) {
    const privateKey = config.get<string>('TRON_HOT_WALLET_PRIVATE_KEY')?.trim() || null
    if (privateKey) {
      parseTronPrivateKey(privateKey)
      this.hotWalletPrivateKey = privateKey
      this.hotWalletAddress = tronAddressFromPrivateKey(privateKey)
      this.log.log(`Manual custody hot wallet configured: ${this.hotWalletAddress}`)
    } else {
      this.hotWalletPrivateKey = null
      this.hotWalletAddress = null
    }
    const windowRaw = config.get<string>('TRON_BROADCAST_RESCUE_WINDOW_MINUTES')
    const window = windowRaw && /^\d+$/.test(windowRaw) ? Number(windowRaw) : 120
    this.rescueWindowMinutes = Number.isSafeInteger(window) && window >= 10 && window <= 1440 ? window : 120
  }

  getHotWalletAddress(): string | null {
    return this.hotWalletAddress
  }

  async provisionWallet(userId: string): Promise<ProvisionedWallet> {
    return { providerReference: `${MANUAL_WALLET_PREFIX}${userId}` }
  }

  async provisionAddress(providerWalletReference: string, network: WalletNetwork, assetCode: string): Promise<ProvisionedAddress> {
    if (network !== 'tron' || assetCode !== 'USDT') {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.NETWORK_UNSUPPORTED,
        message: 'Manual custody only supports TRON USDT deposit addresses in this release.',
      })
    }
    const userId = providerWalletReference.startsWith(MANUAL_WALLET_PREFIX)
      ? providerWalletReference.slice(MANUAL_WALLET_PREFIX.length)
      : providerWalletReference
    const assigned = await this.pools.assignForUser(network, userId)
    if (!assigned) {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.ADDRESS_POOL_EXHAUSTED,
        message: 'No deposit address is currently available. Please contact support to top up the deposit address pool.',
      })
    }
    return { address: assigned.address, memo: null }
  }

  async screenAddress(): Promise<AddressScreeningResult> {
    // 2026-09-18 operating decision: screen nothing automatically; every
    // withdrawal path keeps its limits, cooldowns and review controls.
    return { decision: 'clear' }
  }

  async broadcastWithdrawal(request: BroadcastWithdrawalRequest): Promise<BroadcastWithdrawalResult> {
    if (request.network !== 'tron' || request.assetCode !== 'USDT') {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.NETWORK_UNSUPPORTED,
        message: 'Manual custody can only broadcast TRON USDT withdrawals.',
      })
    }
    if (!this.hotWalletPrivateKey || !this.hotWalletAddress) {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
        message: 'The manual custody hot wallet is not configured; withdrawal execution is unavailable.',
      })
    }
    if (!isValidTronAddress(request.destination)) {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.ADDRESS_INVALID,
        message: 'Withdrawal destination is not a valid TRON address.',
      })
    }
    const built = await this.tron.buildTrc20Transfer({
      ownerAddress: this.hotWalletAddress,
      toAddress: request.destination,
      atomicAmount: request.atomicAmount,
    })
    const signature = signTronTransactionHash(built.txId, this.hotWalletPrivateKey)
    const broadcast = await this.tron.broadcastTransaction({ ...built.transaction, signature: [signature] })
    if (broadcast.ok) {
      const txid = broadcast.txid ?? built.txId
      return { providerReference: `tron:${txid}`, transactionHash: txid }
    }
    if (broadcast.code === 'DUP_TRANSACTION_ERROR') {
      // The network already holds this exact signed transaction (our own retry).
      return { providerReference: `tron:${built.txId}`, transactionHash: built.txId }
    }
    this.log.error(`Broadcast failed for withdrawal ${request.withdrawalId}: ${broadcast.code ?? 'unknown'} ${broadcast.message ?? ''}`)
    throw new ServiceUnavailableException({
      code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
      message: `TRON broadcast failed (${broadcast.code ?? 'unknown_error'}). The withdrawal will be retried with a fresh transaction.`,
    })
  }

  /**
   * Idempotency rescue: after an ambiguous execution timeout the same
   * withdrawal is retried. We surface every hot-wallet transfer matching this
   * destination/amount inside the rescue window (newest first) and let the
   * service decide which candidate is genuinely an unrecorded prior attempt.
   */
  async findRecentBroadcast(input: { network: WalletNetwork; destination: string; atomicAmount: string }): Promise<RecentBroadcastCandidate[]> {
    if (input.network !== 'tron' || !this.hotWalletAddress) return []
    const sinceMs = Date.now() - this.rescueWindowMinutes * 60_000
    const transfers = await this.tron.listOutgoingTransfers(this.hotWalletAddress, { minTimestampMs: sinceMs, limit: 50 })
    const matches = transfers
      .filter((transfer) => transfer.to === input.destination && transfer.atomicAmount === input.atomicAmount)
      .sort((left, right) => right.blockTimestamp - left.blockTimestamp)
      .slice(0, 5)
    const candidates: RecentBroadcastCandidate[] = []
    for (const match of matches) {
      const info = await this.tron.getTransactionInfo(match.transactionId)
      candidates.push({ transactionHash: match.transactionId, receiptResult: info?.receiptResult ?? null })
    }
    return candidates
  }
}
