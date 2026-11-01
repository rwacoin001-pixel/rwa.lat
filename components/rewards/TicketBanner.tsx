'use client'

/**
 * Today's ticket on the 晒单 tab (2026-11-02): a small printer-coloured strip — the dedicated entry the user asked for
 * instead of a popup after posting. Green light + 去打印 when a ticket is waiting; 发晒单卡 when today has no card yet;
 * 查看 once printed. Hidden while the feature is not live for this account.
 */
import { ArrowRight } from 'lucide-react'
import { useQuery } from '@/lib/api/_query'
import { openPath } from '@/lib/maison-nav'
import { rewardTodayQuery } from '@/lib/rewards'
import { PRINT_PATH } from './TicketPrinter'
import { useRewardsCopy } from './rewards-copy'
import s from './rewards.module.css'

export function TicketBanner({ onPost }: { onPost: () => void }) {
  const k = useRewardsCopy()
  const today = useQuery('rewards:today', rewardTodayQuery, { staleTime: 15_000, loading: 'silent' }).data
  if (!today) return null
  const ready = today.eligible
  const action = ready ? { label: k.print, run: () => openPath(PRINT_PATH) }
    : today.draw ? { label: k.view, run: () => openPath(PRINT_PATH) }
    : today.reason === 'no_card_today' ? { label: k.postShort, run: onPost } : null
  return <div className={s.banner} data-ready={ready || undefined}>
    <i className={s.bannerLed} aria-hidden="true" />
    <span><small>{k.today}</small><b>{k.bannerReasons[today.reason]}</b></span>
    {action && <button type="button" className={s.lightKey} onClick={action.run}>{action.label}<ArrowRight size={16} aria-hidden="true" /></button>}
  </div>
}
