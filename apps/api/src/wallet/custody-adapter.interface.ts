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

export interface CustodyAdapter {
  readonly name: string
  readonly mode: 'stub' | 'live'
  provisionWallet(userId: string): Promise<ProvisionedWallet>
  provisionAddress(providerWalletReference: string, network: WalletNetwork, assetCode: string): Promise<ProvisionedAddress>
  screenAddress(network: WalletNetwork, address: string): Promise<AddressScreeningResult>
  /**
   * Must be idempotent on request.withdrawalId. The API deliberately retries
   * the same identifier after an ambiguous timeout so a provider response loss
   * can never create a second on-chain transfer.
   */
  broadcastWithdrawal(request: BroadcastWithdrawalRequest): Promise<BroadcastWithdrawalResult>
}
