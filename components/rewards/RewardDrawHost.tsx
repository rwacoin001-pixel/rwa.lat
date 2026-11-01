'use client'

/**
 * After a card post, asks the server whether today's ticket can be printed and, if so, opens the ticket printer
 * (stage 3; v2 printer 2026-11-02). Quiet when the feature is off, already drawn, or the check fails.
 */
import { useEffect, useState } from 'react'
import { invalidate } from '@/lib/api/_query'
import { getRewardToday, REWARD_DRAW_EVENT } from '@/lib/rewards'
import { TicketPrinter } from './TicketPrinter'

export { REWARDS_PATH } from './TicketPrinter'

export function RewardDrawHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const check = () => {
      // The post's card row lands in the same request; a short wait covers replicas that read a moment behind.
      window.setTimeout(() => {
        void getRewardToday().then(today => { if (today?.eligible) setOpen(true) }).catch(() => { /* quiet: the wallet page still offers the print */ })
      }, 600)
    }
    window.addEventListener(REWARD_DRAW_EVENT, check)
    return () => window.removeEventListener(REWARD_DRAW_EVENT, check)
  }, [])
  return <TicketPrinter open={open} onClose={() => setOpen(false)} onDrawn={() => invalidate(['rewards:'])} />
}
