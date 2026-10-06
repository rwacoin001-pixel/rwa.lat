'use client'

import { ChevronRight, Info, RotateCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { betAmounts, betStatus, betTotals, type BetStatus } from '@/lib/api/my-predictions'
import { predictionApi, type PredictionBet } from '@/lib/rwa-api'
import { fmtUsdt } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { myPredictionsCopy, type MyPredictionsCopy } from '@/lib/maison-my-predictions-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, StatStrip } from './motion'
import { fmtAtomic, fmtDateTime } from './format'
import { settle } from './settle'
import { MY_BETS_PAGE, useMyBets } from './MyPredictionsCard'
import mp from './my-predictions.module.css'

const PAGE = MY_BETS_PAGE
const FILTERS = ['all', 'open', 'won', 'lost', 'void'] as const
type Filter = (typeof FILTERS)[number]
const FILTER_STATUS: Record<Exclude<Filter, 'all'>, BetStatus> = { open: 'placed', won: 'won', lost: 'lost', void: 'void' }
const BADGE_TONE: Partial<Record<BetStatus, string>> = { placed: 'accent', won: 'live', lost: 'down', void: 'warn' }

function BetCard({ bet, locale, t }: { bet: PredictionBet; locale: string; t: MyPredictionsCopy }) {
  const status = betStatus(bet.status)
  const amounts = betAmounts(bet)
  const money = (value: bigint | null) => value === null ? '—' : fmtUsdt(value.toString(), { locale })
  const side = bet.side.toLowerCase()
  const outcome = bet.tokenOutcome?.trim()
  const sideLabel = outcome ? fill(t.backed, { outcome }) : side === 'yes' ? t.sides.yes : side === 'no' ? t.sides.no : bet.side
  const question = bet.marketQuestion?.trim()
  const name = question || `${t.market} · #${bet.marketMappingId.slice(0, 6)}`
  const price = Number(bet.price)
  const target = bet.marketSlug ? `/prediction/${encodeURIComponent(bet.marketSlug)}` : null
  const hasFee = amounts.fee > BigInt(0)
  const hasPayoutFee = amounts.payoutFee > BigInt(0)

  return <li>
    <article className={mp.card} data-status={status}>
      <div className={mp.head}>
        <div className={mp.title}>
          {target
            ? <button type="button" className={mp.question} aria-label={`${t.open}: ${name}`} onClick={() => openPath(target)}><span>{name}</span><ChevronRight size={14} aria-hidden="true" /></button>
            : <span className={mp.question} data-unnamed={!question || undefined}>{name}</span>}
          <div className={mp.meta}>
            <span className={mp.side} data-side={side}>{sideLabel}</span>
            <time dateTime={bet.createdAt}>{t.placedAt} {fmtDateTime(bet.createdAt, locale)}</time>
          </div>
        </div>
        <span className={s.badge} data-tone={BADGE_TONE[status]}>{t.status[status]}</span>
      </div>

      <dl className={mp.facts}>
        <div><dt>{t.stake}</dt><dd className={s.num}>{money(amounts.stake)}</dd></div>
        <div><dt>{t.fee}</dt><dd className={s.num}>{hasFee ? money(amounts.fee) : '—'}</dd></div>
        <div><dt>{t.price}</dt><dd className={s.num}>{Number.isFinite(price) ? price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '—'}</dd></div>
      </dl>

      {status === 'placed' && <div className={mp.result} data-status={status}>
        <span><b>{t.ifRight}</b><small>{t.ifRightNote}</small></span>
        <strong className={s.num}>{money(amounts.grossPayout)}</strong>
      </div>}
      {status === 'won' && <div className={mp.result} data-status={status}>
        <span><b>{t.payout}</b><small>{hasPayoutFee ? fill(t.payoutNote, { fee: money(amounts.payoutFee) }) : null}</small></span>
        <strong className={s.num} data-tone="up">{amounts.netPayout === null ? '—' : `+${money(amounts.netPayout)}`}</strong>
      </div>}
      {status === 'lost' && <div className={mp.result} data-status={status}>
        <span><b>{t.status.lost}</b><small>{t.noPayout}</small></span>
        <strong className={s.num} data-tone="muted">{fmtUsdt('0', { locale })}</strong>
      </div>}
      {status === 'void' && <div className={mp.result} data-status={status}>
        <span><b>{t.refund}</b><small>{hasFee ? fill(t.refundNote, { fee: money(amounts.fee) }) : t.refundFull}</small></span>
        <strong className={s.num}>{money(amounts.refund)}</strong>
      </div>}
      {status !== 'placed' && bet.settledAt && <p className={mp.foot}>{t.settledAt} {fmtDateTime(bet.settledAt, locale)}</p>}
    </article>
  </li>
}

/** `/assets/predictions` — every prediction bet the signed-in user placed, with its server-side result. */
export function MyPredictionsScreen() {
  const { locale } = useI18n()
  const t = myPredictionsCopy[locale]
  const common = marketCopy[locale].common
  const first = useMyBets()
  const [tail, setTail] = useState<{ base: typeof first.data; rows: PredictionBet[]; page: number } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const liveTail = tail && tail.base === first.data ? tail : null
  const bets = useMemo(() => [...new Map([...(first.data?.items ?? []), ...(liveTail?.rows ?? [])].map((bet) => [bet.id, bet])).values()], [first.data, liveTail])
  const total = first.data?.total ?? 0
  const totals = useMemo(() => betTotals(bets), [bets])
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: bets.length, open: 0, won: 0, lost: 0, void: 0 }
    for (const bet of bets) {
      const status = betStatus(bet.status)
      for (const key of ['open', 'won', 'lost', 'void'] as const) if (FILTER_STATUS[key] === status) result[key] += 1
    }
    return result
  }, [bets])
  const shown = filter === 'all' ? bets : bets.filter((bet) => betStatus(bet.status) === FILTER_STATUS[filter])

  const loadMore = async () => {
    if (loadingMore) return
    const base = first.data
    const page = (liveTail?.page ?? 1) + 1
    setLoadingMore(true)
    setMoreError('')
    const result = await settle(() => predictionApi.myBets(page, PAGE))
    if (result.ok) setTail((previous) => ({ base, rows: [...(previous && previous.base === base ? previous.rows : []), ...result.data.items], page }))
    else setMoreError(result.error.message || common.errorGeneric)
    setLoadingMore(false)
  }
  const bare = (value: bigint) => fmtAtomic(value.toString(), 6, '', 2).trim()

  return <MaisonPage page="my-predictions" dock topbar={<RwaTopbar screen="my-predictions" title={t.title} onBack={() => backOr('/assets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    {first.error && !first.data ? <StateBlock tone="error" title={t.loadError} body={first.error.message} retry={first.refetch} retryLabel={common.retry} />
      : !first.data ? <Skeleton rows={4} />
      : total === 0 && bets.length === 0 ? <StateBlock title={t.empty.title} body={t.empty.body}
        action={<button type="button" className={s.ghost} onClick={() => openPath('/markets?tab=predictions')}>{t.empty.cta}<ChevronRight size={15} /></button>} />
      : <>
        <Lacquer aria-live="polite">
          <span className={s.kicker}>{t.kicker} · USDT</span>
          <StatStrip fit items={[
            { label: t.stats.bets, value: total },
            { label: t.stats.inPlay, value: bare(totals.inPlay) },
            { label: t.stats.paidOut, value: bare(totals.won), tone: totals.won > BigInt(0) ? 'up' : undefined },
          ]} />
        </Lacquer>
        {bets.length < total && <p className={mp.foot}>{fill(t.partial, { n: bets.length })}</p>}

        <div className={mp.filters} role="group" aria-label={t.filterLabel}>
          {FILTERS.map((key) => <button key={key} type="button" className={mp.filter} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t.filters[key]}<small>{counts[key]}</small></button>)}
        </div>

        {shown.length === 0 ? <p className={mp.foot} role="status">{t.filterEmpty}</p>
          : <ul className={mp.list}>{shown.map((bet) => <BetCard key={bet.id} bet={bet} locale={locale} t={t} />)}</ul>}

        {bets.length < total && <div className={mp.more}>
          <button type="button" className={s.ghost} onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>
            {loadingMore && <RotateCw size={15} className={s.spin} />}{loadingMore ? t.loadingMore : t.loadMore}
          </button>
        </div>}
        {moreError && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{moreError}</span></div>}
      </>}
  </MaisonPage>
}
