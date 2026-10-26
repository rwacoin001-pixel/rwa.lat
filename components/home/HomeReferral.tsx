'use client'

import { useState } from 'react'
import { useQuery } from '@/lib/api/_query'
import { claimReferralRewards, referralSummary } from '@/lib/api/referral'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fromAtomic } from '@/lib/money'
import { openPath } from '@/lib/maison-nav'
import { showToast } from '@/lib/toast-store'
import styles from './home-v2.module.css'

type Copy = { claimable: string; claim: string; claiming: string; claimed: string; failed: string; invite: string; inviteGo: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { claimable: 'Referral rewards · claimable', claim: 'Claim', claiming: 'Claiming…', claimed: '{v} USDT added to your balance', failed: 'Couldn’t claim. Try again.', invite: 'Invite friends, start together', inviteGo: 'Invite ›' },
  'zh-CN': { claimable: '推荐奖励 · 可领取', claim: '领取', claiming: '领取中…', claimed: '{v} USDT 已到可用余额', failed: '领取失败，请再试一次', invite: '邀请好友，一起开始', inviteGo: '邀请 ›' },
}

/** Referral on home: a card with the amount and "Claim" when there is something to claim, otherwise one quiet row. */
export function HomeReferral() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en
  const summary = useQuery('referral:summary', referralSummary, { staleTime: 60_000 })
  const [busy, setBusy] = useState(false)
  const data = summary.data
  if (!data || !data.payoutsEnabled) return null
  let claimable = 0
  try { claimable = Number(fromAtomic(data.balances.available, data.decimals)) } catch { /* treat as nothing to claim */ }
  const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(claimable)
  const claim = async () => {
    if (busy) return
    setBusy(true)
    const result = await claimReferralRewards(crypto.randomUUID())
    setBusy(false)
    if (result.ok) { showToast(c.claimed.replace('{v}', amount), 'ok'); void summary.refetch() } else showToast(c.failed, 'error')
  }
  if (claimable > 0) return <section className={styles.refCard}>
    <button type="button" className={styles.refMain} onClick={() => openPath('/profile/referral')}>
      <small>{c.claimable}</small><b dir="ltr">{amount} USDT</b>
    </button>
    <button type="button" className={styles.pill} onClick={() => void claim()} disabled={busy} aria-busy={busy}>{busy ? c.claiming : c.claim}</button>
  </section>
  return <button type="button" className={styles.refRow} onClick={() => openPath('/profile/referral')}><span>{c.invite}</span><span>{c.inviteGo}</span></button>
}
