'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'
import type { QuantProduct, QuantSubscriptionPreview } from '@/lib/api/quant'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import { redemptionBands, shortDate } from '@/lib/quant-view-model'
import { usdtNumber } from './QuantParts'
import { AccountCard } from './QuantAccount'
import styles from './quant-spec.module.css'

type Query<T> = { data?: T; error?: unknown; loading: boolean; refetch: () => Promise<unknown> }
const pct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')

/** A numbered section: the running number and the title, nothing else. */
export function QuantSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.sec} aria-label={title}>
    <header className={styles.secHead}>
      <span className={styles.secNo} aria-hidden="true" />
      <h2>{title}</h2>
    </header>
    {children}
  </section>
}

/** The product's terms as a specification sheet: label left in small caps, value right in the dial's serif, hairlines between. */
export function QuantSpecSheet({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const { locale } = useI18n()
  const bands = redemptionBands(product.fees.redemptionTiers)
  const row = (label: string, value: ReactNode, sub?: ReactNode, index = 0) => <div className={styles.row} style={{ '--i': index } as CSSProperties}>
    <dt>{label}</dt>
    <dd><b>{value}</b>{sub && <small>{sub}</small>}</dd>
  </div>
  return <>
    <dl className={styles.spec}>
      {product.target && row(c.charts.target, <>{c.charts.targetValue(product.target.annualMinPct, product.target.annualMaxPct)}<sup>*</sup></>, c.charts.perYear, 0)}
      {row(c.charts.minimum, <>{usdtNumber(product.minSubscriptionAtomic, locale)}<em>USDT</em></>, undefined, 1)}
      {row(c.view.feesMinimum, <>{usdtNumber(product.minRedemptionAtomic, locale)}<em>USDT</em></>, undefined, 2)}
      {row(c.charts.settle, <span className={styles.word}>{c.charts.settleValue}</span>, c.charts.cutoffAt(product.cutoffTime), 3)}
      {row(c.position.management, `${pct(product.fees.managementBps)}%`, c.charts.perYear, 4)}
      {row(c.charts.performanceFee, `${pct(product.fees.performanceBps)}%`, c.charts.newHighsOnly, 5)}
      <div className={styles.row} data-wide="" style={{ '--i': 6 } as CSSProperties}>
        <dt>{c.view.feesRate}</dt>
        <dd>
          <ul className={styles.bands}>
            {bands.map((band) => <li key={band.from}>
              <span>{band.to === null ? c.view.feeFrom(band.from) : c.view.feeBand(band.from, band.to)}</span>
              <b>{band.bps === 0 ? <span className={styles.word}>{c.charts.free}</span> : `${pct(band.bps)}%`}</b>
            </li>)}
          </ul>
        </dd>
      </div>
    </dl>
    <ol className={styles.notes}>
      {product.target && <li data-mark="*">{c.targetNote}</li>}
      <li>{c.ruleCutoff(product.cutoffTime, product.timezone)}</li>
      <li>{c.ruleStart}</li>
      <li>{c.ruleDaily}</li>
      <li>{c.indexNote}</li>
    </ol>
  </>
}

/** What happens after subscribing: three dated stops on one hairline, then where a gain and a loss go. */
export function QuantProcess({ preview, c, children }: { preview: Query<QuantSubscriptionPreview>; c: QuantCopy; children?: ReactNode }) {
  const p = preview.data
  const stops = [
    { label: c.sheet.stepSubmit, date: p ? shortDate(p.localDate) : '—', body: p ? c.charts.cutoffAt(p.cutoffTime) : '' },
    { label: c.sheet.stepStart, date: p ? shortDate(p.effectiveDate) : '—', body: c.charts.startsEarning },
    { label: c.sheet.stepSettle, date: p ? shortDate(p.firstSettlementDate) : '—', body: c.charts.firstPayout },
  ]
  return <>
    <ol className={styles.track}>
      {stops.map((stop, index) => <li key={stop.label} style={{ '--i': index } as CSSProperties}>
        <i aria-hidden="true" />
        <small>{stop.label}</small>
        <b>{stop.date}</b>
        <span>{stop.body}</span>
      </li>)}
    </ol>
    {p?.afterCutoff && <p className={styles.after}>{c.sheet.afterCutoff}</p>}
    <div className={styles.flows}>
      <p><b data-tone="gain">{c.flowGain}</b>{c.flowGainBody}</p>
      <p><b data-tone="loss">{c.flowLoss}</b>{c.flowLossBody}</p>
    </div>
    {children}
  </>
}

/** Before subscribing: the same card a holder sees, with dashes, so the page already shows where the money goes. */
export function QuantAccountPlaceholder({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const { locale } = useI18n()
  return <AccountCard
    title={c.view.accountTitle}
    principal={null}
    sub={c.view.accountPrincipal}
    figures={[
      { label: c.view.accountNet, value: '—' },
      { label: c.view.accountFees, value: '—' },
      { label: c.view.accountPaid, value: '—' },
    ]}
    empty={c.view.accountEmpty(usdtNumber(product.minSubscriptionAtomic, locale))}
  />
}

export type QuantTab = 'overview' | 'performance' | 'account' | 'rules'

/** Segmented secondary menu: one pill per section, the chosen one in the gold action colour. */
export function QuantMenu({ items, value, onChange, label }: {
  items: Array<{ key: QuantTab; label: string }>; value: QuantTab; onChange: (key: QuantTab) => void; label: string
}) {
  return <nav className={styles.menu} role="tablist" aria-label={label}>
    {items.map((item) => <button
      key={item.key}
      type="button"
      role="tab"
      aria-selected={item.key === value}
      className={styles.menuItem}
      onClick={() => onChange(item.key)}
    >{item.label}</button>)}
  </nav>
}
