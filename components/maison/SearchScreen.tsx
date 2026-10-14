'use client'
import { usePageState } from '@/lib/app-navigation'

import { ArrowUpRight, Clock3, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { isListed, listBaskets, listPairs, listProducts, listRwaAssets } from '@/lib/api/markets'
import { fmtUsd, fmtUsdt } from '@/lib/money'
import { directoryCopy } from '@/lib/maison-directory-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { Delta, Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'

const HISTORY_KEY = 'rwa.search.history'

function readHistory(): string[] {
  try { return (JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as unknown[]).filter((value): value is string => typeof value === 'string').slice(0, 8) } catch { return [] }
}

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}

/** `/search?q=` — investable products, directory assets, trading pairs and baskets in one place. */
export function SearchScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = directoryCopy[locale].search
  const [input, setInput] = usePageState('search:input', () => queryParam(query, 'q') ?? '')
  const [history, setHistory] = useState<string[]>([])
  useEffect(() => { setHistory(readHistory()) }, [])
  const term = useDebounced(input.trim().slice(0, 80))
  const needle = term.toLocaleLowerCase(locale)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (term) params.set('q', term); else params.delete('q')
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState({ ...window.history.state, rwaNavigation: Boolean(window.history.state?.rwaNavigation) }, '', next)
  }, [term])

  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000 })
  const pairs = useQuery('markets:pairs', listPairs, { staleTime: 30_000 })
  const baskets = useQuery('markets:baskets', listBaskets, { staleTime: 60_000 })
  const directory = useQuery(`search:rwa:${needle}`, () => listRwaAssets({ search: term || undefined, sort: 'market_cap', limit: term ? 20 : 8 }), { staleTime: 60_000 })

  const investable = useMemo(() => needle ? (products.data ?? []).filter(isListed).filter((product) => `${product.displayName} ${product.externalRef} ${product.summary ?? ''}`.toLocaleLowerCase(locale).includes(needle)).slice(0, 6) : [], [products.data, needle, locale])
  const pairHits = useMemo(() => needle ? (pairs.data ?? []).filter((pair) => pair.symbol.toLocaleLowerCase(locale).includes(needle)).slice(0, 6) : [], [pairs.data, needle, locale])
  const basketHits = useMemo(() => needle ? (baskets.data ?? []).filter((basket) => `${basket.strategyName ?? ''} ${basket.name ?? ''}`.toLocaleLowerCase(locale).includes(needle)).slice(0, 6) : [], [baskets.data, needle, locale])
  const assets = directory.data?.items ?? []
  const settled = Boolean(directory.data || directory.error) && Boolean(products.data || products.error)
  const nothing = needle && settled && !investable.length && !assets.length && !pairHits.length && !basketHits.length

  const go = (path: string) => {
    if (term) {
      const next = [term, ...history.filter((item) => item !== term)].slice(0, 8)
      setHistory(next)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* storage can be unavailable */ }
    }
    openPath(path)
  }
  const clearHistory = () => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY) } catch { /* storage can be unavailable */ } }

  return <MaisonPage page="search" topbar={<RwaTopbar screen="search" title={t.title} onBack={() => backOr('/home')} />}>
    <div className={s.hero} style={{ paddingBottom: 0 }}>
      <label className={s.search}>
        <Search size={17} strokeWidth={1.7} aria-hidden="true" />
        <input type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} maxLength={80} enterKeyHint="search" autoFocus />
        {input && <button type="button" onClick={() => setInput('')} aria-label={copy.common.clear}><X size={14} /></button>}
      </label>
      {!needle && <p className={s.foot} style={{ marginTop: 10 }}><span>{t.hint}</span></p>}
    </div>

    {!needle && history.length > 0 && <>
      <SectionHead title={t.recent} action={<button type="button" className={s.sectionMore} onClick={clearHistory}>{t.clear}</button>} />
      <div className={s.chips}>{history.map((item) => <button key={item} type="button" className={s.chip} onClick={() => setInput(item)}><Clock3 size={12} /><bdi>{item}</bdi></button>)}</div>
    </>}

    {investable.length > 0 && <Group title={t.investable} count={investable.length}>
      {investable.map((product) => <li key={product.id}>
        <button type="button" className={s.row} onClick={() => go(`/asset/${encodeURIComponent(product.externalRef ?? product.id)}`)}>
          <Logo name={product.displayName} />
          <span className={s.rowMain}><b>{product.displayName}</b><small>{copy.markets.classes[product.assetClassId as keyof typeof copy.markets.classes] ?? product.assetClassId}</small></span>
          <span className={s.rowFig}><small className={s.muted}>{fill(copy.markets.from, { v: fmtUsdt(product.minOrderAtomicAmount) })}</small><ArrowUpRight size={15} className={s.muted} /></span>
        </button>
      </li>)}
    </Group>}

    <SectionHead title={needle ? t.directory : t.top} note={copy.markets.directoryNote} />
    {!directory.data && !directory.error ? <Skeleton rows={3} />
      : directory.error && !directory.data ? <StateBlock tone="error" title={t.assetError} body={directory.error.message} retry={directory.refetch} retryLabel={copy.common.retry} />
      : assets.length ? <ul className={s.list}>{assets.map((asset) => <li key={asset.slug}>
        <button type="button" className={s.row} onClick={() => go(`/asset/${encodeURIComponent(asset.slug)}`)}>
          <Logo src={asset.logoUrl} name={asset.name} />
          <span className={s.rowMain}><b>{asset.name}</b><small>{[asset.symbol && asset.symbol !== '-' ? asset.symbol : null, asset.issuer?.name].filter(Boolean).join(' · ')}</small></span>
          <span className={s.rowFig}><b className={s.num}>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small><Delta value={asset.change24hPct} /></small></span>
        </button>
      </li>)}</ul>
      : !nothing && <StateBlock title={needle ? fill(copy.markets.noMatch, { q: term }) : copy.common.empty} />}

    {pairHits.length > 0 && <Group title={t.pairs} count={pairHits.length}>
      {pairHits.map((pair) => {
        const base = pair.symbol.replace(new RegExp(`-${pair.quoteAssetCode}$`), '')
        return <li key={pair.id}>
          <button type="button" className={s.row} onClick={() => go(`/trade/${encodeURIComponent(pair.symbol)}`)}>
            <Logo name={base} />
            <span className={s.rowMain}><b className={s.num}>{base} / {pair.quoteAssetCode}</b><small>{pair.state === 'active' ? copy.markets.active : copy.markets.paused}</small></span>
            <span className={s.rowFig}><b className={s.num}>{pair.lastPrice == null ? '—' : pair.lastPrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}</b></span>
          </button>
        </li>
      })}
    </Group>}

    {basketHits.length > 0 && <Group title={t.baskets} count={basketHits.length}>
      {basketHits.map((basket) => <li key={basket.id}>
        <button type="button" className={s.row} onClick={() => go(`/basket/${encodeURIComponent(basket.id)}`)}>
          <Logo name={basket.name || basket.strategyName || 'B'} />
          <span className={s.rowMain}><b>{basket.name || basket.strategyName || basket.id}</b><small>{[basket.strategyName, basket.status].filter(Boolean).join(' · ')}</small></span>
          <span className={s.rowFig}><ArrowUpRight size={15} className={s.muted} /></span>
        </button>
      </li>)}
    </Group>}

    {nothing && <div style={{ marginTop: 18 }}><StateBlock title={fill(copy.markets.noMatch, { q: term })} /></div>}
  </MaisonPage>
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <>
    <SectionHead title={title} action={<small className={`${s.muted} ${s.num}`}>{count}</small>} />
    <ul className={s.list}>{children}</ul>
  </>
}
