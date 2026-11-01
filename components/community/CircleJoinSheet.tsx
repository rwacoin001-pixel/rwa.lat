'use client'

/**
 * A circle's invite link (2026-11-01, user): /c/<code> lands on Community with ?join=<code>, and this sheet shows the
 * circle (name, owner, size) with one main key that follows where the reader stands: ask to join, waiting for the owner,
 * open the circle. Signed-out readers sign in first and come back here. The shared short pill with a round arrow.
 */
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { Sheet } from '@/components/maison/Sheet'
import controls from '@/components/ui/controls.module.css'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { applyToCircle, getCircleInvite, type CircleInvite } from '@/lib/community-circles'
import s from './circles.module.css'

type Copy = {
  title: string; owner: string; members: (n: number) => string; body: string; apply: string; signIn: string; pending: string
  pendingBody: string; open: string; removed: string; rejected: string; gone: string; goneBody: string; failed: string; close: string
}
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    title: '圈子邀请', owner: '圈主', members: (n) => `${n} 人`, body: '圈子里的帖子只有成员能看到。申请后，圈主同意你就能进圈。',
    apply: '申请加入', signIn: '登录后申请', pending: '已申请', pendingBody: '已发出申请，圈主同意后会通知你。', open: '进入圈子',
    removed: '圈主已把你移出这个圈子，暂时不能加入。', rejected: '上次申请没有通过，可以再申请一次。', gone: '链接已失效',
    goneBody: '这个圈子可能已经删除，或者圈主换了新链接。', failed: '没有成功，请稍后再试。', close: '关闭',
  },
  en: {
    title: 'Circle invite', owner: 'Owner', members: (n) => `${n} ${n === 1 ? 'member' : 'members'}`, body: 'Posts in a circle are seen only by its members. Ask to join; you are in once the owner approves.',
    apply: 'Ask to join', signIn: 'Sign in to ask', pending: 'Requested', pendingBody: 'Request sent. We will let you know when the owner approves.', open: 'Open circle',
    removed: 'The owner removed you from this circle, so you cannot join for now.', rejected: 'Your last request was declined. You can ask again.', gone: 'Link no longer works',
    goneBody: 'The circle may have been deleted, or the owner made a new link.', failed: 'That did not work. Please try again.', close: 'Close',
  },
}

export function CircleJoinSheet({ code, isGuest, onClose, onOpen, onNotify }: {
  code: string | null
  isGuest: boolean
  onClose: () => void
  /** Open the circle on the circle tab (the reader is a member now). */
  onOpen: (circleId: string) => void
  onNotify: (text: string) => void
}) {
  const { locale } = useI18n()
  const k = copy[locale] ?? copy.en!
  const [invite, setInvite] = useState<CircleInvite | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!code) return
    setInvite(undefined)
    getCircleInvite(code).then(setInvite).catch(() => setInvite(null))
  }, [code, isGuest])

  const apply = async () => {
    if (!code || !invite || busy) return
    if (isGuest) { window.location.assign(`/login?returnTo=${encodeURIComponent(`/community?join=${code}`)}`); return }
    setBusy(true)
    try {
      const status = await applyToCircle(code)
      if (status === 'member' || status === 'owner') { onOpen(invite.circle.id); return }
      setInvite({ ...invite, status })
    } catch (error) {
      if (error instanceof Error && error.message === 'CIRCLE_REMOVED') setInvite({ ...invite, status: 'removed' })
      else onNotify(k.failed)
    } finally { setBusy(false) }
  }

  const status = invite?.status
  const inside = status === 'member' || status === 'owner'
  const label = isGuest ? k.signIn : inside ? k.open : status === 'pending' ? k.pending : k.apply
  const note = status === 'pending' ? k.pendingBody : status === 'rejected' ? k.rejected : status === 'removed' ? k.removed : k.body

  return <Sheet open={code !== null} onClose={onClose} title={invite === null ? k.gone : k.title} busy={busy}>
    {invite === undefined ? <p className={s.confirmBody}>…</p> : invite === null ? <div className={s.join}>
      <p className={s.confirmBody}>{k.goneBody}</p>
      <button type="button" className={s.textKey} onClick={onClose}>{k.close}</button>
    </div> : <div className={s.join}>
      <CommunityAvatar avatarUrl={invite.circle.owner.avatarUrl} seed={invite.circle.owner.avatarSeed} handle={invite.circle.owner.handle} size={64} />
      <b className={s.joinName} dir="auto">{invite.circle.name}</b>
      <small className={s.joinMeta}>{k.owner} <span dir="auto">{invite.circle.owner.displayName}</span> · {k.members(invite.circle.memberCount)}</small>
      <p className={s.joinNote}>{note}</p>
      {status !== 'removed' && <button type="button" className={`${controls.primary} ${s.joinKey}`} disabled={busy || (!isGuest && status === 'pending')}
        onClick={() => inside ? onOpen(invite.circle.id) : void apply()}>
        <span>{label}</span>{(isGuest || status !== 'pending') && <i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} strokeWidth={1.7} /></i>}
      </button>}
    </div>}
  </Sheet>
}
