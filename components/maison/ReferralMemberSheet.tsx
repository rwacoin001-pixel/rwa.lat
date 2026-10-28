'use client'

/**
 * One invited member (2026-10-29, user: tapping someone in my team should show when they joined, what they deposited
 * and bought, and what that earned me — the reward already reveals it, so nothing here is private beyond that).
 * Figures come from GET /v1/referral/invitees/:memberLabel. Until that endpoint is live, the sheet shows what the team
 * list and the reward records already say, and says the rest is on its way.
 */
import type { RefObject } from 'react'
import { useQuery } from '@/lib/api/_query'
import { referralAwards, type ReferralMember } from '@/lib/api/referral'
import { referralInvitee } from '@/lib/api/referral-member'
import { porcelainAvatar } from '@/components/community-avatar'
import { ReferralSheet, type SheetTheme } from './ReferralSheet'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'
import { Skeleton } from './primitives'
import v from './invite-centre.module.css'

type Translate = (cn: string, en: string) => string

export function MemberSheet({ member, theme, inertRef, locale, t, onClose }: { member: ReferralMember; theme: SheetTheme; inertRef: RefObject<HTMLElement | null>; locale: string; t: Translate; onClose: () => void }) {
  const detail = useQuery(`referral:v2:member:${member.memberLabel}`, () => referralInvitee(member.memberLabel), { staleTime: 30_000, loading: 'silent' })
  // Fallback while the detail endpoint is not deployed: this member's rewards from the first page of records.
  const awards = useQuery(detail.error || (detail.data && !detail.data.rewardsToMe) ? 'referral:v2:awards:1' : null, () => referralAwards(1), { staleTime: 30_000, loading: 'silent' })
  // Only a complete reply counts (an old API or a proxy may answer with an empty object).
  const d = detail.data && detail.data.rewardsToMe && detail.data.purchases && detail.data.deposits ? detail.data : undefined
  const failed = Boolean(detail.error) || (detail.data !== undefined && !d)
  const money = (atomic: string | undefined) => fmtAtomic(atomic, d?.decimals ?? 6, '', 2).trim()
  const label = `${t('用户', 'Member')} ${member.memberLabel.slice(0, 6).toUpperCase()}`
  const fallbackReward = (awards.data?.items ?? []).filter(row => row.memberLabel === member.memberLabel)
    .reduce((sum, row) => sum + (/^\d+$/.test(row.amountAtomic) ? BigInt(row.amountAtomic) : BigInt(0)), BigInt(0))

  return <ReferralSheet title={t('好友详情', 'Member details')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={inertRef} onClose={onClose}>
    <div className={v.member}>
      <header className={v.memberHead}>
        <img src={porcelainAvatar(member.memberLabel)} alt="" width={56} height={56} aria-hidden="true" />
        <div><b dir="ltr">{label}</b><small>{t(`第 ${d?.level ?? member.level} 级 · ${fmtDate(d?.boundAt ?? member.boundAt, locale)} 绑定`, `Level ${d?.level ?? member.level} · linked ${fmtDate(d?.boundAt ?? member.boundAt, locale)}`)}</small></div>
      </header>
      {!d && !failed ? <Skeleton rows={4} /> : <>
        <div className={v.memberReward}>
          <small>{t('为你带来的奖励', 'Earned you')}</small>
          <p dir="ltr"><span>{d ? money(d.rewardsToMe.totalAtomic) : fmtAtomic(fallbackReward.toString(), 6, '', 2).trim()}</span><small>USDT</small></p>
          {d && <span>{t(`可领取 ${money(d.rewardsToMe.earnedAtomic)} · 已领取 ${money(d.rewardsToMe.claimedAtomic)}`, `${money(d.rewardsToMe.earnedAtomic)} claimable · ${money(d.rewardsToMe.claimedAtomic)} claimed`)}</span>}
        </div>
        <dl className={v.memberRows}>
          <div><dt>{t('注册时间', 'Signed up')}</dt><dd>{d ? fmtDateTime(d.registeredAt, locale) : fmtDate(member.boundAt, locale)}</dd></div>
          {d ? <>
            <div><dt>{t('累计充值', 'Deposits')}</dt><dd dir="ltr">{money(d.deposits.totalAtomic)} USDT<small>{t(`${d.deposits.count} 笔`, `${d.deposits.count}`)}</small></dd></div>
            <div><dt>{t('累计购买', 'Purchases')}</dt><dd dir="ltr">{money(d.purchases.totalAtomic)} USDT<small>{t(`${d.purchases.count} 笔`, `${d.purchases.count}`)}</small></dd></div>
            <div><dt>{t('考拉量化', 'Koala Quant')}</dt><dd dir="ltr">{money(d.purchases.quantAtomic)}</dd></div>
            <div><dt>{t('预测', 'Predictions')}</dt><dd dir="ltr">{money(d.purchases.predictionAtomic)}</dd></div>
            <div><dt>{t('RWA 产品', 'RWA products')}</dt><dd dir="ltr">{money(d.purchases.rwaAtomic)}</dd></div>
            {d.purchases.lastAt && <div><dt>{t('最近购买', 'Last purchase')}</dt><dd>{fmtDateTime(d.purchases.lastAt, locale)}</dd></div>}
          </> : <p className={v.hint}>{t('充值和购买明细正在接入，很快会显示在这里。', 'Deposit and purchase details are on their way.')}</p>}
        </dl>
      </>}
    </div>
  </ReferralSheet>
}
