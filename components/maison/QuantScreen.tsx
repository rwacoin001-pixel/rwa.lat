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
import { QuantAccount, QuantHistory } from './QuantAccount'
import { QuantAccountPlaceholder } from './QuantSpec'
import { QuantMonth, quantWin, useQuantView } from './QuantOverview'
import { ShareWinLine } from './ShareWin'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import stage from './quant.module.css'
import v2 from './quant-v2.module.css'

/**
 * /quant (2026-10-28). Koala Quant itself now lives on Markets (the quant tab), so a plain /quant goes there. What stays here
 * is "My Koala Quant" (/quant?tab=account), opened from the Assets card: the return calendar, my position with add and
 * redeem, and my payout history, in the Paper & Glass look (docs/design-system.md §7.6).
 */
export function QuantScreen() {
  const [mine, setMine] = useState<boolean | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'account') { setMine(true); return }
    setMine(false)
    // A tick later: the shell re-adds its path listener after this first effect runs.
    const timer = window.setTimeout(() => openPath(`/markets?tab=quant${params.get('preview') === '1' ? '&preview=1' : ''}`, { replace: true }), 0)
    return () => window.clearTimeout(timer)
  }, [])
  if (!mine) return <MaisonPage page="quant"><Skeleton rows={5} /></MaisonPage>
  return <MyQuant />
}

function MyQuant() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const { list, slug, detail, product, audience, ticks } = useQuantView()
  const [picked, setPicked] = useState<number | null>(null)
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
          <QuantMonth product={product} ticks={ticks} selected={picked} onSelect={setPicked} locale={locale} />
          {involved
            ? <>
              <QuantAccount product={product} actions={audience !== 'ex-holder'} onAdd={() => setSubscribeOpen(true)} onRedeem={() => setRedeemOpen(true)} />
              <ShareWinLine moment={win} />
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
