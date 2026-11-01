'use client'

import { ArrowLeft, Copy, Feather, MoreHorizontal, Search, X } from 'lucide-react'
import { CommunityAvatar } from '@/components/community-avatar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/maison/Sheet'
import { MaisonPage, maison as mp } from '@/components/maison/primitives'
import { CommunityCompose, useCommunityMe } from '@/components/community-compose'
import { claimFeatherCompose } from '@/lib/community-feather'
import { deleteCircle, getCirclePosts, getMyCircles, leaveCircle, muteCircle, pinCirclePost, rejoinCircle, renameCircle, updateCircle, type Circle, type CircleMembership } from '@/lib/community-circles'
import { getCommunityTopics, type CommunityPost, type CommunityTopic } from '@/lib/community-data'
import { useI18n } from '@/lib/i18n'
import type { RwaScreen } from '@/lib/rwa-routes'
import { InviteSheet, MembersSheet, NameSheet, PeopleSheet, useCircleCopy, useSeenCircles } from './CircleSheets'
import { CircleSearchSheet } from './CircleSearchSheet'
import { useCircleStageCopy } from './circle-copy'
import { PostRow, SkeletonRows, XState, useInfinite, usePostActions, useTimeAgo, type RowActions } from './PostCard'
import c from '../community-x.module.css'
import s from './circles.module.css'
import { RewardDrawHost } from '@/components/rewards/RewardDrawHost'

/** A circle owns its feed and composer (2026-11-01). */
export function CircleScreen({ circleId, go, openPost, openProfile, isGuest = true }: { circleId: string | null; go: (screen: RwaScreen) => void; openPost: (id: string) => void; openProfile: (handle: string) => void; isGuest?: boolean }) {
  const { locale } = useI18n()
  const labels = useCircleStageCopy(), timeAgo = useTimeAgo()
  const me = useCommunityMe(isGuest)
  const [membership, setMembership] = useState<CircleMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [items, setItems] = useState<CommunityPost[]>([])
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [search, setSearch] = useState(false)
  const [composing, setComposing] = useState(false)
  const [pinning, setPinning] = useState(false)
  const version = useRef(0), paging = useRef(false)
  const circles = membership ? [...(membership.owned ? [membership.owned] : []), ...membership.joined, ...membership.left] : []
  const current = circles.find(circle => circle.id === circleId) ?? null
  const left = membership?.left.some(circle => circle.id === circleId) ?? false
  const load = useCallback(async (refresh = false) => {
    const request = ++version.current
    if (!circleId || isGuest) { setLoading(false); return }
    if (!refresh) setLoading(true)
    setFailed(false); setMoreFailed(false); paging.current = false; setMoreLoading(false)
    try {
      const data = await getMyCircles()
      if (request !== version.current) return
      setMembership(data)
      const allowed = data && (data.owned?.id === circleId || data.joined.some(circle => circle.id === circleId))
      if (!allowed) { setItems([]); setCursor(null); return }
      const page = await getCirclePosts(circleId)
      if (request !== version.current) return
      setItems(page.items); setCursor(page.nextCursor)
    } catch { if (request === version.current) setFailed(true) }
    finally { if (request === version.current) setLoading(false) }
  }, [circleId, isGuest])
  useEffect(() => { void load(); return () => { ++version.current } }, [load])
  useEffect(() => { let active = true; void getCommunityTopics().then(page => { if (active) setTopics(page.items) }).catch(() => undefined); return () => { active = false } }, [])
  const actions = usePostActions(isGuest, go, locale, id => {
    setItems(previous => previous.map(post => post.id === id ? { ...post, commentCount: post.commentCount + 1 } : post))
    void load(true)
  }, current?.isOwner ? post => ({ label: current.pinnedPost?.id === post.id ? labels.unpin : labels.pin, run: () => void pin(post) }) : undefined)
  const pin = async (post: CommunityPost): Promise<void> => {
    if (!current || pinning) return
    setPinning(true)
    try { await pinCirclePost(current.id, current.pinnedPost?.id === post.id ? null : post.id); await load(true) } catch { actions.notify({ text: labels.failed, error: true }) } finally { setPinning(false) }
  }
  const rowActions: RowActions = { guest: isGuest, onLogin: actions.login, onReply: actions.onReply, onShare: actions.onShare, onMore: actions.onMore }
  const compose = useCallback(() => {
    if (isGuest) { go('login'); return }
    if (!current || left) return
    if (current.silenced) { actions.notify({ text: labels.silencedNote }); return }
    setComposing(true)
  }, [isGuest, go, current, left, labels.silencedNote, actions.notify])
  useEffect(() => claimFeatherCompose(compose), [compose])
  const more = async () => {
    if (!circleId || !cursor || paging.current || left) return
    paging.current = true; setMoreLoading(true); setMoreFailed(false)
    const request = version.current
    try {
      const page = await getCirclePosts(circleId, { cursor })
      if (request !== version.current) return
      setItems(previous => [...previous, ...page.items.filter(post => !previous.some(item => item.id === post.id))]); setCursor(page.nextCursor)
    } catch { if (request === version.current) setMoreFailed(true) }
    finally { if (request === version.current) { paging.current = false; setMoreLoading(false) } }
  }
  const sentinel = useInfinite(() => void more(), Boolean(cursor) && !loading && !moreLoading && !failed && !moreFailed && !left, cursor)
  const changed = (select?: string | null) => { if (select === null) go('community'); else void load(true) }
  const pinned = current?.pinnedPost
  const rows = items.filter(post => post.id !== pinned?.id)
  const postRow = (post: CommunityPost, index = 0) => <PostRow key={post.id} post={post} timeAgo={timeAgo} openPost={openPost} openProfile={openProfile} topics={topics} locale={locale} index={index} actions={rowActions} />
  return <MaisonPage page="community-circle" className={c.page}><div className={c.x}>
    <header className={c.subHead} data-glass-bar=""><button type="button" className={c.circleBtn} aria-label={labels.back} onClick={() => go('community')}><ArrowLeft size={20} aria-hidden="true" /></button><span className={c.subTitle}>{labels.circles}</span></header>
    {isGuest ? <XState title={labels.unavailable} action={<button type="button" className={c.pill} onClick={() => go('login')}>{labels.enter}</button>} /> : loading ? <SkeletonRows rows={3} /> : <>
      {current && <CircleHeader current={current} left={left} onChanged={changed} onNotify={text => actions.notify({ text })} onSearch={() => setSearch(true)} />}
      {failed ? <XState title={labels.failed} action={<button type="button" className={c.pill} onClick={() => void load(true)}>{labels.retry}</button>} /> : !current ? <XState title={labels.unavailable} /> : !left && <>
        {pinned && <><p className={s.announcement}><span>{labels.announcement}</span></p><ul className={c.feed}>{postRow(pinned)}</ul></>}
        {rows.length ? <ul className={c.feed}>{rows.map((post, index) => postRow(post, index))}</ul> : !pinned && <XState title={labels.emptyFeed} />}
        {cursor && !moreFailed && <div className={c.sentinel} ref={sentinel} aria-hidden="true" />}{moreLoading && <span className={c.spinner} role="status" aria-label={labels.more} />}
        {moreFailed && <button type="button" className={c.more} onClick={() => void more()}>{labels.failed} · {labels.retry}</button>}
      </>}
    </>}
    {/* The circle page has no dock, so it carries the feather itself: the same paper disc, bottom right. */}
    {current && !left && <><button type="button" className={s.feather} aria-label={labels.compose} data-muted={current.silenced || undefined} onClick={compose}><Feather size={22} strokeWidth={1.9} aria-hidden="true" /></button><CircleSearchSheet open={search} circle={current} onClose={() => setSearch(false)} openPost={openPost} />
      <CommunityCompose open={composing} onClose={() => setComposing(false)} target={{ kind: 'post', circleId: current.id }} me={me} topics={topics} circles={circles.filter(circle => !membership?.left.some(item => item.id === circle.id))} onPublished={() => { setComposing(false); void load(true) }} />
      <RewardDrawHost />
    </>}
    {actions.overlays(me)}
  </div></MaisonPage>
}

