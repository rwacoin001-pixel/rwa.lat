'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@/lib/api/_query'
import { Check, Copy, ImagePlus } from 'lucide-react'
import { claimReferralRewards, referralAwards, referralInvitees, referralMe, referralSummary } from '@/lib/api/referral'
import { inviteLinkFor } from '@/lib/referral-invite'
import { MASK, useBalancesHidden } from '@/lib/hide-balance'
import { CommunityAvatar } from '@/components/community-avatar'
import { useCommunityMe } from '@/components/community-compose'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fromAtomic } from '@/lib/money'
import { openPath } from '@/lib/maison-nav'
import { showToast } from '@/lib/toast-store'
import { porcelainAvatar } from '@/components/community-avatar'
import { sparkBurst } from './Tilt3D'
import r from './home-invite.module.css'

type Copy = { inviteShort: string; copy: string; copied: string; copyFailed: string; poster: string; rules: string; latest: string; all: string; kindFee: string; kindPurchase: string; member: string; noneYet: string; label: string; claimable: string; earned: string; startTitle: string; startBody: string; invited: string; invitedEarned: string; allClaimed: string; invite: string; claim: string; claiming: string; claimed: string; failed: string; nothing: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { inviteShort: 'Invite', copy: 'Copy invite link', copied: 'Link copied', copyFailed: 'Could not copy the link', poster: 'Make a poster', rules: 'How invites work', latest: 'Latest reward', all: 'View all', kindFee: 'Fee rebate', kindPurchase: 'Purchase reward', member: 'Member', noneYet: 'Rewards from friends will show here', label: 'Invite friends', claimable: 'Claimable', earned: 'Earned in total', startTitle: 'Invite friends, invest together', startBody: 'When they invest, your rewards go straight to your available balance', invited: '{n} invited', invitedEarned: '{n} invited · {v} earned in total', allClaimed: '{n} invited · all rewards claimed', invite: 'Invite friends', claim: 'Claim', claiming: 'Claiming…', claimed: '{v} USDT added to your balance', failed: 'Couldn’t claim. Try again.', nothing: 'Nothing to claim yet — invite a friend and rewards land here' },
  'zh-CN': { inviteShort: '邀请', copy: '复制邀请链接', copied: '链接已复制', copyFailed: '复制失败，请再试一次', poster: '生成海报', rules: '邀请规则', latest: '最近奖励', all: '查看全部', kindFee: '手续费返佣', kindPurchase: '买入奖励', member: '用户', noneYet: '好友带来的奖励会出现在这里', label: '邀请好友', claimable: '可领取', earned: '累计已赚', startTitle: '邀请好友，一起投资', startBody: '好友投资后，奖励直接进你的可用余额', invited: '已邀请 {n} 人', invitedEarned: '已邀请 {n} 人 · 累计已赚 {v}', allClaimed: '已邀请 {n} 人 · 奖励已全部领取', invite: '邀请好友', claim: '领取', claiming: '领取中…', claimed: '{v} USDT 已到可用余额', failed: '领取失败，请再试一次', nothing: '还没有可领取的奖励，邀请好友后就会有' },
}

