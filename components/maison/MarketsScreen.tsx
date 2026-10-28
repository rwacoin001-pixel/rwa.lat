'use client'

import { ArrowUpRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {useContentTranslation} from '@/lib/use-content-translation'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { POLL } from '@/lib/api/_http'
import { isListed, listProducts, listRwaAssets, type CatalogProduct, type RwaSort } from '@/lib/api/markets'
import { fmtUsd, fmtUsdt } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { proCopy } from '@/lib/maison-pro-copy'
import { openPath } from '@/lib/maison-nav'
import { usePageState } from '@/lib/app-navigation'
import { DeltaPill, Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Segmented, TickerTape, useAutoAnimate } from './motion'
import { TopTabs } from './TopTabs'
import { fmtDate, fmtDateTime } from './format'
import { BasketShelf } from './HengxuScreen'
import { sharedOpen } from '@/lib/market-shared-transition'
import { productCover, sharedKeys } from '@/lib/product-media'
import { MarketHero } from './MarketHero'
import { PredictionFeed } from './PredictionFeed'
import { QuantMarketCard } from './QuantOverview'

// Koala Quant leads (2026-10-28): it replaced the Trade tab, whose pairs had no liquidity; /trade/:symbol still opens.
const TABS = ['quant', 'predictions', 'baskets', 'assets'] as const
type Tab = typeof TABS[number]
const TAB_LABEL_INDEX: Record<Tab, number> = { assets: 0, baskets: 1, predictions: 3, quant: 4 }
const CLASSES = ['all', 'rwa', 'compute', 'stocks'] as const
type ClassFilter = typeof CLASSES[number]
const SORTS: RwaSort[] = ['market_cap', 'change_24h', 'name']

function tabFrom(query: string): Tab {
  const raw = new URLSearchParams(query).get('tab')
  // 衡序 lives inside Baskets; keep old ?tab=hengxu links working.
  const value = raw === 'hengxu' ? 'baskets' : raw === 'trade' ? 'quant' : raw
  return (TABS as readonly string[]).includes(value ?? '') ? value as Tab : 'quant'
}

function useDebounced(value: string, delay = 320) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}

