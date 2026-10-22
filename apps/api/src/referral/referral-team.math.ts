export type TeamTier = { fromAtomic: string; toAtomic: string | null; rateBps: number }
/** Rates apply to separate segments, rounded down once per segment in six-decimal USDT. */
export function progressiveReward(base: bigint, tiers: readonly TeamTier[]): bigint {
  if (base <= 0n) return 0n
  let total = 0n, previous = 0n
  if (!tiers.length) throw new Error('Team tiers are missing')
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i], from = BigInt(t.fromAtomic), to = t.toAtomic === null ? null : BigInt(t.toAtomic)
    if (from !== previous || !Number.isInteger(t.rateBps) || t.rateBps < 0 || t.rateBps > 10000 || (to !== null && to <= from) || (to === null && i !== tiers.length - 1)) throw new Error('Invalid team tiers')
    const end = to === null || base < to ? base : to
    if (end > from) total += (end - from) * BigInt(t.rateBps) / 10000n
    previous = to ?? previous
  }
  if (tiers[tiers.length - 1].toAtomic !== null) throw new Error('Team tiers must cover the entire range')
  return total
}
export function monthlyWindow(month: string, now = new Date()) {
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid settlement month')
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1) - 8 * 3600000)
  const end = new Date(Date.UTC(y, m, 1) - 8 * 3600000)
  if (end.getTime() > now.getTime()) throw new Error('Cannot settle an unfinished month')
  return { start: start.toISOString(), end: end.toISOString() }
}
