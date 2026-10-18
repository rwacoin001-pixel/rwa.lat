/**
 * Koala Quant view model: turns API rows into what the settlement ledger draws. Pure functions, no React, so the day-state
 * rules (gain, loss, flat, missing, today) are tested without a browser.
 */

export type TickKind = 'gain' | 'loss' | 'flat' | 'missing' | 'today'
export type Tick = { date: string; kind: TickKind; value: number | null }
export type DayValue = { date: string; value: number }

const DAY_MS = 86_400_000

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function localToday(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * One tick per calendar day for the last `count` days ending today (product timezone). Settled days are gain/loss/flat by their
 * value; a day that has ended with no record is `missing` (drawn as an empty slot, never as zero); today, which is not settled
 * until it ends, is `today`. Days before the first settlement are left out so a young product does not look like it skipped days.
 */
export function buildTicks(values: DayValue[], options: { today: string; count: number; firstDate?: string | null }): Tick[] {
  const byDate = new Map(values.map((entry) => [entry.date, entry.value]))
  const first = options.firstDate ?? (values.length ? values.map((entry) => entry.date).sort()[0] : null)
  const ticks: Tick[] = []
  for (let offset = options.count - 1; offset >= 0; offset -= 1) {
    const date = addDays(options.today, -offset)
    if (first && date < first) continue
    if (date === options.today) {
      ticks.push({ date, kind: 'today', value: null })
      continue
    }
    if (date > options.today) continue
    const value = byDate.get(date)
    if (value === undefined) ticks.push({ date, kind: 'missing', value: null })
    else ticks.push({ date, kind: value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat', value })
  }
  return ticks
}

/** Bar heights in 0..1 on one shared scale (the largest move in the window), so a quiet week does not look like a crash. */
export function tickScale(ticks: Tick[], floor = 0.15): number {
  const largest = ticks.reduce((max, tick) => (tick.value === null ? max : Math.max(max, Math.abs(tick.value))), 0)
  return Math.max(largest, floor)
}

export function tickHeight(tick: Tick, scale: number): number {
  return tick.value === null || tick.value === 0 ? 0 : Math.min(1, Math.abs(tick.value) / scale)
}

/** `+0.31%` / `-1.20%` with a real minus sign; null becomes an em dash. */
export function formatPct(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  const number = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(number)) return '—'
  const text = Math.abs(number).toFixed(digits)
  return number > 0 && Number(text) !== 0 ? `+${text}%` : number < 0 && Number(text) !== 0 ? `−${text}%` : `${text}%`
}

export type WindowLabel = { text: string; partial: boolean }

/** "近 7 日" figures are only a full window when enough days were recorded; otherwise say how many days stand behind the number. */
export function windowLabel(coveredDays: number, days: number): WindowLabel {
  return { text: String(coveredDays), partial: coveredDays < days }
}

export type TimelineStep = { key: 'submit' | 'start' | 'settle'; date: string }

/**
 * The three dates the subscribe sheet shows: submit (today), the first day that counts (start earning), and the day that
 * first day is settled and its profit reaches the available balance (a trade date is settled after it has ended).
 */
export function subscriptionTimeline(preview: { localDate: string; effectiveDate: string }): TimelineStep[] {
  return [
    { key: 'submit', date: preview.localDate },
    { key: 'start', date: preview.effectiveDate },
    { key: 'settle', date: addDays(preview.effectiveDate, 1) },
  ]
}

/** Shortens `2026-10-18` to `10-18` for tick labels. */
export function shortDate(date: string): string {
  return date.slice(5)
}
