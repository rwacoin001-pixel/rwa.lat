'use client'

/**
 * `/rewards/print` — the ticket printer page (v2, 2026-11-02; after the user's receipt-printer reference; a page with its
 * own entry buttons instead of a popup after posting, at the user's request). A dark printer body with a slot; slide to
 * print → the receipt header peeks out while the server draws → the ticket feeds out line by line with a light haptic per
 * step → the art band shines (more for rarer tiers) and the numbers count up → slide to keep, the ticket tears off and drops
 * into the wallet. Without a card today the page offers to post one and comes back here after publishing.
 */
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import controls from '@/components/ui/controls.module.css'
import { invalidate } from '@/lib/api/_query'
import { backOr, openPath } from '@/lib/maison-nav'
import { drawToday, getRewardToday, type Draw, type RewardToday } from '@/lib/rewards'
import { MiniTicket } from './MiniTicket'
import { PrintedTicket } from './PrintedTicket'
import { SlideKey } from './SlideKey'
import { useRewardsCopy } from './rewards-copy'
import t from './ticket.module.css'

export const REWARDS_PATH = '/profile/rewards'
export const PRINT_PATH = '/rewards/print'
/** Opens the composer on the 晒单 tab with the card picker, and returns to the printer after publishing. */
export const POST_CARD_PATH = '/community?sort=cards&compose=card&then=print'
type Phase = 'loading' | 'idle' | 'ready' | 'waiting' | 'feeding' | 'done' | 'claiming' | 'claimed' | 'shown'
const FEED_MS = 2400

export function PrintScreen() {
  const k = useRewardsCopy()
  const [today, setToday] = useState<RewardToday | null | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('loading')
  const [draw, setDraw] = useState<Draw | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  // A full-screen page: the dock and the AI ball step aside, as for sheets.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.sheetOpen = 'true'
    return () => { delete root.dataset.sheetOpen }
  }, [])
  useEffect(() => {
    void getRewardToday().then(result => {
      setToday(result)
      if (result === null) { backOr('/community'); return }
      if (result.draw) { setDraw(result.draw); setPhase('shown') } else setPhase(result.eligible ? 'ready' : 'idle')
    }).catch(() => { setToday(null); setPhase('idle'); setError(k.loadFailed) })
  }, [k.loadFailed])

  const print = async () => {
    if (phase !== 'ready') return
    setError(null); setPhase('waiting')
    const started = Date.now()
    try {
      const result = await drawToday()
      // Let the header peek for a beat even on a fast network, so the print reads as a print.
      later(() => {
        setDraw(result); setPhase('feeding'); invalidate(['rewards:'])
        navigator.vibrate?.([10, 260, 10, 300, 10, 320, 10, 340, 16])
        later(() => setPhase('done'), FEED_MS)
      }, Math.max(0, 700 - (Date.now() - started)))
    } catch { setPhase('ready'); setError(k.drawFailed) }
  }
  const keep = () => {
    if (phase !== 'done') return
    setPhase('claiming')
    later(() => setPhase('claimed'), 700)
  }
  const busy = phase === 'waiting' || phase === 'feeding'
  const leave = () => { if (!busy) backOr('/community?sort=cards') }
  const status = error ?? (busy ? k.printing : phase === 'ready' ? k.front : phase === 'idle' && today ? k.reasons[today.reason] : phase === 'shown' ? k.reasons.drawn : '')
  // The stage CSS keys off these phases; a ticket printed earlier today sits fully out, like 'done'.
  const stagePhase = phase === 'shown' ? 'done' : phase === 'idle' || phase === 'loading' ? 'ready' : phase

  return <section className={t.stage} data-phase={stagePhase} aria-busy={busy || undefined} aria-labelledby="print-title">
    <header className={t.bar}>
      <button type="button" className={t.round} disabled={busy} aria-label={k.close} onClick={leave}><ArrowLeft size={20} aria-hidden="true" /></button>
      <h2 id="print-title">{k.today}</h2>
      <span />
    </header>
    <div className={t.printer} aria-hidden="true"><span className={t.mono}>{k.printer}</span><i className={t.led} /><i className={t.slot} /></div>
    <div className={t.window} style={stagePhase === 'done' ? { overflowY: 'auto' } : undefined}>
      <div className={t.paper}>
        {draw ? <PrintedTicket draw={draw} reveal={phase === 'feeding' || phase === 'done'} />
          : <div className={t.ticket} style={{ minHeight: 200 }}><p className={`${t.receipt} ${t.mono}`}>A-REIT DAILY · {new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })}</p></div>}
      </div>
      {phase === 'claimed' && draw && <div className={t.done} role="status">
        <b>{k.claimed}</b>
        {draw.prize.points > 0 && <span>{k.points} +{draw.prize.points}</span>}
        {(draw.prize.voucher ?? draw.prize.coupon) && <ul className={t.claimList}><MiniTicket coupon={(draw.prize.voucher ?? draw.prize.coupon)!} /></ul>}
      </div>}
    </div>
    <footer className={t.foot}>
      <p className={t.status} role="status">{status}</p>
      {phase === 'ready' || phase === 'waiting' ? <SlideKey label={k.slidePrint} disabled={phase !== 'ready'} onDone={() => void print()} />
        : phase === 'done' || phase === 'feeding' || phase === 'claiming' ? <SlideKey label={k.slideClaim} disabled={phase !== 'done'} onDone={keep} />
        : phase === 'idle' && today?.reason === 'no_card_today' ? <button type="button" className={controls.primary} onClick={() => openPath(POST_CARD_PATH)}><span>{k.goPost}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} /></i></button>
        : phase === 'claimed' || phase === 'shown' ? <div className={t.keys}>
          <button type="button" className={t.soft} onClick={leave}>{k.ok}</button>
          <button type="button" className={controls.primary} onClick={() => openPath(REWARDS_PATH)}><span>{k.toWallet}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} /></i></button>
        </div>
        : <button type="button" className={t.soft} onClick={leave}>{k.ok}</button>}
    </footer>
  </section>
}