export function MarketsScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const m = copy.markets
  const [tab, setTab] = usePageState<Tab>('markets:tab', () => tabFrom(query))
  const [search, setSearch] = usePageState('markets:search', () => new URLSearchParams(query).get('q') ?? '')
  const [klass, setKlass] = usePageState<ClassFilter>('markets:class', 'all')
  const [sort, setSort] = usePageState<RwaSort>('markets:sort', 'market_cap')
  useEffect(() => { setTab(tabFrom(query)) }, [query])
  const term = useDebounced(search.trim().slice(0, 80))

  // Keep tab + search in the URL without adding history entries per keystroke.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    if (term) params.set('q', term); else params.delete('q')
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState({ ...window.history.state, rwaNavigation: Boolean(window.history.state?.rwaNavigation) }, '', next)
  }, [tab, term])

  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000, pollInterval: POLL.list })
  const directory = useQuery(`markets:rwa:${sort}:${term}`, () => listRwaAssets({ sort, search: term || undefined, limit: 40 }), { staleTime: 60_000, pollInterval: POLL.list })
  const content=useContentTranslation((products.data??[]).flatMap(p=>[p.displayName,p.summary??'']))
  const listed = useMemo(() => (products.data ?? []).filter(isListed), [products.data])
  const investable = useMemo(() => {
    const needle = term.toLowerCase()
    return listed.filter((product) => product.assetClassId !== 'prediction'
      && (klass === 'all' || product.assetClassId === klass)
      && (!needle || `${product.displayName} ${product.externalRef} ${product.summary ?? ''}`.toLowerCase().includes(needle)))
  }, [listed, klass, term])
  const pro = proCopy[locale]
  const [directoryList] = useAutoAnimate<HTMLUListElement>({ duration: 260 })
  const tape = useMemo(() => (directory.data?.items ?? []).slice(0, 12).map((asset) => ({
    key: asset.slug,
    name: asset.symbol && asset.symbol !== '-' ? asset.symbol : asset.name,
    value: fmtUsd(asset.marketCapUsd, { compact: true, locale }),
    delta: <DeltaPill value={asset.change24hPct} />,
    onClick: () => openPath(`/asset/${encodeURIComponent(asset.slug)}`),
  })), [directory.data, locale])
  const counts = useMemo(() => Object.fromEntries(CLASSES.map((key) => [key, listed.filter((product) => product.assetClassId !== 'prediction' && (key === 'all' || product.assetClassId === key)).length])), [listed])

  return <MaisonPage page="markets" dock>
    {/* First-level page: the page opens on its own text menu, pinned under the status bar (docs/design-system.md §7.1). */}
    <TopTabs value={tab} onChange={setTab} label={m.title} options={TABS.map((key) => ({ value: key, label: m.tabs[TAB_LABEL_INDEX[key]] }))} />

    {tab === 'quant' ? <QuantMarketCard /> : <>
      <MarketHero tab={tab} />
      <TickerTape items={tape} label={pro.tape} />
    </>}

    {tab === 'assets' && <div className={s.tabPanel} role="tabpanel">
      <label className={s.search}>
        <Search size={17} strokeWidth={1.7} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={m.search} aria-label={m.search} maxLength={80} enterKeyHint="search" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label={copy.common.clear}><X size={14} /></button>}
      </label>

      <SectionHead title={m.investable} note={m.investableNote} />
      <div className={s.chips} role="group" aria-label={m.investable}>
        {CLASSES.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={klass === key} onClick={() => setKlass(key)}>{m.classes[key]}{products.data && <small className={s.num}>{counts[key]}</small>}</button>)}
      </div>
      <div style={{ marginTop: 16 }}>
        {!products.data && !products.error ? <Skeleton rows={2} />
          : products.error && !products.data ? <StateBlock tone="error" title={m.loadError} body={products.error.message} retry={products.refetch} retryLabel={copy.common.retry} />
          : investable.length ? <ProductTable products={investable} featured={klass === 'all' && !term} />
          : <StateBlock title={term ? fill(m.noMatch, { q: term }) : copy.common.empty} />}
      </div>

      <SectionHead title={m.directory} note={m.directoryNote} action={<span style={{ display: 'flex', gap: 12 }}><button type="button" className={s.sectionMore} onClick={() => openPath('/issuers')}>{m.issuers}</button><button type="button" className={s.sectionMore} onClick={() => openPath('/compare')}>{m.compare}</button></span>} />
      <div className={s.chips} role="group" aria-label={m.directory}>
        {SORTS.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={sort === key} onClick={() => setSort(key)}>{m.sort[key as keyof typeof m.sort]}</button>)}
      </div>
      <div style={{ marginTop: 12 }}>
        {!directory.data && !directory.error ? <Skeleton />
          : directory.error && !directory.data ? <StateBlock tone="error" title={m.loadError} body={directory.error.message} retry={directory.refetch} retryLabel={copy.common.retry} />
          : directory.data?.items.length ? <>
            <div className={s.tableHead} aria-hidden="true"><span># · {pro.name}</span><span>{pro.mcap} · {pro.change}</span></div>
            <ul className={s.list} ref={directoryList}>{directory.data.items.map((asset) => <li key={asset.slug}>
              <button type="button" className={s.row} onClick={(event) => sharedOpen(event.currentTarget, () => openPath(`/asset/${encodeURIComponent(asset.slug)}`))}>
                <span className={s.rowLead}><span className={`${s.rank} ${s.num}`}>{asset.rank ?? '—'}</span><Logo src={asset.logoUrl} name={asset.name} /></span>
                <span className={s.rowMain}><b data-shared={sharedKeys.asset(asset.slug, 'title')}>{asset.name}</b><small>{[asset.symbol && asset.symbol !== '-' ? asset.symbol : null, asset.issuer?.name].filter(Boolean).join(' · ')}</small></span>
                <span className={s.rowFig}><b className={s.num}>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small><DeltaPill value={asset.change24hPct} /></small></span>
              </button>
            </li>)}</ul>
            <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(directory.data.items[0]?.dataTimestamp, locale) })}</span></p>
          </>
          : <StateBlock title={term ? fill(m.noMatch, { q: term }) : copy.common.empty} />}
      </div>
    </div>}

    {tab === 'baskets' && <BasketShelf />}
    {tab === 'predictions' && <PredictionsPanel listed={listed} loading={!products.data && !products.error} />}
  </MaisonPage>
}

/** Up to four featured products in an irregular 2×2 (wide/narrow, then narrow/wide), then a dense table:
 *  exchanges list instruments, they don't tile them. */
