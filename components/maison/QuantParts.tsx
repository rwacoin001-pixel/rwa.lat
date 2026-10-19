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
const splitPct = (text: string) => (text.endsWith('%') ? [text.slice(0, -1), '%'] as const : [text, ''] as const)

/**
 * The settlement dial. One tick per calendar day on a ring: oldest to today clockwise, today at twelve. A gain day reaches
 * outward, a loss day inward, a day with no record is a dashed slot, today is a hollow ring. Tap a tick (or use the arrows)
 * and a needle points at it while the centre shows that day; otherwise the centre shows the figure since inception.
 */
export function QuantDial({ ticks, selected, onSelect, copy, product }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; copy: QuantCopy; product: QuantProduct
}) {
  const scale = tickScale(ticks)
  const last = ticks.length - 1
  const picked = selected !== null ? ticks[selected] : null
  const p = product.performance
  const angleOf = (index: number) => -90 - (last - index) * 12
  const [pickedInt, pickedSign] = splitPct(picked && picked.value !== null ? formatPct(picked.value) : '—')
  const [sinceInt, sinceSign] = splitPct(formatPct(p.sinceInceptionPct))
  return <div className={styles.dialBox}>
    <div className={styles.bezelMetal} />
    <div className={styles.faceBg} />
    <svg className={styles.dial} viewBox="0 0 300 300" role="group" aria-label={copy.ledgerTitle}>
      {Array.from({ length: 120 }, (_, i) => {
        const major = i % 5 === 0
        const [x1, y1] = polar(major ? 130.5 : 133.5, i * 3)
        const [x2, y2] = polar(137, i * 3)
        return <line key={i} className={styles.track} data-major={major || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
      {[58, 72, 86].map((r) => <circle key={r} className={styles.engrave} cx={CX} cy={CX} r={r} />)}
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = polar(40, i * 5)
        const [x2, y2] = polar(56, i * 5)
        return <line key={i} className={styles.spoke} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
      <circle className={styles.baseRing} cx={CX} cy={CX} r={R_BASE} />
      {selected !== null && (() => {
        const [x1, y1] = polar(26, angleOf(selected))
        const [x2, y2] = polar(R_BASE - 2, angleOf(selected))
        return <g aria-hidden="true"><line className={styles.needle} x1={x1} y1={y1} x2={x2} y2={y2} /><circle className={styles.needleDot} cx={x2} cy={y2} r="1.8" /></g>
      })()}
      {ticks.map((tick, index) => {
        const angle = angleOf(index)
        const [bx, by] = polar(R_BASE, angle)
        const length = tick.value === null || tick.value === 0 ? 7 : 3 + (Math.abs(tick.value) / scale) * 20
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
          <circle className={styles.hit} cx={bx} cy={by} r="11" />
          {tick.kind === 'today' ? <circle cx={bx} cy={by} r="4" /> : <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--i': index } as CSSProperties} />}
        </g>
      })}
      <path className={styles.marker} d={`M${CX} ${CX - 126} l5 -9 h-10 z`} transform="translate(0 -22)" />
    </svg>
    <div className={styles.center}>
      {picked
        ? <button type="button" onClick={() => onSelect(null)} aria-label={copy.sinceInception}>
          <span className={styles.cLabel}>{picked.date}</span>
          <span className={styles.cNum}>{pickedInt}{pickedSign && <sup>{pickedSign}</sup>}</span>
          <span className={styles.cSub}>{kindLabel(copy, picked.kind)}</span>
          <span className={styles.cRule} />
          <span className={styles.cFoot}>{copy.sinceInception} ›</span>
        </button>
        : <>
          <span className={styles.cLabel}>{copy.sinceInception}</span>
          <span className={`${styles.cNum} ${p.sinceInceptionPct !== null && p.sinceInceptionPct < 0 ? styles.down : ''}`}>{sinceInt}{sinceSign && <sup>{sinceSign}</sup>}</span>
          <span className={styles.cSub}>{copy.indexShort} {Number(p.index).toFixed(4)}</span>
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

function Sub({ value, full, label, note }: { value: number | null; full: number; label: string; note?: string }) {
  const fraction = value === null ? 0 : Math.min(1, Math.abs(value) / full)
  const circumference = 2 * Math.PI * 44
  const negative = value !== null && value < 0
  return <div className={styles.sub}>
    <svg viewBox="0 0 110 110" aria-hidden="true">
      <circle className={styles.st} cx="55" cy="55" r="44" />
      {[0, 90, 180, 270].map((deg) => { const a = (deg * Math.PI) / 180; return <line key={deg} className={styles.sk} x1={55 + Math.cos(a) * 47} y1={55 + Math.sin(a) * 47} x2={55 + Math.cos(a) * 51} y2={55 + Math.sin(a) * 51} /> })}
      <circle className={styles.sv} cx="55" cy="55" r="44" stroke={negative ? '#cf7457' : '#ecd9ad'} strokeDasharray={`${circumference * fraction} ${circumference}`} transform="rotate(-90 55 55)" />
    </svg>
    <b data-tone={negative ? 'down' : undefined}>{formatPct(value, 1)}</b>
    <span>{label}</span>
    {note && <small>{note}</small>}
  </div>
}

/** Three small subdials under the dial: 7 days, 30 days, max drawdown. A ring is full at a fixed reference (3% / 8% / 5%), named under it. */
export function QuantRings({ product, copy }: { product: QuantProduct; copy: QuantCopy }) {
  const p = product.performance
  return <>
    <div className={styles.subs}>
      <Sub value={p.last7d.pct} full={3} label={copy.last7} note={p.last7d.coveredDays < p.last7d.days ? copy.partial(p.last7d.coveredDays) : undefined} />
      <Sub value={p.last30d.pct} full={8} label={copy.last30} note={p.last30d.coveredDays < p.last30d.days ? copy.partial(p.last30d.coveredDays) : undefined} />
      <Sub value={p.maxDrawdownPct} full={5} label={copy.drawdown} />
    </div>
    <p className={styles.scaleNote}>{copy.scaleNote}</p>
  </>
}

/** Forces the app's dark chrome (top bar, dock) while the Koala stage is on screen, and puts the user's theme back afterwards. */
export function useStageTheme() {
  useEffect(() => {
    const nodes = [document.documentElement, ...Array.from(document.querySelectorAll<HTMLElement>('.rwa-mobile'))]
    const before = nodes.map((node) => node.getAttribute('data-theme'))
    nodes.forEach((node) => node.setAttribute('data-theme', 'dark'))
    const pill = document.querySelector<HTMLElement>('.liquid-dock__pill')
    const pillBefore = pill ? { background: pill.style.background, borderColor: pill.style.borderColor } : null
    if (pill) { pill.style.background = 'rgba(30, 24, 18, .84)'; pill.style.borderColor = 'rgba(217, 191, 134, .3)' }
    return () => {
      nodes.forEach((node, i) => { if (before[i] === null) node.removeAttribute('data-theme'); else node.setAttribute('data-theme', before[i] as string) })
      if (pill && pillBefore) { pill.style.background = pillBefore.background; pill.style.borderColor = pillBefore.borderColor }
    }
  }, [])
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
