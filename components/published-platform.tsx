'use client'

import type { ReactNode } from 'react'
import { ArrowUpRight, BadgeCheck, FileCheck2, FileText, Mail } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { request, apiUrl, type ApiError } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { trustCopy, type TrustCopy } from '@/lib/maison-trust-copy'
import { Skeleton, StateBlock } from './maison/primitives'
import s from './maison/published.module.css'

type Profile = { legalName: string; registrationNumber: string; jurisdiction: string; address: string; supportEmail: string; description: string; allowedRegions: string[]; investorTypes: string[]; documents: { title: string; url: string; kind?: string; reportDate?: string|null; asOfDate?: string|null; issuer?: string|null }[]; officialChannels?: Array<{ kind: string; label: string; url: string; note: string }> }
const loadProfile = () => request<Profile>('/v1/platform')
const channelHost = (url: string) => { try { return new URL(url).hostname } catch { return url } }
// Published files are either API-served (/v1/...) or absolute https links; anything else is not rendered as a link.
const docHref = (url: string) => url.startsWith('/v1/') ? apiUrl(url) : /^https:\/\//i.test(url) ? url : null
const CLIENTS: Record<string, Record<string, string>> = {
  'zh-CN': { retail: '零售客户', professional: '专业投资者', institutional: '机构客户' },
  en: { retail: 'Retail', professional: 'Professional', institutional: 'Institutional' },
  es: { retail: 'Minoristas', professional: 'Profesionales', institutional: 'Institucionales' },
  ar: { retail: 'أفراد', professional: 'محترفون', institutional: 'مؤسسات' },
  fr: { retail: 'Particuliers', professional: 'Professionnels', institutional: 'Institutionnels' },
  pt: { retail: 'Varejo', professional: 'Profissionais', institutional: 'Institucionais' },
  hi: { retail: 'खुदरा', professional: 'पेशेवर', institutional: 'संस्थागत' },
}

function dateOf(value: string | null | undefined, locale: string) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)
}

/** 404 = profile not published yet (honest empty state, no retry); other failures retry. */
function ProfileState({ error, retry, c }: { error: ApiError; retry: () => void; c: TrustCopy }) {
  if (error.status === 404) return <div className={s.wrap}><StateBlock tone="unavailable" title={c.unpublished} body={c.unpublishedBody} /></div>
  return <div className={s.wrap}><StateBlock tone="error" title={error.status === 0 ? c.network : c.failed} retry={retry} retryLabel={c.retry} /></div>
}

function Loading({ label }: { label: string }) {
  return <div className={s.wrap} role="status" aria-label={label}><Skeleton rows={3} /></div>
}

function region(names: Intl.DisplayNames, code: string) { try { return names.of(code) ?? code } catch { return code } }

