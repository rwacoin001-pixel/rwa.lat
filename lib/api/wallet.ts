import { request } from './_http'
import type { LedgerTransactionsDto, WalletNetworksDto } from './contracts'
export type WalletOverview = {
  asset: { code: string; decimals: number }
  balances: { availableAtomic: string; lockedAtomic: string; pendingAtomic: string; investedAtomic: string; rewardPayableAtomic: string; asOf: string | null }
  integration: { adapterMode: string; executionEnabled: boolean; demoExecutionEnabled: boolean }
}
export const getWalletOverview = () => request<WalletOverview>('/v1/wallet')

/** Funding rows the wallet overview carries next to balances (deposits, withdrawals, transfers). */
export type FundingActivity = { kind: 'deposit' | 'withdrawal' | 'transfer'; id: string; state: string; atomicAmount: string; at: string }
export type WalletIntegration = WalletNetworksDto['integration']
export type WalletDetail = WalletOverview & { recentActivity: FundingActivity[]; integration: WalletIntegration }
export type WalletNetwork = WalletNetworksDto['networks'][number]
export type LedgerTransaction = LedgerTransactionsDto['transactions'][number]
export type DepositAddress = { id: string; network: string; assetCode: string; address: string; memo: string | null; requiredConfirmations: number; minimumDepositAtomic: string; estimatedArrivalMinutes: number[]; warning: string; integration: WalletIntegration }

export const getWalletDetail = () => request<WalletDetail>('/v1/wallet')
export const listNetworks = () => request<WalletNetworksDto>('/v1/wallet/networks')
/** Server caps at 100; the optional opaque cursor continues after the previous page. */
export const listLedger = (limit = 100, cursor?: string) => {
  const query = new URLSearchParams({ limit: String(limit) })
  if (cursor) query.set('cursor', cursor)
  return request<LedgerTransactionsDto>(`/v1/ledger/transactions?${query.toString()}`)
}
/** Get-or-provision: the server returns the existing active address when there is one. */
export const getDepositAddress = (network: string) => request<DepositAddress>(`/v1/wallet/deposit-addresses/${encodeURIComponent(network)}`, { method: 'POST' })

export type LedgerGroup = 'funding' | 'investing' | 'income' | 'other'
export function ledgerGroup(type: string): LedgerGroup {
  if (type === 'deposit' || type.startsWith('withdrawal') || type === 'internal_transfer') return 'funding'
  if (type === 'yield_distribution') return 'income'
  if (type === 'adjustment' || type === 'reversal') return 'other'
  return 'investing'
}

/**
 * Signed change of each user balance by account purpose, using the normal side stored with each
 * ledger account. An entry on that side raises the balance.
 */
export function ledgerDeltas(tx: LedgerTransaction): Record<string, bigint> {
  const out: Record<string, bigint> = {}
  for (const entry of tx.entries) {
    if (!/^\d+$/.test(entry.atomicAmount)) continue
    const amount = BigInt(entry.atomicAmount)
    const raises = entry.side === entry.normalSide
    out[entry.purpose] = (out[entry.purpose] ?? BigInt(0)) + (raises ? amount : -amount)
  }
  return out
}

/** The headline movement of a transaction: the `available` change, else the largest absolute change. */
export function ledgerHeadline(tx: LedgerTransaction): { purpose: string; amount: bigint } | null {
  const deltas = ledgerDeltas(tx)
  if (deltas.available !== undefined && deltas.available !== BigInt(0)) return { purpose: 'available', amount: deltas.available }
  let best: { purpose: string; amount: bigint } | null = null
  for (const [purpose, amount] of Object.entries(deltas)) {
    const abs = amount < BigInt(0) ? -amount : amount
    if (!best || abs > (best.amount < BigInt(0) ? -best.amount : best.amount)) best = { purpose, amount }
  }
  return best
}

