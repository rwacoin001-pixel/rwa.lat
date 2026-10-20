'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, getQuantSubscriptionPreview, listQuantPayouts, useQuantProducts } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { demoProduct } from '@/lib/quant-demo'
import { buildTicks, formatPct, localToday, quantAudience, shortDate } from '@/lib/quant-view-model'
import { quantCaps, quantSerif } from './quant-fonts'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { QuantDial, QuantStepper, Reveal, useHideDock } from './QuantParts'
import { QuantAccount, QuantHistory, QuantStrip } from './QuantAccount'
import { QuantDailyBars, QuantHighlights, QuantNavChart } from './QuantCharts'
import { QuantAccountPlaceholder, QuantMenu, QuantProcess, QuantSection, QuantSpecSheet, type QuantTab } from './QuantSpec'
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
  const raw = detail.data
  // Owner layout review: `?preview=1` folds a month of sample settlements in; a banner above the charts says so.
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    try { setDemo(new URLSearchParams(window.location.search).get('preview') === '1') } catch { setDemo(false) }
  }, [])
  const product = useMemo(() => (raw && demo ? demoProduct() : raw), [raw, demo])
  const audience = quantAudience(product?.position)
  const involved = audience !== 'visitor'
  const [picked, setPicked] = useState<number | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [tab, setTab] = useState<QuantTab>('overview')
  useHideDock(disclosureOpen)
  const disclosure = useQuery(disclosureOpen ? 'quant:disclosure' : null, getQuantDisclosure, { staleTime: 5 * 60_000 })
  const payouts = useQuery(involved && slug ? `quant:payouts:${slug}` : null, () => listQuantPayouts(slug as string, 60), { staleTime: 30_000 })
  const wantsSubscribe = audience === 'visitor' || audience === 'ex-holder'
  const preview = useQuery(wantsSubscribe && slug ? `quant:preview:${slug}` : null, () => getQuantSubscriptionPreview(slug as string), { staleTime: 20_000 })

  // The dial holds one ring of 30 days; older history stays in the product record.
  const ticks = useMemo(() => product
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: 30 })
    : [], [product])

  const stage = `${styles.stage} ${quantSerif.variable} ${quantCaps.variable}`

  if (list.loading && !list.data) return <MaisonPage page="quant" dock className={stage}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (list.error && !list.data) return <MaisonPage page="quant" dock className={stage}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></MaisonPage>
  if (!slug) return <MaisonPage page="quant" dock className={stage}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></MaisonPage>
  if (!product) return <MaisonPage page="quant" dock className={stage}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>

  const subscribe = wantsSubscribe && <div className={page.ctaBlock}>
    <button type="button" className={`${s.cta} ${page.cta}`} disabled={!product.open} onClick={() => setSubscribeOpen(true)}>
      <span>{c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
    </button>
    {!product.open && <p className={page.note} style={{ textAlign: 'center' }}>{c.closedNote}</p>}
  </div>
  const tabs: Array<{ key: QuantTab; label: string }> = [
    { key: 'overview', label: c.charts.tabOverview },
    { key: 'performance', label: c.charts.tabPerformance },
    { key: 'account', label: c.charts.tabAccount },
    { key: 'rules', label: c.charts.tabRules },
  ]
  const charts = <>
    {product.history.length > 1
      ? <>
        <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
        <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
      </>
      : <p className={styles.meta} style={{ margin: '12px 2px' }}>{c.perfPending}</p>}
    <p className={page.context} style={{ textAlign: 'start', margin: '8px 2px 0' }}>{c.indexNote}</p>
  </>

  const body = <>
    {demo && <p style={{
      margin: '0 0 14px', padding: '10px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6,
      color: 'var(--m-lacquer-muted)', border: '1px solid rgba(227,187,122,.45)', background: 'rgba(227,187,122,.10)',
    }}>{c.previewNotice}</p>}
    {tab === 'overview' && <>
      {(audience === 'holder' || audience === 'pending') && product.position && <QuantStrip position={product.position} c={c} />}
      {(() => {
        const last = product.history[product.history.length - 1]
        if (!last) return null
        const net = Number(last.netReturnPct)
        return <p className={styles.latest}>{c.charts.latest} · {shortDate(last.tradeDate)}<b data-loss={net < 0 || undefined}>{formatPct(net)}</b></p>
      })()}
      <QuantHighlights product={product} c={c} />
      {subscribe}
    </>}
    {tab === 'performance' && <>{charts}</>}
    {tab === 'account' && <>
      {involved
        ? <>
          <QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => setSubscribeOpen(true)} onRedeem={() => setRedeemOpen(true)} />
          <QuantHistory payouts={payouts} c={c} />
        </>
        : <QuantAccountPlaceholder product={product} c={c} />}
    </>}
    {tab === 'rules' && <>
      {wantsSubscribe && <QuantSection title={c.charts.secProcess} kicker="PROCESS"><QuantProcess preview={preview} c={c} /></QuantSection>}
      <QuantSection title={c.charts.secSpecs} kicker="SPECIFICATIONS"><QuantSpecSheet product={product} c={c} /></QuantSection>
    </>}
    <div className={page.foot}>
      <span>{c.riskLine}</span>
      <button type="button" className={page.link} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
    </div>
  </>

  return <MaisonPage page="quant" dock className={stage}>
    <h1 className="sr-only">{product.name}</h1>
    <QuantPin
      title={<span className={styles.barTitle}>{c.title}</span>}
      dial={ticks.length > 0 ? <QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} /> : undefined}
      menu={<QuantMenu items={tabs} value={tab} onChange={setTab} label={c.title} />}
      body={<div key={tab} className={styles.tabBody}>{body}</div>}
    >
      <div className={styles.pinHead} data-pin-title=""><span className={styles.barTitle}>{c.title}</span></div>
      {ticks.length > 0
        ? <>
          <QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} />
          <div className={styles.pinFade}><QuantStepper ticks={ticks} selected={picked} onSelect={setPicked} /></div>
        </>
        : <p className={styles.meta} style={{ margin: '48px 0', textAlign: 'center' }}>{c.neverSettled}</p>}
    </QuantPin>

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
    <Sheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} kicker={c.kicker} title={disclosure.data?.title ?? c.disclosure}>
      {disclosure.data ? <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{disclosure.data.content}</p> : disclosure.error ? <p className={s.muted}>{c.loadError}</p> : disclosure.loading ? <Skeleton rows={3} /> : <p className={s.muted}>{c.view.disclosureEmpty}</p>}
    </Sheet>
  </MaisonPage>
}