export function PublishedReserves() {
  const { locale } = useI18n(); const c = trustCopy[locale]
  const query = useQuery('platform:published', loadProfile, { staleTime: 30_000 })
  if (query.error) return <ProfileState error={query.error} retry={query.refetch} c={c} />
  if (!query.data) return <Loading label={c.loading} />
  const documents = query.data.documents.filter(d => d.kind === 'reserve_audit' || d.kind === 'reserve_custody')
  return <div className={s.wrap}>
    <p className={s.lede}>{c.reservesBody}</p>
    {documents.length ? <ul className={s.card}>{documents.map(d => {
      const report = dateOf(d.reportDate, locale), asOf = dateOf(d.asOfDate, locale), href = docHref(d.url)
      const body = <><span className={s.rowIcon} aria-hidden="true"><FileCheck2 size={17} strokeWidth={1.6} /></span>
        <span className={s.rowText}><b dir="auto">{d.title}</b>
          {d.issuer && <small>{c.issuer} · <span dir="auto">{d.issuer}</span></small>}
          {(report || asOf) && <small>{[report && `${c.reportDate}: ${report}`, asOf && `${c.asOf}: ${asOf}`].filter(Boolean).join(' · ')}</small>}</span>
        {href && <ArrowUpRight className={s.chev} size={16} aria-hidden="true" />}</>
      return <li key={d.url}>{href ? <a className={s.row} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${d.title} · ${c.openDoc}`}>{body}</a> : <div className={s.row}>{body}</div>}</li>
    })}</ul> : <StateBlock title={c.noReserves} />}
  </div>
}

export function PublishedPlatform({ regions = false }: { regions?: boolean }) {
  const { locale } = useI18n()
  const c = trustCopy[locale]
  const query = useQuery('platform:published', loadProfile, { staleTime: 30_000 })
  if (query.error) return <ProfileState error={query.error} retry={query.refetch} c={c} />
  if (!query.data) return <Loading label={c.loading} />
  const p = query.data
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const docs = p.documents.flatMap(doc => { const href = docHref(doc.url); return href ? [{ ...doc, href }] : [] })
  const facts: Array<[string, ReactNode]> = []
  if (regions) {
    facts.push([c.regions, p.allowedRegions.length ? p.allowedRegions.map(code => region(names, code)).join(' · ') : c.noRegions])
    if (p.investorTypes.length) facts.push([c.clients, p.investorTypes.map(type => CLIENTS[locale][type] ?? type).join(' · ')])
  } else {
    facts.push([c.operator, <span dir="auto">{p.legalName}</span>])
    if (p.registrationNumber) facts.push([c.registration, <span dir="ltr">{p.registrationNumber}</span>])
    if (p.jurisdiction) facts.push([c.jurisdiction, region(names, p.jurisdiction)])
    if (p.supportEmail) facts.push([c.support, <a href={`mailto:${p.supportEmail}`} dir="ltr">{p.supportEmail}</a>])
  }
  return <div className={s.wrap}>
    <dl className={s.card}>{facts.map(([label, value]) => <div key={label} className={s.fact}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!regions && (p.address || p.description) && <div className={s.prose}>{p.address && <p dir="auto">{p.address}</p>}{p.description && <p dir="auto">{p.description}</p>}</div>}
    {!regions && <>
      <h2 className={s.section}>{c.documents}</h2>
      {docs.length ? <ul className={s.card}>{docs.map(doc => <li key={doc.url}><a className={s.row} href={doc.href} target="_blank" rel="noopener noreferrer">
        <span className={s.rowIcon} aria-hidden="true"><FileText size={17} strokeWidth={1.6} /></span><span className={s.rowText}><b dir="auto">{doc.title}</b></span><ArrowUpRight className={s.chev} size={16} aria-hidden="true" />
      </a></li>)}</ul> : <StateBlock title={c.noDocuments} />}
    </>}
  </div>
}

export function PublishedOfficialChannels() {
  const { locale } = useI18n()
  const c = trustCopy[locale]
  const query = useQuery('platform:published', loadProfile, { staleTime: 30_000 })
  if (query.error) return <ProfileState error={query.error} retry={query.refetch} c={c} />
  if (!query.data) return <Loading label={c.loading} />
  const profile = query.data
  const channels = (profile.officialChannels ?? []).filter(channel => /^https:\/\//i.test(channel.url))
  if (!channels.length && !profile.supportEmail) return <div className={s.wrap}><StateBlock title={c.noChannels} /></div>
  return <div className={s.wrap}><ul className={s.card}>
    {channels.map((channel) => <li key={`${channel.kind}:${channel.url}`}><a className={s.row} href={channel.url} target="_blank" rel="noopener noreferrer">
      <span className={s.rowIcon} aria-hidden="true"><BadgeCheck size={17} strokeWidth={1.6} /></span>
      <span className={s.rowText}><small dir="auto">{channel.label}</small><b dir="ltr">{channelHost(channel.url)}</b>{channel.note && <small dir="auto">{channel.note}</small>}</span><ArrowUpRight className={s.chev} size={16} aria-hidden="true" />
    </a></li>)}
    {profile.supportEmail && <li><a className={s.row} href={`mailto:${profile.supportEmail}`}>
      <span className={s.rowIcon} aria-hidden="true"><Mail size={17} strokeWidth={1.6} /></span><span className={s.rowText}><small>{c.supportEmail}</small><b dir="ltr">{profile.supportEmail}</b></span><ArrowUpRight className={s.chev} size={16} aria-hidden="true" />
    </a></li>}
  </ul></div>
}
