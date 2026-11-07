import { request, type ApiResult } from './_http'
import { getWalletOverview, type WalletOverview } from './wallet'
import { listPositions, totalsFor, type Position } from './portfolio'
import { listBasketPositions, basketMarketValue, type BasketPosition } from './basket-positions'
import type { QuantPosition } from './quant'
import { betAmounts, betStatus } from './my-predictions'
import type { PredictionBet } from '@/lib/rwa-api'

export type PortfolioSummary = {
  currency: 'USDT'
  decimals: 6
  totalAtomic: string
  today: null | {
    changeAtomic: string
    changePct: string | null
    since: string
    basis: 'ledger'
  }
  /** Total at the end of each of the last 6 Singapore days, then now (oldest first). Older APIs omit it. */
  sparkAtomic?: string[]
  asOf: string
}

export type AssetSummary = PortfolioSummary & {
  availableAtomic: string
  valuationComplete: boolean
  unpricedCount: number
  breakdown: Record<'cash' | 'rewards' | 'quant' | 'predictions' | 'baskets' | 'other', string>
  quant: { netAtomic: string; lastDayAtomic: string | null }
  predictions: { count: number; openCount: number; paidAtomic: string }
}

const atomic = (value: string) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid asset amount')
  return BigInt(value)
}

/** One valuation rule for home, profile and assets. Paid-out income is already in cash. */
export function summarizeAssets(wallet: WalletOverview, positions: Position[], baskets: BasketPosition[], quant: QuantPosition[], bets: PredictionBet[], ledger: PortfolioSummary | null): AssetSummary {
  if (wallet.asset.code !== 'USDT' || wallet.asset.decimals !== 6) throw new Error('Unsupported settlement asset')
  const balances = wallet.balances
  const products = totalsFor(positions)
  let unpricedCount = products.unpriced
  let basketValue = BigInt(0)
  for (const basket of baskets) {
    const value = basketMarketValue(basket)
    if (value === null) unpricedCount++
    else basketValue += value
  }
  let predictionValue = BigInt(0), paid = BigInt(0), openCount = 0
  for (const bet of bets) {
    if (bet.feeAtomic !== undefined) atomic(bet.feeAtomic)
    if (bet.payoutFeeAtomic !== undefined) atomic(bet.payoutFeeAtomic)
    const amounts = betAmounts(bet)
    const status = betStatus(bet.status)
    if (status === 'unknown') throw new Error('Unknown prediction status')
    if (status === 'placed') {
      // The placement fee has been spent. The remaining stake is cost, not a live quote.
      if (amounts.stake === null || amounts.stake < amounts.fee) throw new Error('Invalid prediction stake')
      predictionValue += amounts.stake - amounts.fee
      openCount++
    }
    if (status === 'won') {
      if (amounts.netPayout === null || amounts.netPayout < BigInt(0)) throw new Error('Invalid prediction payout')
      paid += amounts.netPayout
    }
  }
  const breakdown = {
    cash: (atomic(balances.availableAtomic) + atomic(balances.lockedAtomic) + atomic(balances.pendingAtomic)).toString(),
    rewards: atomic(balances.rewardPayableAtomic).toString(),
    // principalAtomic includes waiting lots. investedAtomic is book cost represented by the holdings below.
    quant: quant.reduce((sum, position) => sum + atomic(position.principalAtomic), BigInt(0)).toString(),
    predictions: predictionValue.toString(), baskets: basketValue.toString(), other: products.value.toString(),
  }
  const latestDay = quant.reduce<string | null>((day, position) => !position.lastDay ? day : day === null || position.lastDay.tradeDate > day ? position.lastDay.tradeDate : day, null)
  return {
    currency: 'USDT', decimals: 6,
    totalAtomic: Object.values(breakdown).reduce((sum, value) => sum + BigInt(value), BigInt(0)).toString(),
    availableAtomic: balances.availableAtomic, breakdown, unpricedCount, valuationComplete: unpricedCount === 0,
    // The old spark and percentage track ledger book balances, which have a different basis from asset valuation.
    today: ledger?.today ? { ...ledger.today, changePct: null } : null,
    asOf: new Date().toISOString(),
    quant: {
      netAtomic: quant.reduce((sum, position) => sum + BigInt(position.totalNetAtomic), BigInt(0)).toString(),
      lastDayAtomic: latestDay === null ? null : quant.reduce((sum, position) => sum + (position.lastDay?.tradeDate === latestDay ? BigInt(position.lastDay.netAtomic) : BigInt(0)), BigInt(0)).toString(),
    },
    predictions: { count: bets.length, openCount, paidAtomic: paid.toString() },
  }
}

type BetPage = { total: number; page: number; limit: number; items: PredictionBet[] }
const invalid = (): ApiResult<never> => ({ ok: false, error: { status: 0, code: 'ASSET_SUMMARY_UNAVAILABLE', message: 'Asset data could not be verified. Refresh to retry.' } })

/** Read every page. A truncated/changed history must never become a smaller, apparently complete balance. */
async function allPredictionBets(): Promise<ApiResult<PredictionBet[]>> {
  const rows: PredictionBet[] = [], seen = new Set<string>()
  let total: number | undefined
  for (let page = 1; total === undefined || rows.length < total; page++) {
    const result = await request<BetPage>(`/v1/predictions/bets?page=${page}&limit=100`, { loading: 'silent' })
    if (!result.ok) return result
    const data = result.data
    if (!Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page || data.limit !== 100 || !Array.isArray(data.items) || (total !== undefined && total !== data.total)) return invalid()
    total = data.total
    for (const bet of data.items) {
      if (!bet.id || seen.has(bet.id)) return invalid()
      seen.add(bet.id)
      rows.push(bet)
    }
    if (rows.length === total) return { ok: true, data: rows }
    if (!data.items.length || rows.length > total) return invalid()
  }
  return invalid()
}

export async function getPortfolioSummary(): Promise<ApiResult<AssetSummary>> {
  const [wallet, positions, baskets, quant, bets, ledger] = await Promise.all([
    getWalletOverview(), listPositions(), listBasketPositions(),
    request<QuantPosition[]>('/v1/quant/me/positions', { loading: 'silent' }),
    allPredictionBets(), request<PortfolioSummary>('/v1/portfolio/summary', { loading: 'silent' }),
  ])
  if (!wallet.ok) return wallet
  if (!positions.ok) return positions
  if (!baskets.ok) return baskets
  if (!quant.ok) return quant
  if (!bets.ok) return bets
  try {
    return { ok: true, data: summarizeAssets(wallet.data, positions.data, baskets.data, quant.data, bets.data, ledger.ok ? ledger.data : null) }
  } catch { return invalid() }
}
