'use client'
import {PredictionHowTo} from './PredictionHowTo'

import { ArrowUpRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { POLL, apiUrl } from '@/lib/api/_http'
import { isListed, listBaskets, listPairs, listProducts, listRwaAssets, type CatalogProduct, type RwaSort } from '@/lib/api/markets'
import { fmtUsd, fmtUsdt } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { proCopy } from '@/lib/maison-pro-copy'
import { openPath } from '@/lib/maison-nav'
import { DeltaPill, Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, PollBar, Segmented, StatStrip, TickerTape, useAutoAnimate } from './motion'
import { fmtDate, fmtDateTime } from './format'
import { HengxuPanel } from './HengxuScreen'
import { PredictionFeed } from './PredictionFeed'

const TABS = ['assets', 'baskets', 'trade', 'predictions'] as const
type Tab = typeof TABS[number]
const CLASSES = ['all', 'rwa', 'compute', 'stocks'] as const
type ClassFilter = typeof CLASSES[number]
const SORTS: RwaSort[] = ['market_cap', 'change_24h', 'name']

function tabFrom(query: string): Tab {
  const raw = new URLSearchParams(query).get('tab')
  // 衡序 lives inside Baskets; keep old ?tab=hengxu links working.
  const value = raw === 'hengxu' ? 'baskets' : raw
  return (TABS as readonly string[]).includes(value ?? '') ? value as Tab : 'assets'
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
  const [tab, setTab] = useState<Tab>(() => tabFrom(query))
  const [search, setSearch] = useState(() => new URLSearchParams(query).get('q') ?? '')
  const [klass, setKlass] = useState<ClassFilter>('all')
  const [sort, setSort] = useState<RwaSort>('market_cap')
  useEffect(() => { setTab(tabFrom(query)) }, [query])
  const term = useDebounced(search.trim().slice(0, 80))

  // Keep tab + search in the URL without adding history entries per keystroke.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (tab === 'assets') params.delete('tab'); else params.set('tab', tab)
    if (term) params.set('q', term); else params.delete('q')
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState({ rwaNavigation: Boolean(window.history.state?.rwaNavigation) }, '', next)
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

  return <MaisonPage page="markets" dock topbar={<RwaTopbar screen="invest" title={m.title} />}>
    <header className={s.hero}>
      <p className={s.kicker}><span className={s.liveDot} aria-hidden="true" />{m.kicker}</p>
      <h1 className={s.display}>{m.title}</h1>
      <p className={s.lede}>{products.data || directory.data ? fill(m.lede, { n: listed.length, m: directory.data?.total ?? '—' }) : ' '}</p>
      {(products.data || directory.data) && <StatStrip items={[
        { label: m.investable, value: products.data ? <Figure value={listed.length} locale={locale} flash={false} /> : '—' },
        { label: m.directory, value: directory.data ? <Figure value={directory.data.total} locale={locale} flash={false} /> : '—' },
        { label: pro.time, value: directory.data?.items[0]?.dataTimestamp ? fmtDateTime(directory.data.items[0].dataTimestamp, locale, { timeStyle: 'short' }) : '—' },
      ]} />}
    </header>

    <TickerTape items={tape} label={pro.tape} />

    <Segmented value={tab} onChange={setTab} label={m.title} sticky options={TABS.map((key) => ({ value: key, label: m.tabs[TABS.indexOf(key)] }))} />

    {tab === 'assets' && <div className={s.tabPanel} role="tabpanel">
      <label className={s.search}>
        <Search size={17} strokeWidth={1.7} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={m.search} aria-label={m.search} maxLength={80} enterKeyHint="search" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label={copy.common.clear}><X size={14} /></button>}
      </label>

      <SectionHead index="01" title={m.investable} note={m.investableNote} />
      <div className={s.chips} role="group" aria-label={m.investable}>
        {CLASSES.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={klass === key} onClick={() => setKlass(key)}>{m.classes[key]}{products.data && <small className={s.num}>{counts[key]}</small>}</button>)}
      </div>
      <div style={{ marginTop: 14 }}>
        {!products.data && !products.error ? <Skeleton rows={2} />
          : products.error && !products.data ? <StateBlock tone="error" title={m.loadError} body={products.error.message} retry={products.refetch} retryLabel={copy.common.retry} />
          : investable.length ? <ProductTable products={investable} featured={klass === 'all' && !term} />
          : <StateBlock title={term ? fill(m.noMatch, { q: term }) : copy.common.empty} />}
      </div>

      <SectionHead index="02" title={m.directory} note={m.directoryNote} action={<span style={{ display: 'flex', gap: 12 }}><button type="button" className={s.sectionMore} onClick={() => openPath('/issuers')}>{m.issuers}</button><button type="button" className={s.sectionMore} onClick={() => openPath('/compare')}>{m.compare}</button></span>} />
      <div className={s.chips} role="group" aria-label={m.directory}>
        {SORTS.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={sort === key} onClick={() => setSort(key)}>{m.sort[key as keyof typeof m.sort]}</button>)}
      </div>
      <div style={{ marginTop: 10 }}>
        {!directory.data && !directory.error ? <Skeleton />
          : directory.error && !directory.data ? <StateBlock tone="error" title={m.loadError} body={directory.error.message} retry={directory.refetch} retryLabel={copy.common.retry} />
          : directory.data?.items.length ? <>
            <div className={s.tableHead} aria-hidden="true"><span># · {pro.name}</span><span>{pro.mcap} · {pro.change}</span></div>
            <ul className={s.list} ref={directoryList}>{directory.data.items.map((asset) => <li key={asset.slug}>
              <button type="button" className={s.row} onClick={() => openPath(`/asset/${encodeURIComponent(asset.slug)}`)}>
                <span className={s.rowLead}><span className={`${s.rank} ${s.num}`}>{asset.rank ?? '—'}</span><Logo src={asset.logoUrl} name={asset.name} /></span>
                <span className={s.rowMain}><b>{asset.name}</b><small>{[asset.symbol && asset.symbol !== '-' ? asset.symbol : null, asset.issuer?.name].filter(Boolean).join(' · ')}</small></span>
                <span className={s.rowFig}><b className={s.num}>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small><DeltaPill value={asset.change24hPct} /></small></span>
              </button>
            </li>)}</ul>
            <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(directory.data.items[0]?.dataTimestamp, locale) })}</span></p>
          </>
          : <StateBlock title={term ? fill(m.noMatch, { q: term }) : copy.common.empty} />}
      </div>
    </div>}

    {tab === 'baskets' && <BasketsPanel />}
    {tab === 'trade' && <TradePanel />}
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
          <button type="button" className={s.row} onClick={() => openPath(`/asset/${encodeURIComponent(slug)}`)}>
            <Logo name={product.displayName} />
            <span className={s.rowMain}><b>{content(product.displayName)}</b><small>{[klass, product.network].filter(Boolean).join(' · ')}</small></span>
            <span className={s.rowFig}><b className={s.num}>{fmtUsdt(product.minOrderAtomicAmount)}</b><small className={s.up}>{copy.detail.investable}</small></span>
          </button>
        </li>
      })}</ul>
    </>}
  </>
}

