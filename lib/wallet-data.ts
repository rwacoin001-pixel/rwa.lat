/**
 * Wallet data layer — balances + ledger activity via Core API.
 */
import { apiClient } from './api-client'

export type WalletBalances = {
  availableAtomic: string
  lockedAtomic: string
  pendingAtomic: string
  investedAtomic: string
  rewardPayableAtomic: string
  asOf: string | null
}

export type WalletView = {
  asset: { code: string; decimals: number }
  balances: WalletBalances
  integration?: {
    custodyProvider?: string
    realFunds?: boolean
    financialMode?: boolean
    withdrawalControls?: { addressBookRequired?: boolean; addressCooldownSeconds?: number }
  }
}

export type LedgerEntry = {
  side: 'debit' | 'credit'
  purpose: string
  accountId: string
  assetCode: string
  atomicAmount: string
  assetDecimals?: number
}

export type LedgerTransaction = {
  id: string
  transactionType: string
  referenceType?: string | null
  referenceId?: string | null
  effectiveAt: string
  createdAt: string
  entries: LedgerEntry[]
}

export const ACTIVITY_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal_lock: 'Withdrawal hold',
  withdrawal_settlement: 'Withdrawal settlement',
  withdrawal_refund: 'Withdrawal refund',
  internal_transfer: 'Internal transfer',
  order_settlement: 'Order settlement',
  order_lock: 'Order hold',
  investment: 'Investment debit',
  redemption: 'Redemption',
  yield_distribution: 'Yield distribution',
  adjustment: 'Ledger adjustment',
  reversal: 'Reversal',
}

export const toUnits = (atomic: string | number | null | undefined, decimals = 6): number => {
  if (atomic === null || atomic === undefined) return 0
  const n = typeof atomic === 'string' ? Number(atomic) : atomic
  if (!Number.isFinite(n)) return 0
  return n / 10 ** decimals
}

export async function getWallet(): Promise<WalletView> {
  const r = await apiClient.axios.get('/v1/wallet')
  return r.data as WalletView
}

export async function getLedgerTransactions(limit = 50): Promise<LedgerTransaction[]> {
  const r = await apiClient.axios.get('/v1/ledger/transactions', { params: { limit } })
  const d = r.data as { transactions?: LedgerTransaction[] } | LedgerTransaction[]
  return Array.isArray(d) ? d : d.transactions ?? []
}

/** 某笔交易的"用户侧变化"（取用户账户那条 entry） */
export function userSideAmount(tx: LedgerTransaction, purposes = ['available', 'invested_cost']): { amount: number; direction: 'in' | 'out' } {
  const entry = tx.entries.find((e) => purposes.includes(e.purpose)) ?? tx.entries[0]
  if (!entry) return { amount: 0, direction: 'in' }
  const amount = toUnits(entry.atomicAmount, entry.assetDecimals ?? 6)
  return { amount, direction: entry.side === 'debit' ? 'in' : 'out' }
}
