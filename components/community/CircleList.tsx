'use client'

import { ArrowRight, ChevronRight, Moon, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { applyToCircleById, createCircle, getMyCircles, searchCircles, type Circle, type CircleMembership, type CircleSearchResult } from '@/lib/community-circles'
import { openPath } from '@/lib/maison-nav'
import { NameSheet, useCircleCopy } from './CircleSheets'
import { useCircleStageCopy } from './circle-copy'
import { useTimeAgo } from './PostCard'
import { HotCircles } from './HotCircles'
import s from './circles.module.css'
import l from './circle-list.module.css'

export const openCircle = (id: string) => openPath(`/community/circle/${encodeURIComponent(id)}`)

/** Circle list v2 (2026-11-01): search capsule, my circle with three figures (or a compact start card), joined circles. */
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
  const field = useRef<HTMLInputElement>(null)
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
  const meta = (circle: Circle) => <>{k.owner} <span dir="auto">{circle.owner.displayName}</span> · {k.members(circle.memberCount)}{circle.lastPostAt ? <> · <i>{timeAgo(circle.lastPostAt)}</i></> : null}</>
  const row = (circle: Circle, left = false) => <li key={circle.id}><button type="button" className={l.row} data-left={left || undefined} onClick={() => openCircle(circle.id)}>
    <CommunityAvatar avatarUrl={circle.owner.avatarUrl} seed={circle.owner.avatarSeed} handle={circle.owner.handle} size={40} />
    <span className={l.text}><b dir="auto">{circle.name}</b><small>{meta(circle)}</small></span>
    {left ? <span className={l.tag}>{labels.left}</span> : circle.muted ? <Moon size={16} aria-label={labels.muted} /> : null}<ChevronRight size={18} aria-hidden="true" />
  </button></li>
  const ghost = <ul className={l.paper} aria-hidden="true"><li className={l.ghost}><i /><span /></li><li className={l.ghost}><i /><span /></li></ul>
  const owned = membership?.owned
  const joinedCount = membership ? membership.joined.length + membership.left.length : 0
  return <section className={l.page} aria-label={labels.circles}>
    <label className={l.search}><Search size={18} aria-hidden="true" /><span className={s.srOnly}>{labels.search}</span>
      <input ref={field} type="search" inputMode="search" enterKeyHint="search" value={q} placeholder={labels.search} onChange={event => setQ(event.target.value)} />
      {q && <button type="button" className={l.clear} aria-label={labels.clear} onClick={() => { setQ(''); field.current?.focus() }}><X size={18} aria-hidden="true" /></button>}
    </label>
    {query ? <section className={l.section} aria-live="polite">
      {searching ? ghost : searchFailed ? <p className={l.note} role="alert">{labels.failed}<button type="button" onClick={() => setRetry(value => value + 1)}>{labels.retry}</button></p> : results.length === 0 ? <div className={l.empty}><b>{labels.noCircles}</b><p>{labels.joinHint}</p></div> : <>
        <h2 className={l.label}>{labels.resultsCount(results.length)}</h2>
        <ul className={l.paper}>{results.map(result => <li key={result.circle.id} className={l.row}>
          <CommunityAvatar avatarUrl={result.circle.owner.avatarUrl} seed={result.circle.owner.avatarSeed} handle={result.circle.owner.handle} size={40} />
          <span className={l.text}><b dir="auto">{result.circle.name}</b><small>{k.owner} <span dir="auto">{result.circle.owner.displayName}</span> · {k.members(result.circle.memberCount)} · ID <i>{result.circle.publicNo}</i></small></span>
          {result.status === 'removed' ? <span className={l.tag}>{labels.removed}</span> : result.status === 'member' || result.status === 'owner' ? <button type="button" className={l.key} onClick={() => openCircle(result.circle.id)}>{labels.enter}</button> : <button type="button" className={l.key} data-solid={result.status === 'pending' ? undefined : ''} disabled={busy !== null || result.status === 'pending'} onClick={() => void apply(result)}>{result.status === 'pending' ? labels.pending : labels.apply}</button>}
        </li>)}</ul>
      </>}
    </section> : failed ? <p className={l.note} role="alert">{labels.failed}<button type="button" onClick={load}>{labels.retry}</button></p> : membership === undefined ? <section className={l.section}><h2 className={l.label}>{labels.mine}</h2>{ghost}</section> : membership === null ? <p className={l.note}>{labels.notLive}</p> : <>
      <section className={l.section}>
        <h2 className={l.label}>{labels.mine}</h2>
        {owned ? <button type="button" className={l.mine} onClick={() => openCircle(owned.id)}>
          <span className={`${l.cover} ${l.mineCover}`} data-tone={[...owned.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 8} aria-hidden="true"><span className={l.glyph} dir="auto">{Array.from(owned.name)[0]}</span></span>
          <span className={l.mineHead}>
            <CommunityAvatar avatarUrl={owned.owner.avatarUrl} seed={owned.owner.avatarSeed} handle={owned.owner.handle} size={44} />
            <span className={l.text}><b dir="auto">{owned.name}</b><small>{labels.statLatest} {owned.lastPostAt ? <i>{timeAgo(owned.lastPostAt)}</i> : labels.none}</small></span>
            {owned.muted && <Moon size={16} aria-label={labels.muted} />}<ChevronRight size={18} aria-hidden="true" />
          </span>
          {owned.intro && <span className={l.mineIntro} dir="auto">{owned.intro}</span>}
          <span className={l.stats}>
            <span><b>{owned.memberCount}</b><small>{labels.statMembers}</small></span>
            <span><b data-hot={(owned.pendingCount ?? 0) > 0 || undefined}>{(owned.pendingCount ?? 0) > 99 ? '99+' : owned.pendingCount ?? 0}</b><small>{labels.statPending}</small></span>
            <span><b>{owned.publicNo}</b><small>{labels.statId}</small></span>
          </span>
        </button> : <div className={l.create}>
          <div className={l.createHead}>
            <span><b>{k.introTitle}</b><p>{labels.createBody}</p></span>
            <button type="button" className={l.createKey} onClick={() => setNaming(true)}>{labels.createKey}<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <ul className={l.facts}>{labels.facts.map(([title, sub]) => <li key={title}><b>{title}</b><small>{sub}</small></li>)}</ul>
        </div>}
      </section>
      <section className={l.section}>
        <h2 className={l.label}>{labels.joined}{joinedCount > 0 && <span>{joinedCount}</span>}</h2>
        {joinedCount > 0 ? <ul className={l.paper}>{membership.joined.map(item => row(item))}{membership.left.map(item => row(item, true))}</ul> : <div className={l.empty}>
          <b>{labels.noJoined}</b><p>{labels.joinHint}</p>
          <button type="button" className={l.textKey} onClick={() => field.current?.focus()}>{labels.searchById}</button>
        </div>}
      </section>
      <HotCircles onNotify={onNotify} />
    </>}
    <NameSheet open={naming} title={k.foundTitle} initial="" busy={busy === 'create'} onClose={() => setNaming(false)} onSave={(name, intro) => {
      if (busy) return
      setBusy('create')
      void createCircle(name, intro).then(circle => { setNaming(false); load(); openCircle(circle.id) }).catch(() => onNotify(k.failed)).finally(() => setBusy(null))
    }} />
  </section>
}
