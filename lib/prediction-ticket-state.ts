import { fromAtomic, toAtomic } from './money'

export type PredictionWalletAction = 'bet' | 'deposit' | 'reload' | 'loading'

/** A failed/unknown wallet must never be presented as a verified zero balance. */
export function predictionWalletAction(input: {
  availableAtomic?: string | null
  walletDecimals?: number
  walletAsset?: string
  expectedDecimals: number
  loading?: boolean
  error?: boolean
}): PredictionWalletAction {
  if (input.error) return 'reload'
  if (input.loading || input.availableAtomic == null) return 'loading'
  if (!/^\d+$/.test(input.availableAtomic) || input.walletDecimals !== input.expectedDecimals || input.walletAsset !== 'USDT') return 'reload'
  return BigInt(input.availableAtomic) === BigInt(0) ? 'deposit' : 'bet'
}

export function addPredictionStake(input: string, increment: number, decimals = 6) {
  const current = toAtomic(input, decimals)
  const extra = toAtomic(String(increment), decimals)
  if (!extra) return input
  return fromAtomic((BigInt(current ?? '0') + BigInt(extra)).toString(), decimals)
}

/** Round down: this is a smaller amount suggestion, never a promised fill. */
export function predictionCapacityStake(depth: number, placeFeeRate: number, decimals = 6): string | null {
  if (!Number.isFinite(depth) || depth <= 0 || !Number.isFinite(placeFeeRate) || placeFeeRate < 0 || placeFeeRate >= 1 || !Number.isInteger(decimals) || decimals < 0 || decimals > 12) return null
  const scale = 10 ** decimals
  const amount = Math.floor(depth / (1 - placeFeeRate) * scale)
  if (!Number.isSafeInteger(amount) || amount < 1) return null
  return fromAtomic(String(amount), decimals)
}
