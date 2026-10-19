/**
 * Local design preview for the Koala page: a 20-day settled history with daily returns between −0.10% and +1.20%, built the
 * same way the API builds it (index compounding, windows, drawdown). Only loaded when NEXT_PUBLIC_QUANT_DEMO=1, which no
 * deployed build sets. `?holder=1` adds a position and payouts so the holder layout can be previewed too.
 */
import type { QuantPayout, QuantPoint, QuantProduct, QuantSubscriptionPreview } from './api/quant'
import { addDays, localToday } from './quant-view-model'

const TZ = 'Asia/Singapore'
const DAYS = 20

function series(): Array<{ date: string; net: number; gross: number; index: number }> {
  let seed = 20261019
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const today = localToday(TZ)
  let index = 1
  return Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(today, i - DAYS)
    // Two quiet down days so the preview shows both colours; the rest spread across the range.
    const net = i === 6 ? -0.08 : i === 13 ? -0.04 : Number((-0.1 + random() * 1.3).toFixed(4))
    index *= 1 + net / 100
    return { date, net, gross: Number((net >= 0 ? net / 0.8 + 0.003 : net + 0.003).toFixed(4)), index }
  })
}

function windowPct(rows: ReturnType<typeof series>, days: number) {
  const last = rows[rows.length - 1]
  const start = addDays(last.date, -days)
  let base = 1
  let covered = 0
  for (const row of rows) { if (row.date <= start) base = row.index; else covered += 1 }
  return { pct: (last.index / base - 1) * 100, coveredDays: covered, days }
}

const holder = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('holder')
const PRINCIPAL = 10_000

export function demoProduct(): QuantProduct {
  const rows = series()
  const last = rows[rows.length - 1]
  let peak = 1
  let worst = 0
  for (const row of rows) { peak = Math.max(peak, row.index); worst = Math.min(worst, row.index / peak - 1) }
  const history: QuantPoint[] = rows.map((row) => ({ tradeDate: row.date, grossReturnPct: row.gross.toFixed(4), netReturnPct: row.net.toFixed(4), indexAfter: row.index.toFixed(8) }))
  const payouts = demoPayouts()
  const paid = payouts.reduce((sum, row) => sum + Number(row.paidAtomic), 0)
  const fees = payouts.reduce((sum, row) => sum + Number(row.managementFeeAtomic) + Number(row.performanceFeeAtomic), 0)
  return {
    id: 'demo', slug: 'koala-quant', name: '考拉量化', summary: null, status: 'pilot', open: true, cutoffTime: '15:00', timezone: TZ,
    fees: { managementBps: 100, performanceBps: 2000, redemptionTiers: [{ maxDays: 7, bps: 150 }, { maxDays: 30, bps: 50 }] },
    minSubscriptionAtomic: '100000000', minRedemptionAtomic: '10000000',
    target: { annualMinPct: '8', annualMaxPct: '15' },
    performance: {
      index: last.index.toFixed(8), indexNetOf: 'management_fee', sinceInceptionPct: (last.index - 1) * 100,
      last7d: windowPct(rows, 7), last30d: windowPct(rows, 30), maxDrawdownPct: worst * 100, lastSettledDate: last.date, days: rows.length,
    },
    history,
    disclosureId: null,
    ...(holder() ? {
      position: {
        principalAtomic: String(PRINCIPAL * 1e6), investedAtomic: String(PRINCIPAL * 1e6), waitingAtomic: '0', totalPaidAtomic: String(paid), totalNetAtomic: String(paid), totalFeesAtomic: String(fees),
        lastDay: { tradeDate: last.date, netAtomic: payouts[0].netAtomic, paidAtomic: payouts[0].paidAtomic },
        pendingOrders: [],
      },
    } : {}),
  }
}

export function demoPayouts(): QuantPayout[] {
  return series().map((row) => {
    const net = Math.round(PRINCIPAL * 1e6 * row.net / 100)
    const gross = Math.round(PRINCIPAL * 1e6 * row.gross / 100)
    const management = Math.round(PRINCIPAL * 1e6 * 0.01 / 365)
    const performance = Math.max(0, gross - management - net)
    return { tradeDate: row.date, principalBeforeAtomic: String(PRINCIPAL * 1e6), grossAtomic: String(gross), managementFeeAtomic: String(management), performanceFeeAtomic: String(performance), netAtomic: String(net), paidAtomic: String(Math.max(0, net)) }
  }).reverse()
}

export function demoPreview(): QuantSubscriptionPreview {
  const today = localToday(TZ)
  return { tradeDate: today, effectiveDate: addDays(today, 1), firstSettlementDate: addDays(today, 2), cutoffTime: '15:00', timezone: TZ, afterCutoff: false, localDate: today }
}