/** The invite card on home: faces of the people you invited (empty wells until there are some), one number, invite + claim. */
export function HomeReferral() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en
  const summary = useQuery('referral:summary', referralSummary, { staleTime: 60_000 })
  const data = summary.data
  const direct = data?.levels.find(level => level.level === 1)?.count ?? 0
  const invitees = useQuery(direct > 0 ? 'referral:invitees:1' : null, () => referralInvitees(1, '1'), { staleTime: 300_000 })
  const awards = useQuery(data ? 'referral:awards:1' : null, () => referralAwards(1), { staleTime: 120_000 })
  const [busy, setBusy] = useState(false)
  const me = useCommunityMe(false)
  const code = useQuery('referral:v2:me', referralMe, { staleTime: 300_000 }).data?.code
  const [copied, setCopied] = useState(false)
  const hideMoney = useBalancesHidden() !== false
  // Claim (2026-10-28): one idempotency key per claim attempt, kept across retries; the key folds into a ring while the
  // server works, shows a check once it confirms, and the receipt names the amount the server actually moved.
  const claimKey = useRef<string | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const copyLink = async () => {
    if (!code) return
    try { await navigator.clipboard.writeText(inviteLinkFor('/invite', code).replace(/\?next=.*$/, '')); setCopied(true); navigator.vibrate?.(8); window.setTimeout(() => setCopied(false), 1200) }
    catch { showToast(c.copyFailed, 'error') }
  }
  if (!data || !data.payoutsEnabled) return null
  const units = (atomic: string, decimals = data.decimals) => { try { return Number(fromAtomic(atomic, decimals)) } catch { return 0 } }
  const fmt = (n: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const claimable = units(data.balances.available), earned = units(data.balances.total)
  const people = invitees.data?.items ?? []
  const open = () => openPath('/community?tab=invite')
  const latest = awards.data?.items[0] ?? null
  // Five seats: the people you invited (newest first), grey seats for the ones still to come, "+N" when there are more.
  const seats = Array.from({ length: 5 }, (_, i) => i === 4 && direct > 5 ? { more: direct - 4 } : people[i] ? { person: people[i] } : { empty: i })
  const claim = async () => {
    if (busy) return
    setBusy(true)
    claimKey.current ??= crypto.randomUUID()
    const result = await claimReferralRewards(claimKey.current)
    setBusy(false)
    if (result.ok) {
      claimKey.current = null
      navigator.vibrate?.(10)
      setReceipt(c.claimed.replace('{v}', fmt(units(result.data.amountAtomic, result.data.decimals))))
      window.setTimeout(() => setReceipt(null), 4200)
      void summary.refetch(); void awards.refetch()
    } else showToast(c.failed, 'error')
  }
  const figure = claimable > 0 ? { label: c.claimable, value: claimable } : earned > 0 ? { label: c.earned, value: earned } : null
  // Invite card (2026-10-28, after the user's wallet reference): a soft grey panel with a pill label and the reward
  // large in the middle; five round faces sit across its lower edge (grey seats until friends join); the latest reward
  // as one row; round rules key, porcelain claim, ink invite.
  return <section className={r.card} aria-label={c.label}>
    <div className={r.panel}>
      <div className={r.top}>
        <span className={r.who}>{me ? <CommunityAvatar avatarUrl={me.avatarUrl} seed={me.avatarSeed} handle={me.handle || 'me'} size={24} /> : null}<b dir="auto">{me?.displayName || c.label}</b></span>
        <button type="button" className={r.info} aria-label={c.rules} onClick={() => openPath('/community?tab=invite')}>i</button>
      </div>
      <span className={r.pill}>{figure ? figure.label : c.startTitle}</span>
      {figure ? <b className={r.figure} dir="ltr">{hideMoney ? MASK : fmt(figure.value)}<small>USDT</small></b> : <p className={r.lead}>{c.startBody}</p>}
    </div>
    <div className={r.faces}>
      {seats.map((seat, i) => 'person' in seat && seat.person
        ? <span key={i} className={r.face} data-tone={i % 5}><img src={porcelainAvatar(seat.person.memberLabel)} alt="" width={56} height={56} /></span>
        : 'more' in seat ? <span key={i} className={r.more} data-tone={i % 5}>+{seat.more}</span>
        : <button key={i} type="button" className={r.seat} onClick={open} aria-label={c.invite}><img src={porcelainAvatar(`seat-${i}`)} alt="" width={56} height={56} /></button>)}
    </div>
    <div className={r.last}>
      <div className={r.lastHead}><span>{c.latest}</span><button type="button" onClick={open}>{c.all}</button></div>
      {latest
        ? <div className={r.lastRow}>
          <img src={porcelainAvatar(latest.memberLabel)} alt="" width={44} height={44} />
          <span><b>{latest.kind === 'fee' ? c.kindFee : c.kindPurchase}</b><small>{c.member} {latest.memberLabel.slice(0, 6).toUpperCase()} · {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(latest.occurredAt))}</small></span>
          <b className={r.amount} dir="ltr">+{fmt(units(latest.amountAtomic, latest.decimals))}</b>
        </div>
        : <p className={r.none}>{direct > 0 ? c.invited.replace('{n}', String(direct)) : c.noneYet}</p>}
    </div>
    <div className={r.acts}>
      <button type="button" className={r.round} aria-label={copied ? c.copied : c.copy} data-done={copied || undefined} onClick={() => void copyLink()}>{copied ? <Check size={20} strokeWidth={2} aria-hidden="true" /> : <Copy size={20} strokeWidth={1.8} aria-hidden="true" />}</button>
      <button type="button" className={r.round} aria-label={c.poster} onClick={open}><ImagePlus size={20} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" className={r.claim} onClick={() => { if (claimable > 0) void claim(); else showToast(c.nothing, 'info') }} disabled={busy} aria-busy={busy} aria-label={busy ? c.claiming : undefined} data-state={busy ? 'busy' : receipt ? 'done' : undefined} data-empty={claimable > 0 || receipt ? undefined : ''}>
        {busy ? <i className={r.ring} aria-hidden="true" /> : receipt ? <Check size={20} strokeWidth={2.4} aria-hidden="true" /> : <>{c.claim}<i aria-hidden="true">↓</i></>}</button>
      <button type="button" className={r.invite} onClick={event => { sparkBurst(event); open() }}>{c.inviteShort}<i aria-hidden="true">↑</i></button>
    </div>
    {receipt && <p className={r.receipt} role="status"><Check size={14} strokeWidth={2.4} aria-hidden="true" />{receipt}</p>}
  </section>
}
