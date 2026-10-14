'use client'

import { Info, Plus, Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { assetClassLabel } from '@/lib/asset-labels'
import { useQuery } from '@/lib/api/_query'
import { getRwaDetail, listRwaAssets, type RwaDetail } from '@/lib/api/markets'
import { fmtUsd } from '@/lib/money'
import { directoryCopy } from '@/lib/maison-directory-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { Delta, Logo, MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { fmtDateTime } from './format'

const MAX = 3

function slugsFrom(query: string) {
  const raw = queryParam(query, 'slugs') ?? ''
  return [...new Set(raw.split(',').map((slug) => slug.trim()).filter((slug) => /^[a-z0-9][a-z0-9-]{0,80}$/i.test(slug)))].slice(0, MAX)
}

function useDebounced(value: string, delay = 320) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}

/** `/compare?slugs=a,b,c` — up to three directory assets side by side; the URL is the only state. */
export function CompareScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const d = copy.detail
  const t = directoryCopy[locale].compare
  const slugs = slugsFrom(query)
  // Fixed hook count: one query per slot, idle when the slot is empty.
  const slots = [0, 1, 2].map((index) => slugs[index] ?? null)
  const a = useQuery(slots[0] ? `rwa:detail:${slots[0]}` : null, () => getRwaDetail(slots[0]!), { staleTime: 60_000 })
  const b = useQuery(slots[1] ? `rwa:detail:${slots[1]}` : null, () => getRwaDetail(slots[1]!), { staleTime: 60_000 })
  const c = useQuery(slots[2] ? `rwa:detail:${slots[2]}` : null, () => getRwaDetail(slots[2]!), { staleTime: 60_000 })
  const columns = [a, b, c].slice(0, slugs.length).map((result, index) => ({ slug: slugs[index], result }))
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const term = useDebounced(search.trim().slice(0, 80))
  const candidates = useQuery(adding ? `compare:search:${term}` : null, () => listRwaAssets({ search: term || undefined, sort: 'market_cap', limit: 8 }), { staleTime: 60_000 })

  const write = (next: string[]) => openPath(next.length ? `/compare?slugs=${next.map(encodeURIComponent).join(',')}` : '/compare', { replace: true })
  const add = (slug: string) => { write([...slugs, slug].slice(0, MAX)); setAdding(false); setSearch('') }
  const remove = (slug: string) => write(slugs.filter((item) => item !== slug))

  const rows: Array<{ label: string; cell: (asset: RwaDetail) => ReactNode }> = [
    { label: d.marketCap, cell: (asset) => <span className={s.num}>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</span> },
    { label: d.change24h, cell: (asset) => <Delta value={asset.change24hPct} /> },
    { label: d.change7d, cell: (asset) => <Delta value={asset.change7dPct} /> },
    { label: d.change30d, cell: (asset) => <Delta value={asset.change30dPct} /> },
    { label: d.volume, cell: (asset) => <span className={s.num}>{fmtUsd(asset.volume24hUsd, { compact: true, locale })}</span> },
    { label: d.score, cell: (asset) => <span className={s.num}>{asset.score && typeof asset.score === 'object' ? asset.score.overallScore ?? '—' : '—'}</span> },
    { label: d.risk, cell: (asset) => asset.riskLevel ?? '—' },
    { label: t.cls, cell: (asset) => assetClassLabel(asset.assetClass, locale) ?? '—' },
    { label: t.issuer, cell: (asset) => asset.issuer ? <button type="button" className={s.link} onClick={() => openPath(`/issuers/${encodeURIComponent(asset.issuer.slug)}`)}>{asset.issuer.name}</button> : '—' },
    { label: d.region, cell: (asset) => asset.region ?? '—' },
  ]
  const loaded = columns.map((column) => column.result.data).filter((asset): asset is RwaDetail => Boolean(asset))

  return <MaisonPage page="compare" dock topbar={<RwaTopbar screen="rwa-detail" title={t.title} onBack={() => backOr('/markets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    {slugs.length ? <div className={s.compare} style={{ ['--m-cols' as string]: slugs.length }}>
      <div className={s.compareHead}>
        {columns.map(({ slug, result }) => <div key={slug} className={s.compareCol}>
          <button type="button" className={s.compareRemove} onClick={() => remove(slug)} aria-label={fill(t.remove, { v: result.data?.name ?? slug })}><X size={13} /></button>
          {result.data ? <button type="button" className={s.compareName} onClick={() => openPath(`/asset/${encodeURIComponent(slug)}`)}>
            <Logo src={result.data.logoUrl} name={result.data.name} />
            <b>{result.data.name}</b>
            <small className={s.num}>{result.data.symbol && result.data.symbol !== '-' ? result.data.symbol : ' '}</small>
          </button>
            : result.error ? <span className={s.compareName}><b>{result.error.status === 404 ? t.missing : copy.common.errorGeneric}</b><small><bdi>{slug}</bdi></small>{result.error.status !== 404 && <button type="button" className={s.link} onClick={result.refetch}>{copy.common.retry}</button>}</span>
            : <Skeleton rows={2} />}
        </div>)}
      </div>
      <dl className={s.compareRows}>{rows.map((row) => <div key={row.label}>
        <dt>{row.label}</dt>
        <dd>{columns.map(({ slug, result }) => <span key={slug}>{result.data ? row.cell(result.data) : '—'}</span>)}</dd>
      </div>)}</dl>
      {loaded[0] && <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(loaded[0].dataTimestamp, locale) })}</span></p>}
    </div>
      : <StateBlock title={t.empty} body={t.emptyBody} />}

    {slugs.length < MAX ? <div style={{ marginTop: 18 }}>
      {adding ? <>
        <label className={s.search}>
          <Search size={17} strokeWidth={1.7} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.pick} aria-label={t.pick} maxLength={80} autoFocus />
          <button type="button" onClick={() => { setAdding(false); setSearch('') }} aria-label={copy.common.close}><X size={14} /></button>
        </label>
        <div style={{ marginTop: 8 }}>
          {!candidates.data && !candidates.error ? <Skeleton rows={2} />
            : candidates.error && !candidates.data ? <StateBlock tone="error" title={copy.markets.loadError} body={candidates.error.message} retry={candidates.refetch} retryLabel={copy.common.retry} />
            : candidates.data?.items.filter((asset) => !slugs.includes(asset.slug)).length ? <ul className={s.list}>{candidates.data.items.filter((asset) => !slugs.includes(asset.slug)).map((asset) => <li key={asset.slug}>
              <button type="button" className={s.row} onClick={() => add(asset.slug)}>
                <Logo src={asset.logoUrl} name={asset.name} />
                <span className={s.rowMain}><b>{asset.name}</b><small>{[asset.symbol && asset.symbol !== '-' ? asset.symbol : null, asset.issuer?.name].filter(Boolean).join(' · ')}</small></span>
                <span className={s.rowFig}><Plus size={16} className={s.muted} /></span>
              </button>
            </li>)}</ul>
            : <StateBlock title={term ? fill(copy.markets.noMatch, { q: term }) : copy.common.empty} />}
        </div>
      </> : <button type="button" className={s.ghost} style={{ width: '100%' }} onClick={() => setAdding(true)}><Plus size={15} />{t.add}</button>}
    </div> : <p className={s.foot}><span>{t.max}</span></p>}

    <div className={s.notice}><Info size={16} /><span>{d.researchNote}</span></div>
  </MaisonPage>
}