/** Local project imagery for product cards, matched strictly by CatalogProduct.externalRef.
 *  Products without a mapping keep the plain card — no placeholder, no remote hosts. */
const PRODUCT_IMAGES: Record<string, string> = {
  'h100-inference-pool': '/media/generated/project-assets/h100-inference-ops-v1.png',
  'solar-income-2027': '/media/generated/project-assets/solar-income-ops-v1.png',
  'tech-growth-etf': '/media/generated/project-assets/tech-growth-etf-ops-v1.png',
}

function ProductCard({ product, tone }: { product: CatalogProduct; tone?: 'lacquer' }) {
  const content=useContentTranslation([product.displayName,product.summary??''])
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const slug = product.externalRef ?? product.id
  const klass = copy.markets.classes[product.assetClassId as keyof typeof copy.markets.classes] ?? product.assetClassId
  return <button type="button" className={s.product} data-tone={tone} onClick={() => openPath(`/asset/${encodeURIComponent(slug)}`)}>
    {(product.imageUrl || (product.externalRef && PRODUCT_IMAGES[product.externalRef])) && <span aria-hidden="true" style={{ position: 'relative', display: 'block', gridColumn: '1 / -1', aspectRatio: '16 / 7', borderRadius: 8, overflow: 'hidden' }}>
      <Image src={product.imageUrl ? apiUrl(product.imageUrl) : PRODUCT_IMAGES[product.externalRef!]} unoptimized={Boolean(product.imageUrl)} alt="" fill sizes="(max-width: 500px) 60vw, 280px" style={{ objectFit: 'cover' }} />
    </span>}
    <span className={s.productMeta}><span>{klass}</span>{product.network && <span>{product.network}</span>}</span>
    <span className={s.productName}>{content(product.displayName)}</span>
    <span className={s.productArrow} aria-hidden="true"><ArrowUpRight size={16} /></span>
    {product.summary && <span className={s.productSummary}>{content(product.summary)}</span>}
    <span className={s.productFoot}><span>{copy.detail.investable}</span><b className={s.num}>{fill(copy.markets.from, { v: fmtUsdt(product.minOrderAtomicAmount) })}</b></span>
  </button>
}

