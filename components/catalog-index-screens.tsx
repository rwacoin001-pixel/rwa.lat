'use client'

import { Building2, ChevronRight, Clock3, Layers3, Search, ShieldCheck, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import RwaTopbar from './rwa-topbar'
import type { RwaScreen } from '@/lib/rwa-routes'
import { request } from '@/lib/api/_http'
import type { RwaAssetRow } from '@/lib/rwa-data'
import { useI18n } from '@/lib/i18n'
import { EmptyState } from './ui/Empty'

type Issuer = { slug: string; name?: string; verified?: boolean; website?: string; websiteUrl?: string; description?: string }
type Basket = Record<string, unknown> & { id?: string; slug?: string; name?: string; displayName?: string; title?: string; summary?: string }
type Pair = Record<string, unknown> & { id?: string; symbol?: string; name?: string; baseSymbol?: string; quoteSymbol?: string; status?: string }
type SearchState = 'idle' | 'loading' | 'ready' | 'error'

const HISTORY_KEY = 'rwa.search.history'
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const asItems = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const source = asRecord(value)
  for (const key of ['items', 'data', 'portfolios', 'pairs']) if (Array.isArray(source[key])) return source[key] as T[]
  return []
}
const labelOf = (item: Basket) => String(item.name ?? item.displayName ?? item.title ?? item.slug ?? item.id ?? '')
const pairLabel = (item: Pair) => String(item.symbol ?? item.name ?? [item.baseSymbol, item.quoteSymbol].filter(Boolean).join('/') ?? '')
const message = (locale: string, en: string, zh: string) => locale === 'zh-CN' ? zh : en

export function IssuersIndexScreen({ go, openIssuer }: { go: (screen: RwaScreen) => void; openIssuer: (slug: string) => void }) {
  const { locale } = useI18n()
  const [items, setItems] = useState<Issuer[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { request<Issuer[] | { items: Issuer[] }>('/v1/rwa/issuers').then((result) => {
    if (!result.ok) { setState('error'); return }
    setItems(asItems<Issuer>(result.data)); setState('ready')
  }) }, [])
  return <section className="screen catalog-index-screen"><RwaTopbar screen="issuers" title={message(locale, 'Issuers', '发行方')} onBack={() => go('invest')} />
    <div className="catalog-index-hero"><img src="/media/generated/design-v2/treasury-architecture-v1.png" alt="" /><div><span>RWA / ISSUERS</span><h1>{message(locale, 'Institutions behind the assets', '资产背后的机构')}</h1><p>{message(locale, 'Review verified issuer information alongside the assets they manage.', '查看已核验的发行方信息及其管理的资产。')}</p></div></div>
    {state === 'loading' ? <div className="catalog-index-loading" /> : state === 'error' ? <EmptyState variant="card" icon={Building2} title={message(locale, 'Issuer directory unavailable', '发行方目录暂不可用')} body={message(locale, 'Issuer information could not be loaded right now.', '暂时无法读取发行方信息。')} /> : items.length ? <div className="catalog-index-list">{items.map((issuer) => <button type="button" key={issuer.slug} onClick={() => openIssuer(issuer.slug)}><span><Building2 size={19} /></span><p><b>{issuer.name || issuer.slug}</b><small>{issuer.description || issuer.websiteUrl || issuer.website || message(locale, 'Issuer profile', '发行方资料')}</small></p>{issuer.verified ? <ShieldCheck size={16} className="is-verified" /> : null}<ChevronRight size={17} /></button>)}</div> : <EmptyState variant="card" icon={Building2} title={message(locale, 'No issuers yet', '暂无可查看的发行方')} body={message(locale, 'Verified issuer information will appear here when it is published.', '发行方发布已核验资料后，会显示在这里。')} />}
  </section>
}

