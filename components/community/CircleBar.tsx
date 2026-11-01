'use client'

/**
 * Own circles on the community "Circle" tab (2026-11-01, user). One row of circle names (mine first, then the circles I
 * am in through whoever invited me), the chosen circle's head (name, owner, member count, one "…" key), and the sheets:
 * found / rename, members (with how many invites away each one is), and the confirm for leave / delete.
 * With no circle at all, a short paper card explains it and offers to found one. Type only, no icons in tiles.
 * Joining and leaving (2026-11-01, user): the owner shares an invite link (copy, share, QR, reset) and approves requests;
 * a removal can be undone from the removed list; a circle I joined through my inviter shows a one-time note.
 */
import { MoreHorizontal, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { Sheet } from '@/components/maison/Sheet'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { CIRCLE_NAME_MAX, circleInviteUrl, createCircle, decideCircleRequest, deleteCircle, getCircleMembers, getCircleRequests, getRemovedCircleMembers, leaveCircle, rejoinCircle, removeCircleMember, renameCircle, resetCircleInvite, restoreCircleMember, validCircleName, type Circle, type CircleMemberRow, type CircleMembership, type CirclePersonRow } from '@/lib/community-circles'
import c from '../community-x.module.css'
import s from './circles.module.css'

type Copy = {
  mine: string; found: string; introTitle: string; introBody: string; owner: string; members: (n: number) => string; name: string
  namePlaceholder: string; nameHint: string; save: string; rename: string; viewMembers: string; remove: string; leave: string
  delete: string; leaveTitle: string; leaveBody: string; deleteTitle: string; deleteBody: string; cancel: string; depth: (n: number) => string
  you: string; foundTitle: string; failed: string; more: string; empty: string; rejoin: string; leftNote: string
  invite: string; inviteBody: string; copy: string; copied: string; share: string; reset: string; resetDone: string; qr: string
  requests: (n: number) => string; requestsEmpty: string; approve: string; reject: string; removed: string; removedEmpty: string
  restore: string; viaLink: string; joinedNote: (owner: string) => string; dismiss: string
}
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    mine: '我的', found: '建立圈子', introTitle: '建立你的圈子', introBody: '你邀请的人，不管隔了几层，都会自动加入。圈子里的帖子，只有圈子里的人能看到。',
    owner: '圈主', members: (n) => `${n} 人`, name: '圈子名字', namePlaceholder: '给圈子起个名字', nameHint: `2–${CIRCLE_NAME_MAX} 个字`, save: '保存',
    rename: '修改名字', viewMembers: '圈子成员', remove: '移出', leave: '退出圈子', delete: '删除圈子', leaveTitle: '退出这个圈子？',
    leaveBody: '退出后你看不到这里的帖子，也不能在这里发帖。你发过的帖子会保留。', deleteTitle: '删除你的圈子？',
    deleteBody: '圈子里的帖子会一起隐藏，成员也看不到了。', cancel: '取消', depth: (n) => n <= 1 ? '你邀请的' : `第 ${n} 层`, you: '你',
    foundTitle: '建立圈子', failed: '没有成功，请稍后再试。', more: '更多', empty: '还没有成员。邀请朋友，他们会自动加入。', rejoin: '重新加入', leftNote: '你已退出这个圈子',
    invite: '邀请朋友', inviteBody: '朋友打开链接后申请加入，你同意后他就能进圈。你邀请注册的人会自动进圈，不用这个链接。', copy: '复制链接', copied: '链接已复制',
    share: '分享', reset: '重置链接', resetDone: '旧链接已失效', qr: '圈子邀请二维码', requests: (n) => n > 0 ? `待审核（${n}）` : '待审核', requestsEmpty: '没有新的申请。',
    approve: '同意', reject: '拒绝', removed: '已移出', removedEmpty: '没有被移出的人。', restore: '撤回', viaLink: '链接加入',
    joinedNote: (owner) => `${owner} 在你的邀请链上，所以你自动加入了这个圈子。`, dismiss: '知道了',
  },
  en: {
    mine: 'Mine', found: 'Start a circle', introTitle: 'Start your circle', introBody: 'Everyone you invite joins it automatically, however far down the invites go. Posts in a circle are seen only by its members.',
    owner: 'Owner', members: (n) => `${n} ${n === 1 ? 'member' : 'members'}`, name: 'Circle name', namePlaceholder: 'Name your circle', nameHint: `2–${CIRCLE_NAME_MAX} characters`, save: 'Save',
    rename: 'Rename', viewMembers: 'Members', remove: 'Remove', leave: 'Leave circle', delete: 'Delete circle', leaveTitle: 'Leave this circle?',
    leaveBody: 'You will no longer see or post here. Your past posts stay.', deleteTitle: 'Delete your circle?',
    deleteBody: 'Its posts are hidden too, and members can no longer see them.', cancel: 'Cancel', depth: (n) => n <= 1 ? 'You invited' : `${n} invites away`, you: 'You',
    foundTitle: 'Start a circle', failed: 'That did not work. Please try again.', more: 'More', empty: 'No members yet. Invite friends and they join automatically.', rejoin: 'Rejoin', leftNote: 'You left this circle',
    invite: 'Invite friends', inviteBody: 'Friends open the link and ask to join; they are in once you approve. People you invited to A-REIT join on their own.', copy: 'Copy link', copied: 'Link copied',
    share: 'Share', reset: 'Reset link', resetDone: 'The old link no longer works', qr: 'Circle invite QR code', requests: (n) => n > 0 ? `Requests (${n})` : 'Requests', requestsEmpty: 'No new requests.',
    approve: 'Approve', reject: 'Decline', removed: 'Removed', removedEmpty: 'Nobody has been removed.', restore: 'Undo', viaLink: 'Joined by link',
    joinedNote: (owner) => `${owner} is in your invite chain, so you joined this circle automatically.`, dismiss: 'Got it',
  },
}

