'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantSubscriptionPreview, useQuantProducts, type QuantPayout, type QuantProduct, type QuantSubscriptionPreview } from '@/lib/api/quant'
import { quantCopyFor, type QuantCopy } from '@/lib/maison-quant-copy'
import { demoProduct } from '@/lib/quant-demo'
import { buildTicks, localToday, quantAudience, subscriptionTimeline, type Tick } from '@/lib/quant-view-model'
import { Skeleton, StateBlock, maison as s } from './primitives'
import { QuantDisclosureSheet } from './QuantDisclosureSheet'
import { QuantDailyBars, QuantNavChart } from './QuantCharts'
import { QuantProcess, QuantSpecSheet } from './QuantSpec'
import { QuantStrip } from './QuantAccount'
import { QuantReceipt } from './QuantParts'
import { useQuantProduct } from './QuantPositionCard'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import { ShareWinLine, type WinMoment } from './ShareWin'
import stage from './quant.module.css'
import page from './quant-page.module.css'
import v2 from './quant-v2.module.css'

/**
 * Koala Quant on the Markets page (2026-10-28, docs/design-system.md §7.6). No watch dial: the same photo card as the home
 * "For you" row, one paper card with the since-inception figure and three small ones, the NAV curve, the daily bars,
 * then how subscribing works and the specification as text rows. Everything on the §3 type scale and the Palette A colours.
 */
type HeroCopy = { line: string; last30: string; days: (n: number) => string; nav: string; since: string; d7: string; d30: string; mdd: string; process: string; specs: string }
const hero: Record<AppLocale, HeroCopy> = {
  en: { line: 'Settled daily', last30: 'Past 30 days', days: (n) => `running ${n} days`, nav: 'NAV', since: 'Since inception', d7: '7 days', d30: '30 days', mdd: 'Max drawdown', process: 'How subscribing works', specs: 'Specification' },
  'zh-CN': { line: '每日结算', last30: '过去 30 天', days: (n) => `已运行 ${n} 天`, nav: '净值', since: '成立以来', d7: '近 7 天', d30: '近 30 天', mdd: '最大回撤', process: '申购流程', specs: '产品规格' },
  hi: { line: 'रोज़ निपटान', last30: 'पिछले 30 दिन', days: (n) => `${n} दिन से चालू`, nav: 'NAV', since: 'शुरुआत से', d7: '7 दिन', d30: '30 दिन', mdd: 'अधिकतम गिरावट', process: 'सब्सक्रिप्शन कैसे होता है', specs: 'विवरण' },
  es: { line: 'Liquidación diaria', last30: 'Últimos 30 días', days: (n) => `${n} días en marcha`, nav: 'Valor', since: 'Desde el inicio', d7: '7 días', d30: '30 días', mdd: 'Caída máxima', process: 'Cómo suscribirse', specs: 'Especificación' },
  ar: { line: 'تسوية يومية', last30: 'آخر 30 يومًا', days: (n) => `يعمل منذ ${n} يومًا`, nav: 'صافي القيمة', since: 'منذ الإطلاق', d7: '7 أيام', d30: '30 يومًا', mdd: 'أقصى تراجع', process: 'كيف يتم الاكتتاب', specs: 'المواصفات' },
  fr: { line: 'Règlement quotidien', last30: '30 derniers jours', days: (n) => `${n} jours d’activité`, nav: 'VL', since: 'Depuis le lancement', d7: '7 jours', d30: '30 jours', mdd: 'Baisse max.', process: 'Comment souscrire', specs: 'Caractéristiques' },
  pt: { line: 'Liquidação diária', last30: 'Últimos 30 dias', days: (n) => `${n} dias em operação`, nav: 'Cota', since: 'Desde o início', d7: '7 dias', d30: '30 dias', mdd: 'Queda máxima', process: 'Como subscrever', specs: 'Especificação' },
}
export const quantHeroCopy = (locale: AppLocale) => hero[locale] ?? hero.en

