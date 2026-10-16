'use client'

import { ChevronDown, ChevronRight, Info, RotateCw } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { betAmounts, betStatus, betTotals, type BetStatus } from '@/lib/api/my-predictions'
import { predictionApi, type PredictionBet } from '@/lib/rwa-api'
import { fmtUsdt } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { myPredictionsCopy, myPredictionsScreenCopy, type MyPredictionsCopy, type MyPredictionsScreenCopy } from '@/lib/maison-my-predictions-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { fmtAtomic, fmtDateTime } from './format'
import { settle } from './settle'
import { MY_BETS_PAGE, useMyBets } from './MyPredictionsCard'
import mp from './my-predictions.module.css'

const PAGE = MY_BETS_PAGE
const FILTERS = ['all', 'open', 'won', 'lost', 'void'] as const
type Filter = (typeof FILTERS)[number]
const FILTER_STATUS: Record<Exclude<Filter, 'all'>, BetStatus> = { open: 'placed', won: 'won', lost: 'lost', void: 'void' }
function BetCard({ bet, locale, t, sc }: { bet: PredictionBet; locale: string; t: MyPredictionsCopy; sc: MyPredictionsScreenCopy }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState(false)
  const status = betStatus(bet.status)
  const amounts = betAmounts(bet)
  const money = (value: bigint | null) => value === null ? '—' : fmtUsdt(value.toString(), { locale })
  const side = bet.side.toLowerCase()
  const outcome = bet.tokenOutcome?.trim()
  const sideLabel = outcome ? fill(t.backed, { outcome }) : side === 'yes' ? t.sides.yes : side === 'no' ? t.sides.no : bet.side
  const question = bet.marketQuestion?.trim()
  const name = question || `${t.market} · #${bet.marketMappingId.slice(0, 6)}`
  const price = Number(bet.price)
  const priceText = Number.isFinite(price) ? price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '—'
  // Same screens as the markets page: the event page when the market belongs to one, else the single market.
  const target = bet.marketEventId ? `/prediction/event-${encodeURIComponent(bet.marketEventId)}` : bet.marketId ? `/prediction/${encodeURIComponent(bet.marketId)}` : null
  const hasFee = amounts.fee > BigInt(0)
  const hasPayoutFee = amounts.payoutFee > BigInt(0)
  // Shares are shown verbatim, and only when they parse as a valid payout amount.
  const shares = amounts.grossPayout === null ? null : bet.shares.trim()
  // Right-hand figure: gross before the payout fee while waiting, net paid when won, zero when lost, the helper's refund when void.
  const result = status === 'placed' ? { label: sc.payoutBeforeFee, value: money(amounts.grossPayout) }
    : status === 'won' ? { label: sc.payoutPaid, value: money(amounts.netPayout) }
    : status === 'lost' ? { label: sc.payoutLost, value: fmtUsdt('0', { locale }) }
    : status === 'void' ? { label: sc.payoutRefund, value: money(amounts.refund) }
    : { label: sc.payoutUnknown, value: '—' }
  const notes = status === 'placed' ? [t.ifRightNote]
    : status === 'won' ? [hasPayoutFee ? fill(t.payoutNote, { fee: money(amounts.payoutFee) }) : null, sc.wonNote]
    : status === 'lost' ? [t.noPayout]
    : status === 'void' ? [hasFee ? fill(t.refundNote, { fee: money(amounts.fee) }) : t.refundFull]
    : [sc.unknownNote]

  return <li>
    <article className={mp.card} data-status={status}>
      <div className={mp.meta}>
        <span className={mp.side} data-side={side}>{sideLabel}</span>
        <span className={mp.state}>{sc.statusShort[status]}</span>
        <time dateTime={bet.createdAt}>{fmtDateTime(bet.createdAt, locale, { month: 'short', day: 'numeric' })}</time>
      </div>
      {target
        ? <button type="button" className={mp.question} aria-label={`${t.open}: ${name}`} onClick={() => openPath(target)}><span>{name}</span></button>
        : <p className={mp.question} data-unnamed={!question || undefined}><span>{name}</span></p>}

      <div className={mp.pair}>
        <div><span>{sc.stakeLabel}</span><b className={s.num}>{money(amounts.stake)}</b></div>
        <div><span>{result.label}</span><b className={s.num} data-tone={status === 'won' ? 'up' : status === 'lost' || status === 'unknown' ? 'muted' : undefined}>{result.value}</b></div>
      </div>

      <div className={mp.sub}>
        <span>{t.price} <span className={s.num}>{priceText}</span></span>
        <button type="button" className={mp.toggle} aria-expanded={open} aria-controls={`${id}-details`} onClick={() => setOpen(!open)}>
          {sc.details}<ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={mp.detail} id={`${id}-details`} hidden={!open}>
        <dl>
          <div className={mp.wide}><dt>{sc.marketTitle}</dt><dd>{name}</dd></div>
          <div><dt>{sc.stakeLabel}</dt><dd className={s.num}>{money(amounts.stake)}</dd></div>
          <div><dt>{t.fee}</dt><dd className={s.num}>{hasFee ? money(amounts.fee) : '—'}</dd></div>
          {hasPayoutFee && <div><dt>{sc.payoutFee}</dt><dd className={s.num}>{money(amounts.payoutFee)}</dd></div>}
          <div><dt>{t.price}</dt><dd className={s.num}>{priceText}</dd></div>
          {shares && <div><dt>{t.shares}</dt><dd className={s.num}>{shares}</dd></div>}
          <div><dt>{t.placedAt}</dt><dd><time dateTime={bet.createdAt}>{fmtDateTime(bet.createdAt, locale)}</time></dd></div>
          <div><dt>{t.settledAt}</dt><dd>{bet.settledAt ? <time dateTime={bet.settledAt}>{fmtDateTime(bet.settledAt, locale)}</time> : status === 'placed' ? sc.pending : '—'}</dd></div>
        </dl>
        <div className={mp.acts}>
          <button type="button" aria-expanded={why} aria-controls={`${id}-why`} onClick={() => setWhy(!why)}>
            <Info size={16} aria-hidden="true" />{sc.moreInfo}
          </button>
          {target && <button type="button" onClick={() => openPath(target)}>{t.open}<ChevronRight size={16} aria-hidden="true" /></button>}
        </div>
        <div className={mp.why} id={`${id}-why`} hidden={!why}>
          {notes.filter(Boolean).map((note) => <p key={note}>{note}</p>)}
        </div>
      </div>
    </article>
  </li>
}