export function useCircleCopy() {
  const { locale } = useI18n()
  return copy[locale] ?? copy.en!
}

export function CircleBar({ membership, selected, onSelect, onChanged, onNotify }: {
  membership: CircleMembership
  selected: string | null
  onSelect: (id: string) => void
  /** Reload membership; `select` picks a circle afterwards (a new one), null when the chosen one is gone. */
  onChanged: (select?: string | null) => void
  onNotify: (text: string) => void
}) {
  const k = useCircleCopy()
  const circles = [...(membership.owned ? [membership.owned] : []), ...membership.joined, ...membership.left]
  const leftIds = new Set(membership.left.map((circle) => circle.id))
  const current = circles.find((circle) => circle.id === selected) ?? circles[0] ?? null
  const [naming, setNaming] = useState<null | 'found' | 'rename'>(null)
  const [menu, setMenu] = useState(false)
  const [members, setMembers] = useState(false)
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null)
  const [sheet, setSheet] = useState<null | 'invite' | 'requests' | 'removed'>(null)
  const seen = useSeenCircles()
  const fresh = current && !current.isOwner && !leftIds.has(current.id) && seen.ready && !seen.ids.has(current.id)
  const pending = current?.isOwner ? current.pendingCount ?? 0 : 0
  const [busy, setBusy] = useState(false)

  const act = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await work() } catch { onNotify(k.failed) } finally { setBusy(false) }
  }

  return <section className={s.bar} aria-label={k.viewMembers}>
    {circles.length > 0 && <div className={s.names} role="group">
      {circles.map((circle) => <button key={circle.id} type="button" className={c.chip} data-left={leftIds.has(circle.id) || undefined} aria-pressed={circle.id === current?.id} onClick={() => onSelect(circle.id)}>
        {circle.name}{circle.isOwner && <small className={s.mine}>{k.mine}</small>}
      </button>)}
      {!membership.owned && <button type="button" className={`${c.chip} ${s.found}`} onClick={() => setNaming('found')}>+ {k.found}</button>}
    </div>}

    {current ? <div className={s.head}>
      <div className={s.headText}>
        <b dir="auto">{current.name}</b>
        <small>{leftIds.has(current.id) ? k.leftNote : <>{k.owner} <span dir="auto">{current.isOwner ? k.you : current.owner.displayName}</span> · {k.members(current.memberCount)}</>}</small>
      </div>
      {leftIds.has(current.id)
        ? <button type="button" className={`${c.pill} ${c.pillSolid}`} disabled={busy} onClick={() => void act(async () => { await rejoinCircle(current.id); onChanged(current.id) })}>{k.rejoin}</button>
        : <button type="button" className={s.more} aria-label={pending ? `${k.more} · ${k.requests(pending)}` : k.more} aria-haspopup="dialog" onClick={() => setMenu(true)}><MoreHorizontal size={18} strokeWidth={1.9} aria-hidden="true" />{pending > 0 && <span className={s.badge} aria-hidden="true">{pending > 99 ? '99+' : pending}</span>}</button>}
    </div> : <div className={s.intro}>
      <b>{k.introTitle}</b>
      <p>{k.introBody}</p>
      <button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => setNaming('found')}>{k.found}</button>
    </div>}
    {fresh && <p className={s.note} role="status"><span dir="auto">{k.joinedNote(current.owner.displayName)}</span>
      <button type="button" aria-label={k.dismiss} onClick={() => seen.add(current.id)}><X size={16} strokeWidth={2} aria-hidden="true" /></button></p>}

    <NameSheet open={naming !== null} title={naming === 'rename' ? k.rename : k.foundTitle} initial={naming === 'rename' ? current?.name ?? '' : ''} busy={busy} onClose={() => setNaming(null)}
      onSave={(name) => void act(async () => {
        if (naming === 'rename' && current) { await renameCircle(current.id, name); onChanged(current.id) }
        else { const made = await createCircle(name); onChanged(made.id) }
        setNaming(null)
      })} />

    <Sheet open={menu && current !== null} onClose={() => setMenu(false)} title={current?.name ?? ''}>
      {current && <div className={s.options}>
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

function NameSheet({ open, title, initial, busy, onClose, onSave }: { open: boolean; title: string; initial: string; busy: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const k = useCircleCopy()
  const [name, setName] = useState(initial)
  useEffect(() => { if (open) setName(initial) }, [open, initial])
  const ok = validCircleName(name)
  return <Sheet open={open} onClose={onClose} title={title} busy={busy}>
    <form className={s.nameForm} onSubmit={(event) => { event.preventDefault(); if (ok) onSave(name.trim()) }}>
      <label className={s.field}>
        <span className={s.srOnly}>{k.name}</span>
        <input value={name} maxLength={CIRCLE_NAME_MAX} placeholder={k.namePlaceholder} dir="auto" autoFocus enterKeyHint="done" onChange={(event) => setName(event.target.value)} />
        <small aria-hidden="true">{name.trim().length}/{CIRCLE_NAME_MAX}</small>
      </label>
      <p className={s.hint}>{k.nameHint}</p>
      <button type="submit" className={`${c.pill} ${c.pillSolid} ${s.save}`} disabled={!ok || busy}>{k.save}</button>
    </form>
  </Sheet>
}

function MembersSheet({ open, circle, onClose, onRemoved, onNotify }: { open: boolean; circle: Circle; onClose: () => void; onRemoved: () => void; onNotify: (text: string) => void }) {
  const k = useCircleCopy()
  const [rows, setRows] = useState<CircleMemberRow[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setRows(null)
    getCircleMembers(circle.id).then((page) => { setRows(page.items); setCursor(page.nextCursor) }).catch(() => { setRows([]); onNotify(k.failed) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, circle.id])
  const more = () => { if (cursor) void getCircleMembers(circle.id, cursor).then((page) => { setRows((previous) => [...(previous ?? []), ...page.items]); setCursor(page.nextCursor) }).catch(() => onNotify(k.failed)) }
  const remove = (row: CircleMemberRow) => void removeCircleMember(circle.id, row.profile.id)
    .then(() => { setRows((previous) => previous?.filter((item) => item.profile.id !== row.profile.id) ?? null); onRemoved() })
    .catch(() => onNotify(k.failed))
  return <Sheet open={open} onClose={onClose} title={k.viewMembers} kicker={circle.name}>
    {rows === null ? <p className={s.confirmBody}>…</p> : rows.length === 0 ? <p className={s.confirmBody}>{k.empty}</p> : <ul className={s.memberList}>
      {rows.map((row) => <li key={row.profile.id}>
        <CommunityAvatar avatarUrl={row.profile.avatarUrl} seed={row.profile.avatarSeed} handle={row.profile.handle} size={40} />
        <span><b dir="auto">{row.profile.displayName}</b><small>{row.via === 'link' ? k.viaLink : k.depth(row.depth)}</small></span>
        {circle.isOwner && <button type="button" className={c.pill} onClick={() => remove(row)}>{k.remove}</button>}
      </li>)}
    </ul>}
    {cursor && <button type="button" className={`${c.pill} ${s.loadMore}`} onClick={more}>{k.more}</button>}
  </Sheet>
}

/** Circles whose "you joined automatically" note was put away (this device). */
const SEEN_KEY = 'rwa.circles.seen'
function useSeenCircles() {
  const [ids, setIds] = useState<Set<string> | null>(null)
  useEffect(() => { try { setIds(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])) } catch { setIds(new Set()) } }, [])
  const add = (id: string) => setIds((previous) => {
    const next = new Set(previous ?? []); next.add(id)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-100))) } catch { /* Shows again next time. */ }
    return next
  })
  return { ready: ids !== null, ids: ids ?? new Set<string>(), add }
}

