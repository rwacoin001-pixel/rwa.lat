'use client'

import { useI18n } from '@/lib/i18n'
import type { QuantProduct, QuantSubscriptionPreview } from '@/lib/api/quant'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import { formatPct, redemptionBands, shortDate } from '@/lib/quant-view-model'
import { usdtNumber } from './QuantParts'
import { BlockState } from './QuantAccount'
import styles from './quant-page.module.css'

type Query<T> = { data?: T; error?: unknown; loading: boolean; refetch: () => Promise<unknown> }
const pct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')

/** What the index has actually done (and, separately, the target) as aligned rows; coverage is shown where a window is partial. */
export function QuantPerformance({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const p = product.performance
  const row = (label: string, value: number | null, note?: string) => <li key={label}>
    <span>{label}{note && <small>{note}</small>}</span>
    <span className={`${styles.num} ${value !== null && value < 0 ? styles.down : ''}`}>{formatPct(value)}</span>
  </li>
  return <section className={styles.block} aria-label={c.view.performanceTitle}>
    <h2 className={styles.h2}>{c.view.performanceTitle}</h2>
    <ul className={styles.rows}>
      {row(c.last7, p.last7d.pct, p.last7d.coveredDays < p.last7d.days ? c.partial(p.last7d.coveredDays) : undefined)}
      {row(c.last30, p.last30d.pct, p.last30d.coveredDays < p.last30d.days ? c.partial(p.last30d.coveredDays) : undefined)}
      {row(c.drawdown, p.maxDrawdownPct)}
    </ul>
    <p className={styles.note}>{c.view.drawdownHelp}</p>
    {product.target && <>
      <p className={styles.sub} style={{ marginTop: 14, color: 'var(--m-ink)' }}>{c.targetValue(product.target.annualMinPct, product.target.annualMaxPct)}</p>
      <p className={styles.note} style={{ marginTop: 2 }}>{c.targetNote}</p>
    </>}
  </section>
}

/** Visitors and ex-holders: what to know before the transaction sheet, with the dates the server gave for this order. */
export function QuantSummary({ product, preview, c }: { product: QuantProduct; preview: Query<QuantSubscriptionPreview>; c: QuantCopy }) {
  const { locale } = useI18n()
  return <section className={styles.block} aria-label={c.view.summaryTitle}>
    <h2 className={styles.h2}>{c.view.summaryTitle}</h2>
    <ul className={styles.rows}>
      <li><span>{c.view.summaryMinimum}</span><span className={styles.num}>{usdtNumber(product.minSubscriptionAtomic, locale)} USDT</span></li>
    </ul>
    <BlockState query={preview} c={c}>{(p) => <>
      <ul className={styles.rows} style={{ marginTop: 0 }}>
        <li><span>{c.view.summaryStart}</span><span className={styles.num}>{shortDate(p.effectiveDate)}</span></li>
        <li><span>{c.view.summarySettle}</span><span className={styles.num}>{shortDate(p.firstSettlementDate)}</span></li>
        <li data-quiet=""><span>{c.view.summaryCutoff(p.cutoffTime, p.timezone)}</span></li>
      </ul>
      {p.afterCutoff && <p className={styles.note}>{c.sheet.afterCutoff}</p>}
    </>}</BlockState>
    <ul className={styles.rows}>
      <li><span>{c.flowGain}<small>{c.flowGainBody}</small></span></li>
      <li><span>{c.flowLoss}<small>{c.flowLossBody}</small></span></li>
    </ul>
  </section>
}

/** Fees and settlement rules: the two fees as rows, redemption fees as a day-band table, then the rules. */
export function QuantTerms({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const { locale } = useI18n()
  const bands = redemptionBands(product.fees.redemptionTiers)
  return <section className={styles.block} aria-label={c.feesTitle}>
    <h2 className={styles.h2}>{c.feesTitle}</h2>
    <ul className={styles.rows}>
      <li><span>{c.feeManagement(pct(product.fees.managementBps))}</span></li>
      <li><span>{c.feePerformance(pct(product.fees.performanceBps))}</span></li>
    </ul>
    <table className={styles.table}>
      <thead><tr><th scope="col">{c.view.feesHolding}</th><th scope="col">{c.view.feesRate}</th></tr></thead>
      <tbody>{bands.map((band) => <tr key={band.from}>
        <td>{band.to === null ? c.view.feeFrom(band.from) : c.view.feeBand(band.from, band.to)}</td>
        <td className={styles.num}>{pct(band.bps)}%</td>
      </tr>)}</tbody>
    </table>
    <ul className={styles.rows}>
      <li><span>{c.view.feesMinimum}</span><span className={styles.num}>{usdtNumber(product.minRedemptionAtomic, locale)} USDT</span></li>
    </ul>
    <h2 className={styles.h2} style={{ marginTop: 28 }}>{c.rulesTitle}</h2>
    <ul className={styles.rows}>
      <li><span>{c.ruleCutoff(product.cutoffTime, product.timezone)}</span></li>
      <li><span>{c.ruleStart}</span></li>
      <li><span>{c.ruleDaily}</span></li>
    </ul>
  </section>
}