function BasketsPanel() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const pro = proCopy[locale]
  const baskets = useQuery('markets:baskets', listBaskets, { staleTime: 60_000, pollInterval: POLL.list })
  return <div className={s.tabPanel} role="tabpanel">
    <SectionHead index="01" title={copy.markets.tabs[1]} />
    {!baskets.data && !baskets.error ? <Skeleton rows={2} />
      : baskets.error && !baskets.data ? <StateBlock tone="error" title={copy.markets.loadError} body={baskets.error.message} retry={baskets.refetch} retryLabel={copy.common.retry} />
      : baskets.data?.length ? <><div className={s.tableHead} aria-hidden="true"><span>{pro.name}</span><span>{pro.nav} · AUM</span></div><ul className={s.list}>{baskets.data.map((basket) => <li key={basket.id}>
        <button type="button" className={s.row} onClick={() => openPath(`/basket/${encodeURIComponent(basket.id)}`)}>
          <Logo name={basket.name || basket.strategyName || 'B'} />
          <span className={s.rowMain}><b>{basket.name || basket.strategyName || basket.id}</b><small>{[basket.strategyName, basket.riskLevel].filter(Boolean).join(' · ')}</small></span>
          <span className={s.rowFig}><b className={s.num}>{fmtUsd(basket.navPerUnit, { digits: 4, locale })}</b><small className={s.muted}>{fmtUsd(basket.aumUsd, { compact: true, locale })}</small></span>
        </button>
      </li>)}</ul></>
      : <StateBlock title={copy.markets.basketsEmpty} body={copy.markets.basketsEmptyBody} />}

    <HengxuPanel />
  </div>
}

function TradePanel() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const pro = proCopy[locale]
  const pairs = useQuery('markets:pairs', listPairs, { staleTime: 30_000, pollInterval: POLL.market })
  const [beat, setBeat] = useState(0)
  useEffect(() => { if (pairs.data) setBeat((value) => value + 1) }, [pairs.data])
  const [pairList] = useAutoAnimate<HTMLUListElement>({ duration: 240 })
  return <div className={s.tabPanel} role="tabpanel">
    <SectionHead index="01" title={copy.markets.tabs[2]} note={fill(pro.refresh, { s: POLL.market / 1000 })} />
    {pairs.data && <PollBar every={POLL.market} stamp={beat} label={fill(pro.refresh, { s: POLL.market / 1000 })} />}
    {!pairs.data && !pairs.error ? <Skeleton />
      : pairs.error && !pairs.data ? <StateBlock tone="error" title={copy.markets.loadError} body={pairs.error.message} retry={pairs.refetch} retryLabel={copy.common.retry} />
      : pairs.data?.length ? <><div className={s.tableHead} aria-hidden="true"><span>{pro.name}</span><span>{pro.last}</span></div><ul className={s.list} ref={pairList}>{pairs.data.map((pair) => {
        const base = pair.symbol.replace(new RegExp(`-${pair.quoteAssetCode}$`), '')
        return <li key={pair.id}>
          <button type="button" className={s.row} onClick={() => openPath(`/trade/${encodeURIComponent(pair.symbol)}`)}>
            <Logo name={base} />
            <span className={s.rowMain}><b className={s.num}>{base} / {pair.quoteAssetCode}</b><small>{pair.state === 'active' ? copy.markets.active : copy.markets.paused}{pair.updatedAt ? ` · ${fmtDateTime(pair.updatedAt, locale, { timeStyle: 'short' })}` : ''}</small></span>
            <span className={s.rowFig}><b><Figure value={pair.lastPrice} locale="en-US" format={{ maximumFractionDigits: 6 }} /></b><small className={s.muted}>{pair.quoteAssetCode}</small></span>
          </button>
        </li>
      })}</ul></>
      : <StateBlock title={copy.markets.pairsEmpty} />}
  </div>
}

function PredictionsPanel({ listed, loading }: { listed: CatalogProduct[]; loading: boolean }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const m = copy.markets
  const orderable = listed.filter((product) => product.assetClassId === 'prediction')
  return <div className={s.tabPanel} role="tabpanel">
    {(loading || orderable.length > 0) && <>
      <SectionHead index="01" title={m.predictionOpen} />
      {loading ? <Skeleton rows={1} /> : <div className={s.productGrid}>{orderable.map((product) => <ProductCard key={product.id} product={product} tone="lacquer" />)}</div>}
    </>}
    <SectionHead index={loading || orderable.length ? '02' : '01'} title={m.discovery} note={m.discoveryNote} action={<PredictionHowTo/>} />
    <PredictionFeed />
  </div>
}
