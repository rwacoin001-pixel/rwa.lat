'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, getQuantSubscriptionPreview, listQuantPayouts, useQuantProducts } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { buildTicks, localToday, quantAudience } from '@/lib/quant-view-model'
import { quantCaps, quantSerif } from './quant-fonts'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { QuantDial, QuantStepper, Reveal, useHideDock } from './QuantParts'
import { QuantAccount, QuantHistory, QuantStrip } from './QuantAccount'
import { QuantDailyBars, QuantKpis, QuantNavChart } from './QuantCharts'
import { QuantAccountPlaceholder, QuantProcess, QuantSection, QuantSpecSheet } from './QuantSpec'
import { QuantPin } from './QuantPin'
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

  const topbar = <RwaTopbar screen="quant" r2={null} account={false} title={<span className={styles.barTitle}>{c.title}</span>} />
  const stage = `${styles.stage} ${quantSerif.variable} ${quantCaps.variable}`

  if (list.loading && !list.data) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (list.error && !list.data) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></MaisonPage>
  if (!slug) return <MaisonPage page="quant" dock topbar={topbar} className={stage}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></MaisonPage>
  if (!product) return <MaisonPage page="quant" dock topbar={topbar} className={stage}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>

  const subscribe = wantsSubscribe && <div className={page.ctaBlock}>
    <button type="button" className={`${s.cta} ${page.cta}`} disabled={!product.open} onClick={() => setSubscribeOpen(true)}>
      <span>{c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
    </button>
    {!product.open && <p className={page.note} style={{ textAlign: 'center' }}>{c.closedNote}</p>}
  </div>
  const performance = product.history.length > 1 && <Reveal><QuantSection no="I" title={c.charts.secPerformance} kicker="PERFORMANCE">
    <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
    <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
  </QuantSection></Reveal>
  const process = wantsSubscribe && <Reveal><QuantSection no={involved ? 'III' : 'II'} title={c.charts.secProcess} kicker="PROCESS">
    <QuantProcess preview={preview} c={c}>{subscribe}</QuantProcess>
  </QuantSection></Reveal>
  const specs = <Reveal><QuantSection no={involved ? (wantsSubscribe ? 'IV' : 'III') : 'III'} title={c.charts.secSpecs} kicker="SPECIFICATIONS">
    <QuantSpecSheet product={product} c={c} />
  </QuantSection></Reveal>

  return <MaisonPage page="quant" dock topbar={topbar} className={stage}>
    <h1 className="sr-only">{product.name}</h1>
    <QuantPin subs={<QuantKpis product={product} c={c} />} bar={ticks.length > 0 ? <><div className={styles.pinBarDial}><QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} /></div><QuantKpis product={product} c={c} compact /></> : undefined}>
      {ticks.length > 0
        ? <>
          <QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} />
          <div className={styles.pinFade}><QuantStepper ticks={ticks} selected={picked} onSelect={setPicked} /></div>
        </>
        : <p className={styles.meta} style={{ margin: '48px 0', textAlign: 'center' }}>{c.neverSettled}</p>}
    </QuantPin>

    {(audience === 'holder' || audience === 'pending') && product.position && <QuantStrip position={product.position} c={c} />}

    {involved && <>
      <Reveal><QuantSection no="I" title={c.charts.secAccount} kicker="ACCOUNT">
        <QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => setSubscribeOpen(true)} onRedeem={() => setRedeemOpen(true)} />
        <QuantHistory payouts={payouts} c={c} />
      </QuantSection></Reveal>
      {product.history.length > 1 && <Reveal><QuantSection no="II" title={c.charts.secPerformance} kicker="PERFORMANCE">
        <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
        <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
      </QuantSection></Reveal>}
      {process}
      {specs}
    </>}
    {!involved && <>
      <Reveal><QuantSection no="I" title={c.charts.secAccount} kicker="ACCOUNT">
        <QuantAccountPlaceholder product={product} c={c} />
      </QuantSection></Reveal>
      {performance}{process}{specs}
    </>}
    <div className={page.foot}>
      <span>{c.riskLine}</span>
      <button type="button" className={page.link} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
    </div>

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
    <Sheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} kicker={c.kicker} title={disclosure.data?.title ?? c.disclosure}>
      {disclosure.data ? <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{disclosure.data.content}</p> : disclosure.error ? <p className={s.muted}>{c.loadError}</p> : disclosure.loading ? <Skeleton rows={3} /> : <p className={s.muted}>{c.view.disclosureEmpty}</p>}
    </Sheet>
  </MaisonPage>
}
