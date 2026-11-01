'use client'

/**
 * `/profile/rewards` — coupons and points (stage 3, 2026-11-01; v2 tickets 2026-11-02). From top: today's ticket (print it, or
 * the printed ticket), the odds, points with the exchange row, my coupons as small tickets, points history, the rules line. Every figure comes from /v1/rewards; 404 means not live → back to the profile.
 */
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { fmtAtomic, fmtDate } from '@/components/maison/format'
import { MaisonPage } from '@/components/maison/primitives'
import { useI18n } from '@/lib/i18n'
import { backOr, openPath } from '@/lib/maison-nav'
import { Sheet } from '@/components/maison/Sheet'
import { useQuery } from '@/lib/api/_query'
import { exchangePoints, getPointsHistory, getRewardWallet, rewardOddsQuery, type PointsRow, type RewardWallet } from '@/lib/rewards'
import { MiniTicket } from './MiniTicket'
import { PrintedTicket } from './PrintedTicket'
import { TicketPrinter } from './TicketPrinter'
import { useRewardsCopy } from './rewards-copy'
import s from './rewards.module.css'

export function RewardsScreen() {
  const k = useRewardsCopy()
  const { locale } = useI18n()
  const [wallet, setWallet] = useState<RewardWallet | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'exchange' | null>(null)
  const [printing, setPrinting] = useState(false)
  const [oddsOpen, setOddsOpen] = useState(false)
  const odds = useQuery(oddsOpen ? 'rewards:odds' : null, rewardOddsQuery, { staleTime: 300_000, loading: 'silent' })
  const [flash, setFlash] = useState<string | null>(null)
  const [rows, setRows] = useState<PointsRow[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const load = useCallback(() => {
    setFailed(false)
    void getRewardWallet().then(data => { setWallet(data); if (data === null) backOr('/profile') }).catch(() => setFailed(true))
    void getPointsHistory().then(data => { setRows(data.rows); setCursor(data.nextCursor) }).catch(() => setRows([]))
  }, [])
  useEffect(load, [load])

  const exchange = async () => {
    if (busy) return
    setBusy('exchange'); setFlash(null)
    try { await exchangePoints(); setFlash(k.exchanged); load() } catch (error) {
      setFlash(error instanceof Error && error.message === 'REWARD_EXCHANGE_LIMIT' ? k.exchangeLimit : k.loadFailed)
    } finally { setBusy(null) }
  }

  const topbar = <RwaTopbar screen="rewards" title={k.title} onBack={() => backOr('/profile')} />
  const today = wallet?.today
  const per = wallet?.exchange.pointsPerCoupon ?? 100
  const short = wallet ? Math.max(0, per - wallet.points) : 0
  const pct = (w: number, all: number) => `${(w / all * 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
  return <MaisonPage page="rewards" topbar={topbar}>
    <div className={s.page}>
      <header className={s.hero}><p>{k.kicker}</p><h1>{k.title}</h1></header>
      {failed ? <p className={s.flash} role="alert">{k.loadFailed} <button type="button" className={s.textKey} onClick={load}>{k.retry}</button></p>
        : wallet === undefined ? <div className={s.paper} aria-hidden="true"><div className={s.ghost} /><div className={s.ghost} /></div>
        : wallet && <>
          <section className={s.section}>
            <h2 className={s.label}>{k.today}</h2>
            {today?.draw ? <PrintedTicket draw={today.draw} />
              : <div className={s.printCard}>
                <span><b>{k.reasons[today?.reason ?? 'no_card_today']}</b><small>{k.front}</small></span>
                {today?.eligible ? <button type="button" className={s.lightKey} onClick={() => setPrinting(true)}>{k.print}<ArrowRight size={16} aria-hidden="true" /></button>
                  : today?.reason === 'no_card_today' && <button type="button" className={s.lightKey} onClick={() => openPath('/community?sort=cards')}>{k.goPost}<ArrowRight size={16} aria-hidden="true" /></button>}
              </div>}
            <button type="button" className={s.oddsRow} onClick={() => setOddsOpen(true)}><span>{k.odds}</span><ChevronRight size={16} aria-hidden="true" /></button>
          </section>

          <section className={s.section}>
            <h2 className={s.label}>{k.points}</h2>
            <div className={s.paper}>
              <div className={s.pointsHead}><span>{k.pointsAvailable}</span><b>{wallet.points.toLocaleString(locale)}</b></div>
              <div className={s.exchange}>
                <span><b>{k.exchangeTitle(per)}</b><small>{wallet.exchange.canExchange ? fmtAtomic(wallet.exchange.maxDiscountAtomic, 6, 'USDT') : short > 0 ? k.pointsLow(short) : k.exchangeLimit}</small></span>
                <button type="button" className={s.inkKey} disabled={!wallet.exchange.canExchange || busy !== null} onClick={() => void exchange()}>{k.exchange}</button>
              </div>
            </div>
            {flash && <p className={s.flash} role="status">{flash}</p>}
          </section>

          <section className={s.section}>
            <h2 className={s.label}>{k.coupons}{wallet.coupons.length > 0 && <span>{wallet.coupons.filter(c => c.state === 'available').length}</span>}</h2>
            {wallet.coupons.length === 0 ? <div className={s.paper}><p className={s.empty}>{k.noCoupons}</p></div>
              : <ul className={s.tickets}>{wallet.coupons.map(coupon => <MiniTicket key={coupon.id} coupon={coupon} />)}</ul>}
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
    <TicketPrinter open={printing} onClose={() => { setPrinting(false); load() }} onDrawn={(draw) => setWallet(w => w ? { ...w, today: { ...w.today, eligible: false, reason: 'drawn', draw } } : w)} />
    <Sheet open={oddsOpen} onClose={() => setOddsOpen(false)} title={k.odds}>
      <div className={s.odds}>
        <p>{k.oddsNote}</p>
        {odds.data ? <>
          <h3>{k.oddsVoucher}</h3>
          <ul>{odds.data.vouchers.map(v => <li key={v.faceAtomic}><span>{fmtAtomic(v.faceAtomic, 6, 'USDT', 0)}</span><small>{v.dailyCap ? k.perDay(v.dailyCap) : ''}</small><b>{pct(v.weight, odds.data!.vouchers.reduce((n, x) => n + x.weight, 0))}</b></li>)}</ul>
          <h3>{k.oddsPoints}</h3>
          <ul>{odds.data.points.map(p => <li key={p.points}><span>{p.points} {k.pointsUnit}</span><small /><b>{pct(p.weight, odds.data!.points.reduce((n, x) => n + x.weight, 0))}</b></li>)}</ul>
        </> : odds.error ? <p>{k.loadFailed}</p> : <div className={s.ghost} aria-hidden="true" />}
      </div>
    </Sheet>
  </MaisonPage>
}