/** `/assets/predictions` — every prediction bet the signed-in user placed, with its server-side result. */
export function MyPredictionsScreen() {
  const { locale } = useI18n()
  const t = myPredictionsCopy[locale]
  const sc = myPredictionsScreenCopy[locale]
  const common = marketCopy[locale].common
  const scopeId = useId()
  const [scopeOpen, setScopeOpen] = useState(false)
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
    <h1 className={mp.srOnly}>{t.title}</h1>

    {first.error && !first.data ? <StateBlock tone="error" title={t.loadError} body={first.error.message} retry={first.refetch} retryLabel={common.retry} />
      : !first.data ? <Skeleton rows={4} />
      : total === 0 && bets.length === 0 ? <StateBlock title={t.empty.title} body={t.empty.body}
        action={<button type="button" className={s.ghost} onClick={() => openPath('/markets?tab=predictions')}>{t.empty.cta}<ChevronRight size={15} /></button>} />
      : <>
        <section className={mp.summary} aria-label={sc.summaryLabel} aria-live="polite">
          <p className={mp.eyebrow}>{t.kicker} · USDT</p>
          <dl className={mp.stats}>
            <div><dt>{t.stats.bets}</dt><dd className={s.num}>{total}</dd></div>
            <div><dt>{sc.inPlayStake}</dt><dd className={s.num}>{bare(totals.inPlay)}</dd></div>
            <div><dt>{sc.paidPayout}</dt><dd className={s.num} data-tone={totals.won > BigInt(0) ? 'up' : undefined}>{bare(totals.won)}</dd></div>
          </dl>
        </section>
        <div className={mp.scope}>
          <span>{fill(sc.scope, { m: bets.length, n: total })}</span>
          <button type="button" className={mp.icon} aria-label={sc.scopeInfo} aria-expanded={scopeOpen} aria-controls={scopeId} onClick={() => setScopeOpen(!scopeOpen)}>
            <Info size={16} aria-hidden="true" />
          </button>
        </div>
        <p className={mp.scopeNote} id={scopeId} hidden={!scopeOpen}>{fill(sc.scopeNote, { m: bets.length })}</p>

        <div className={mp.filters} role="group" aria-label={t.filterLabel}>
          {FILTERS.map((key) => <button key={key} type="button" className={mp.filter} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t.filters[key]}<small>{counts[key]}</small></button>)}
        </div>

        {shown.length === 0 ? <p className={mp.foot} role="status">{t.filterEmpty}</p>
          : <ul className={mp.list}>{shown.map((bet) => <BetCard key={bet.id} bet={bet} locale={locale} t={t} sc={sc} />)}</ul>}

        {bets.length < total && <div className={mp.more}>
          <button type="button" className={s.ghost} onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>
            {loadingMore && <RotateCw size={15} className={s.spin} />}{loadingMore ? t.loadingMore : t.loadMore}
          </button>
        </div>}
        {moreError && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{moreError}</span></div>}
      </>}
  </MaisonPage>
}