function InviteSheet({ open, circle, onClose, onChanged, onNotify }: { open: boolean; circle: Circle; onClose: () => void; onChanged: () => void; onNotify: (text: string) => void }) {
  const k = useCircleCopy()
  const [busy, setBusy] = useState(false)
  const link = circle.inviteCode ? circleInviteUrl(circle.inviteCode) : ''
  const copyLink = async () => { try { await navigator.clipboard.writeText(link); onNotify(k.copied) } catch { onNotify(k.failed) } }
  const share = async () => {
    if (typeof navigator.share !== 'function') return void copyLink()
    try { await navigator.share({ title: circle.name, url: link }) } catch { /* Closed by the user. */ }
  }
  const reset = async () => {
    if (busy) return
    setBusy(true)
    try { await resetCircleInvite(circle.id); onChanged(); onNotify(k.resetDone) } catch { onNotify(k.failed) } finally { setBusy(false) }
  }
  return <Sheet open={open} onClose={onClose} title={k.invite} kicker={circle.name} busy={busy}>
    <div className={s.invite}>
      <p className={s.confirmBody}>{k.inviteBody}</p>
      {link && <div className={s.qr}><QRCodeSVG value={link} size={168} marginSize={2} level="M" bgColor="#ffffff" fgColor="#0b1220" title={k.qr} /></div>}
      <p className={s.link} dir="ltr">{link}</p>
      <div className={s.inviteKeys}>
        <button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => void share()}>{k.share}</button>
        <button type="button" className={c.pill} onClick={() => void copyLink()}>{k.copy}</button>
      </div>
      <button type="button" className={s.textKey} disabled={busy} onClick={() => void reset()}>{k.reset}</button>
    </div>
  </Sheet>
}

