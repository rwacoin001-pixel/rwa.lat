'use client'

import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { betAmounts, betStatus, betTotals } from '@/lib/api/my-predictions'
import { predictionApi } from '@/lib/rwa-api'
import { fill } from '@/lib/maison-market-copy'
import { myPredictionsCopy } from '@/lib/maison-my-predictions-copy'
import { openPath } from '@/lib/maison-nav'
import { maison as s } from './primitives'
import { fmtAtomic } from './format'
import { settle } from './settle'
import mp from './my-predictions.module.css'

export const MY_BETS_PAGE = 20

/** First page of the user's bets; the assets card and `/assets/predictions` share this cache entry. */
export function useMyBets(options: { loading?: 'silent' | 'overlay' } = {}) {
  return useQuery('prediction:bets', () => settle(() => predictionApi.myBets(1, MY_BETS_PAGE)), { staleTime: 15_000, ...options })
}

const bare = (value: bigint) => fmtAtomic(value.toString(), 6, '', 2).trim()

/** Entry card on `/assets`, above the tabs so it is visible without scrolling. The whole card opens `/assets/predictions`. */
export function MyPredictionsCard() {
  const { locale } = useI18n()
  const t = myPredictionsCopy[locale]
  const bets = useMyBets({ loading: 'silent' })
  const items = bets.data?.items
  const total = bets.data?.total ?? 0
  const totals = useMemo(() => items ? betTotals(items) : null, [items])
  const failed = Boolean(bets.error && !bets.data)
  const empty = Boolean(bets.data) && total === 0
  const partial = Boolean(items) && (items?.length ?? 0) < total

  return <button type="button" className={mp.entry} onClick={() => openPath('/assets/predictions')} aria-busy={!bets.data && !failed}>
    <span className={mp.entryHead}>
      <span className={mp.entryText}>
        <b>{t.entry}</b>
        <small>{failed ? t.loadError : empty ? t.empty.title : t.entryBody}</small>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </span>
    {!failed && !empty && <dl className={mp.entryStats}>
      <div><dt>{t.stats.bets}</dt><dd className={s.num}>{bets.data ? total : '—'}</dd></div>
      <div><dt>{t.stats.inPlay} · USDT</dt><dd className={s.num}>{totals ? bare(totals.inPlay) : '—'}</dd></div>
      <div><dt>{t.stats.paidOut} · USDT</dt><dd className={s.num} data-tone={totals && totals.won > BigInt(0) ? 'up' : undefined}>{totals ? bare(totals.won) : '—'}</dd></div>
    </dl>}
    {partial && <small className={mp.entryNote}>{fill(t.partial, { n: items?.length ?? 0 })}</small>}
  </button>
}

/**
 * Bets still in play, as holdings on the Assets positions tab (2026-10-29): the question and side, the stake, and what it
 * pays if right (gross, before any payout fee). Each row opens its market; the header opens all predictions.
 */
export function OpenBets() {
  const { locale } = useI18n()
  const t = myPredictionsCopy[locale]
  const bets = useMyBets({ loading: 'silent' })
  const rows = useMemo(() => (Array.isArray(bets.data?.items) ? bets.data.items : []).filter((bet) => betStatus(bet.status) === 'placed'), [bets.data])
  if (!rows.length) return null
  return <ul className={s.list}>{rows.map((bet) => {
    const { stake, grossPayout } = betAmounts(bet)
    const outcome = bet.tokenOutcome?.trim()
    const target = bet.marketEventId ? `/prediction/event-${encodeURIComponent(String(bet.marketEventId))}` : bet.marketId ? `/prediction/${encodeURIComponent(String(bet.marketId))}` : '/assets/predictions'
    return <li key={bet.id}>
      <button type="button" className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }} onClick={() => openPath(target)}>
        <span className={s.rowMain}><b className={s.clamp2} dir="auto">{bet.marketQuestion?.trim() || t.market}</b><small>{outcome ? fill(t.backed, { outcome }) : t.market} · {t.stake} {stake === null ? '—' : bare(stake)}</small></span>
        <span className={s.rowFig}><b className={s.num}>{grossPayout === null ? '—' : bare(grossPayout)}</b><small className={s.muted}>USDT · {t.ifRight}</small></span>
      </button>
    </li>
  })}</ul>
}
