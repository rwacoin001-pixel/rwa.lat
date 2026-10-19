import { addDays } from './quant.dates'

export type IndexPoint = { tradeDate: string; indexAfter: number }

export type WindowReturn = { pct: number | null; /** days of real settlements behind the figure; below `days` means the window is only partly covered */ coveredDays: number; days: number }

/**
 * Return over the last `days` calendar days ending at the latest settled date: latest index against the index at the end of
 * the day before the window opened (1.0 before the first settlement). A window longer than the history is reported with its
 * real coverage rather than presented as a full window.
 */
export function windowReturn(points: IndexPoint[], days: number): WindowReturn {
  if (!points.length) return { pct: null, coveredDays: 0, days }
  const last = points[points.length - 1]
  const startExclusive = addDays(last.tradeDate, -days)
  let base = 1
  let covered = 0
  for (const point of points) {
    if (point.tradeDate <= startExclusive) base = point.indexAfter
    else covered += 1
  }
  return { pct: (last.indexAfter / base - 1) * 100, coveredDays: covered, days }
}

/** Worst peak-to-trough fall over every settled day since inception (the index starts at 1.0), as a negative percent. */
export function maxDrawdownPct(points: IndexPoint[]): number | null {
  if (!points.length) return null
  let peak = 1
  let worst = 0
  for (const point of points) {
    peak = Math.max(peak, point.indexAfter)
    worst = Math.min(worst, point.indexAfter / peak - 1)
  }
  return worst * 100
}
