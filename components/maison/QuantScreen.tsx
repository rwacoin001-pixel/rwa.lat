'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, useQuantProducts, type QuantProduct } from '@/lib/api/quant'
import { quantCopyFor, type QuantCopy } from '@/lib/maison-quant-copy'
import { buildTicks, localToday, shortDate } from '@/lib/quant-view-model'
import { Lacquer } from './motion'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { QuantDial, QuantLegend, QuantRings, QuantStepper, useHideDock } from './QuantParts'
import { QuantPositionPlate, useQuantProduct } from './QuantPositionCard'
import { QuantSubscribeSheet } from './QuantSheets'
import styles from './quant.module.css'

function Rules({ product, c, first }: { product: QuantProduct; c: QuantCopy; first: number }) {
  const tiers = [...product.fees.redemptionTiers].sort((a, b) => a.maxDays - b.maxDays)
  const last = tiers[tiers.length - 1]
  const pct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')
  const index = (offset: number) => String(first + offset).padStart(2, '0')
  return <>
    <SectionHead index={index(0)} title={c.feesTitle} />
    <ul className={`${styles.lines} ${styles.plain}`}>
      <li><span>{c.feeManagement(pct(product.fees.managementBps))}</span></li>
      <li><span>{c.feePerformance(pct(product.fees.performanceBps))}</span></li>
      {tiers.map((tier) => <li key={tier.maxDays}><span>{c.feeRedemption(tier.maxDays, pct(tier.bps))}</span></li>)}
      {last && <li><span>{c.feeRedemptionFree(last.maxDays)}</span></li>}
    </ul>
    <SectionHead index={index(1)} title={c.rulesTitle} />
    <ul className={`${styles.lines} ${styles.plain}`}>
      <li><span>{c.ruleCutoff(product.cutoffTime, product.timezone)}</span></li>
      <li><span>{c.ruleStart}</span></li>
      <li><span>{c.ruleDaily}</span></li>
      <li><span>{c.indexNote}</span></li>
    </ul>
  </>
}

/** The Koala Quant tab: the settlement dial on a lacquer card, then the account, where the money goes, fees and rules. */
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

  // The dial holds one ring of 30 days; older history stays in the product record.
  const ticks = useMemo(() => product
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: 30 })
    : [], [product])

  const topbar = <RwaTopbar screen="quant" title={c.title} />

  if (list.loading && !list.data) return <MaisonPage page="quant" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (list.error && !list.data) return <MaisonPage page="quant" dock topbar={topbar}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></MaisonPage>
  if (!slug) return <MaisonPage page="quant" dock topbar={topbar}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></MaisonPage>
  if (!product) return <MaisonPage page="quant" dock topbar={topbar}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>

  const p = product.performance
  const holds = Boolean(product.position && (BigInt(product.position.principalAtomic) > BigInt(0) || product.position.pendingOrders.length > 0))
  return <MaisonPage page="quant" dock topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{c.kicker}</p>
      <h1 className={s.titleL}>{product.name}</h1>
    </header>

    <Lacquer className={styles.card}>
      <div className={styles.head}>
        <span className={styles.kick}>{c.ledgerTitle}</span>
        <span className={styles.meta}>{p.lastSettledDate ? `${c.settledTo} ${shortDate(p.lastSettledDate)}` : c.neverSettled}</span>
      </div>
      {ticks.length > 0
        ? <>
          <QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} />
          <QuantStepper ticks={ticks} selected={picked} onSelect={setPicked} />
        </>
        : <p className={styles.meta} style={{ margin: '36px 0', textAlign: 'center' }}>{c.neverSettled}</p>}
      <QuantRings product={product} copy={c} />
      <div className={styles.foot2}>
        <span>{c.riskLine}</span>
        <button type="button" className={s.link} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
      </div>
    </Lacquer>
    <QuantLegend copy={c} />

    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button type="button" className={s.cta} style={{ flex: 1 }} disabled={!product.open} onClick={() => setSubscribeOpen(true)}>
        <span>{holds ? c.addMore : c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
      </button>
    </div>
    {!product.open && <div className={s.notice}><span>{c.closedNote}</span></div>}

    {product.target && <div className={styles.target}><b>{product.target.annualMinPct}–{product.target.annualMaxPct}%</b><p><strong>{c.target}</strong> · {c.targetNote}</p></div>}

    {holds && <>
      <SectionHead index="01" title={c.position.title} />
      <QuantPositionPlate product={product} />
    </>}

    <SectionHead index={holds ? '02' : '01'} title={c.flowTitle} />
    <div className={styles.flow}>
      <div><b>{c.flowGain}</b>{c.flowGainBody}</div><hr />
      <div><b>{c.flowLoss}</b>{c.flowLossBody}</div>
    </div>
    <Rules product={product} c={c} first={holds ? 3 : 2} />

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <Sheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} kicker={c.kicker} title={disclosure.data?.title ?? c.disclosure}>
      {disclosure.data ? <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{disclosure.data.content}</p> : disclosure.error ? <p className={s.muted}>{c.loadError}</p> : <Skeleton rows={3} />}
    </Sheet>
  </MaisonPage>
}
