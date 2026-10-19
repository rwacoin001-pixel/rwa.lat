'use client'

import { useEffect, type CSSProperties } from 'react'
import { fmtUsdt } from '@/lib/money'
import { formatPct, shortDate, tickHeight, tickScale, type Tick } from '@/lib/quant-view-model'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import type { QuantPayout, QuantProduct } from '@/lib/api/quant'
import styles from './quant.module.css'

/** The bottom dock sits above Maison sheets, so it steps out of the way while one is open. */
export function useHideDock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const dock = document.querySelector<HTMLElement>('.liquid-dock')
    if (!dock) return
    const before = { opacity: dock.style.opacity, pointerEvents: dock.style.pointerEvents, visibility: dock.style.visibility }
    dock.style.opacity = '0'
    dock.style.pointerEvents = 'none'
    dock.style.visibility = 'hidden'
    return () => { dock.style.opacity = before.opacity; dock.style.pointerEvents = before.pointerEvents; dock.style.visibility = before.visibility }
  }, [open])
}

/** `1,234.50` from atomic USDT (no unit); `+`/`−` signs are added by the caller where the sign matters. */
export function usdtNumber(atomic: string | null | undefined, locale: string): string {
  return fmtUsdt(atomic, { locale }).replace(/\s?USDT$/, '')
}

export function signedUsdt(atomic: string | null | undefined, locale: string): string {
  if (atomic === null || atomic === undefined) return '—'
  const negative = atomic.startsWith('-')
  const body = usdtNumber(negative ? atomic.slice(1) : atomic, locale)
  if (body === '—') return body
  return negative ? `−${body}` : atomic === '0' ? body : `+${body}`
}

const kindClass: Record<Tick['kind'], string> = { gain: styles.gain, loss: styles.loss, flat: styles.flat, missing: styles.missing, today: styles.today }
const kindLabel = (copy: QuantCopy, kind: Tick['kind']) => kind === 'gain' ? copy.tickGain : kind === 'loss' ? copy.tickLoss : kind === 'flat' ? copy.tickFlat : kind === 'today' ? copy.tickToday : copy.tickMissing

/**
 * Linear settlement ledger (position card): one column per calendar day on a shared scale. Every column is a real button
 * so a day can be picked without aiming at a thin bar.
 */
export function QuantLedger({ ticks, selected, onSelect, height = 56, copy, label }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number) => void; height?: number; copy: QuantCopy; label: string
}) {
  const scale = tickScale(ticks)
  return <div className={styles.ticks} style={{ '--ledger-h': `${height}px` } as CSSProperties} role="group" aria-label={label}>
    {ticks.map((tick, index) => <button
      key={tick.date}
      type="button"
      className={`${styles.tick} ${kindClass[tick.kind]}`}
      aria-pressed={selected === index}
      aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
      onClick={() => onSelect(index)}
    >
      <i className={styles.bar} style={{ '--f': tickHeight(tick, scale), '--i': index } as CSSProperties} />
    </button>)}
  </div>
}

const CX = 150
const R_BASE = 104
const polar = (radius: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180
  return [CX + Math.cos(a) * radius, CX + Math.sin(a) * radius] as const
}

/**
 * The settlement dial. One tick per calendar day on a ring: oldest to today clockwise, today at twelve. A gain day reaches
 * outward, a loss day inward, a day with no record is a dashed slot, today is a hollow ring. The centre shows the figure since
 * inception, or the picked day. Colours come from the shared lacquer tokens, so it is ivory enamel in the warm theme and navy
 * lacquer in the cool one.
 */
