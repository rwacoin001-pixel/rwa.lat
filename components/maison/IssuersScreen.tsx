'use client'

import { BadgeCheck, ExternalLink, Info, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { assetClassLabel } from '@/lib/asset-labels'
import { useQuery } from '@/lib/api/_query'
import { getIssuer, listIssuers } from '@/lib/api/markets'
import { fmtUsd } from '@/lib/money'
import { directoryCopy } from '@/lib/maison-directory-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { Delta, Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { fmtDateTime } from './format'

type Sort = 'cap' | 'name'

/** `/issuers` — third-party issuer directory, research only. */
export function IssuersScreen() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = directoryCopy[locale].issuers
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<Sort>('cap')
  const issuers = useQuery('issuers:list', listIssuers, { staleTime: 5 * 60_000 })
  const items = issuers.data?.items
  const total = useMemo(() => (items ?? []).reduce((sum, issuer) => sum + (Number(issuer.totalMarketCapUsd) || 0), 0), [items])
  const visible = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(locale)
    const rows = (items ?? []).filter((issuer) => !needle || `${issuer.name} ${issuer.slug}`.toLocaleLowerCase(locale).includes(needle))
    return sort === 'name' ? [...rows].sort((a, b) => a.name.localeCompare(b.name, locale)) : [...rows].sort((a, b) => (Number(b.totalMarketCapUsd) || 0) - (Number(a.totalMarketCapUsd) || 0))
  }, [items, filter, sort, locale])

  return <MaisonPage page="issuers" dock topbar={<RwaTopbar screen="issuers" title={t.title} onBack={() => backOr('/markets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{items ? fill(t.lede, { n: items.length, v: fmtUsd(String(total), { compact: true, locale }) }) : ' '}</p>
    </header>

    <label className={s.search}>
      <Search size={17} strokeWidth={1.7} aria-hidden="true" />
      <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t.filter} aria-label={t.filter} maxLength={80} />
      {filter && <button type="button" onClick={() => setFilter('')} aria-label={copy.common.clear}><X size={14} /></button>}
    </label>
    <div className={s.chips} role="group" aria-label={t.title} style={{ marginTop: 14 }}>
      {(['cap', 'name'] as const).map((key) => <button key={key} type="button" className={s.chip} aria-pressed={sort === key} onClick={() => setSort(key)}>{t.sort[key]}</button>)}
    </div>

    <div style={{ marginTop: 10 }}>
      {!issuers.data && !issuers.error ? <Skeleton rows={4} />
        : issuers.error && !issuers.data ? <StateBlock tone="error" title={t.loadError} body={issuers.error.message} retry={issuers.refetch} retryLabel={copy.common.retry} />
        : visible.length ? <ul className={s.list}>{visible.map((issuer) => <li key={issuer.slug}>
          <button type="button" className={s.row} onClick={() => openPath(`/issuers/${encodeURIComponent(issuer.slug)}`)}>
            <Logo src={typeof issuer.logoUrl === 'string' ? issuer.logoUrl : null} name={issuer.name} />
            <span className={s.rowMain}><b>{issuer.name}</b><small>{[issuer.verified ? t.verified : null, fill(t.assets, { n: issuer.assetCount })].filter(Boolean).join(' · ')}</small></span>
            <span className={s.rowFig}><b className={s.num}>{fmtUsd(issuer.totalMarketCapUsd, { compact: true, locale })}</b><small className={s.muted}>{t.marketCap}</small></span>
          </button>
        </li>)}</ul>
        : <StateBlock title={filter.trim() ? fill(copy.markets.noMatch, { q: filter.trim() }) : copy.common.empty} />}
    </div>
    <div className={s.notice}><Info size={16} /><span>{t.note}</span></div>
  </MaisonPage>
}

/** `/issuers/:slug` — keyed by slug, so a new slug always loads its own profile. */
export function IssuerProfileScreen({ slug }: { slug: string | null }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const d = copy.detail
  const t = directoryCopy[locale].issuers
  const profile = useQuery(slug ? `issuers:detail:${slug}` : null, () => getIssuer(slug!), { staleTime: 5 * 60_000 })
  const issuer = profile.data
  const topbar = <RwaTopbar screen="issuer-profile" title={issuer?.name ?? t.title} onBack={() => backOr('/issuers')} />
  const toAll = <button type="button" className={s.link} onClick={() => openPath('/issuers')}>{t.all}</button>

  if (!slug) return <MaisonPage page="issuer" dock topbar={topbar}><div className={s.hero}><StateBlock title={t.notFound} body={t.notFoundBody} action={toAll} /></div></MaisonPage>
  if (!issuer && !profile.error) return <MaisonPage page="issuer" dock topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  if (!issuer) return <MaisonPage page="issuer" dock topbar={topbar}><div className={s.hero}>
    {profile.error?.status === 404 ? <StateBlock title={t.notFound} body={t.notFoundBody} action={toAll} />
      : <StateBlock tone="error" title={t.loadError} body={profile.error?.message} retry={profile.refetch} retryLabel={copy.common.retry} />}
  </div></MaisonPage>

  const assets = issuer.assets ?? []
  return <MaisonPage page="issuer" dock topbar={topbar}>
    <header className={s.hero}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo src={typeof issuer.logoUrl === 'string' ? issuer.logoUrl : null} name={issuer.name} />
        <p className={s.kicker}>{t.kicker}</p>
      </div>
      <h1 className={s.titleL} style={{ marginTop: 14 }}>{issuer.name}</h1>
      <p className={s.lede} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {issuer.verified && <span className={s.badge} data-tone="accent"><BadgeCheck size={12} />{t.verified}</span>}
        <span className={s.badge}>{d.research}</span>
      </p>
    </header>

    <section className={s.lacquer}>
      <span className={s.kicker}>{t.marketCap}</span>
      <p className={`${s.bigFigure} ${s.num}`}>{fmtUsd(issuer.totalMarketCapUsd, { compact: true, locale })}</p>
      <dl className={s.stats} style={{ marginTop: 18 }}>
        <div><dt>{t.managed}</dt><dd className={s.num}>{assets.length}</dd></div>
        <div><dt>{d.website}</dt><dd>{issuer.websiteUrl ? <a className={s.link} style={{ color: 'inherit' }} href={issuer.websiteUrl} target="_blank" rel="noopener noreferrer"><bdi>{hostOf(issuer.websiteUrl)}</bdi><ExternalLink size={12} /></a> : '—'}</dd></div>
      </dl>
    </section>

    {issuer.description && <><SectionHead index="01" title={d.about} /><p className={s.prose}>{issuer.description}</p></>}

    <SectionHead index={issuer.description ? '02' : '01'} title={t.managed} action={assets.length > 1 ? <button type="button" className={s.sectionMore} onClick={() => openPath(`/compare?slugs=${assets.slice(0, 3).map((asset) => encodeURIComponent(asset.slug)).join(',')}`)}>{copy.markets.compare}</button> : undefined} />
    {assets.length ? <>
      <ul className={s.list}>{assets.map((asset) => <li key={asset.slug}>
        <button type="button" className={s.row} onClick={() => openPath(`/asset/${encodeURIComponent(asset.slug)}`)}>
          <Logo src={asset.logoUrl} name={asset.name} />
          <span className={s.rowMain}><b>{asset.name}</b><small>{[asset.symbol && asset.symbol !== '-' ? asset.symbol : null, assetClassLabel(asset.assetClass, locale)].filter(Boolean).join(' · ')}</small></span>
          <span className={s.rowFig}><b className={s.num}>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small><Delta value={asset.change24hPct} /></small></span>
        </button>
      </li>)}</ul>
      <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(assets[0]?.dataTimestamp, locale) })}</span></p>
    </> : <StateBlock title={t.noAssets} />}

    <div className={s.notice}><Info size={16} /><span>{t.note}</span></div>
    <div className={s.actions2} style={{ marginTop: 14 }}>
      <button type="button" className={s.ghost} onClick={() => openPath('/issuers')}>{t.all}</button>
      <button type="button" className={s.ghost} onClick={() => openPath('/markets')}>{copy.status.backMarkets}</button>
    </div>
  </MaisonPage>
}

function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return url }
}
