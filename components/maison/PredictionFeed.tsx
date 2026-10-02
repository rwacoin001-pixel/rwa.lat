'use client'

import {Search, SlidersHorizontal, Check} from 'lucide-react'
import {predictionControlText} from '@/lib/prediction-controls-copy'
import { useEffect, useRef, useState } from 'react'
import { usePageState } from '@/lib/app-navigation'
import { mergeDisplayPage } from '@/lib/navigation-memory'
import { useI18n } from '@/lib/i18n'
import { getPolymarketFeed, POLYMARKET_CATEGORIES, POLYMARKET_SORTS, type PolymarketSort, type PolymarketCategory, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'
import {useContentTranslation} from '@/lib/use-content-translation'
import { fmtUsd } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { openPath } from '@/lib/maison-nav'
import { polymarketFeedCopy } from '@/lib/polymarket-feed-copy'
import { Figure } from './motion'
import { fmtDate, fmtDateTime } from './format'
import { Skeleton, StateBlock, maison as s } from './primitives'
import {PredictionTranslationButton} from './PredictionTranslationButton'
import {PredictionPulse} from './PredictionPulse'

export function PredictionFeed() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const m = copy.markets
  const labels = polymarketFeedCopy[locale]
  const [category, setCategory] = usePageState<PolymarketCategory>('prediction:category', 'all')
  const [sort,setSort]=usePageState<PolymarketSort>('prediction:sort','volume24hr')
  const [search,setSearch]=usePageState('prediction:search','')
  const [draftSearch,setDraftSearch]=useState(search)
  const [sortOpen,setSortOpen]=useState(false)
  const toolbar=useRef<HTMLDivElement>(null)
  const text=(key:Parameters<typeof predictionControlText>[1])=>predictionControlText(locale,key)
  const [offset, setOffset] = usePageState('prediction:offset', 0)
  const [items, setItems] = usePageState<PolymarketFeedMarket[]>('prediction:items', [])
  const [nextOffset, setNextOffset] = usePageState<number | null>('prediction:next', null)
  const [fetchedAt, setFetchedAt] = usePageState<string | null>('prediction:updated', null)
  const [loading, setLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = usePageState('prediction:loaded', false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const sources=items.flatMap(item=>[item.question,...item.outcomes.map(o=>o.label)])
  const translation=useContentTranslation(sources)
  const [original,setOriginal]=useState(false)
  const content=(text:string)=>original?text:translation(text)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    void getPolymarketFeed(category, offset, controller.signal,sort,search)
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
  }, [category, offset, retry,sort,search])

  useEffect(()=>{
    const controller=new AbortController()
    const timer=setInterval(()=>{
      if(document.visibilityState!=='visible')return
      void getPolymarketFeed(category,0,controller.signal,sort,search).then(page=>{
        if(controller.signal.aborted)return
        setItems(previous=>{
          const refreshed=new Map(page.items.map(item=>[item.id,item]))
          // Replace only the rolling Up/Down slot; retain pagination and card order.
          const rolling=page.items.find(item=>item.conditionId&&item.outcomes.every(o=>/^(up|down)$/i.test(o.label)))
          return previous.map(item=>refreshed.get(item.id)??(rolling&&item.conditionId&&item.outcomes.every(o=>/^(up|down)$/i.test(o.label))?rolling:item)).filter((item,index,list)=>list.findIndex(other=>other.id===item.id)===index)
        })
        setFetchedAt(page.fetchedAt)
      }).catch(()=>{})
    },30000)
    return()=>{controller.abort();clearInterval(timer)}
  },[category,sort,search])

  useEffect(() => {
    if (!nextOffset || loading || error || !sentinel.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setOffset(nextOffset)
    }, { rootMargin: '400px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [nextOffset, loading, error])

  useEffect(()=>{const timer=setTimeout(()=>{const value=draftSearch.trim();if(value!==search){setSearch(value);setOffset(0);setItems([]);setNextOffset(null);setLoadedOnce(false)}},350);return()=>clearTimeout(timer)},[draftSearch,search])
  useEffect(()=>{if(!sortOpen)return;const outside=(e:PointerEvent)=>{if(!toolbar.current?.contains(e.target as Node))setSortOpen(false)};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setSortOpen(false)};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[sortOpen])
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
    <div className={s.predSearchToolbar} ref={toolbar}>
      <label className={s.predSearch}><Search size={18}/><input type="search" aria-label={text('search')} placeholder={text('search')} maxLength={120} value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}/></label>
      <button type="button" className={s.predSortButton} aria-label={text('sort')} aria-expanded={sortOpen} aria-controls="prediction-sort" onClick={()=>setSortOpen(v=>!v)}><SlidersHorizontal size={20}/></button>
      {sortOpen&&<div className={s.predSortMenu} id="prediction-sort" role="group" aria-label={text('sort')}>{POLYMARKET_SORTS.map(key=><button key={key} type="button" aria-pressed={sort===key} onClick={()=>{setSort(key);setSortOpen(false);if(key!==sort){setOffset(0);setItems([]);setNextOffset(null);setLoadedOnce(false)}}}><span>{text(key)}</span>{sort===key&&<Check size={16}/>}</button>)}</div>}
    </div>
    <div className={s.chips} role="group" aria-label={m.discovery}>
      {POLYMARKET_CATEGORIES.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={category === key} onClick={() => selectCategory(key)}>{labels.categories[key]}</button>)}
    </div>
    {!loadedOnce && loading ? <Skeleton rows={3} /> : null}
    {error && !items.length ? <StateBlock tone="error" title={m.loadError} retry={() => setRetry((value) => value + 1)} retryLabel={labels.retry} /> : null}
    {items.length > 0 && <div aria-live="off">{items.map((item) => {
      const layout = item.featured
        ? 'featured'
        : item.outcomes.length === 2 && item.outcomes.every(o=>/^(up|down)$/i.test(o.label))
          ? 'pulse'
        : item.category === 'sports' && item.outcomes.length === 2
          ? 'matchup'
          : item.outcomes.length > 2
              ? 'multi'
              : 'binary'
      const shown = layout === 'multi' ? item.outcomes.slice(0, 4) : item.outcomes.slice(0, 2)
      const remaining = Math.max(0, (item.optionCount ?? item.outcomes.length) - shown.length)
      return <article key={item.id} className={s.predFeedArticle}><button type="button" data-layout={layout} className={`${s.predCard} ${s.predFeedCard}`} onClick={() => openPath(`/prediction/${encodeURIComponent(item.id)}`)}>
        {layout !== 'featured' && <span className={s.predCardHead}>
          <span className={s.predCardMeta}><span>{item.featured ? content('2026 Midterms') : category === 'all' ? 'Polymarket' : labels.categories[category]}</span>{item.endAt && <span>{fill(m.closes, { d: fmtDate(item.endAt, locale) })}</span>}</span>
          {item.image && <img className={s.predThumb} src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        </span>}
        <b className={s.predQuestion}>{content(item.question)}</b>
        {layout === 'featured' && item.image && <span className={s.predFeatureMedia}><img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>}
        {layout === 'multi' && <span className={s.predOptions}>{shown.map((outcome, index) => <span key={`${index}:${outcome.label}`} className={s.predOption}>
          <i data-index={index} />
          <span>{content(outcome.label)}</span>
          <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
          <span className={s.predMiniBar}><i data-index={index} style={{ width: `${Math.max(0, Math.min(1, outcome.impliedProbability)) * 100}%` }} /></span>
        </span>)}</span>}
        {layout === 'pulse' && <PredictionPulse item={item} content={content}/>}
        {(layout === 'binary' || layout === 'matchup') && <span className={s.predBinaryOutcomes}>{shown.map((outcome, index) => <span key={`${index}:${outcome.label}`} className={s.predBinaryOutcome} data-side={index}>
          <b><Figure value={outcome.impliedProbability} format={{ style: 'percent', maximumFractionDigits: 0 }} locale={locale} /></b>
          <span>{content(outcome.label)}</span>
          <i><span style={{ width: `${Math.max(0, Math.min(1, outcome.impliedProbability)) * 100}%` }} /></i>
        </span>)}</span>}
        {layout !== 'featured' && <span className={s.predCardFoot}><span>{m.volume24h} <b className={s.num}>{item.volume24hUsd == null ? '—' : fmtUsd(String(item.volume24hUsd), { compact: true, locale })}</b></span>{remaining > 0 && <span>+{remaining}</span>}</span>}
      </button><PredictionTranslationButton translation={translation} original={original} onOriginal={setOriginal} sources={[item.question,...item.outcomes.map(o=>o.label)]}/></article>
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
