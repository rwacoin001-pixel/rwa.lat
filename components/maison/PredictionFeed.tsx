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
      const layout = item.featured
        ? 'featured'
        : item.category === 'sports' && item.outcomes.length === 2
          ? 'matchup'
          : item.category === 'crypto' && item.outcomes.length === 2
            ? 'pulse'
            : item.outcomes.length > 2
              ? 'multi'
              : 'binary'
      const shown = layout === 'multi' ? item.outcomes.slice(0, 4) : item.outcomes.slice(0, 2)
      const remaining = Math.max(0, (item.optionCount ?? item.outcomes.length) - shown.length)
      return <button type="button" key={item.id} data-layout={layout} className={`${s.predCard} ${s.predFeedCard}`} onClick={() => openPath(`/prediction/${encodeURIComponent(item.id)}`)}>
        {layout === 'featured' && item.image && <span className={s.predFeatureMedia}><img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>}
        <span className={s.predCardHead}>
          <span className={s.predCardMeta}><span>{item.featured ? content('2026 Midterms') : category === 'all' ? 'Polymarket' : labels.categories[category]}</span>{item.endAt && <span>{fill(m.closes, { d: fmtDate(item.endAt, locale) })}</span>}</span>
          {layout !== 'featured' && item.image && <img className={s.predThumb} src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        </span>
        <b className={s.predQuestion}>{content(item.question)}</b>
        {layout === 'featured' && <span className={s.predFeatureOutcomes}>{shown.map((outcome, index) => <span key={outcome.label} className={s.predFeatureOutcome}>
          <span className={s.predFeatureLabel}><i data-index={index} />{content(outcome.label)}</span>
          <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
          <span className={s.predMiniBar}><i data-index={index} style={{ width: `${Math.max(0, Math.min(1, outcome.impliedProbability)) * 100}%` }} /></span>
        </span>)}</span>}
        {layout === 'multi' && <span className={s.predOptions}>{shown.map((outcome, index) => <span key={outcome.label} className={s.predOption}>
          <i data-index={index} />
          <span>{content(outcome.label)}</span>
          <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
          <span className={s.predMiniBar}><i data-index={index} style={{ width: `${Math.max(0, Math.min(1, outcome.impliedProbability)) * 100}%` }} /></span>
        </span>)}</span>}
        {(layout === 'binary' || layout === 'matchup' || layout === 'pulse') && <span className={s.predBinaryOutcomes}>{shown.map((outcome, index) => <span key={outcome.label} className={s.predBinaryOutcome} data-side={index}>
          {layout === 'pulse' && <small>{content(outcome.label)}</small>}
          <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
          {layout !== 'pulse' && <span>{content(outcome.label)}</span>}
          <i><span style={{ width: `${Math.max(0, Math.min(1, outcome.impliedProbability)) * 100}%` }} /></i>
        </span>)}</span>}
        <span className={s.predCardFoot}><span>{m.volume24h} <b className={s.num}>{item.volume24hUsd == null ? '—' : fmtUsd(String(item.volume24hUsd), { compact: true, locale })}</b></span>{remaining > 0 && <span>+{remaining}</span>}</span>
      </button>
    })}</div>}
    {loadedOnce && !loading && !error && !items.length && nextOffset === null ? <StateBlock title={copy.common.empty} /> : null}
    <div ref={sentinel} className={s.predFeedSentinel} aria-hidden="true" />
    {loading && loadedOnce ? <div className={s.predFeedStatus} role="status">{labels.loading}…</div> : null}
    {error && items.length > 0 ? <div className={s.predFeedStatus}><button type="button" className={s.ghost} onClick={() => setRetry((value) => value + 1)}>{labels.retry}</button></div> : null}
    {nextOffset !== null && !loading && !error ? <div className={s.predFeedStatus}><button type="button" className={s.ghost} onClick={() => setOffset(nextOffset)}>{labels.more}</button></div> : null}
    {loadedOnce && nextOffset === null && items.length > 0 && !loading ? <p className={s.predFeedStatus}>{labels.end}</p> : null}
    {fetchedAt && <p className={s.foot}><span>{copy.common.source}: Polymarket</span><span>{fill(copy.common.updated, { t: fmtDateTime(fetchedAt, locale) })}</span></p>}
  </>
}
