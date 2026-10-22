'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantSubscriptionPreview, listQuantPayouts, useQuantProducts } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { demoProduct } from '@/lib/quant-demo'
import { buildTicks, localToday, quantAudience } from '@/lib/quant-view-model'
import { quantCaps, quantSerif } from './quant-fonts'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { QuantDisclosureSheet } from './QuantDisclosureSheet'
import { Segmented } from './motion'
import { QuantDial as WatchDial } from './watch/Dial'
import { QuantKpis as WatchKpis } from './watch/Charts'
import { QuantCalendar } from './watch/Calendar'
import './watch/watch-scope.css'
import './watch/fonts.css'
import { QuantAccount, QuantHistory, QuantStrip } from './QuantAccount'
import { QuantDailyBars, QuantNavChart } from './QuantCharts'
import { QuantAccountPlaceholder, QuantProcess, QuantSection, QuantSpecSheet, type QuantTab } from './QuantSpec'
import { QuantPin as WatchPin } from './watch/Pin'
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
  const { theme } = useRwaTheme()
  const c = quantCopyFor(locale)
  const list = useQuantProducts()
  const slug = list.data?.[0]?.slug
  const detail = useQuantProduct(slug)
  const raw = detail.data
  const [flagged, setFlagged] = useState(false)
  useEffect(() => {
    try { setFlagged(new URLSearchParams(window.location.search).get('preview') === '1') } catch { setFlagged(false) }
  }, [])
  // Sample figures require the explicit design-preview flag, including before the first real settlement.
  const sample = Boolean(raw) && flagged
  const product = useMemo(() => {
    if (!raw || !sample) return raw
    const shown = demoProduct()
    return { ...raw, performance: shown.performance, history: shown.history }
  }, [raw, sample])
  const audience = quantAudience(product?.position)
  const involved = audience !== 'visitor'
  const [picked, setPicked] = useState<number | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [tab, setTab] = useState<QuantTab>('overview')
  // The dial and calendar speak one language: Chinese for Chinese, English for every other locale.
  const english = locale !== 'zh-CN'
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

  // Subscribing stays one thumb away: a bar pinned above the dock (MaisonPage's `cta` reserves the room under the page).
  const pinnedSubscribe = wantsSubscribe && product.open
  const subscribe = pinnedSubscribe
    ? <div className={`${s.stickyCta} ${page.dockCta}`}>
      <button type="button" className={`${s.cta} ${page.cta}`} onClick={() => setSubscribeOpen(true)}>
        <span>{c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
      </button>
    </div>
    : wantsSubscribe && <p className={page.note} style={{ textAlign: 'center' }}>{c.closedNote}</p>
  const tabs: Array<{ key: QuantTab; label: string }> = [
    { key: 'overview', label: c.charts.tabOverview },
    { key: 'account', label: c.charts.tabAccount },
  ]
  const charts = <>
    {product.history.length > 1
      ? <>
        <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
        <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
      </>
      : <p className={styles.meta} style={{ margin: '12px 2px' }}>{c.perfPending}</p>}
  </>

  const body = <>
    {sample && <p style={{
      margin: '0 0 14px', padding: '10px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6,
      color: 'var(--m-lacquer-muted)', border: '1px solid rgba(227,187,122,.45)', background: 'rgba(227,187,122,.10)',
    }}>{c.previewNotice}</p>}
    {tab === 'overview' && <>
      {(audience === 'holder' || audience === 'pending') && product.position && <QuantStrip position={product.position} c={c} />}
      {charts}
      {wantsSubscribe && <QuantSection title={c.charts.secProcess}><QuantProcess preview={preview} c={c} /></QuantSection>}
      <QuantSection title={c.charts.secSpecs}><QuantSpecSheet product={product} c={c} /></QuantSection>
      {subscribe}
    </>}
    {tab === 'account' && <>
      <QuantCalendar product={product} ticks={ticks} selected={picked} onSelect={setPicked} english={english} />
      {involved
        ? <>
          <QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => setSubscribeOpen(true)} onRedeem={() => setRedeemOpen(true)} />
          <QuantHistory payouts={payouts} c={c} />
        </>
        : <QuantAccountPlaceholder product={product} c={c} />}
    </>}
    <div className={page.foot}>
      <span>{c.riskLine}</span>
      <button type="button" className={page.link} onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
    </div>
  </>

  return <MaisonPage page="quant" dock cta={Boolean(pinnedSubscribe && tab === 'overview')} className={`${stage} ${page.watchPage}`}>
    <h1 className="sr-only">{product.name}</h1>
    <div className="watch-scope" data-theme={theme}>
    <div className="study-stage">
    <WatchPin
      dial={ticks.length > 0
        ? <WatchDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} english={english} />
        : <p className={styles.meta} style={{ margin: '48px 0', textAlign: 'center' }}>{c.neverSettled}</p>}
      subs={<WatchKpis product={product} c={c} />}

      menu={<div className={page.siteControls}><Segmented value={tab} onChange={setTab} label={c.title} options={tabs.map(({ key, label }) => ({ value: key, label }))} /></div>}
      body={<div id="quant-panel" role="tabpanel" aria-label={tabs.find(({ key }) => key === tab)?.label} className={page.watchContent}>{body}</div>}
    />
    </div>
    </div>

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
    <QuantDisclosureSheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} />
  </MaisonPage>
}
