'use client'

/**
 * The daily reward ticket (stage 3, 2026-11-01). Same family as the result card: a soft band head, a perforation, a grey
 * well. Front = "tap to flip"; back = the prize the server picked. Type only, no confetti or sparkles (docs/design-system.md §6).
 */
import { fmtAtomic, fmtDate } from '@/components/maison/format'
import { useI18n } from '@/lib/i18n'
import type { Coupon, Draw } from '@/lib/rewards'
import { useRewardsCopy } from './rewards-copy'
import s from './rewards.module.css'

export function CouponFace({ coupon }: { coupon: Coupon }) {
  const k = useRewardsCopy()
  const money = fmtAtomic(coupon.maxDiscountAtomic, coupon.assetDecimals, '').trim()
  return <>
    <span className={s.kicker}>{k.kinds[coupon.kind]}</span>
    {coupon.kind === 'withdrawal_fee'
      ? <b className={s.figureSm}>{k.freeOnce}</b>
      : <b className={s.figure}><small>{k.upTo}</small>{money}<small>{coupon.assetCode}</small></b>}
  </>
}

export function DrawTicket({ draw, busy, error, onFlip, reason }: { draw: Draw | null; busy: boolean; error: string | null; onFlip?: () => void; reason?: string }) {
  const k = useRewardsCopy()
  const { locale } = useI18n()
  const flipped = Boolean(draw)
  const prize = draw?.prize
  return <div className={s.ticket} data-flipped={flipped || undefined}>
    <div className={s.inner}>
      <button type="button" className={`${s.face} ${s.front}`} disabled={busy || !onFlip || flipped} aria-hidden={flipped || undefined} tabIndex={flipped ? -1 : undefined} onClick={onFlip}>
        <span className={s.head}><span>{k.today}</span><em>{busy ? k.flipping : k.tapToFlip}</em></span>
        <i className={s.perf} aria-hidden="true" />
        <span className={s.well}>
          <b className={s.frontTitle}>{k.tapToFlip}</b>
          <span className={s.note}>{error ?? reason ?? k.front}</span>
        </span>
      </button>
      <div className={`${s.face} ${s.back}`} aria-hidden={!flipped || undefined} aria-live="polite">
        <span className={s.head}><span>{k.today}</span>{draw && <em>{draw.state === 'frozen' ? k.states.frozen : fmtDate(draw.createdAt, locale)}</em>}</span>
        <i className={s.perf} aria-hidden="true" />
        <span className={s.well}>
          {prize?.kind === 'points' && <><span className={s.kicker}>{k.points}</span><b className={s.figure}>{k.plusPoints(prize.points)}<small>{k.pointsUnit}</small></b></>}
          {prize?.kind === 'coupon' && <><CouponFace coupon={prize.coupon} /><span className={s.note}>{k.validUntil(fmtDate(prize.coupon.expiresAt, locale))}</span></>}
          {draw?.state === 'frozen' && <span className={s.note}>{k.frozenNote}</span>}
        </span>
      </div>
    </div>
  </div>
}