export function QuantDial({ ticks, selected, onSelect, copy, product }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; copy: QuantCopy; product: QuantProduct
}) {
  const scale = tickScale(ticks)
  const last = ticks.length - 1
  const picked = selected !== null ? ticks[selected] : null
  const p = product.performance
  return <div className={styles.dialBox}>
    <svg className={styles.dial} viewBox="0 0 300 300" role="group" aria-label={copy.ledgerTitle}>
      <circle className={styles.bezel} cx={CX} cy={CX} r="146" />
      <circle className={styles.bezel} cx={CX} cy={CX} r="143" />
      {Array.from({ length: 120 }, (_, i) => {
        const [x1, y1] = polar(i % 5 === 0 ? 134.5 : 137, i * 3)
        const [x2, y2] = polar(141, i * 3)
        return <line key={i} className={styles.track} data-major={i % 5 === 0 || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
      <circle className={styles.face} cx={CX} cy={CX} r="131" />
      {[62, 84].map((r) => <circle key={r} className={styles.engrave} cx={CX} cy={CX} r={r} />)}
      <circle className={styles.baseRing} cx={CX} cy={CX} r={R_BASE} />
      {ticks.map((tick, index) => {
        const age = last - index
        const angle = -90 - age * 12
        const [bx, by] = polar(R_BASE, angle)
        const length = tick.value === null || tick.value === 0 ? 7 : 3 + (Math.abs(tick.value) / scale) * 22
        const outward = tick.value === null || tick.value >= 0
        const [x1, y1] = polar(tick.kind === 'missing' ? R_BASE - 7 : R_BASE, angle)
        const [x2, y2] = polar(tick.kind === 'missing' ? R_BASE + 7 : tick.kind === 'flat' ? R_BASE + 3 : outward ? R_BASE + length : R_BASE - length, angle)
        const toggle = () => onSelect(selected === index ? null : index)
        return <g
          key={tick.date}
          className={styles.t}
          data-kind={tick.kind}
          role="button"
          tabIndex={0}
          aria-pressed={selected === index}
          aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
          onClick={toggle}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } }}
        >
          <circle className={styles.hit} cx={bx} cy={by} r="12" />
          {tick.kind === 'today' ? <circle cx={bx} cy={by} r="4" /> : <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--i': index } as CSSProperties} />}
        </g>
      })}
      <path className={styles.marker} d={`M${CX} ${CX - 135} l5 -9 h-10 z`} />
    </svg>
    <div className={styles.center}>
      {picked
        ? <button type="button" onClick={() => onSelect(null)} aria-label={copy.sinceInception}>
          <span className={styles.cLabel}>{picked.date}</span>
          <span className={styles.cNum}>{picked.value === null ? '—' : formatPct(picked.value)}</span>
          <span className={styles.cSub}>{kindLabel(copy, picked.kind)}</span>
          <span className={styles.cRule} />
          <span className={styles.cFoot}>{copy.sinceInception} ›</span>
        </button>
        : <>
          <span className={styles.cLabel}>{copy.sinceInception}</span>
          <span className={`${styles.cNum} ${p.sinceInceptionPct !== null && p.sinceInceptionPct < 0 ? styles.down : ''}`}>{formatPct(p.sinceInceptionPct)}</span>
          <span className={styles.cSub}>{Number(p.index).toFixed(4)}</span>
          <span className={styles.cRule} />
          <span className={styles.cFoot}>{copy.recorded(p.days)}</span>
        </>}
    </div>
  </div>
}

/** Previous / next day under the dial: a thumb-sized way to walk the ticks. */
export function QuantStepper({ ticks, selected, onSelect }: { ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void }) {
  if (ticks.length === 0) return null
  const current = selected ?? ticks.length - 1
  return <div className={styles.stepper}>
    <button type="button" aria-label="‹" disabled={current <= 0} onClick={() => onSelect(current - 1)}>‹</button>
    <span>{ticks[current]?.date}</span>
    <button type="button" aria-label="›" disabled={current >= ticks.length - 1} onClick={() => onSelect(current + 1)}>›</button>
  </div>
}

function Stat({ value, label, note }: { value: number | null; label: string; note?: string }) {
  return <div className={styles.ring}>
    {label}
    <b data-tone={value === null || value === 0 ? undefined : value > 0 ? 'up' : 'down'}>{formatPct(value, 1)}</b>
    {note && <small>{note}</small>}
  </div>
}

/** Three figures under the dial: 7 days, 30 days, max drawdown. A window that is only partly recorded says how many days stand behind it. */
export function QuantRings({ product, copy }: { product: QuantProduct; copy: QuantCopy }) {
  const p = product.performance
  return <div className={styles.rings}>
    <Stat value={p.last7d.pct} label={copy.last7} note={p.last7d.coveredDays < p.last7d.days ? copy.partial(p.last7d.coveredDays) : undefined} />
    <Stat value={p.last30d.pct} label={copy.last30} note={p.last30d.coveredDays < p.last30d.days ? copy.partial(p.last30d.coveredDays) : undefined} />
    <Stat value={p.maxDrawdownPct} label={copy.drawdown} />
  </div>
}

export function QuantLegend({ copy }: { copy: QuantCopy }) {
  return <ul className={styles.legend}>
    <li><i className={styles.lgGain} />{copy.legend.gain}</li>
    <li><i className={styles.lgLoss} />{copy.legend.loss}</li>
    <li><i className={styles.lgFlat} />{copy.legend.flat}</li>
    <li><i className={styles.lgMissing} />{copy.legend.missing}</li>
    <li><i className={styles.lgToday} />{copy.legend.today}</li>
  </ul>
}

/** One day's slip: strategy return, the two fees, the net, and where the net went. Amounts are what the ledger booked. */
export function QuantReceipt({ payout, copy, locale }: { payout: QuantPayout; copy: QuantCopy; locale: string }) {
  const net = BigInt(payout.netAtomic)
  const negate = (atomic: string) => (BigInt(atomic) === BigInt(0) ? '0' : `-${atomic}`)
  return <div className={styles.slip}>
    <div className={styles.slipHead}><span>{shortDate(payout.tradeDate)} · {copy.position.receipt}</span><small>{payout.tradeDate.replace(/-/g, '')}</small></div>
    <ul className={styles.lines}>
      <li><span>{copy.position.gross}</span><i /><span>{signedUsdt(payout.grossAtomic, locale)}</span></li>
      <li><span>{copy.position.management}</span><i /><span>{signedUsdt(negate(payout.managementFeeAtomic), locale)}</span></li>
      <li><span>{copy.position.performance}</span><i /><span>{signedUsdt(negate(payout.performanceFeeAtomic), locale)}</span></li>
      <li data-total=""><span>{copy.position.net} · {net < BigInt(0) ? copy.position.reduced : copy.position.credited}</span><i /><span style={{ color: net < BigInt(0) ? 'var(--m-down)' : 'var(--m-up)' }}>{signedUsdt(payout.netAtomic, locale)}</span></li>
    </ul>
  </div>
}
