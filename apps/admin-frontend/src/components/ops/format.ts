// Display rules for the redesigned console: money with two decimals (full precision on hover), waits in plain words,
// Singapore time, one porcelain face per user. Pure functions, covered by test/ops-format.test.mjs.

export function money(atomic: string | bigint | null | undefined, decimals = 6, places = 2): string {
  if (atomic === null || atomic === undefined || atomic === '') return '—'
  let value: bigint
  try { value = BigInt(atomic) } catch { return '—' }
  const negative = value < BigInt(0)
  if (negative) value = -value
  const scale = BigInt(10) ** BigInt(decimals)
  const keep = BigInt(10) ** BigInt(places)
  // Round half up to `places`.
  const scaled = (value * keep * BigInt(2) + scale) / (scale * BigInt(2))
  const whole = scaled / keep
  const fraction = (scaled % keep).toString().padStart(places, '0')
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${places ? '.' + fraction : ''}`
}

export function moneyFull(atomic: string | bigint | null | undefined, decimals = 6): string {
  if (atomic === null || atomic === undefined || atomic === '') return '—'
  let value: bigint
  try { value = BigInt(atomic) } catch { return '—' }
  const negative = value < BigInt(0)
  if (negative) value = -value
  const scale = BigInt(10) ** BigInt(decimals)
  const whole = (value / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`
}

/** "刚刚" / "12 分钟" / "3 小时" / "5 天": how long something has waited. */
export function waited(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时`
  return `${Math.floor(hours / 24)} 天`
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  const w = waited(iso, now)
  return w === '—' || w === '刚刚' ? w : `${w}前`
}

/** Full Singapore time for tooltips: 2026-11-03 14:05:09 (新加坡). */
export function sgTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 8 * 3600000)
  return `${d.toISOString().slice(0, 19).replace('T', ' ')} (新加坡)`
}

export function sgDateLabel(now = Date.now()): string {
  const d = new Date(now + 8 * 3600000)
  const week = '日一二三四五六'[d.getUTCDay()]
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日 · 周${week}`
}

/** Wait buckets for the big card's timeline: under 10 min, 10–30, 30–60, over an hour. */
export const WAIT_BUCKETS = [
  { label: '< 10 分钟', max: 10 },
  { label: '10–30 分钟', max: 30 },
  { label: '30–60 分钟', max: 60 },
  { label: '> 1 小时', max: Infinity },
] as const

export function waitBucket(iso: string, now = Date.now()): number {
  const minutes = (now - Date.parse(iso)) / 60000
  return WAIT_BUCKETS.findIndex((b) => minutes < b.max)
}

/** The same porcelain face for the same user everywhere (public/avatars/porcelain/01–16.webp). */
export function faceFor(id: string | null | undefined): string {
  let hash = 0
  for (const ch of id ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return `/avatars/porcelain/${String((hash % 16) + 1).padStart(2, '0')}.webp`
}

export function shortAddress(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) return '—'
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`
}

export const NETWORK_LABEL: Record<string, string> = {
  'tron-mainnet': 'TRC20',
  'ethereum-mainnet': 'ERC20',
  'bsc-mainnet': 'BEP20',
  'polygon-mainnet': 'Polygon',
}
export const networkLabel = (network: string) => NETWORK_LABEL[network] ?? network

/** "1200", "1,200" and "1200.00" all match "1,200.00", "-0.120" matches "-0.12"; other text must match exactly. */
export function sameEntry(typed: string, expected: string): boolean {
  const norm = (s: string) => {
    const v = s.trim().replace(/,/g, '')
    const m = v.match(/^(-?)(\d+)(?:\.(\d+))?$/)
    if (!m) return v
    const whole = m[2].replace(/^0+(?=\d)/, '')
    const fraction = (m[3] ?? '').replace(/0+$/, '')
    const value = fraction ? `${whole}.${fraction}` : whole
    return value === '0' ? '0' : `${m[1]}${value}`
  }
  return typed.trim() !== '' && norm(typed) === norm(expected)
}
