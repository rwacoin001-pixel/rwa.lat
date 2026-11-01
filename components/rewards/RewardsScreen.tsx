'use client'

/**
 * `/profile/rewards` — coupons and points (stage 3, 2026-11-01). From top: today's ticket, points with the exchange row,
 * my coupons, points history, the rules line. Every figure comes from /v1/rewards; 404 means not live → back to the profile.
 */
import { ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { fmtAtomic, fmtDate } from '@/components/maison/format'
import { MaisonPage } from '@/components/maison/primitives'
import { useI18n } from '@/lib/i18n'
import { backOr, openPath } from '@/lib/maison-nav'
import { drawToday, exchangePoints, getPointsHistory, getRewardWallet, type Coupon, type PointsRow, type RewardWallet } from '@/lib/rewards'
import { DrawTicket } from './DrawTicket'
import { useRewardsCopy } from './rewards-copy'
import s from './rewards.module.css'

export function RewardsScreen() {
  const k = useRewardsCopy()
  const { locale } = useI18n()
  const [wallet, setWallet] = useState<RewardWallet | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'draw' | 'exchange' | null>(null)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [rows, setRows] = useState<PointsRow[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const load = useCallback(() => {
    setFailed(false)
    void getRewardWallet().then(data => { setWallet(data); if (data === null) backOr('/profile') }).catch(() => setFailed(true))
    void getPointsHistory().then(data => { setRows(data.rows); setCursor(data.nextCursor) }).catch(() => setRows([]))
  }, [])
  useEffect(load, [load])

  const flip = async () => {
    if (busy) return
    setBusy('draw'); setDrawError(null)
    try { const draw = await drawToday(); setWallet(w => w ? { ...w, today: { ...w.today, eligible: false, reason: 'drawn', draw } } : w); load() } catch { setDrawError(k.drawFailed) } finally { setBusy(null) }
  }
  const exchange = async () => {
    if (busy) return
    setBusy('exchange'); setFlash(null)
    try { await exchangePoints(); setFlash(k.exchanged); load() } catch (error) {
      setFlash(error instanceof Error && error.message === 'REWARD_EXCHANGE_LIMIT' ? k.exchangeLimit : k.loadFailed)
    } finally { setBusy(null) }
  }

  const topbar = <RwaTopbar screen="rewards" title={k.title} onBack={() => backOr('/profile')} />
  const today = wallet?.today
  const showTicket = today && (today.eligible || today.draw)
  const per = wallet?.exchange.pointsPerCoupon ?? 100
  const short = wallet ? Math.max(0, per - wallet.points) : 0
  const couponLine = (coupon: Coupon) => {
    const date = fmtDate(coupon.state === 'used' ? coupon.usedAt : coupon.expiresAt, locale)
    return coupon.state === 'used' ? k.usedOn(date) : coupon.state === 'expired' ? k.expiredOn(date) : coupon.state === 'frozen' ? k.frozenNote : k.validUntil(date)
  }
  return <MaisonPage page="rewards" topbar={topbar}>
    <div className={s.page}>
      <header className={s.hero}><p>{k.kicker}</p><h1>{k.title}</h1></header>
      {failed ? <p className={s.flash} role="alert">{k.loadFailed} <button type="button" className={s.textKey} onClick={load}>{k.retry}</button></p>
        : wallet === undefined ? <div className={s.paper} aria-hidden="true"><div className={s.ghost} /><div className={s.ghost} /></div>
        : wallet && <>
          <section className={s.section}>
            <h2 className={s.label}>{k.today}</h2>
            {showTicket ? <DrawTicket draw={today.draw} busy={busy === 'draw'} error={drawError} onFlip={today.eligible ? () => void flip() : undefined} />
              : <div className={s.paper}><div className={`${s.exchange} ${s.solo}`}>
                <span><b>{k.reasons[today?.reason ?? 'no_card_today']}</b><small>{k.front}</small></span>
                {today?.reason === 'no_card_today' && <button type="button" className={s.inkKey} onClick={() => openPath('/community?sort=cards')}>{k.goPost}<ArrowRight size={16} aria-hidden="true" /></button>}
              </div></div>}
          </section>

          <section className={s.section}>
            <h2 className={s.label}>{k.points}</h2>
            <div className={s.paper}>
              <div className={s.pointsHead}><span>{k.pointsAvailable}</span><b>{wallet.points.toLocaleString(locale)}</b></div>
              <div className={s.exchange}>
                <span><b>{k.exchangeTitle(per)}</b><small>{wallet.exchange.canExchange ? `${k.upTo} ${fmtAtomic(wallet.exchange.maxDiscountAtomic, 6, 'USDT')}` : short > 0 ? k.pointsLow(short) : k.exchangeLimit}</small></span>
                <button type="button" className={s.inkKey} disabled={!wallet.exchange.canExchange || busy !== null} onClick={() => void exchange()}>{k.exchange}</button>
              </div>
            </div>
            {flash && <p className={s.flash} role="status">{flash}</p>}
          </section>

          <section className={s.section}>
            <h2 className={s.label}>{k.coupons}{wallet.coupons.length > 0 && <span>{wallet.coupons.filter(c => c.state === 'available').length}</span>}</h2>
            <div className={s.paper}>{wallet.coupons.length === 0 ? <p className={s.empty}>{k.noCoupons}</p> : <ul className={s.list}>{wallet.coupons.map(coupon => {
              const dim = coupon.state !== 'available' && coupon.state !== 'locked'
              return <li key={coupon.id} className={s.coupon} data-dim={dim || undefined}>
                <span><b>{k.kinds[coupon.kind]}</b><small>{couponLine(coupon)}</small></span>
                {coupon.kind === 'withdrawal_fee' ? <span className={s.amount}>{k.freeOnce}</span> : <span className={s.amount}>{fmtAtomic(coupon.maxDiscountAtomic, coupon.assetDecimals, coupon.assetCode)}</span>}
                <span className={s.tag} data-ready={coupon.state === 'available' || undefined}>{k.states[coupon.state]}</span>
              </li>
            })}</ul>}</div>
          </section>

          <section className={s.section}>
            <h2 className={s.label}>{k.history}</h2>
            <div className={s.paper}>{rows === null ? <div className={s.ghost} aria-hidden="true" /> : rows.length === 0 ? <p className={s.empty}>{k.noHistory}</p> : <ul className={s.list}>{rows.map(row => <li key={row.id} className={s.history}>
              <span>{k.reasonsRow[row.reason]}<small>{fmtDate(row.createdAt, locale)}</small></span><b data-up={row.delta > 0 || undefined}>{row.delta > 0 ? `+${row.delta}` : row.delta}</b>
            </li>)}</ul>}</div>
            {cursor && <button type="button" className={s.textKey} onClick={() => void getPointsHistory(cursor).then(data => { setRows(r => [...(r ?? []), ...data.rows]); setCursor(data.nextCursor) })}>{k.more}</button>}
          </section>

          <p className={s.rules}>{k.rules}</p>
        </>}
    </div>
  </MaisonPage>
}