/** The owner's two people lists: pending requests (approve / decline) and removed members (undo). */
function PeopleSheet({ open, kind, circle, onClose, onChanged, onNotify }: { open: boolean; kind: 'requests' | 'removed'; circle: Circle; onClose: () => void; onChanged: () => void; onNotify: (text: string) => void }) {
  const k = useCircleCopy()
  const [rows, setRows] = useState<CirclePersonRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setRows(null)
    ;(kind === 'requests' ? getCircleRequests(circle.id) : getRemovedCircleMembers(circle.id)).then(setRows).catch(() => { setRows([]); onNotify(k.failed) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, circle.id])
  const act = async (row: CirclePersonRow, work: () => Promise<void>) => {
    if (busy) return
    setBusy(row.profile.id)
    try { await work(); setRows((previous) => previous?.filter((item) => item.profile.id !== row.profile.id) ?? null); onChanged() } catch { onNotify(k.failed) } finally { setBusy(null) }
  }
  return <Sheet open={open} onClose={onClose} title={kind === 'requests' ? k.requests(0) : k.removed} kicker={circle.name}>
    {rows === null ? <p className={s.confirmBody}>…</p> : rows.length === 0 ? <p className={s.confirmBody}>{kind === 'requests' ? k.requestsEmpty : k.removedEmpty}</p> : <ul className={s.memberList}>
      {rows.map((row) => <li key={row.profile.id}>
        <CommunityAvatar avatarUrl={row.profile.avatarUrl} seed={row.profile.avatarSeed} handle={row.profile.handle} size={40} />
        <span><b dir="auto">{row.profile.displayName}</b><small dir="auto">@{row.profile.handle}</small></span>
        {kind === 'requests' ? <>
          <button type="button" className={c.pill} disabled={busy !== null} onClick={() => void act(row, () => decideCircleRequest(circle.id, row.profile.id, false))}>{k.reject}</button>
          <button type="button" className={`${c.pill} ${c.pillSolid}`} disabled={busy !== null} onClick={() => void act(row, () => decideCircleRequest(circle.id, row.profile.id, true))}>{k.approve}</button>
        </> : <button type="button" className={c.pill} disabled={busy !== null} onClick={() => void act(row, () => restoreCircleMember(circle.id, row.profile.id))}>{k.restore}</button>}
      </li>)}
    </ul>}
  </Sheet>
}
