'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery } from '@/lib/api/_query'
import { claimReferralRewards, referralInvitees, referralSummary } from '@/lib/api/referral'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fromAtomic } from '@/lib/money'
import { openPath } from '@/lib/maison-nav'
import { showToast } from '@/lib/toast-store'
import { porcelainAvatar } from '@/components/community-avatar'
import { sparkBurst } from './Tilt3D'
import styles from './home-v2.module.css'

type Copy = { label: string; claimable: string; earned: string; startTitle: string; startBody: string; invited: string; invitedEarned: string; allClaimed: string; invite: string; claim: string; claiming: string; claimed: string; failed: string; nothing: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { label: 'Invite friends', claimable: 'Claimable', earned: 'Earned in total', startTitle: 'Invite friends, invest together', startBody: 'When they invest, your rewards go straight to your available balance', invited: '{n} invited', invitedEarned: '{n} invited · {v} earned in total', allClaimed: '{n} invited · all rewards claimed', invite: 'Invite friends', claim: 'Claim', claiming: 'Claiming…', claimed: '{v} USDT added to your balance', failed: 'Couldn’t claim. Try again.', nothing: 'Nothing to claim yet — invite a friend and rewards land here' },
  'zh-CN': { label: '邀请好友', claimable: '可领取', earned: '累计已赚', startTitle: '邀请好友，一起投资', startBody: '好友投资后，奖励直接进你的可用余额', invited: '已邀请 {n} 人', invitedEarned: '已邀请 {n} 人 · 累计已赚 {v}', allClaimed: '已邀请 {n} 人 · 奖励已全部领取', invite: '邀请好友', claim: '领取', claiming: '领取中…', claimed: '{v} USDT 已到可用余额', failed: '领取失败，请再试一次', nothing: '还没有可领取的奖励，邀请好友后就会有' },
}

/** The invite card on home: faces of the people you invited (empty wells until there are some), one number, invite + claim. */
export function HomeReferral() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en
  const summary = useQuery('referral:summary', referralSummary, { staleTime: 60_000 })
  const data = summary.data
  const direct = data?.levels.find(level => level.level === 1)?.count ?? 0
  const invitees = useQuery(direct > 0 ? 'referral:invitees:1' : null, () => referralInvitees(1, '1'), { staleTime: 300_000 })
  const [busy, setBusy] = useState(false)
  if (!data || !data.payoutsEnabled) return null
  const units = (atomic: string) => { try { return Number(fromAtomic(atomic, data.decimals)) } catch { return 0 } }
  const fmt = (n: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const claimable = units(data.balances.available), earned = units(data.balances.total)
  const people = invitees.data?.items ?? []
  const open = () => openPath('/profile/referral')
  const add = <button type="button" className={styles.add} onClick={open} aria-label={c.invite}><Plus size={18} strokeWidth={2} aria-hidden="true" /></button>
  const faces = direct > 0
    ? <>{people.slice(0, 4).map((person, i) => <img key={`${person.memberLabel}-${i}`} src={porcelainAvatar(person.memberLabel)} alt="" width={40} height={40} />)}
        {direct > 4 && <span className={styles.more}>+{direct - 4}</span>}</>
    : <><span className={styles.slot} /><span className={styles.slot} /><span className={styles.slot} /></>
  const claim = async () => {
    if (busy) return
    setBusy(true)
    const result = await claimReferralRewards(crypto.randomUUID())
    setBusy(false)
    if (result.ok) { navigator.vibrate?.(10); showToast(c.claimed.replace('{v}', fmt(claimable)), 'ok'); void summary.refetch() } else showToast(c.failed, 'error')
  }
  const sub = direct === 0 && earned <= 0 ? c.startBody
    : claimable > 0 ? c.invitedEarned.replace('{n}', String(direct)).replace('{v}', fmt(earned)) : earned > 0 ? c.allClaimed.replace('{n}', String(direct)) : c.invited.replace('{n}', String(direct))
  // A member card: the reward is the headline, a porcelain gift sits in its case, the people you invited below.
  // A warm photo across the top carries the reward in glass; the people you invited and the buttons sit below on paper.
  return <section className={styles.invite} aria-label={c.label}>
    <div className={styles.invPhoto}>
      <img src="/media/home/cards/invite-720.webp" alt="" width={720} height={450} decoding="async" />
      <span className={styles.invLabel}>{c.label}</span>
      {claimable > 0 ? <div className={styles.invNum}><small>{c.claimable}</small><b dir="ltr">{fmt(claimable)}<span>USDT</span></b></div>
        : earned > 0 ? <div className={styles.invNum}><small>{c.earned}</small><b dir="ltr">{fmt(earned)}<span>USDT</span></b></div>
        : <p className={styles.invTitle}>{c.startTitle}</p>}
    </div>
    <div className={styles.invPeople}>
      <div className={styles.faces}>{faces}{claimable <= 0 && add}</div>
      <p className={styles.invSub}>{sub}</p>
    </div>
    <div className={styles.invActs}>
      <button type="button" className={styles.cta} onClick={event => { sparkBurst(event); open() }}><span>{c.invite}</span><i aria-hidden="true">→</i></button>
      {/* Claim stays put, so the row never changes shape; with nothing to claim it says how rewards come. */}
      <button type="button" className={styles.ghost} onClick={event => { if (claimable > 0) { sparkBurst(event); void claim() } else showToast(c.nothing, 'info') }} disabled={busy} aria-busy={busy} data-empty={claimable > 0 ? undefined : ''}>{busy ? c.claiming : c.claim}</button>
    </div>
  </section>
}