function CircleHeader({ current, left, onChanged, onNotify, onSearch }: { current: Circle; left: boolean; onChanged: (select?: string | null) => void; onNotify: (text: string) => void; onSearch: () => void }) {
  const k = useCircleCopy(), labels = useCircleStageCopy()
  const [naming, setNaming] = useState<null | 'rename'>(null)
  const [menu, setMenu] = useState(false)
  const [members, setMembers] = useState(false)
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null)
  const [sheet, setSheet] = useState<null | 'invite' | 'requests' | 'removed'>(null)
  const seen = useSeenCircles()
  const fresh = current && !current.isOwner && !left && seen.ready && !seen.ids.has(current.id)
  const pending = current?.isOwner ? current.pendingCount ?? 0 : 0
  const [busy, setBusy] = useState(false)

  const act = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await work() } catch { onNotify(k.failed) } finally { setBusy(false) }
  }

  // The circle's head (2026-11-01, Claude's pass over the first cut): one paper card — owner face, name, owner and size,
  // the two round keys, and the 6-digit ID as a pill that copies itself.
  const copyId = () => void navigator.clipboard.writeText(String(current.publicNo)).then(() => onNotify(labels.copied)).catch(() => onNotify(k.failed))
  return <section className={s.circleHeader}><div className={s.heroCard}>
    <div className={s.titleRow}><CommunityAvatar avatarUrl={current.owner.avatarUrl} seed={current.owner.avatarSeed} handle={current.owner.handle} size={48} />
      <div className={s.titleText}><h1 dir="auto">{current.name}</h1><small>{k.owner} <span dir="auto">{current.isOwner ? k.you : current.owner.displayName}</span> · {k.members(current.memberCount)}</small></div>
      <div className={s.headerKeys}>
      {!left && <button type="button" className={s.more} aria-label={labels.searchInside} onClick={onSearch}><Search size={20} aria-hidden="true" /></button>}
      {!left && <button type="button" className={s.more} aria-label={pending ? `${k.more} · ${k.requests(pending)}` : k.more} aria-haspopup="dialog" onClick={() => setMenu(true)}><MoreHorizontal size={20} aria-hidden="true" />{pending > 0 && <span className={s.badge}>{pending > 99 ? '99+' : pending}</span>}</button>}
    </div></div>
    <button type="button" className={s.idPill} aria-label={`${labels.copyId} ${current.publicNo}`} onClick={copyId}><span>ID</span><b>{current.publicNo}</b><Copy size={14} strokeWidth={1.9} aria-hidden="true" /></button>
  </div>
    {left && <div className={s.leftState}><p>{k.leftNote}</p><button type="button" className={`${c.pill} ${c.pillSolid}`} disabled={busy} onClick={() => void act(async () => { await rejoinCircle(current.id); onChanged(current.id) })}>{k.rejoin}</button></div>}
    {fresh && <p className={s.note} role="status"><span dir="auto">{k.joinedNote(current.owner.displayName)}</span>
      <button type="button" aria-label={k.dismiss} onClick={() => seen.add(current.id)}><X size={16} strokeWidth={2} aria-hidden="true" /></button></p>}

    <NameSheet open={naming !== null} title={k.rename} initial={current.name} busy={busy} onClose={() => setNaming(null)}
      onSave={(name) => void act(async () => {
        await renameCircle(current.id, name); onChanged(current.id)
        setNaming(null)
      })} />

    <Sheet open={menu && current !== null} onClose={() => setMenu(false)} title={current?.name ?? ''}>
      {current && <div className={s.options}>
        <label className={`${mp.switchRow} ${s.toggleRow}`}><input type="checkbox" role="switch" checked={current.muted} disabled={busy} onChange={event => { const value = event.target.checked; void act(async () => { await muteCircle(current.id, value); onChanged(current.id) }) }} /><span>{labels.muted}<small>{current.muted ? labels.on : labels.off}</small></span></label>
        {current.isOwner && <label className={`${mp.switchRow} ${s.toggleRow}`}><input type="checkbox" role="switch" checked={Boolean(current.searchable)} disabled={busy} onChange={event => { const value = event.target.checked; void act(async () => { await updateCircle(current.id, { searchable: value }); onChanged(current.id) }) }} /><span>{labels.searchable}<small>{current.searchable ? labels.on : labels.off}</small></span></label>}
        {current.isOwner && current.inviteCode && <button type="button" onClick={() => { setMenu(false); setSheet('invite') }}>{k.invite}</button>}
        {current.isOwner && <button type="button" onClick={() => { setMenu(false); setSheet('requests') }}>{k.requests(pending)}</button>}
        <button type="button" onClick={() => { setMenu(false); setMembers(true) }}>{k.viewMembers}</button>
        {current.isOwner && <button type="button" onClick={() => { setMenu(false); setSheet('removed') }}>{k.removed}</button>}
        {current.isOwner && <button type="button" onClick={() => { setMenu(false); setNaming('rename') }}>{k.rename}</button>}
        {current.isOwner
          ? <button type="button" data-danger="" onClick={() => { setMenu(false); setConfirm('delete') }}>{k.delete}</button>
          : <button type="button" data-danger="" onClick={() => { setMenu(false); setConfirm('leave') }}>{k.leave}</button>}
      </div>}
    </Sheet>

    <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'delete' ? k.deleteTitle : k.leaveTitle}>
      <div className={s.options}>
        <p className={s.confirmBody}>{confirm === 'delete' ? k.deleteBody : k.leaveBody}</p>
        <button type="button" data-danger="" disabled={busy} onClick={() => current && void act(async () => {
          if (confirm === 'delete') await deleteCircle(current.id); else await leaveCircle(current.id)
          setConfirm(null); onChanged(confirm === 'leave' ? current.id : null)
        })}>{confirm === 'delete' ? k.delete : k.leave}</button>
        <button type="button" onClick={() => setConfirm(null)}>{k.cancel}</button>
      </div>
    </Sheet>

    {current && <MembersSheet open={members} circle={current} onClose={() => setMembers(false)} onRemoved={() => onChanged(current.id)} onNotify={onNotify} />}
    {current?.isOwner && <InviteSheet open={sheet === 'invite'} circle={current} onClose={() => setSheet(null)} onChanged={() => onChanged(current.id)} onNotify={onNotify} />}
    {current?.isOwner && <PeopleSheet open={sheet === 'requests' || sheet === 'removed'} kind={sheet === 'removed' ? 'removed' : 'requests'} circle={current} onClose={() => setSheet(null)} onChanged={() => onChanged(current.id)} onNotify={onNotify} />}
  </section>
}
