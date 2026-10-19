'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, getQuantSubscriptionPreview, listQuantPayouts, useQuantProducts } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { buildTicks, localToday, quantAudience, shortDate } from '@/lib/quant-view-model'
import { quantCaps, quantSerif } from './quant-fonts'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { QuantDial, QuantLegend, QuantStepper, Reveal, useHideDock } from './QuantParts'
import { QuantAccount, QuantHistory, QuantStrip } from './QuantAccount'
import { QuantPerformance, QuantSummary, QuantTerms } from './QuantInfo'
import { useQuantProduct } from './QuantPositionCard'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import styles from './quant.module.css'
import page from './quant-page.module.css'

/**
 * The Koala Quant tab. The settlement dial leads for everyone; what follows depends on who is looking: a visitor reads what to
 * know before subscribing, a holder sees their account and history first.
 */
export function QuantScreen() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const list = useQuantProducts()
  const slug = list.data?.[0]?.slug
  const detail = useQuantProduct(slug)
  const product = detail.data
  const audience = quantAudience(product?.position)
  const involved = audience !== 'visitor'
  const [picked, setPicked] = useState<number | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  useHideDock(disclosureOpen)
  const disclosure = useQuery(disclosureOpen ? 'quant:disclosure' : null, getQuantDisclosure, { staleTime: 5 * 60_000 })
  const payouts = useQuery(involved && slug ? `quant:payouts:${slug}` : null, () => listQuantPayouts(slug as string, 60), { staleTime: 30_000 })
  const wantsSubscribe = audience === 'visitor' || audience === 'ex-holder'
  const preview = useQuery(wantsSubscribe && slug ? `quant:preview:${slug}` : null, () => getQuantSubscriptionPreview(slug as string), { staleTime: 20_000 })

  // The dial holds one ring of 30 days; older history stays in the product record.
  const ticks = useMemo(() => product
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: 30 })
    : [], [product])

  const topbar = <RwaTopbar screen="quant" title={c.title} />
  const stage = `${styles.stage} ${quantSerif.variable} ${quantCaps.variable}`

  if (list.loading && !list.data) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (list.error && !list.data) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></MaisonPage>
  if (!slug) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></MaisonPage>
  if (!product) return <MaisonPage page="quant" dock topbar={topbar} className={stage}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>

  const p = product.performance
  const subscribe = wantsSubscribe && <Reveal>
    <button type="button" className={`${s.cta} ${page.cta}`} disabled={!product.open} onClick={() => setSubscribeOpen(true)}>
      <span>{c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
    </button>
    {!product.open && <p className={page.note}>{c.closedNote}</p>}
  </Reveal>
  const performance = <Reveal><QuantPerformance product={product} c={c} /></Reveal>
  const summary = <Reveal><QuantSummary product={product} preview={preview} c={c} /></Reveal>

  return <MaisonPage page="quant" dock topbar={topbar} className={stage}>
    <header className={styles.mast}>
      <div>
        <span className={styles.mastCaps}>{c.kicker}</span>
        <h1 className={styles.mastName}>{product.name}</h1>
      </div>
      <p className={styles.mastMeta}>{p.lastSettledDate ? `${c.settledTo} ${shortDate(p.lastSettledDate)}` : c.neverSettled}</p>
    </header>

    {(audience === 'holder' || audience === 'pending') && product.position && <QuantStrip position={product.position} c={c} />}

    {ticks.length > 0
      ? <>
        <QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} />
        <QuantStepper ticks={ticks} selected={picked} onSelect={setPicked} />
      </>
      : <p className={styles.meta} style={{ margin: '48px 0', textAlign: 'center' }}>{c.neverSettled}</p>}
    <div className={page.legend}><QuantLegend copy={c} /></div>
    <p className={page.context}>{c.indexNote}</p>

    <div>
      {involved && <>
        <Reveal><QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => setSubscribeOpen(true)} onRedeem={() => setRedeemOpen(true)} /></Reveal>
        <Reveal><QuantHistory payouts={payouts} c={c} /></Reveal>
        {performance}
        {wantsSubscribe && <>{summary}{subscribe}</>}
      </>}
      {!involved && <>{performance}{summary}{subscribe}</>}
      <Reveal><QuantTerms product={product} c={c} /></Reveal>
      <div className={page.foot}>
        <span>{c.riskLine}</span>
        <button type="button" className={page.link} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
      </div>
    </div>

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
    <Sheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} kicker={c.kicker} title={disclosure.data?.title ?? c.disclosure}>
      {disclosure.data ? <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{disclosure.data.content}</p> : disclosure.error ? <p className={s.muted}>{c.loadError}</p> : disclosure.loading ? <Skeleton rows={3} /> : <p className={s.muted}>{c.view.disclosureEmpty}</p>}
    </Sheet>
  </MaisonPage>
}
