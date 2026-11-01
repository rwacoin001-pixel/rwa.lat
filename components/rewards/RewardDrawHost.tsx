'use client'

/**
 * After a card post, asks the server whether today's draw is open and, if so, offers the ticket in a sheet
 * (stage 3, 2026-11-01). Quiet when the feature is off, already drawn, or the check fails.
 */
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sheet } from '@/components/maison/Sheet'
import controls from '@/components/ui/controls.module.css'
import { openPath } from '@/lib/maison-nav'
import { drawToday, getRewardToday, REWARD_DRAW_EVENT, type Draw } from '@/lib/rewards'
import { DrawTicket } from './DrawTicket'
import { useRewardsCopy } from './rewards-copy'
import s from './rewards.module.css'

export const REWARDS_PATH = '/profile/rewards'

export function RewardDrawHost() {
  const k = useRewardsCopy()
  const [open, setOpen] = useState(false)
  const [draw, setDraw] = useState<Draw | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const check = () => {
      // The post's card row lands in the same request; a short wait covers replicas that read a moment behind.
      window.setTimeout(() => {
        void getRewardToday().then(today => {
          if (!today?.eligible) return
          setDraw(null); setError(null); setOpen(true)
        }).catch(() => { /* quiet: the wallet page still offers the draw */ })
      }, 600)
    }
    window.addEventListener(REWARD_DRAW_EVENT, check)
    return () => window.removeEventListener(REWARD_DRAW_EVENT, check)
  }, [])
  const flip = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try { setDraw(await drawToday()) } catch { setError(k.drawFailed) } finally { setBusy(false) }
  }
  return <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title={k.posted} busy={busy}>
    <div className={s.sheetBody}>
      <DrawTicket draw={draw} busy={busy} error={error} onFlip={() => void flip()} />
      {draw && <div className={s.sheetKeys}>
        <button type="button" className={s.softKey} onClick={() => setOpen(false)}>{k.ok}</button>
        <button type="button" className={controls.primary} onClick={() => { setOpen(false); openPath(REWARDS_PATH) }}><span>{k.toWallet}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} /></i></button>
      </div>}
    </div>
  </Sheet>
}
