'use client'

import { useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, useQuantProducts, type QuantProduct } from '@/lib/api/quant'
import { quantCopyFor, type QuantCopy } from '@/lib/maison-quant-copy'
import { buildTicks, formatPct, localToday, shortDate } from '@/lib/quant-view-model'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { QuantLedger, QuantLegend, useHideDock } from './QuantParts'
import { QuantPositionPlate, useQuantProduct } from './QuantPositionCard'
import { QuantSubscribeSheet } from './QuantSheets'
import styles from './quant.module.css'

const tone = (value: number | null | undefined) => (value === null || value === undefined || value === 0 ? undefined : value > 0 ? styles.up : styles.down)

function Metrics({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const p = product.performance
  const cell = (label: string, value: number | null, note?: string) => <div className={styles.metric}>{label}<b className={tone(value)}>{formatPct(value, 1)}</b>{note && <small>{note}</small>}</div>
  return <div className={styles.metrics}>
    {cell(c.last7, p.last7d.pct, p.last7d.coveredDays < p.last7d.days ? c.partial(p.last7d.coveredDays) : undefined)}
    {cell(c.last30, p.last30d.pct, p.last30d.coveredDays < p.last30d.days ? c.partial(p.last30d.coveredDays) : undefined)}
    {cell(c.drawdown, p.maxDrawdownPct)}
  </div>
}

function Rules({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const tiers = [...product.fees.redemptionTiers].sort((a, b) => a.maxDays - b.maxDays)
  const last = tiers[tiers.length - 1]
  const pct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')
  return <>
    <SectionHead index="02" title={c.feesTitle} />
    <ul className={styles.lines}>
      <li><span>{c.feeManagement(pct(product.fees.managementBps))}</span></li>
      <li><span>{c.feePerformance(pct(product.fees.performanceBps))}</span></li>
      {tiers.map((tier) => <li key={tier.maxDays}><span>{c.feeRedemption(tier.maxDays, pct(tier.bps))}</span></li>)}
      {last && <li><span>{c.feeRedemptionFree(last.maxDays)}</span></li>}
    </ul>
    <SectionHead index="03" title={c.rulesTitle} />
    <ul className={styles.lines}>
      <li><span>{c.ruleCutoff(product.cutoffTime, product.timezone)}</span></li>
      <li><span>{c.ruleStart}</span></li>
      <li><span>{c.ruleDaily}</span></li>
      <li><span>{c.indexNote}</span></li>
    </ul>
  </>
}

/** The Koala Quant tab: lacquer plate with the daily settlement ledger, then where the money goes, fees and rules. */
export function QuantScreen() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const list = useQuantProducts()
  const slug = list.data?.[0]?.slug
  const detail = useQuantProduct(slug)
  const product = detail.data
  const [picked, setPicked] = useState<number | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  useHideDock(disclosureOpen)
  const disclosure = useQuery(disclosureOpen ? 'quant:disclosure' : null, getQuantDisclosure, { staleTime: 5 * 60_000 })

  const ticks = useMemo(() => product
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: 30 })
    : [], [product])
  const lastSettled = useMemo(() => ticks.map((tick, index) => (tick.value !== null ? index : -1)).filter((index) => index >= 0).pop() ?? null, [ticks])
  const selected = picked ?? lastSettled
  const sel = selected !== null ? ticks[selected] : null
  const selRow = sel ? product?.history.find((row) => row.tradeDate === sel.date) : undefined

  const topbar = <RwaTopbar screen="quant" title={c.title} />

  if (list.loading && !list.data) return <MaisonPage page="quant" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (list.error && !list.data) return <MaisonPage page="quant" dock topbar={topbar}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></MaisonPage>
  if (!slug) return <MaisonPage page="quant" dock topbar={topbar}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></MaisonPage>
  if (!product) return <MaisonPage page="quant" dock topbar={topbar}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>

  const p = product.performance
  const holds = product.position && (BigInt(product.position.principalAtomic) > BigInt(0) || product.position.pendingOrders.length > 0)
  return <MaisonPage page="quant" dock topbar={topbar}>
    <section className={styles.plate}>
      <div className={styles.plateHead}>
        <span className={styles.plateKicker}>{c.kicker} · {product.name}</span>
        <span className={styles.plateMeta}>{p.lastSettledDate ? `${c.settledTo} ${shortDate(p.lastSettledDate)}` : c.neverSettled}</span>
      </div>
      <div className={styles.big}>
        <p className={`${styles.bigFigure} ${tone(p.sinceInceptionPct) ?? ''}`}>{formatPct(p.sinceInceptionPct)}</p>
        <span className={styles.bigLabel}>{c.sinceInception}</span>
      </div>
      <p className={`${styles.plateMeta} ${s.num}`} style={{ margin: '6px 0 0' }}>{c.indexLabel} {Number(p.index).toFixed(4)} · {c.recorded(p.days)}</p>
      <div className={styles.slot}>
        {ticks.length > 0
          ? <QuantLedger ticks={ticks} selected={selected} onSelect={setPicked} copy={c} label={c.ledgerTitle} />
          : <p className={styles.plateMeta} style={{ margin: '24px 8px', textAlign: 'center' }}>{c.neverSettled}</p>}
        {ticks.length > 0 && <div className={styles.axis}><span>{shortDate(ticks[0].date)}</span><span>{shortDate(ticks[ticks.length - 1].date)}</span></div>}
      </div>
      <div className={styles.readout} aria-live="polite">
        {sel
          ? <><span>{sel.date} · {sel.kind === 'gain' ? c.tickGain : sel.kind === 'loss' ? c.tickLoss : sel.kind === 'flat' ? c.tickFlat : sel.kind === 'today' ? c.tickToday : c.tickMissing}</span>
            {sel.value !== null && <b className={tone(sel.value)}>{formatPct(sel.value)}{sel.kind === 'loss' ? ` · ${c.position.reduced}` : ''}</b>}</>
          : <span>{c.ledgerTitle}</span>}
      </div>
      {selRow && <p className={`${styles.plateMeta} ${s.num}`} style={{ margin: '2px 0 0' }}>{c.position.gross} {formatPct(selRow.grossReturnPct)}</p>}
      <Metrics product={product} c={c} />
      <div className={styles.plateFoot}><span>{c.riskLine}</span><b><button type="button" className={s.link} style={{ color: 'inherit' }} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button></b></div>
      <div className={styles.plateActions}>
        <button type="button" className={styles.plateBtn} data-primary="" disabled={!product.open} onClick={() => setSubscribeOpen(true)}>{holds ? c.addMore : c.subscribe}</button>
      </div>
    </section>
    <QuantLegend copy={c} />
    {!product.open && <div className={s.notice}><span>{c.closedNote}</span></div>}
    {product.target && <div className={styles.target}><span>{c.target}</span><b>{c.targetValue(product.target.annualMinPct, product.target.annualMaxPct)}</b><small>{c.targetNote}</small></div>}

    {holds && <div style={{ marginTop: 22 }}><QuantPositionPlate product={product} /></div>}

    <SectionHead index="01" title={c.flowTitle} />
    <div className={styles.flow}>
      <div className={styles.flowCard} data-tone="gain"><p>{c.flowGain}</p><span>{c.flowGainBody}</span></div>
      <div className={styles.flowCard} data-tone="loss"><p>{c.flowLoss}</p><span>{c.flowLossBody}</span></div>
    </div>
    <Rules product={product} c={c} />

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <Sheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} kicker={c.kicker} title={disclosure.data?.title ?? c.disclosure}>
      {disclosure.data ? <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{disclosure.data.content}</p> : disclosure.error ? <p className={s.muted}>{c.loadError}</p> : <Skeleton rows={3} />}
    </Sheet>
  </MaisonPage>
}
