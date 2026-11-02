'use client'

import { useEffect, useRef, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { Sheet } from '@/components/maison/Sheet'
import { searchCircle, type Circle, type CircleMemberRow } from '@/lib/community-circles'
import type { CommunityPost } from '@/lib/community-data'
import { useCircleStageCopy } from './circle-copy'
import { useCircleCopy } from './CircleSheets'
import { useTimeAgo } from './PostCard'
import c from '../community-x.module.css'
import s from './circles.module.css'

type Results = { kind: 'posts'; items: CommunityPost[]; nextCursor: string | null } | { kind: 'members'; items: CircleMemberRow[]; nextCursor: string | null }

/** Search stays inside the selected circle; old requests cannot replace a new query (2026-11-01). */
export function CircleSearchSheet({ open, circle, onClose, openPost }: { open: boolean; circle: Circle; onClose: () => void; openPost: (id: string) => void }) {
  const labels = useCircleStageCopy(), k = useCircleCopy(), timeAgo = useTimeAgo()
  const [type, setType] = useState<'posts' | 'members'>('posts')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const version = useRef(0), paging = useRef(false)
  const query = q.trim()
  useEffect(() => {
    const request = ++version.current
    setResults(null); setFailed(false); setLoading(Boolean(open && query)); paging.current = false
    if (!open || !query) return
    const timer = setTimeout(() => {
      const work = type === 'posts' ? searchCircle(circle.id, query, 'posts').then(page => ({ kind: 'posts' as const, ...page })) : searchCircle(circle.id, query, 'members').then(page => ({ kind: 'members' as const, ...page }))
      void work.then(page => { if (request === version.current) setResults(page) }).catch(() => { if (request === version.current) setFailed(true) }).finally(() => { if (request === version.current) setLoading(false) })
    }, 300)
    return () => { clearTimeout(timer); ++version.current }
  }, [open, circle.id, query, type, retry])
  const more = async () => {
    if (!results?.nextCursor || paging.current) return
    const request = version.current
    paging.current = true; setLoading(true); setFailed(false)
    try {
      if (results.kind === 'posts') {
        const page = await searchCircle(circle.id, query, 'posts', results.nextCursor)
        if (request === version.current) setResults({ kind: 'posts', items: [...results.items, ...page.items.filter(post => !results.items.some(item => item.id === post.id))], nextCursor: page.nextCursor })
      } else {
        const page = await searchCircle(circle.id, query, 'members', results.nextCursor)
        if (request === version.current) setResults({ kind: 'members', items: [...results.items, ...page.items.filter(row => !results.items.some(item => item.profile.id === row.profile.id))], nextCursor: page.nextCursor })
      }
    } catch { if (request === version.current) setFailed(true) }
    finally { if (request === version.current) { paging.current = false; setLoading(false) } }
  }
  return <Sheet open={open} onClose={onClose} title={labels.searchInside} kicker={circle.name}>
    <div className={s.searchBody}>
      <div className={s.segments} role="tablist" aria-label={labels.searchInside}>{(['posts', 'members'] as const).map(kind => <button key={kind} type="button" role="tab" aria-selected={type === kind} onClick={() => setType(kind)}>{labels[kind]}</button>)}</div>
      <label className={s.field}><span className={s.srOnly}>{type === 'posts' ? labels.searchPosts : labels.searchMembers}</span><input type="search" value={q} placeholder={type === 'posts' ? labels.searchPosts : labels.searchMembers} onChange={event => setQ(event.target.value)} /></label>
      {results?.kind === 'posts' && <ul className={s.searchPosts}>{results.items.map(post => <li key={post.id}><button type="button" onClick={() => { onClose(); openPost(post.id) }}><b dir="auto">{post.author?.displayName ?? '—'}</b><small>{timeAgo(post.publishedAt)}</small><p dir="auto">{post.body}</p></button></li>)}</ul>}
      {results?.kind === 'members' && <ul className={s.memberList}>{results.items.map(row => <li key={row.profile.id}><CommunityAvatar avatarUrl={row.profile.avatarUrl} seed={row.profile.avatarSeed} handle={row.profile.handle} size={40} /><span><b dir="auto">{row.profile.displayName}</b><small>{row.via === 'link' ? k.viaLink : k.depth(row.depth)}{row.identityConfigured === false ? ` · ${k.noProfile}` : ''}{row.silenced ? ` · ${labels.silenced}` : ''}</small></span></li>)}</ul>}
      {loading && <p className={s.hint} role="status">…</p>}{failed && <p className={s.hint} role="alert">{labels.failed} <button type="button" className={s.textKey} onClick={() => results?.nextCursor ? void more() : setRetry(value => value + 1)}>{labels.retry}</button></p>}
      {!loading && !failed && !results?.items.length && <p className={s.hint}>{labels.noResults}</p>}
      {results?.nextCursor && !failed && <button type="button" className={c.pill} disabled={loading} onClick={() => void more()}>{labels.more}</button>}
    </div>
  </Sheet>
}
