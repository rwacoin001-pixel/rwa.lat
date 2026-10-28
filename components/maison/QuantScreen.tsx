'use client'

import { useEffect, useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { listQuantPayouts } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock } from './primitives'
import { QuantDisclosureSheet } from './QuantDisclosureSheet'
import { QuantAccount, QuantHistory, QuantOrders } from './QuantAccount'
import { QuantAccountPlaceholder } from './QuantSpec'
import { QuantDateStrip, QuantOverview, quantWin, useQuantView } from './QuantOverview'
import { ShareWinLine } from './ShareWin'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import stage from './quant.module.css'
import v2 from './quant-v2.module.css'

/**
 * /quant (2026-10-28, IA plan docs/handoff/2026-10-28-quant-ia-plan.md). Four layers, one job each: Markets shows the
 * card (browse); /quant is the product page (understand); /quant?step=subscribe is the full-page subscribe flow
 * (decide); /quant?tab=account is "My Koala Quant" (position, orders, daily slips, add and redeem).
 */
export function QuantScreen() {
  const [mode, setMode] = useState<'product' | 'subscribe' | 'account' | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setMode(params.get('tab') === 'account' ? 'account' : params.get('step') === 'subscribe' ? 'subscribe' : 'product')
  }, [])
  if (!mode) return <MaisonPage page="quant"><Skeleton rows={5} /></MaisonPage>
  if (mode === 'account') return <MyQuant />
  if (mode === 'subscribe') return <QuantSubscribePage />
  return <QuantProductPage />
}

function QuantProductPage() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const { product } = useQuantView()
  return <MaisonPage page="quant" cta topbar={<RwaTopbar screen="quant" title={product?.name ?? c.title} onBack={() => backOr('/markets?tab=quant')} />}>
    <QuantOverview />
  </MaisonPage>
}

function QuantSubscribePage() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const { list, slug, detail, product } = useQuantView()
  const topbar = <RwaTopbar screen="quant" title={product?.name ?? c.title} onBack={() => backOr('/quant')} />
  return <MaisonPage page="quant" topbar={topbar}>
    {list.error && !list.data ? <StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} />
      : list.data && !slug ? <StateBlock title={c.comingSoon} body={c.comingSoonBody} />
      : !product ? (detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <Skeleton rows={4} />)
      : <QuantSubscribeSheet page open product={product} onClose={() => backOr('/quant')} onViewPosition={() => openPath('/quant?tab=account', { replace: true })} />}
  </MaisonPage>
}

function MyQuant() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const { list, slug, detail, product, audience } = useQuantView()
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const involved = audience !== 'visitor'
  const win = useMemo(() => quantWin(product), [product])
  const payouts = useQuery(involved && slug ? `quant:payouts:${slug}` : null, () => listQuantPayouts(slug as string, 60), { staleTime: 30_000 })
  const title = product ? `${product.name} · ${c.charts.tabAccount}` : c.title
  const topbar = <RwaTopbar screen="quant" title={title} onBack={() => backOr('/assets')} />
  const root = `${stage.stage} ${v2.root}`

  return <MaisonPage page="quant" topbar={topbar}>
    <div className={root} data-quant-v2="">
      {list.error && !list.data ? <StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} />
        : list.data && !slug ? <StateBlock title={c.comingSoon} body={c.comingSoonBody} />
        : !product ? (detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <Skeleton rows={5} />)
        : <>
          <QuantDateStrip product={product} payouts={payouts.data} locale={locale} copy={c} />
          {involved
            ? <>
              <QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => openPath('/quant?step=subscribe')} onRedeem={() => setRedeemOpen(true)} />
              <ShareWinLine moment={win} />
              <QuantOrders slug={product.slug} />
              <QuantHistory payouts={payouts} c={c} />
            </>
            : <QuantAccountPlaceholder product={product} c={c} />}
          <div className={v2.foot}>
            <span>{c.riskLine}</span>
            <button type="button" onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
          </div>
          <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
          <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
        </>}
      <QuantDisclosureSheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} />
    </div>
  </MaisonPage>
}
