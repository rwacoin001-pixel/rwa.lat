'use client'

import { useEffect, useRef, useState } from 'react'
import { usePageState } from '@/lib/app-navigation'
import { mergeDisplayPage } from '@/lib/navigation-memory'
import { useI18n } from '@/lib/i18n'
import { getPolymarketFeed, POLYMARKET_CATEGORIES, type PolymarketCategory, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'
import {useContentTranslation} from '@/lib/use-content-translation'
import { fmtUsd } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { openPath } from '@/lib/maison-nav'
import { polymarketFeedCopy } from '@/lib/polymarket-feed-copy'
import { Figure } from './motion'
import { fmtDate, fmtDateTime } from './format'
import { Skeleton, StateBlock, maison as s } from './primitives'

export function PredictionFeed() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const m = copy.markets
  const labels = polymarketFeedCopy[locale]
  const [category, setCategory] = usePageState<PolymarketCategory>('prediction:category', 'all')
  const [offset, setOffset] = usePageState('prediction:offset', 0)
  const [items, setItems] = usePageState<PolymarketFeedMarket[]>('prediction:items', [])
  const [nextOffset, setNextOffset] = usePageState<number | null>('prediction:next', null)
  const [fetchedAt, setFetchedAt] = usePageState<string | null>('prediction:updated', null)
  const [loading, setLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = usePageState('prediction:loaded', false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const content=useContentTranslation(items.flatMap(item=>[item.question,...item.outcomes.map(o=>o.label),'2026 Midterms']))
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    void getPolymarketFeed(category, offset, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        setItems((previous) => mergeDisplayPage(previous, page.items, offset))
        setNextOffset(page.nextOffset)
        setFetchedAt(page.fetchedAt)
        setLoadedOnce(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) { setError(true); setLoadedOnce(true) }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [category, offset, retry])

  useEffect(() => {
    if (!nextOffset || loading || error || !sentinel.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setOffset(nextOffset)
    }, { rootMargin: '400px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [nextOffset, loading, error])

  const selectCategory = (next: PolymarketCategory) => {
    if (next === category) return
    setCategory(next)
    setOffset(0)
    setItems([])
    setNextOffset(null)
    setFetchedAt(null)
    setLoadedOnce(false)
    setLoading(true)
    setError(false)
  }

  return <>
    <div className={s.chips} role="group" aria-label={m.discovery}>
      {POLYMARKET_CATEGORIES.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={category === key} onClick={() => selectCategory(key)}>{labels.categories[key]}</button>)}
    </div>
    {!loadedOnce && loading ? <Skeleton rows={3} /> : null}
    {error && !items.length ? <StateBlock tone="error" title={m.loadError} retry={() => setRetry((value) => value + 1)} retryLabel={labels.retry} /> : null}
    {items.length > 0 && <div aria-live="off">{items.map((item) => {
      return <button type="button" key={item.id} className={`${s.predCard} ${s.predFeedCard}`} onClick={() => openPath(`/prediction/${encodeURIComponent(item.id)}`)}>
      <span className={s.productMeta}><span>{item.featured ? (content('2026 Midterms')) : category === 'all' ? 'Polymarket' : labels.categories[category]}</span>{item.endAt && <span>{fill(m.closes, { d: fmtDate(item.endAt, locale) })}</span>}</span>
      {item.image && <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" style={{width:44,height:44,borderRadius:10,objectFit:"cover",float:"right",marginLeft:12}} />}
      <b className={s.predQuestion}>{content(item.question)}</b>
      <span className={s.prob}>{item.outcomes.map((outcome, index) => <span key={outcome.label} className={s.probRow}>
        <span>{content(outcome.label)}</span>
        <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
        <span className={s.probBar}><i style={{ ['--p' as string]: outcome.impliedProbability }} /></span>
      </span>)}</span>
      <span className={s.foot} style={{ marginTop: 12 }}><span>{m.volume24h} <b className={s.num}>{item.volume24hUsd == null ? '—' : fmtUsd(String(item.volume24hUsd), { compact: true, locale })}</b></span></span>
    </button>})}</div>}
    {loadedOnce && !loading && !error && !items.length && nextOffset === null ? <StateBlock title={copy.common.empty} /> : null}
    <div ref={sentinel} className={s.predFeedSentinel} aria-hidden="true" />
    {loading && loadedOnce ? <div className={s.predFeedStatus} role="status">{labels.loading}…</div> : null}
    {error && items.length > 0 ? <div className={s.predFeedStatus}><button type="button" className={s.ghost} onClick={() => setRetry((value) => value + 1)}>{labels.retry}</button></div> : null}
    {nextOffset !== null && !loading && !error ? <div className={s.predFeedStatus}><button type="button" className={s.ghost} onClick={() => setOffset(nextOffset)}>{labels.more}</button></div> : null}
    {loadedOnce && nextOffset === null && items.length > 0 && !loading ? <p className={s.predFeedStatus}>{labels.end}</p> : null}
    {fetchedAt && <p className={s.foot}><span>{copy.common.source}: Polymarket</span><span>{fill(copy.common.updated, { t: fmtDateTime(fetchedAt, locale) })}</span></p>}
  </>
}
