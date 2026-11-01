'use client'

/** A coupon as a small ticket (wallet rows, 2026-11-02): art stub on the left, notched tear line, then the face. */
import { fmtAtomic, fmtDate } from '@/components/maison/format'
import { useI18n } from '@/lib/i18n'
import type { Coupon } from '@/lib/rewards'
import { TicketArt } from './PrintedTicket'
import { useRewardsCopy } from './rewards-copy'
import t from './ticket.module.css'

const tierFor = (coupon: Coupon) => {
  if (coupon.kind !== 'prediction_stake') return 'fee' as const
  const face = Number(coupon.maxDiscountAtomic) / 10 ** coupon.assetDecimals
  return face >= 100 ? 'legend' as const : face >= 20 ? 'epic' as const : face >= 5 ? 'rare' as const : 'common' as const
}

export function MiniTicket({ coupon }: { coupon: Coupon }) {
  const k = useRewardsCopy()
  const { locale } = useI18n()
  const dim = coupon.state !== 'available' && coupon.state !== 'locked'
  const when = coupon.state === 'used' ? coupon.usedAt : coupon.expiresAt
  const date = when ? new Date(when).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' }) : fmtDate(when, locale)
  const line = coupon.state === 'used' ? k.usedOn(date) : coupon.state === 'expired' ? k.expiredOn(date) : coupon.state === 'frozen' ? k.frozenNote : k.validUntil(date)
  const money = fmtAtomic(coupon.maxDiscountAtomic, coupon.assetDecimals, '', coupon.kind === 'prediction_stake' ? 0 : 2).trim()
  return <li className={t.mini} data-dim={dim || undefined}>
    <TicketArt tier={tierFor(coupon)} compact />
    <i className={t.miniCut} aria-hidden="true" />
    <div className={t.miniBody}>
      <span>
        <small>{k.kinds[coupon.kind]}{coupon.kind === 'prediction_place_fee' ? ` · ${k.upTo}` : ''}</small>
        {coupon.kind === 'withdrawal_fee' ? <b style={{ fontSize: 17, lineHeight: '24px' }}>{k.freeOnce}</b>
          : <b>{money}<i>{coupon.assetCode}</i></b>}
        <em>{line}</em>
      </span>
      <span className={t.chip} data-ready={coupon.state === 'available' || undefined}>{k.states[coupon.state]}</span>
    </div>
  </li>
}
