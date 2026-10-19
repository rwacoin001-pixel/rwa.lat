'use client'

import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import type { ApiResult } from '@/lib/api/_http'
import { getPolymarketFeed, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'
import { getPolymarketMarket, getPredictionStatus } from '@/lib/api/markets'
import { useContentTranslation } from '@/lib/use-content-translation'
import { fmtUsd } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { polymarketFeedCopy } from '@/lib/polymarket-feed-copy'
import { heroCardCopy } from '@/lib/hero-card-copy'
import { predictionCountdown } from '@/lib/prediction-availability'
import { openPredictionItems } from '@/lib/prediction-lifecycle'
import { openPath } from '@/lib/maison-nav'
import { Figure } from './motion'
import { MiniTrend, type TrendPoint } from './MiniTrend'
import { AssetAlmanac, BasketPoster, TradeGauge, useBasketNote } from './MarketHeroBodies'
import h from './hero-card.module.css'

export type HeroTab = 'predictions' | 'baskets' | 'trade' | 'assets'

const PERIODS = ['1d', '1w', '1m'] as const
const SPAN_LABEL = { '1d': '24h', '1w': '7d', '1m': '30d' } as const
type Period = (typeof PERIODS)[number]
type Hero = { item: PolymarketFeedMarket | null; fetchedAt: string }
type History = { points: TrendPoint[]; label: string | null }

const unavailable = { ok: false as const, error: { status: 0, code: 'POLYMARKET_UNAVAILABLE', message: 'Market data is unavailable right now.' } }
const isRolling = (item: PolymarketFeedMarket) => item.outcomes.every((outcome) => /^(up|down)$/i.test(outcome.label))
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const whole = (value: number) => Math.round(clamp01(value) * 100)

/** The highest 24h-volume event that is still open, skipping the rolling 5-minute Up/Down slots. */
async function loadHero(): Promise<ApiResult<Hero>> {
  try {
    const page = await getPolymarketFeed('all', 0, undefined, 'volume24hr', '')
    const item = openPredictionItems(page.items).find((entry) => entry.outcomes.length >= 2 && !isRolling(entry)) ?? null
    return { ok: true, data: { item, fetchedAt: page.fetchedAt } }
  } catch { return unavailable }
}

/** `prefer` is the leading outcome's label, so a multi-option event draws the curve the big number is about. */
async function loadHistory(id: string, period: Period, prefer: string | undefined): Promise<ApiResult<History>> {
  const clean = (rows: Array<{ time: number; price: number }>): TrendPoint[] => rows.filter((row) => Number.isFinite(row.time) && row.time > 0 && Number.isFinite(row.price)).map((row) => ({ time: row.time, value: row.price }))
  try {
    const eventId = /^event-(\d+)$/.exec(id)?.[1]
    if (eventId) {
      const response = await fetch(`/api/polymarket/event/${eventId}?period=${period}`, { cache: 'no-store' })
      if (!response.ok) return unavailable
      const data = await response.json() as { curves?: Array<{ label: string; available: boolean; points: Array<{ time: number; price: number }> }> }
      const usable = data.curves?.filter((entry) => entry.available && entry.points.length > 1) ?? []
      const curve = usable.find((entry) => prefer !== undefined && entry.label === prefer) ?? usable[0] ?? data.curves?.[0]
      return { ok: true, data: { points: clean(curve?.points ?? []), label: curve?.label ?? null } }
    }
    const result = await getPolymarketMarket(id, period)
    if (!result.ok) return result
    return { ok: true, data: { points: clean(result.data.pricing.history), label: null } }
  } catch { return unavailable }
}

/** Eases a figure up from zero once, then follows live changes. */
function useRise(target: number) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setValue(target))
    return () => window.cancelAnimationFrame(frame)
  }, [target])
  return value
}

/** JS twin of the CSS scroll-driven drawer, for engines without `animation-timeline` (iOS Safari, Firefox). It only
 *  writes the card's raw exit progress to --hero-p; the stylesheet maps it with the same ranges as the keyframes, so
 *  both paths land on identical frames. Read and write share one rAF per scroll and there is no easing, so it stays
 *  under the finger and stops dead at 0 and 1. */
