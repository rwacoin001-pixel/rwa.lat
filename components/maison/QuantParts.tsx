'use client'

import { useEffect, type CSSProperties } from 'react'
import { fmtUsdt } from '@/lib/money'
import { formatPct, shortDate, tickHeight, tickScale, type Tick } from '@/lib/quant-view-model'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import type { QuantPayout } from '@/lib/api/quant'
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

/**
 * The settlement ledger: one column per calendar day on a shared scale. Every column is a real button (44px-ish tall hit area,
 * keyboard focusable) so a day can be picked without aiming at a thin bar.
 */
export function QuantLedger({ ticks, selected, onSelect, height = 84, copy, label }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number) => void; height?: number; copy: QuantCopy; label: string
}) {
  const scale = tickScale(ticks)
  const kindLabel = (tick: Tick) => tick.kind === 'gain' ? copy.tickGain : tick.kind === 'loss' ? copy.tickLoss : tick.kind === 'flat' ? copy.tickFlat : tick.kind === 'today' ? copy.tickToday : copy.tickMissing
  return <div className={styles.ticks} style={{ '--ledger-h': `${height}px` } as CSSProperties} role="group" aria-label={label}>
    {ticks.map((tick, index) => <button
      key={tick.date}
      type="button"
      className={`${styles.tick} ${kindClass[tick.kind]}`}
      aria-pressed={selected === index}
      aria-label={`${tick.date} · ${kindLabel(tick)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
      onClick={() => onSelect(index)}
    >
      <i className={styles.bar} style={{ '--f': tickHeight(tick, scale), '--i': index } as CSSProperties} />
    </button>)}
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

/** One day's receipt: strategy return, the two fees, the net, and where the net went. Amounts are what the ledger booked. */
export function QuantReceipt({ payout, copy, locale }: { payout: QuantPayout; copy: QuantCopy; locale: string }) {
  const net = BigInt(payout.netAtomic)
  const negate = (atomic: string) => (BigInt(atomic) === BigInt(0) ? '0' : `-${atomic}`)
  return <div className={styles.receipt}>
    <div className={styles.receiptHead}><span>{shortDate(payout.tradeDate)} · {copy.position.receipt}</span><small>{net < BigInt(0) ? copy.position.reduced : copy.position.credited}</small></div>
    <ul className={styles.lines}>
      <li><span>{copy.position.gross}</span><span>{signedUsdt(payout.grossAtomic, locale)}</span></li>
      <li><span>{copy.position.management}</span><span>{signedUsdt(negate(payout.managementFeeAtomic), locale)}</span></li>
      <li><span>{copy.position.performance}</span><span>{signedUsdt(negate(payout.performanceFeeAtomic), locale)}</span></li>
      <li><span>{copy.position.net}</span><span className={net < BigInt(0) ? styles.down : undefined}>{signedUsdt(payout.netAtomic, locale)}</span></li>
    </ul>
  </div>
}
