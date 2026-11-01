'use client'

import { ArrowRight, ChevronRight, Moon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import controls from '@/components/ui/controls.module.css'
import { applyToCircleById, createCircle, getMyCircles, searchCircles, type Circle, type CircleMembership, type CircleSearchResult } from '@/lib/community-circles'
import { openPath } from '@/lib/maison-nav'
import { NameSheet, useCircleCopy } from './CircleSheets'
import { useCircleStageCopy } from './circle-copy'
import { useTimeAgo } from './PostCard'
import c from '../community-x.module.css'
import s from './circles.module.css'

export const openCircle = (id: string) => openPath(`/community/circle/${encodeURIComponent(id)}`)

/** One paper group per membership section (2026-11-01). */
export function CircleList({ onNotify }: { onNotify: (text: string) => void }) {
  const k = useCircleCopy(), labels = useCircleStageCopy(), timeAgo = useTimeAgo()
  const [membership, setMembership] = useState<CircleMembership | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const query = q.trim()
  const [results, setResults] = useState<CircleSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const version = useRef(0)
  const searchVersion = useRef(0)
  const load = useCallback(() => {
    const request = ++version.current
    setFailed(false)
    void getMyCircles().then(data => { if (request === version.current) setMembership(data) }).catch(() => { if (request === version.current) setFailed(true) })
  }, [])
  useEffect(() => { load(); return () => { ++version.current } }, [load])
  useEffect(() => {
    const request = ++searchVersion.current
    setResults([]); setSearchFailed(false); setSearching(Boolean(query))
    if (!query) return
    const timer = setTimeout(() => {
      void searchCircles(query).then(rows => { if (request === searchVersion.current) setResults(rows) }).catch(() => { if (request === searchVersion.current) setSearchFailed(true) }).finally(() => { if (request === searchVersion.current) setSearching(false) })
    }, 300)
    return () => { clearTimeout(timer); ++searchVersion.current }
  }, [query, retry])
  const apply = async (row: CircleSearchResult) => {
    if (busy) return
    setBusy(row.circle.id)
    try {
      const status = await applyToCircleById(row.circle.id)
      setResults(previous => previous.map(item => item.circle.id === row.circle.id ? { ...item, status } : item))
      if (status === 'member' || status === 'owner') openCircle(row.circle.id)
    } catch (error) {
      if (error instanceof Error && error.message === 'CIRCLE_REMOVED') setResults(previous => previous.map(item => item.circle.id === row.circle.id ? { ...item, status: 'removed' } : item))
      else onNotify(k.failed)
    } finally { setBusy(null) }
  }
  const row = (circle: Circle, left = false) => <li key={circle.id}><button type="button" className={s.circleRow} data-left={left || undefined} onClick={() => openCircle(circle.id)}>
    <CommunityAvatar avatarUrl={circle.owner.avatarUrl} seed={circle.owner.avatarSeed} handle={circle.owner.handle} size={44} />
    <span className={s.rowText}><b dir="auto">{circle.name}</b><small>{k.owner} <span dir="auto">{circle.owner.displayName}</span> · {k.members(circle.memberCount)}{left ? ` · ${labels.left}` : circle.lastPostAt ? ` · ${labels.latest} ${timeAgo(circle.lastPostAt)}` : ''}</small></span>
    {circle.muted && <Moon size={14} aria-label={labels.muted} />}{circle.isOwner && (circle.pendingCount ?? 0) > 0 && <span className={`${s.badge} ${s.rowBadge}`}>{circle.pendingCount! > 99 ? '99+' : circle.pendingCount}</span>}<ChevronRight size={16} aria-hidden="true" />
  </button></li>
  return <section className={s.list} aria-label={labels.circles}>
    <label className={s.field}><span className={s.srOnly}>{labels.search}</span><input type="search" value={q} placeholder={labels.search} onChange={event => setQ(event.target.value)} /></label>
    {query ? searching ? <p className={s.hint} role="status">…</p> : searchFailed ? <p className={s.hint} role="alert">{labels.failed} <button type="button" className={s.textKey} onClick={() => setRetry(value => value + 1)}>{labels.retry}</button></p> : results.length === 0 ? <p className={s.hint}>{labels.noCircles}</p> : <ul className={s.paperList}>
      {results.map(result => <li key={result.circle.id} className={s.searchRow}>
        <CommunityAvatar avatarUrl={result.circle.owner.avatarUrl} seed={result.circle.owner.avatarSeed} handle={result.circle.owner.handle} size={40} />
        <span className={s.rowText}><b dir="auto">{result.circle.name}</b><small>{k.owner} <span dir="auto">{result.circle.owner.displayName}</span> · {k.members(result.circle.memberCount)} · ID {result.circle.publicNo}</small></span>
        {result.status === 'removed' ? <small className={s.hint}>{labels.removed}</small> : result.status === 'member' || result.status === 'owner' ? <button type="button" className={c.pill} onClick={() => openCircle(result.circle.id)}>{labels.enter}</button> : <button type="button" className={`${c.pill} ${result.status === 'pending' ? '' : c.pillSolid}`} disabled={busy !== null || result.status === 'pending'} onClick={() => void apply(result)}>{result.status === 'pending' ? labels.pending : labels.apply}</button>}
      </li>)}
    </ul> : failed ? <p className={s.hint} role="alert">{labels.failed} <button type="button" className={s.textKey} onClick={load}>{labels.retry}</button></p> : membership === undefined ? <p className={s.hint} role="status">…</p> : membership === null ? <p className={s.hint}>{labels.notLive}</p> : <>
      <section className={s.listSection}><h2>{labels.mine}</h2>{membership.owned ? <ul className={s.paperList}>{row(membership.owned)}</ul> : <div className={s.intro}><b>{k.introTitle}</b><p>{k.introBody}</p><button type="button" className={controls.primary} onClick={() => setNaming(true)}><span>{k.found}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} /></i></button></div>}</section>
      <section className={s.listSection}><h2>{labels.joined}</h2>{membership.joined.length + membership.left.length > 0 ? <ul className={s.paperList}>{membership.joined.map(item => row(item))}{membership.left.map(item => row(item, true))}</ul> : <p className={s.hint}>{labels.noJoined}</p>}</section>
    </>}
    <NameSheet open={naming} title={k.foundTitle} initial="" busy={busy === 'create'} onClose={() => setNaming(false)} onSave={name => {
      if (busy) return
      setBusy('create')
      void createCircle(name).then(circle => { setNaming(false); load(); openCircle(circle.id) }).catch(() => onNotify(k.failed)).finally(() => setBusy(null))
    }} />
  </section>
}