function useHeroStow(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()'))) return
    let scroller: HTMLElement | null = null
    for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) { scroller = node; break }
    }
    const target: HTMLElement | Window = scroller ?? window
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())
    let frame = 0
    let last = -1
    let running = false
    let settle: number[] = []
    const apply = () => {
      frame = 0
      const height = el.offsetHeight
      const port = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0
      // The card scales about its bottom edge, so rect.bottom is the untransformed edge: our own transform never feeds back.
      const top = el.getBoundingClientRect().bottom - height
      const value = height > 0 ? Math.round(Math.min(1, Math.max(0, (port - top) / height)) * 1000) / 1000 : 0
      if (value === last) return
      last = value
      el.style.setProperty('--hero-p', String(value))
    }
    function schedule() { if (running && !frame) frame = window.requestAnimationFrame(apply) }
    const start = () => {
      if (running) return
      running = true
      last = -1
      el.dataset.stow = 'js'
      apply()
      target.addEventListener('scroll', schedule, { passive: true })
      window.addEventListener('resize', schedule)
      resize?.observe(el)
      // The first read can land mid screen-transition or before scroll restoration; nothing else triggers a second one
      // until the user scrolls, so re-measure once the page has settled instead of keeping a stale (stowed) value.
      document.addEventListener('animationend', schedule, true)
      settle = [120, 420, 900].map((delay) => window.setTimeout(schedule, delay))
    }
    const stop = () => {
      running = false
      document.removeEventListener('animationend', schedule, true)
      settle.forEach((timer) => window.clearTimeout(timer))
      settle = []
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      resize?.disconnect()
      delete el.dataset.stow
      el.style.removeProperty('--hero-p')
    }
    const sync = () => { if (motion.matches) stop(); else start() }
    sync()
    if (motion.addEventListener) motion.addEventListener('change', sync); else motion.addListener(sync)
    return () => {
      if (motion.removeEventListener) motion.removeEventListener('change', sync); else motion.removeListener(sync)
      stop()
    }
  }, [ref])
}

function Countdown({ endAt }: { endAt: string | null }) {
  const { locale } = useI18n()
  const copy = heroCardCopy[locale]
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [endAt])
  const left = now === null ? null : predictionCountdown(endAt, now)
  if (!left) return null
  if (left.reached) return <span className={h.countdown} data-done="true" role="timer">{copy.ended}</span>
  const two = (value: number) => value.toLocaleString(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const parts: Array<[string, string]> = [
    ...(left.days > 0 ? [[left.days.toLocaleString(locale), copy.units[0]] as [string, string]] : []),
    [two(left.hours), copy.units[1]], [two(left.minutes), copy.units[2]], [two(left.seconds), copy.units[3]],
  ]
  return <span className={h.countdown} data-soon={left.days === 0 || undefined} role="timer" aria-live="off" dir="ltr">
    {parts.map(([value, unit]) => <span key={unit}><b>{value}</b>{unit}</span>)}
  </span>
}

/** First screen of Markets: one fixed-size frame (--mk-hero-h) whose body follows the active tab — same frame, four
 *  pictures. The frame owns the scroll drawer and never animates itself, so switching tabs cannot move the tab bar;
 *  only the body cross-fades. Each body mounts only while its tab is active, so only that tab's data is fetched. */
export function MarketHero({ tab = 'predictions' }: { tab?: HeroTab }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const text = heroCardCopy[locale]
  const basketNote = useBasketNote()
  const stowRef = useRef<HTMLElement>(null)
  useHeroStow(stowRef)
  // Safety net for the entrance: if the browser never starts the staggered reveal (no frames while the page is still
  // settling), its backwards fill would leave the card's contents invisible. After the longest reveal has had time to
  // finish, drop the animation so everything is simply shown.
  useEffect(() => {
    const el = stowRef.current
    if (!el) return
    delete el.dataset.settled
    const timer = window.setTimeout(() => { el.dataset.settled = 'true' }, 1500)
    return () => window.clearTimeout(timer)
  }, [tab])
  const note = tab === 'baskets' ? basketNote : tab === 'trade' ? text.tradeNote : tab === 'assets' ? text.assetsNote : text.noteShort

  return <>
  <section ref={stowRef} className={`${h.hero} ${h.frame}`} data-kind={tab} aria-label={copy.markets.title}>
    <h1 className={h.srOnly}>{copy.markets.title}</h1>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} className={h.body} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: .22, ease: 'easeOut' } }} exit={{ opacity: 0, transition: { duration: .14, ease: 'easeIn' } }}>
        {tab === 'baskets' ? <BasketPoster /> : tab === 'trade' ? <TradeGauge /> : tab === 'assets' ? <AssetAlmanac /> : <PredictionHero />}
      </motion.div>
    </AnimatePresence>
    {/* After the body, so the dark-theme edge light also rides over the poster's full-bleed image. */}
    <span className={h.halo} aria-hidden="true" />
  </section>
  {/* Risk line sits just under the card, not in it, and is always present so nothing below shifts while data loads. */}
  <p key={tab} className={`${h.note} ${h.reveal}`} style={{ '--i': 6 } as CSSProperties}>{note}</p>
  </>
}