export type WithdrawalQuote = {
  network: string; assetCode: string; assetDecimals: number; atomicAmount: string; feeAtomicAmount: string; totalDebitAtomic: string
  availableAtomic: string; sufficientBalance: boolean; requiresStepUp: boolean; requiresAddressScreening: boolean; expiresAt: string; integration: WalletIntegration
}
/** The intent only: idempotency fingerprints it, so the PIN and step-up token are passed separately and never land in it. */
export type WithdrawalBody = { network: string; atomicAmount: string; addressBookId?: string; destination?: string }
export type WithdrawalSecrets = { transactionPin: string; reauthentication?: string }
export type WithdrawalReceipt = { id: string; state: string; network: string; atomicAmount: string; feeAtomicAmount: string; reasonCode: string | null; created: boolean; integration: WalletIntegration }
export type WithdrawalStatus = {
  id: string; state: string; network: string; assetCode: string; assetDecimals: number; atomicAmount: string; feeAtomicAmount: string
  reasonCode: string | null; requestedAt: string; approvedAt: string | null; completedAt: string | null
}
export type TransferBody = { recipientUserId: string; atomicAmount: string; reauthentication?: string }
export type TransferReceipt = { id: string; recipientUserId: string; atomicAmount: string; state: string; created: boolean; postedAt?: string | null; integration: WalletIntegration }
export type AddressBookEntry = {
  id: string; network: string; assetCode: string; label: string; destination: string; state: 'pending' | 'active' | 'revoked'
  riskState: 'clear' | 'manual_review' | 'blocked'; reasonCode: string | null; cooldownUntil: string; createdAt: string; activatedAt: string | null; revokedAt: string | null
}
export type AddressBook = { entries: AddressBookEntry[]; policy: { cooldownSeconds: number; financialMode: boolean } }

/** Read-only: nothing is locked. The server rejects amounts under the network minimum. */
export const quoteWithdrawal = (network: string, atomicAmount: string) => request<WithdrawalQuote>('/v1/wallet/withdrawals/quote', { method: 'POST', body: JSON.stringify({ network, atomicAmount }) })
/** Every new request carries this attempt's PIN; it is serialised straight into the request and kept nowhere else. */
export const createWithdrawal = (body: WithdrawalBody, secrets: WithdrawalSecrets, idempotencyKey: string) => request<WithdrawalReceipt>('/v1/wallet/withdrawals', {
  method: 'POST', idempotencyKey,
  body: JSON.stringify({ ...body, transactionPin: secrets.transactionPin, ...(secrets.reauthentication ? { reauthentication: secrets.reauthentication } : {}) }),
})
/** Read-only owner-scoped status; the destination address and internal chain IDs are not returned. */
export const getWithdrawalStatus = (id: string) => request<WithdrawalStatus>(`/v1/wallet/withdrawals/${encodeURIComponent(id)}`)
/** Whether the signed-in account itself can receive internal transfers (current user only). */
export type TransferEligibility = { receivable: boolean; reason: null | 'deposit_threshold' | 'account_unavailable' }
export const getTransferEligibility = () => request<TransferEligibility>('/v1/wallet/transfer-eligibility')
/** Recipient pre-check: existence + receivability only, masked name; never the recipient's deposit details. */
export type TransferRecipient = { userId: string; exists: boolean; receivable: boolean; reason: string | null; displayName: string | null; avatarInitial: string | null }
export const getTransferRecipient = (userId: string) => request<TransferRecipient>(`/v1/wallet/transfer-recipients/${encodeURIComponent(userId)}`, { loading: 'silent' })
export const createTransfer = (body: TransferBody, idempotencyKey: string) => request<TransferReceipt>('/v1/wallet/transfers', { method: 'POST', body: JSON.stringify(body), idempotencyKey })
/** Listing also activates entries whose cooldown has passed with a clear screening (server side). */
export const listAddressBook = () => request<AddressBook>('/v1/wallet/withdrawal-addresses')
export const addAddress = (body: { network: string; destination: string; label: string; reauthentication: string }) => request<AddressBookEntry>('/v1/wallet/withdrawal-addresses', { method: 'POST', body: JSON.stringify(body) })
export const revokeAddress = (id: string, reauthentication: string) => request<{ id: string; state: string; revokedAt: string | null }>(`/v1/wallet/withdrawal-addresses/${encodeURIComponent(id)}/revoke`, { method: 'PUT', body: JSON.stringify({ reauthentication }) })

/** Mirrors wallet.service assertAddress so the form can reject a malformed address before any request. */
export const isValidAddress = (network: string, value: string) => network === 'tron' ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) : /^0x[a-fA-F0-9]{40}$/.test(value)
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
