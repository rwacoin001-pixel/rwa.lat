import type { WalletNetwork } from './wallet.entities'

export interface ProvisionedWallet {
  providerReference: string
}

export interface ProvisionedAddress {
  address: string
  memo: string | null
}

export interface AddressScreeningResult {
  decision: 'clear' | 'manual_review' | 'blocked'
  reasonCode?: string
}

export interface BroadcastWithdrawalRequest {
  withdrawalId: string
  network: WalletNetwork
  assetCode: string
  atomicAmount: string
  destination: string
}

export interface BroadcastWithdrawalResult {
  providerReference: string
  transactionHash: string
}

export interface RecentBroadcastCandidate {
  transactionHash: string
  /** 'SUCCESS' | 'FAILED' | another receipt result, or null while indeterminate. */
  receiptResult: string | null
}

export interface CustodyAdapter {
  readonly name: string
  readonly mode: 'stub' | 'live' | 'manual'
  provisionWallet(userId: string): Promise<ProvisionedWallet>
  provisionAddress(providerWalletReference: string, network: WalletNetwork, assetCode: string): Promise<ProvisionedAddress>
  screenAddress(network: WalletNetwork, address: string): Promise<AddressScreeningResult>
  /**
   * Must be idempotent on request.withdrawalId. The API deliberately retries
   * the same identifier after an ambiguous timeout so a provider response loss
   * can never create a second on-chain transfer.
   */
  broadcastWithdrawal(request: BroadcastWithdrawalRequest): Promise<BroadcastWithdrawalResult>
  /**
   * Optional idempotency rescue for retried executions: recent broadcasts that
   * may have left the process before being recorded. The service filters these
   * candidates against recorded chain transactions before trusting one.
   */
  findRecentBroadcast?(input: { network: WalletNetwork; destination: string; atomicAmount: string }): Promise<RecentBroadcastCandidate[]>
}
