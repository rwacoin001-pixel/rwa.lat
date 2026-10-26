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
import styles from './home-v2.module.css'

type Copy = { label: string; tag: string; claimable: string; earned: string; startTitle: string; startBody: string; invited: string; invitedEarned: string; allClaimed: string; invite: string; claim: string; claiming: string; claimed: string; failed: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { label: 'Invite friends', tag: 'Rewards', claimable: 'Claimable', earned: 'Earned in total', startTitle: 'Invite friends, invest together', startBody: 'When they invest, your rewards go straight to your available balance', invited: '{n} invited', invitedEarned: '{n} invited · {v} earned in total', allClaimed: '{n} invited · all rewards claimed', invite: 'Invite friends', claim: 'Claim', claiming: 'Claiming…', claimed: '{v} USDT added to your balance', failed: 'Couldn’t claim. Try again.' },
  'zh-CN': { label: '邀请好友', tag: '奖励', claimable: '可领取', earned: '累计已赚', startTitle: '邀请好友，一起投资', startBody: '好友投资后，奖励直接进你的可用余额', invited: '已邀请 {n} 人', invitedEarned: '已邀请 {n} 人 · 累计已赚 {v}', allClaimed: '已邀请 {n} 人 · 奖励已全部领取', invite: '邀请好友', claim: '领取', claiming: '领取中…', claimed: '{v} USDT 已到可用余额', failed: '领取失败，请再试一次' },
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
  return <section className={styles.invite} aria-label={c.label}>
    <div className={styles.invTop}><span>{c.label}</span><span className={styles.invTag}>{c.tag}</span></div>
    <div className={styles.invRow}>
      <div className={styles.faces}>{faces}{claimable <= 0 && add}</div>
      {claimable > 0 ? <div className={styles.invNum}><small>{c.claimable}</small><b dir="ltr">{fmt(claimable)}<span>USDT</span></b></div>
        : earned > 0 ? <div className={styles.invNum}><small>{c.earned}</small><b dir="ltr">{fmt(earned)}<span>USDT</span></b></div> : null}
    </div>
    {direct === 0 && earned <= 0 ? <div><p className={styles.invTitle}>{c.startTitle}</p><p className={styles.invSub}>{c.startBody}</p></div>
      : <p className={styles.invSub}>{claimable > 0 ? c.invitedEarned.replace('{n}', String(direct)).replace('{v}', fmt(earned)) : earned > 0 ? c.allClaimed.replace('{n}', String(direct)) : c.invited.replace('{n}', String(direct))}</p>}
    <div className={styles.invActs}>
      <button type="button" className={styles.cta} onClick={open}><span>{c.invite}</span><i aria-hidden="true">→</i></button>
      {claimable > 0 && <button type="button" className={styles.ghost} onClick={() => void claim()} disabled={busy} aria-busy={busy}>{busy ? c.claiming : c.claim}</button>}
    </div>
  </section>
}