/** Predictions body (A′): the day's top prediction event — one figure, one gold action.
 *  Binary events: gold goes to the side the figure describes; the other side is a same-height outline pill, so gold
 *  never doubles up and never silently follows the favourite. */
function PredictionHero() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const labels = polymarketFeedCopy[locale]
  const text = heroCardCopy[locale]
  const feed = useQuery('markets:hero', loadHero, { staleTime: 30_000, pollInterval: 30_000, loading: 'silent' })
  const item = feed.data?.item ?? null
  const status = useQuery('prediction:status', getPredictionStatus, { staleTime: 60_000, loading: 'silent' })
  const [period, setPeriod] = useState<Period>('1d')
  const content = useContentTranslation(item ? [item.question, ...item.outcomes.map((outcome) => outcome.label)] : [])
  const binary = item?.outcomes.length === 2
  const primaryIndex = useMemo(() => {
    if (!item || binary) return 0
    return item.outcomes.reduce((best, outcome, index, all) => outcome.impliedProbability > all[best].impliedProbability ? index : best, 0)
  }, [item, binary])
  const primary = item?.outcomes[primaryIndex]
  const history = useQuery(item ? `markets:hero:history:${item.id}:${period}:${primary?.label ?? ''}` : null, () => loadHistory(item!.id, period, primary?.label), { staleTime: 60_000, loading: 'silent' })
  const rise = useRise(whole(primary?.impliedProbability ?? 0))
  const open = () => item && openPath(`/prediction/${encodeURIComponent(item.id)}`)
  const outcomeText = (label: string) => {
    const key = label.trim().toLowerCase()
    return key === 'yes' ? copy.review.yes : key === 'no' ? copy.review.no : content(label)
  }
  const points = history.data?.points ?? []
  const change = points.length > 1 ? (points[points.length - 1].value - points[0].value) * 100 : null
  const feeRate = status.data?.fees?.placeFeeRate
  const primaryName = primary ? outcomeText(primary.label) : ''
  const other = binary && item ? item.outcomes[1 - primaryIndex] : undefined
  const optionCount = item ? item.optionCount ?? item.outcomes.length : 0
  const at = (i: number) => ({ '--i': i }) as CSSProperties
  // Split Yes/No buttons only when both sides have a one-word label ("买 是"); anything longer would truncate in a half-width
  // pill, so named or multi-option events get one gold "买入" (the cap line names the side) plus the all-options pill.
  const yesNo = (label: string) => /^(yes|no)$/i.test(label.trim())
  const split = binary && other && primary && yesNo(primary.label) && yesNo(other.label)

  // Tiers are what the scroll drawer fades (top first); `.reveal` children carry the one entrance.
  return <div className={h.inner}>
      {!item && !feed.error && !feed.data ? <div className={h.skeleton} aria-busy="true"><i /><i /><i /></div>
        : !item ? <div className={h.state} role={feed.error ? 'alert' : 'status'}>
          <span>{feed.error ? copy.markets.loadError : copy.common.empty}</span>
          <button type="button" onClick={() => void feed.refetch()}>{copy.common.retry}</button>
        </div>
        : <>
          <div className={h.tier} data-tier="1">
            <div className={`${h.top} ${h.reveal}`} style={at(0)}>
              <span className={h.tag}>{item.category === 'all' ? 'Polymarket' : labels.categories[item.category]}</span>
              <Countdown endAt={item.endAt} />
            </div>
            <button type="button" className={`${h.question} ${h.reveal}`} style={at(1)} onClick={open}>{content(item.question)}</button>
            <div className={`${h.prob} ${h.reveal}`} style={at(2)}>
              <span className={`${h.big} ${h.num}`}><Figure value={rise} flash={false} locale={locale} format={{ maximumFractionDigits: 0 }} /><small>%</small></span>
              {change !== null && <span className={`${h.delta} ${h.num}`} data-tone={change < 0 ? 'down' : undefined}>
                <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d={change < 0 ? 'M5 8.5 9 1.5H1Z' : 'M5 1.5 9 8.5H1Z'} fill="currentColor" /></svg>
                {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(1)}pt<i>· {SPAN_LABEL[period]}</i>
              </span>}
            </div>
            <p className={`${h.cap} ${h.reveal}`} style={at(2)}>{binary ? primaryName : `${text.leading} · ${primaryName}`} · {text.implied}</p>
          </div>
          <div className={`${h.tier} ${h.chart}`} data-tier="2">
            <div className={`${h.chartHead} ${h.reveal}`} style={at(3)}>
              <span className={h.chartLead}>{fill(text.trend, { o: history.data?.label ? outcomeText(history.data.label) : primaryName })}</span>
              <div className={h.seg} role="group" aria-label={copy.markets.volume24h}>
                {PERIODS.map((key) => <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{key.toUpperCase()}</button>)}
              </div>
            </div>
            <div className={h.reveal} style={at(3)}>
              {points.length > 1 ? <div className={h.chartBody} data-busy={history.loading || undefined}>
                <MiniTrend points={points} label={fill(text.trend, { o: primaryName })} height={72} axis minSpan={0.04} drawKey={`${item.id}:${period}`} locale={locale} flatLabel={text.flat} format={(value) => `${(value * 100).toFixed(value > 0.995 || value < 0.005 ? 0 : 1)}%`} />
              </div>
                : history.loading || (!history.data && !history.error) ? <div className={h.skeleton} aria-busy="true"><i style={{ width: '100%', height: 72 }} /></div>
                : <p className={h.trendEmpty}>{text.historyEmpty}</p>}
            </div>
          </div>
          <div className={h.tier} data-tier="3">
            <div className={`${h.actions} ${h.reveal}`} style={at(4)}>
              {split ? [primary!, other!].map((outcome, index) => <button key={outcome.label} type="button" className={h.buy} data-quiet={index === 1 || undefined} onClick={open} aria-label={`${fill(text.buy, { o: outcomeText(outcome.label) })} ${whole(outcome.impliedProbability)}¢`}>
                <span>{fill(text.buy, { o: outcomeText(outcome.label) })}</span>
                <span className={`${h.price} ${h.num}`}>{whole(outcome.impliedProbability)}<small>¢</small></span>
              </button>)
                : <>
                  <button type="button" className={h.buy} onClick={open} aria-label={`${fill(text.buy, { o: primaryName })} ${whole(primary?.impliedProbability ?? 0)}¢`}>
                    <span>{text.buyNow}</span>
                    <span className={`${h.price} ${h.num}`}>{whole(primary?.impliedProbability ?? 0)}<small>¢</small></span>
                  </button>
                  <button type="button" className={h.more} onClick={open}>
                    <span>{text.allOptions} · {optionCount}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </>}
            </div>
            <dl className={`${h.facts} ${h.reveal}`} style={at(5)}>
              <div><dt>{copy.markets.volume24h}</dt><dd className={h.num}>{item.volume24hUsd == null ? '—' : fmtUsd(String(item.volume24hUsd), { compact: true, locale })}</dd></div>
              <div><dt>{text.fee}</dt><dd className={h.num}>{typeof feeRate === 'number' ? `${+(feeRate * 100).toFixed(2)}%` : '—'}</dd></div>
              <div><dt>{text.settles}</dt><dd className={h.num}>{item.endAt ? new Intl.DateTimeFormat(locale, { year: '2-digit', month: 'numeric', day: 'numeric' }).format(new Date(item.endAt)) : '—'}</dd></div>
            </dl>
          </div>
        </>}
    </div>
}
