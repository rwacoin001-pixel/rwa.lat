'use client'

/**
 * The ticket printer (v2, 2026-11-02; after the user's receipt-printer reference). Full screen: a dark printer body with a
 * slot; slide to print → the receipt header peeks out while the server draws → the ticket feeds out line by line with a
 * light haptic per step → the art band shines (more for rarer tiers) and the numbers count up → slide to keep, the ticket
 * tears off and drops into the wallet. The draw is granted on the server at "print"; keeping is the hand-over moment.
 */
import { Dialog } from '@base-ui/react/dialog'
import { ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import controls from '@/components/ui/controls.module.css'
import { openPath } from '@/lib/maison-nav'
import { drawToday, type Draw } from '@/lib/rewards'
import { MiniTicket } from './MiniTicket'
import { PrintedTicket } from './PrintedTicket'
import { SlideKey } from './SlideKey'
import { useRewardsCopy } from './rewards-copy'
import t from './ticket.module.css'

export const REWARDS_PATH = '/profile/rewards'
type Phase = 'ready' | 'waiting' | 'feeding' | 'done' | 'claiming' | 'claimed'
const FEED_MS = 2400

export function TicketPrinter({ open, onClose, initial = null, onDrawn }: { open: boolean; onClose: () => void; initial?: Draw | null; onDrawn?: (draw: Draw) => void }) {
  const k = useRewardsCopy()
  const anchor = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [phase, setPhase] = useState<Phase>(initial ? 'done' : 'ready')
  const [draw, setDraw] = useState<Draw | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => setContainer(anchor.current?.closest<HTMLElement>('[data-maison-page]') ?? null), [])
  useEffect(() => { if (open) { setDraw(initial); setPhase(initial ? 'done' : 'ready'); setError(null) } }, [open, initial])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.dataset.sheetOpen = 'true'
    return () => { delete root.dataset.sheetOpen }
  }, [open])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const print = async () => {
    if (phase !== 'ready') return
    setError(null); setPhase('waiting')
    const started = Date.now()
    try {
      const result = await drawToday()
      // Let the header peek for a beat even on a fast network, so the print reads as a print.
      later(() => {
        setDraw(result); setPhase('feeding'); onDrawn?.(result)
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

  return <>
    <span ref={anchor} hidden />
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={t.backdrop} />
        <Dialog.Popup className={t.stage} data-phase={phase} aria-busy={busy || undefined}>
          <header className={t.bar}>
            <span />
            <Dialog.Title render={<h2 />}>{k.today}</Dialog.Title>
            <Dialog.Close className={t.round} disabled={busy} aria-label={k.close}><X size={20} aria-hidden="true" /></Dialog.Close>
          </header>
          <div className={t.printer} aria-hidden="true"><span className={t.mono}>{k.printer}</span><i className={t.led} /><i className={t.slot} /></div>
          <div className={t.window} style={phase === 'done' ? { overflowY: 'auto' } : undefined}>
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
            <p className={t.status} role="status">{error ?? (phase === 'waiting' || phase === 'feeding' ? k.printing : phase === 'ready' ? k.front : '')}</p>
            {phase === 'ready' || phase === 'waiting' ? <SlideKey label={k.slidePrint} disabled={phase !== 'ready'} onDone={() => void print()} />
              : phase === 'claimed' ? <div className={t.keys}>
                <button type="button" className={t.soft} onClick={onClose}>{k.ok}</button>
                <button type="button" className={controls.primary} onClick={() => { onClose(); openPath(REWARDS_PATH) }}><span>{k.toWallet}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} /></i></button>
              </div>
              : <SlideKey label={k.slideClaim} disabled={phase !== 'done'} onDone={keep} />}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
