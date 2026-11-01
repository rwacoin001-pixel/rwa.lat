'use client'

/**
 * Own circles on the community "Circle" tab (2026-11-01, user). One row of circle names (mine first, then the circles I
 * am in through whoever invited me), the chosen circle's head (name, owner, member count, one "…" key), and the sheets:
 * found / rename, members (with how many invites away each one is), and the confirm for leave / delete.
 * With no circle at all, a short paper card explains it and offers to found one. Type only, no icons in tiles.
 */
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { Sheet } from '@/components/maison/Sheet'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { CIRCLE_NAME_MAX, createCircle, deleteCircle, getCircleMembers, leaveCircle, removeCircleMember, renameCircle, validCircleName, type Circle, type CircleMemberRow, type CircleMembership } from '@/lib/community-circles'
import c from '../community-x.module.css'
import s from './circles.module.css'

type Copy = {
  mine: string; found: string; introTitle: string; introBody: string; owner: string; members: (n: number) => string; name: string
  namePlaceholder: string; nameHint: string; save: string; rename: string; viewMembers: string; remove: string; leave: string
  delete: string; leaveTitle: string; leaveBody: string; deleteTitle: string; deleteBody: string; cancel: string; depth: (n: number) => string
  you: string; foundTitle: string; failed: string; more: string; empty: string
}
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    mine: '我的', found: '建立圈子', introTitle: '建立你的圈子', introBody: '你邀请的人，不管隔了几层，都会自动加入。圈子里的帖子，只有圈子里的人能看到。',
    owner: '圈主', members: (n) => `${n} 人`, name: '圈子名字', namePlaceholder: '给圈子起个名字', nameHint: `2–${CIRCLE_NAME_MAX} 个字`, save: '保存',
    rename: '修改名字', viewMembers: '圈子成员', remove: '移出', leave: '退出圈子', delete: '删除圈子', leaveTitle: '退出这个圈子？',
    leaveBody: '退出后你看不到这里的帖子，也不能在这里发帖。以后可以重新加入。', deleteTitle: '删除你的圈子？',
    deleteBody: '圈子里的帖子会一起隐藏，成员也看不到了。', cancel: '取消', depth: (n) => n <= 1 ? '你邀请的' : `第 ${n} 层`, you: '你',
    foundTitle: '建立圈子', failed: '没有成功，请稍后再试。', more: '更多', empty: '还没有成员。邀请朋友，他们会自动加入。',
  },
  en: {
    mine: 'Mine', found: 'Start a circle', introTitle: 'Start your circle', introBody: 'Everyone you invite joins it automatically, however far down the invites go. Posts in a circle are seen only by its members.',
    owner: 'Owner', members: (n) => `${n} ${n === 1 ? 'member' : 'members'}`, name: 'Circle name', namePlaceholder: 'Name your circle', nameHint: `2–${CIRCLE_NAME_MAX} characters`, save: 'Save',
    rename: 'Rename', viewMembers: 'Members', remove: 'Remove', leave: 'Leave circle', delete: 'Delete circle', leaveTitle: 'Leave this circle?',
    leaveBody: 'You will no longer see or post here. You can join again later.', deleteTitle: 'Delete your circle?',
    deleteBody: 'Its posts are hidden too, and members can no longer see them.', cancel: 'Cancel', depth: (n) => n <= 1 ? 'You invited' : `${n} invites away`, you: 'You',
    foundTitle: 'Start a circle', failed: 'That did not work. Please try again.', more: 'More', empty: 'No members yet. Invite friends and they join automatically.',
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
  const circles = [...(membership.owned ? [membership.owned] : []), ...membership.joined]
  const current = circles.find((circle) => circle.id === selected) ?? circles[0] ?? null
  const [naming, setNaming] = useState<null | 'found' | 'rename'>(null)
  const [menu, setMenu] = useState(false)
  const [members, setMembers] = useState(false)
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null)
  const [busy, setBusy] = useState(false)

  const act = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await work() } catch { onNotify(k.failed) } finally { setBusy(false) }
  }

  return <section className={s.bar} aria-label={k.viewMembers}>
    {circles.length > 0 && <div className={s.names} role="group">
      {circles.map((circle) => <button key={circle.id} type="button" className={c.chip} aria-pressed={circle.id === current?.id} onClick={() => onSelect(circle.id)}>
        {circle.name}{circle.isOwner && <small className={s.mine}>{k.mine}</small>}
      </button>)}
      {!membership.owned && <button type="button" className={`${c.chip} ${s.found}`} onClick={() => setNaming('found')}>+ {k.found}</button>}
    </div>}

    {current ? <div className={s.head}>
      <div className={s.headText}>
        <b dir="auto">{current.name}</b>
        <small>{current.isOwner ? k.you : current.owner.displayName} · {k.owner} · {k.members(current.memberCount)}</small>
      </div>
      <button type="button" className={s.more} aria-label={k.more} aria-haspopup="dialog" onClick={() => setMenu(true)}><MoreHorizontal size={18} strokeWidth={1.9} aria-hidden="true" /></button>
    </div> : <div className={s.intro}>
      <b>{k.introTitle}</b>
      <p>{k.introBody}</p>
      <button type="button" className={`${c.pill} ${c.pillSolid}`} onClick={() => setNaming('found')}>{k.found}</button>
    </div>}

    <NameSheet open={naming !== null} title={naming === 'rename' ? k.rename : k.foundTitle} initial={naming === 'rename' ? current?.name ?? '' : ''} busy={busy} onClose={() => setNaming(null)}
      onSave={(name) => void act(async () => {
        if (naming === 'rename' && current) { await renameCircle(current.id, name); onChanged(current.id) }
        else { const made = await createCircle(name); onChanged(made.id) }
        setNaming(null)
      })} />

    <Sheet open={menu && current !== null} onClose={() => setMenu(false)} title={current?.name ?? ''}>
      {current && <div className={s.options}>
        <button type="button" onClick={() => { setMenu(false); setMembers(true) }}>{k.viewMembers}</button>
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
          setConfirm(null); onChanged(null)
        })}>{confirm === 'delete' ? k.delete : k.leave}</button>
        <button type="button" onClick={() => setConfirm(null)}>{k.cancel}</button>
      </div>
    </Sheet>

    {current && <MembersSheet open={members} circle={current} onClose={() => setMembers(false)} onRemoved={() => onChanged(current.id)} onNotify={onNotify} />}
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
        <span><b dir="auto">{row.profile.displayName}</b><small>{k.depth(row.depth)}</small></span>
        {circle.isOwner && <button type="button" className={c.pill} onClick={() => remove(row)}>{k.remove}</button>}
      </li>)}
    </ul>}
    {cursor && <button type="button" className={`${c.pill} ${s.loadMore}`} onClick={more}>{k.more}</button>}
  </Sheet>
}