const signed = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`
const toneOf = (value: number | null | undefined) => value === null || value === undefined || value === 0 ? undefined : value > 0 ? 'up' : 'down'

const daysSince = (first: string | undefined, today: string) => first ? Math.min(800, Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1)) : 30

/** Everything the quant views read: the first product, its detail (sample figures only with ?preview=1), who is looking, the ticks. */
export function useQuantView() {
  const list = useQuantProducts()
  const slug = list.data?.[0]?.slug
  const detail = useQuantProduct(slug)
  const raw = detail.data
  const [flagged, setFlagged] = useState(false)
  useEffect(() => {
    // Sample figures are for local design review only (2026-10-28): never on a public host, where a shared ?preview=1
    // link would show made-up performance as if it were real.
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(window.location.hostname)
    try { setFlagged(local && new URLSearchParams(window.location.search).get('preview') === '1') } catch { setFlagged(false) }
  }, [])
  const sample = Boolean(raw) && flagged
  const product = useMemo(() => {
    if (!raw || !sample) return raw
    const shown = demoProduct()
    return { ...raw, performance: shown.performance, history: shown.history }
  }, [raw, sample])
  const audience = quantAudience(product?.position)
  const ticks = useMemo(() => product
    // Every settled day since inception (2026-10-28; was the last 30), so any day can be picked on the charts and the strip.
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: daysSince(product.history[0]?.tradeDate, localToday(product.timezone)) })
    : [], [product])
  return { list, slug, detail, product, sample, audience, ticks }
}

/** The latest paid day (within three days), with the product's settled return for it, for the share line. */
export function quantWin(product: QuantProduct | undefined | null): WinMoment | null {
  const last = product?.position?.lastDay
  if (!product || !last || BigInt(last.netAtomic) <= BigInt(0) || Date.now() - Date.parse(`${last.tradeDate}T00:00:00Z`) > 3 * 86_400_000) return null
  const row = product.history.find((entry) => entry.tradeDate === last.tradeDate)
  if (!row) return null
  return { id: `quant-${product.slug}-${last.tradeDate}`, kind: 'quant', date: last.tradeDate, pct: Number(row.netReturnPct), title: product.name, path: '/markets?tab=quant', proof: { kind: 'quant_day', product: product.slug, date: last.tradeDate } }
}

/** The quant tab of Markets. */
export function QuantOverview() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const h = quantHeroCopy(locale)
  const { list, slug, detail, product, sample, audience, ticks } = useQuantView()
  const [picked, setPicked] = useState<number | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const wantsSubscribe = audience === 'visitor' || audience === 'ex-holder'
  const preview = useQuery(wantsSubscribe && slug ? `quant:preview:${slug}` : null, () => getQuantSubscriptionPreview(slug as string), { staleTime: 20_000 })
  const win = useMemo(() => sample ? null : quantWin(product), [product, sample])

  const root = `${stage.stage} ${v2.root}`
  if (list.loading && !list.data) return <div className={root}><Skeleton rows={5} /></div>
  if (list.error && !list.data) return <div className={root}><StateBlock tone="error" title={c.loadError} retry={list.refetch} retryLabel={c.retry} /></div>
  if (!slug) return <div className={root}><StateBlock title={c.comingSoon} body={c.comingSoonBody} /></div>
  if (!product) return <div className={root}>{detail.error ? <StateBlock tone="error" title={c.loadError} retry={detail.refetch} retryLabel={c.retry} /> : <Skeleton rows={5} />}</div>

  const p = product.performance
  const last30 = p.last30d.pct
  const open = wantsSubscribe && product.open
  return <div className={root} data-quant-v2="" role="tabpanel">
    <QuantMiniBar product={product} />
    <QuantPhoto product={product} h={h} />

    {sample && <p className={v2.sample}>{c.previewNotice}</p>}
    {(audience === 'holder' || audience === 'pending') && product.position && <div>
      <QuantStrip position={product.position} c={c} />
      <ShareWinLine moment={win} />
    </div>}

    <section className={v2.perf} aria-label={h.since}>
      <small>{h.since}</small>
      <b className={v2.big} data-tone={toneOf(p.sinceInceptionPct)} dir="ltr">{signed(p.sinceInceptionPct)}</b>
      <p>{h.nav} {Number(p.index).toFixed(4)} · {h.days(p.days)}</p>
      <dl className={v2.kpis}>
        <div><dt>{h.d7}</dt><dd data-tone={toneOf(p.last7d.pct)} dir="ltr">{signed(p.last7d.pct)}</dd></div>
        <div><dt>{h.d30}</dt><dd data-tone={toneOf(last30)} dir="ltr">{signed(last30)}</dd></div>
        <div><dt>{h.mdd}</dt><dd data-tone={p.maxDrawdownPct ? 'down' : undefined} dir="ltr">{p.maxDrawdownPct === null ? '—' : `${p.maxDrawdownPct ? '−' : ''}${Math.abs(p.maxDrawdownPct).toFixed(2)}%`}</dd></div>
      </dl>
    </section>

    {product.history.length > 1
      ? <>
        <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
        <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
      </>
      : <p className={v2.note}>{c.perfPending}</p>}

    {wantsSubscribe && <section className={v2.sec}><h2>{h.process}</h2><QuantProcess preview={preview} c={c} /></section>}
    <section className={v2.sec}><h2>{h.specs}</h2><QuantSpecSheet product={product} c={c} /></section>

    <div className={v2.foot}>
      <span>{c.riskLine}</span>
      <button type="button" onClick={() => setDisclosureOpen(true)}>{c.disclosure}</button>
    </div>

    {open
      ? <div className={`${s.stickyCta} ${page.dockCta}`}>
        {preview.data && <CutoffPill preview={preview.data} locale={locale} />}
        <button type="button" className={`${s.cta} ${page.cta}`} onClick={() => setSubscribeOpen(true)}>
          <span>{c.subscribe}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
        </button>
      </div>
      : wantsSubscribe && <p className={v2.note} style={{ textAlign: 'center' }}>{c.closedNote}</p>}

    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
    <QuantDisclosureSheet open={disclosureOpen} onClose={() => setDisclosureOpen(false)} />
  </div>
}

/**
 * 15:00 pill (2026-10-28, after the "focus timer" reference): one small line above the subscribe key — when today's
 * cut-off is; tap and it opens sideways into the three real dates from the server preview (submit, start, first
 * settlement); tap again to fold. No countdown: the time is information, not pressure.
 */
const cutoffCopy: Record<string, { before: (t: string) => string; after: (t: string) => string; submit: string; start: string; settle: string }> = {
  en: { before: (time) => `Cut-off ${time} today (Singapore)`, after: (time) => `Past ${time}: counts from the next day`, submit: 'Submit', start: 'Starts', settle: 'First settled' },
  'zh-CN': { before: (time) => `今天 ${time} 截止（新加坡时间）`, after: (time) => `已过 ${time}，按下一个交易日`, submit: '提交', start: '起息', settle: '首次结算' },
}
export function CutoffPill({ preview, locale }: { preview: QuantSubscriptionPreview; locale: AppLocale }) {
  const c = cutoffCopy[locale] ?? cutoffCopy.en
  const [open, setOpen] = useState(false)
  const time = preview.cutoffTime.slice(0, 5)
  const day = (date: string) => new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const steps = subscriptionTimeline(preview)
  return <button type="button" className={v2.cutoff} data-open={open || undefined} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
    <i aria-hidden="true" />
    {open
      ? <span className={v2.cutoffSteps}>{steps.map((step, i) => <span key={step.key}>{i > 0 && <em aria-hidden="true">→</em>}{[c.submit, c.start, c.settle][i]} <b dir="ltr">{day(step.date)}</b></span>)}</span>
      : <span>{preview.afterCutoff ? c.after(time) : c.before(time)}</span>}
  </button>
}

/**
 * When the photo has scrolled away, a slim bar slides in under the page menu with the name and the since-inception
 * figure (2026-10-28, the "photo drawer" reference used the other way round), so the reader never loses which product
 * and how it has done. The risk text is never covered: the bar is one line.
 */
function QuantMiniBar({ product }: { product: QuantProduct }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const photo = document.querySelector('[data-quant-photo]')
    if (!photo || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(photo)
    return () => io.disconnect()
  }, [])
  const pct = product.performance.sinceInceptionPct
  return <div className={v2.mini} data-show={show || undefined} aria-hidden={!show}>
    <b>{product.name}</b>{pct !== null && <span data-tone={toneOf(pct)} dir="ltr">{signed(pct)}</span>}
  </div>
}

/** The home "For you" photo, as the head of the tab: the same picture and glass chip, so tapping through feels continuous. */
export function QuantPhoto({ product, h }: { product: QuantProduct; h: HeroCopy }) {
  const pct = product.performance.last30d.pct
  return <div className={v2.photo} data-quant-photo="">
    <img src="/media/home/cards/quant-720.webp" alt="" width={720} height={450} decoding="async" />
    {pct !== null && <span className={v2.chip} dir="ltr">{h.last30} · {signed(pct)}</span>}
    <span className={v2.photoText}><strong>{product.name}</strong><small>{h.line}</small></span>
  </div>
}

/**
 * Date strip on "My Koala Quant" (2026-10-28, after the "date strip" reference): one row of days, newest at the end,
 * each with a gain or loss dot; the month above follows the row as it scrolls. Tap a day and its slip opens below:
 * the product's settled return that day, and — only if you held — your own payout (net, fees). Never one from the other.
 */
export function QuantDateStrip({ product, payouts, locale, copy }: { product: QuantProduct; payouts: QuantPayout[] | undefined; locale: AppLocale; copy: QuantCopy }) {
  const zh = locale === 'zh-CN'
  const today = localToday(product.timezone)
  const first = product.history[0]?.tradeDate ?? today
  const days = useMemo(() => {
    const out: string[] = []
    for (let d = Date.parse(`${first}T00:00:00Z`); d <= Date.parse(`${today}T00:00:00Z`) && out.length < 800; d += 86_400_000) out.push(new Date(d).toISOString().slice(0, 10))
    return out
  }, [first, today])
  const rows = useMemo(() => new Map(product.history.map((row) => [row.tradeDate, Number(row.netReturnPct)])), [product.history])
  const paid = useMemo(() => new Map((payouts ?? []).map((row) => [row.tradeDate, row])), [payouts])
  const lastSettled = [...days].reverse().find((date) => rows.has(date)) ?? today
  const [picked, setPicked] = useState(lastSettled)
  const [month, setMonth] = useState(lastSettled.slice(0, 7))
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = strip.current; if (el) el.scrollLeft = el.scrollWidth }, [days.length])
  // The month label follows the day nearest the middle of the row.
  const onScroll = () => {
    const el = strip.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    const child = [...el.children].find((node) => (node as HTMLElement).offsetLeft + (node as HTMLElement).offsetWidth > mid) as HTMLElement | undefined
    const date = child?.dataset.date
    if (date && date.slice(0, 7) !== month) setMonth(date.slice(0, 7))
  }
  const fmtMonth = (m: string) => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))
  const weekday = (date: string) => new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const value = rows.get(picked)
  const payout = paid.get(picked)
  return <section className={v2.strip} aria-label={zh ? '每日结算' : 'Daily settlement'}>
    <header><h2>{fmtMonth(month)}</h2><small>{zh ? '点一天，看当天结算' : 'Tap a day to see its settlement'}</small></header>
    <div ref={strip} className={v2.days} onScroll={onScroll} role="listbox" aria-label={zh ? '日期' : 'Dates'}>
      {days.map((date) => {
        const r = rows.get(date)
        const kind = r === undefined ? (date === today ? 'today' : 'none') : r > 0 ? 'gain' : r < 0 ? 'loss' : 'flat'
        return <button key={date} type="button" role="option" data-date={date} data-kind={kind} aria-selected={date === picked} onClick={() => setPicked(date)}
          aria-label={`${date} ${r === undefined ? '—' : signed(r)}`}>
          <small>{weekday(date)}</small><b>{Number(date.slice(8))}</b><i aria-hidden="true" />
        </button>
      })}
    </div>
    <div key={picked} className={v2.slip}>
      <div className={v2.slipRow}><span>{zh ? '产品当日涨跌' : 'Product that day'}</span><b data-tone={value === undefined ? undefined : value > 0 ? 'up' : value < 0 ? 'down' : undefined} dir="ltr">{value === undefined ? (picked === today ? (zh ? '待结算' : 'Pending') : '—') : signed(value)}</b></div>
      {payout ? <QuantReceipt payout={payout} copy={copy} locale={locale} />
        // Only say "nothing held" when the loaded records cover that day (2026-10-28): the list holds the latest 60
        // payouts, so an older day is "not loaded here", never "you held nothing"; a day not yet settled is pending.
        : <p className={v2.slipNote}>{payouts === undefined ? '…'
          : value === undefined ? (zh ? '这一天还没有结算。' : 'This day has not settled yet.')
          : payouts.length >= 60 && picked < (payouts.reduce((min, row) => row.tradeDate < min ? row.tradeDate : min, payouts[0].tradeDate))
            ? (zh ? '更早的到账记录在对账单里查看。' : 'Older payouts are in your statements.')
          : zh ? '这一天你没有持仓，所以没有个人到账。' : 'You held nothing that day, so there is no payout of yours.'}</p>}
    </div>
  </section>
}

/**
 * The return calendar on "My Koala Quant": one month of day cells; a settled day carries its return under the date, a gain or
 * loss dot beside it. Tapping a settled day picks it (the charts follow).
 */
export function QuantMonth({ product, ticks, selected, onSelect, locale }: { product: QuantProduct; ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; locale: AppLocale }) {
  const zh = locale === 'zh-CN'
  const today = localToday(product.timezone)
  const active = ticks[selected ?? ticks.length - 1]?.date ?? today
  const [month, setMonth] = useState(() => active.slice(0, 7))
  const rows = useMemo(() => new Map(product.history.map((row) => [row.tradeDate, Number(row.netReturnPct)])), [product.history])
  const firstMonth = product.history[0]?.tradeDate.slice(0, 7) ?? today.slice(0, 7)
  const [year, number] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const move = (delta: number) => setMonth(new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7))
  const label = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, number - 1, 1)))
  const week = zh ? [...'一二三四五六日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return <section className={v2.month} aria-label={zh ? '收益日历' : 'Return calendar'}>
    <header>
      <div><h2>{zh ? '收益日历' : 'Return calendar'}</h2><small>{zh ? '产品每日表现，不是个人收益' : 'Product daily return, not your own'}</small></div>
      <span className={v2.monthNav}>
        <button type="button" aria-label={zh ? '上个月' : 'Previous month'} disabled={month <= firstMonth} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <b>{label}</b>
        <button type="button" aria-label={zh ? '下个月' : 'Next month'} disabled={month >= today.slice(0, 7)} onClick={() => move(1)}><ChevronRight size={18} /></button>
      </span>
    </header>
    <div className={v2.grid} dir="ltr">
      {week.map((day, i) => <span key={`w${i}`} className={v2.wd}>{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`s${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`
        const value = rows.get(date)
        const index = ticks.findIndex((tick) => tick.date === date)
        const kind = value === undefined ? (date === today ? 'today' : 'none') : value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat'
        return <button key={date} type="button" className={v2.day} data-kind={kind} aria-pressed={index >= 0 && index === selected} disabled={index < 0 || value === undefined}
          onClick={() => onSelect(index === selected ? null : index)} aria-label={`${date} ${value === undefined ? '—' : signed(value)}`}>
          <b>{i + 1}</b>
          <small>{value === undefined ? (date === today ? (zh ? '待结算' : 'Pending') : '') : signed(value).replace('%', '')}</small>
        </button>
      })}
    </div>
  </section>
}