export function GlobalSearchScreen({ go, openAsset }: { go: (screen: RwaScreen) => void; openAsset: (asset: RwaAssetRow) => void }) {
  const { locale } = useI18n()
  const [query, setQuery] = useState('')
  const [assets, setAssets] = useState<RwaAssetRow[]>([])
  const [baskets, setBaskets] = useState<Basket[]>([])
  const [pairs, setPairs] = useState<Pair[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [state, setState] = useState<SearchState>('idle')
  const requestVersion = useRef(0)

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]').filter((value: unknown) => typeof value === 'string').slice(0, 10)) } catch { setHistory([]) }
    Promise.all([request<unknown>('/v1/basket/portfolios'), request<unknown>('/v1/market/pairs')]).then(([basketResult, pairResult]) => {
      if (basketResult.ok) setBaskets(asItems<Basket>(basketResult.data))
      if (pairResult.ok) setPairs(asItems<Pair>(pairResult.data))
    })
  }, [])

  useEffect(() => {
    const version = ++requestVersion.current
    const controller = new AbortController()
    const currentQuery = query.trim()
    const timer = window.setTimeout(async () => {
      setState(currentQuery ? 'loading' : 'idle')
      const path = currentQuery
        ? `/v1/rwa/assets?search=${encodeURIComponent(currentQuery)}&limit=20`
        : '/v1/rwa/assets?featured=true&limit=8'
      const result = await request<unknown>(path, { signal: controller.signal })
      if (controller.signal.aborted || version !== requestVersion.current) return
      if (!result.ok) { setAssets([]); setState('error'); return }
      setAssets(asItems<RwaAssetRow>(result.data)); setState(currentQuery ? 'ready' : 'idle')
    }, currentQuery ? 300 : 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [query])

  const needle = query.trim().toLocaleLowerCase(locale)
  const basketResults = useMemo(() => needle ? baskets.filter((item) => `${labelOf(item)} ${String(item.summary ?? '')}`.toLocaleLowerCase(locale).includes(needle)).slice(0, 8) : [], [baskets, locale, needle])
  const pairResults = useMemo(() => needle ? pairs.filter((item) => pairLabel(item).toLocaleLowerCase(locale).includes(needle)).slice(0, 8) : [], [pairs, locale, needle])
  const remember = (value: string) => {
    const next = [value, ...history.filter((item) => item !== value)].slice(0, 10)
    setHistory(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* storage can be unavailable */ }
  }
  const clearHistory = () => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY) } catch { /* storage can be unavailable */ } }
  const openResult = (destination: RwaScreen, value: string) => { remember(value); go(destination) }
  const total = assets.length + basketResults.length + pairResults.length

  return <section className="screen catalog-index-screen search-screen"><RwaTopbar screen="search" title={message(locale, 'Search', '全局搜索')} onBack={() => go('home')} action={history.length ? { label: message(locale, 'Clear history', '清除历史'), onClick: clearHistory, Icon: X } : undefined} />
    <label className="catalog-index-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={message(locale, 'Search assets, baskets and pairs', '搜索资产、篮子与交易对')} /><kbd>⌘K</kbd></label>
    {!needle && history.length > 0 && <section className="search-group"><div className="catalog-index-section-title"><span><Clock3 size={15} />{message(locale, 'Recent', '最近搜索')}</span><small>{history.length}</small></div><div className="search-history">{history.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}</div></section>}
    <SearchGroup title={needle ? message(locale, 'Assets', '资产') : message(locale, 'Featured assets', '精选资产')} count={assets.length} icon={<Building2 size={15} />}>
      {assets.map((asset) => <button type="button" key={asset.slug} onClick={() => { remember(asset.name); openAsset(asset) }}><span className="catalog-index-logo">{asset.logoUrl ? <img src={asset.logoUrl} alt="" /> : <Building2 size={19} />}</span><p><b>{asset.name}</b><small>{asset.symbol || asset.assetClass || 'RWA'}</small></p>{asset.isVerified ? <ShieldCheck size={15} className="is-verified" /> : null}<ChevronRight size={17} /></button>)}
    </SearchGroup>
    {needle && <SearchGroup title={message(locale, 'Baskets', '篮子')} count={basketResults.length} icon={<Layers3 size={15} />}>{basketResults.map((item, index) => { const label = labelOf(item); return <button type="button" key={String(item.id ?? item.slug ?? index)} onClick={() => openResult('invest', label)}><span><Layers3 size={19} /></span><p><b>{label}</b><small>{String(item.summary ?? message(locale, 'Portfolio basket', '组合篮子'))}</small></p><ChevronRight size={17} /></button> })}</SearchGroup>}
    {needle && <SearchGroup title={message(locale, 'Trading pairs', '交易对')} count={pairResults.length} icon={<TrendingUp size={15} />}>{pairResults.map((item, index) => { const label = pairLabel(item); return <button type="button" key={String(item.id ?? item.symbol ?? index)} onClick={() => { remember(label); go('trade'); window.history.replaceState(window.history.state, '', `/trade?symbol=${encodeURIComponent(label)}`) }}><span><TrendingUp size={19} /></span><p><b dir="ltr">{label}</b><small>{String(item.status ?? message(locale, 'Market pair', '市场交易对'))}</small></p><ChevronRight size={17} /></button> })}</SearchGroup>}
    {state === 'loading' && <div className="catalog-index-loading" />}
    {state === 'error' && <EmptyState variant="card" icon={Search} title={message(locale, 'Asset search unavailable', '资产搜索暂不可用')} body={message(locale, 'Basket and pair matches remain available.', '仍可查看篮子与交易对匹配。')} />}
    {needle && state !== 'loading' && state !== 'error' && total === 0 && <EmptyState variant="card" icon={Search} title={message(locale, 'No matching results', '没有匹配结果')} body={message(locale, 'Try a different asset, basket or trading pair.', '请换一个资产、篮子或交易对关键词。')} />}
  </section>
}

function SearchGroup({ title, count, icon, children }: { title: string; count: number; icon: ReactNode; children: ReactNode }) {
  if (!count) return null
  return <section className="search-group"><div className="catalog-index-section-title"><span>{icon}{title}</span><small>{count}</small></div><div className="catalog-index-list">{children}</div></section>
}