function ProductTable({ products, featured }: { products: CatalogProduct[]; featured: boolean }) {
  const { locale } = useI18n()
  const content=useContentTranslation(products.flatMap(p=>[p.displayName,p.summary??'']))
  const copy = marketCopy[locale]
  const pro = proCopy[locale]
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 240 })
  const leads = featured ? products.slice(0, 4) : []
  const rest = products.slice(leads.length)
  return <>
    {leads.length === 1 && <ProductCard product={leads[0]} tone="lacquer" />}
    {leads.length > 1 && <div className={s.featureGrid} data-count={leads.length}>
      {leads.map((product, index) => <ProductCard key={product.id} product={product} tone={index === 0 ? 'lacquer' : undefined} />)}
    </div>}
    {rest.length > 0 && <>
      <div className={s.tableHead} style={{ marginTop: leads.length ? 12 : 0 }} aria-hidden="true"><span>{pro.name}</span><span>{copy.detail.min}</span></div>
      <ul className={s.list} ref={list}>{rest.map((product) => {
        const slug = product.externalRef ?? product.id
        const klass = copy.markets.classes[product.assetClassId as keyof typeof copy.markets.classes] ?? product.assetClassId
        return <li key={product.id}>
          <button type="button" className={s.row} onClick={(event) => sharedOpen(event.currentTarget, () => openPath(`/asset/${encodeURIComponent(slug)}`))}>
            <Logo src={productCover(product)?.src} name={product.displayName} shared={sharedKeys.asset(slug, 'image')} />
            <span className={s.rowMain}><b data-shared={sharedKeys.asset(slug, 'title')}>{content(product.displayName)}</b><small>{[klass, product.network].filter(Boolean).join(' · ')}</small></span>
            <span className={s.rowFig}><b className={s.num}>{fmtUsdt(product.minOrderAtomicAmount)}</b><small className={s.up}>{copy.detail.investable}</small></span>
          </button>
        </li>
      })}</ul>
    </>}
  </>
}

function ProductCard({ product, tone }: { product: CatalogProduct; tone?: 'lacquer' }) {
  const content=useContentTranslation([product.displayName,product.summary??''])
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const slug = product.externalRef ?? product.id
  const klass = copy.markets.classes[product.assetClassId as keyof typeof copy.markets.classes] ?? product.assetClassId
  // One picture source with the detail hero (lib/product-media); tapping flies this picture up into it.
  const cover = productCover(product)
  return <button type="button" className={s.product} data-tone={tone} onClick={(event) => sharedOpen(event.currentTarget, () => openPath(`/asset/${encodeURIComponent(slug)}`))}>
    {cover && <span aria-hidden="true" data-shared={sharedKeys.asset(slug, 'image')} style={{ position: 'relative', display: 'block', gridColumn: '1 / -1', aspectRatio: '16 / 7', borderRadius: 8, overflow: 'hidden' }}>
      <Image src={cover.src} unoptimized={cover.remote} alt="" fill sizes="(max-width: 500px) 60vw, 280px" style={{ objectFit: 'cover' }} />
    </span>}
    <span className={s.productMeta}><span>{klass}</span>{product.network && <span>{product.network}</span>}</span>
    <span className={s.productName} data-shared={sharedKeys.asset(slug, 'title')}>{content(product.displayName)}</span>
    <span className={s.productArrow} aria-hidden="true"><ArrowUpRight size={16} /></span>
    {product.summary && <span className={s.productSummary}>{content(product.summary)}</span>}
    <span className={s.productFoot}><span>{copy.detail.investable}</span><b className={s.num}>{fill(copy.markets.from, { v: fmtUsdt(product.minOrderAtomicAmount) })}</b></span>
  </button>
}

function PredictionsPanel({ listed, loading }: { listed: CatalogProduct[]; loading: boolean }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const m = copy.markets
  const orderable = listed.filter((product) => product.assetClassId === 'prediction')
  return <div className={s.tabPanel} role="tabpanel">
    {/* Shown only once there is something in it: a placeholder that later vanished made the feed below jump. */}
    {!loading && orderable.length > 0 && <>
      <SectionHead title={m.predictionOpen} />
      <div className={s.productGrid}>{orderable.map((product) => <ProductCard key={product.id} product={product} tone="lacquer" />)}</div>
    </>}
    <PredictionFeed />
  </div>
}
