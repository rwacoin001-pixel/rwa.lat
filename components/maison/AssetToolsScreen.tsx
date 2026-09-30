'use client'

import { ChevronLeft, ChevronRight, Download, Info, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { listProducts, type CatalogProduct } from '@/lib/api/markets'
import { cancelRebalance, confirmRebalanceBuys, createRebalance, listExpectedDistributions, listPositions, listRebalances, listYield, totalsFor, type ExpectedDistribution, type RebalancePlan, type YieldCredit } from '@/lib/api/portfolio'
import { ledgerDeltas, listLedger, type LedgerTransaction } from '@/lib/api/wallet'
import { fromAtomic, toAtomic } from '@/lib/money'
import { assetToolsCopy } from '@/lib/maison-assets-tools-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { portfolioCopy } from '@/lib/maison-portfolio-copy'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, Lacquer, StatStrip, useAutoAnimate } from './motion'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'
import { LedgerRows, useLedger } from './CashScreen'
import { RecurringForm } from './RecurringForm'
import { FormalDocumentsPanel } from './FormalDocumentsPanel'

// Platform unit (USDT, 6 decimals) for ledger, yield and valuation amounts.
const DECIMALS = 6
const ZERO = BigInt(0)
const BPS = BigInt(10_000)
const big = (value: string | null | undefined) => value != null && /^\d+$/.test(value) ? BigInt(value) : null
const bare = (atomic: bigint | string | null | undefined, sign = false) => {
  if (atomic === null || atomic === undefined) return '—'
  const text = fmtAtomic(atomic.toString(), DECIMALS, '', 2).trim()
  return sign && BigInt(atomic) > ZERO ? `+${text}` : text
}
const toneOf = (atomic: bigint) => atomic > ZERO ? 'up' as const : atomic < ZERO ? 'down' as const : undefined
const toneClass = (atomic: bigint) => atomic > ZERO ? s.up : atomic < ZERO ? s.down : s.muted

/** Local calendar month key (YYYY-MM); statements and the calendar both follow the device time zone. */
function monthOf(iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const monthDate = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const shiftMonth = (key: string, by: number) => monthOf(new Date(monthDate(key).getFullYear(), monthDate(key).getMonth() + by, 1).toISOString())!
const monthLabel = (key: string, locale: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate(key))
const setQuery = (name: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}
function nameFor(products: CatalogProduct[] | undefined, productId: string, fallback: string) {
  return products?.find((product) => product.id === productId)?.displayName ?? `${fallback} ${productId.slice(0, 8)}`
}
const useProducts = () => useQuery('markets:catalog', listProducts, { staleTime: 60_000 })

function csvFor(rows: LedgerTransaction[]) {
  const cell = (value: string | number) => { const raw = String(value); const text = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw; return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
  const lines = [['transaction_id', 'effective_at', 'transaction_type', 'reference_type', 'reference_id', 'entry_id', 'purpose', 'side', 'normal_side', 'atomic_amount', 'asset_code', 'asset_decimals']]
  for (const tx of rows) for (const entry of tx.entries) lines.push([tx.id, tx.effectiveAt, tx.transactionType, tx.referenceType ?? '', tx.referenceId ?? '', entry.entryId, entry.purpose, entry.side, entry.normalSide, entry.atomicAmount, entry.assetCode, String(entry.assetDecimals)])
  return lines.map((line) => line.map(cell).join(',')).join('\n')
}

/**
 * `/assets/statements?month=YYYY-MM` — loaded ledger summary and separately archived official PDFs.
 * In/out/net are BigInt sums of the `available` change, the same basis as /assets/activity.
 */
export function StatementsScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].statements
  const a = walletCopy[locale].activity
  const common = marketCopy[locale].common
  const ledger = useLedger()
  const [tail, setTail] = useState<{ base: typeof ledger.data; rows: LedgerTransaction[]; cursor: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState('')
  const cursor = tail?.base === ledger.data ? tail?.cursor : ledger.data?.nextCursor
  const all = useMemo(() => [...new Map([...(ledger.data?.transactions ?? []), ...(tail?.base === ledger.data ? tail?.rows ?? [] : [])].map(tx => [tx.id, tx])).values()], [ledger.data, tail])
  const loadMore = async () => {
    if (!cursor || loadingMore) return
    const base = ledger.data
    setLoadingMore(true); setPageError('')
    try {
      const page = await listLedger(100, cursor)
      if (!page.ok) throw new Error(page.error.message)
      setTail(previous => ({ base, rows: [...(previous && previous.base === base ? previous.rows : []), ...page.data.transactions], cursor: page.data.nextCursor }))
    } catch (error) { setPageError(error instanceof Error ? error.message : common.errorGeneric) }
    finally { setLoadingMore(false) }
  }
  const moreLabel = { en: 'Load older records', 'zh-CN': '加载更早记录', hi: 'पुराने रिकॉर्ड लोड करें', es: 'Cargar registros anteriores', ar: 'تحميل السجلات الأقدم', fr: 'Charger les anciens enregistrements', pt: 'Carregar registros anteriores' }[locale]
  const months = useMemo(() => [...new Set(all.map((tx) => monthOf(tx.effectiveAt)).filter((key): key is string => Boolean(key)))].sort().reverse(), [all])
  const [picked, setPicked] = useState(() => queryParam(query, 'month'))
  const month = picked && months.includes(picked) ? picked : months[0] ?? null
  const choose = (key: string) => { setPicked(key); setQuery('month', key) }
  const rows = useMemo(() => all.filter((tx) => monthOf(tx.effectiveAt) === month), [all, month])
  const sums = useMemo(() => rows.reduce((acc, tx) => {
    const delta = ledgerDeltas(tx).available ?? ZERO
    if (delta > ZERO) acc.inflow += delta
    else acc.outflow += delta
    return acc
  }, { inflow: ZERO, outflow: ZERO }), [rows])
  const byType = useMemo(() => {
    const map = new Map<string, { count: number; net: bigint }>()
    for (const tx of rows) {
      const item = map.get(tx.transactionType) ?? { count: 0, net: ZERO }
      item.count += 1
      item.net += ledgerDeltas(tx).available ?? ZERO
      map.set(tx.transactionType, item)
    }
    return [...map.entries()].sort((x, y) => y[1].count - x[1].count)
  }, [rows])
  // A full page means older rows may exist; only the oldest loaded month can be cut off.
  const truncated = Boolean(cursor)
  const partial = truncated && month !== null && month === months[months.length - 1]
  const net = sums.inflow + sums.outflow
  const exportCsv = () => {
    if (!month) return
    const url = URL.createObjectURL(new Blob([csvFor(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `ledger-${month}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <MaisonPage page="statements" dock topbar={<RwaTopbar screen="statements" title={t.title} onBack={() => backOr('/assets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>
    {ledger.error && !ledger.data ? <StateBlock tone="error" title={common.errorGeneric} body={ledger.error.message} retry={ledger.refetch} retryLabel={common.retry} />
      : !ledger.data ? <Skeleton rows={6} />
      : !month ? <StateBlock title={t.noMonths} body={t.noMonthsBody} />
      : <>
        <p className={s.kicker}>{t.month}</p>
        <div className={s.chips} role="group" aria-label={t.month}>{months.map((key) => <button key={key} type="button" className={s.chip} aria-pressed={key === month} onClick={() => choose(key)}>{monthLabel(key, locale)}</button>)}</div>
        <Lacquer style={{ marginTop: 16 }} aria-live="polite">
          <span className={s.kicker}>{monthLabel(month, locale)} · {t.net} · USDT</span>
          <p className={`${s.bigFigure} ${s.num}`} dir="ltr"><Figure value={Number(fromAtomic(net.toString(), DECIMALS))} locale={locale} prefix={net > ZERO ? '+' : ''} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /><small>USDT</small></p>
          <StatStrip fit items={[
            { label: t.inflow, value: bare(sums.inflow, true), tone: toneOf(sums.inflow) },
            { label: t.outflow, value: bare(sums.outflow), tone: toneOf(sums.outflow) },
            { label: t.entries, value: String(rows.length) },
          ]} />
        </Lacquer>
        {partial && <div className={s.notice} data-tone="info" role="status"><Info size={16} /><span><b>{t.partial}</b> · {fill(t.partialBody, { n: String(all.length) })}</span></div>}
        <div className={s.actionsRow}>
          <button type="button" className={s.ghost} onClick={exportCsv}><Download size={15} />{t.export}</button>
          {cursor && <button type="button" className={s.ghost} disabled={loadingMore} onClick={() => void loadMore()}>{moreLabel}</button>}
        </div>
        {pageError && <p role="alert">{pageError}</p>}
        <p className={s.foot}><span>{t.exportNote}</span><span>{fill(t.scope, { n: String(all.length) })} {t.tz}</span></p>

        <SectionHead index="01" title={t.byType} note={t.byTypeNote} />
        <div className={s.tableHead} aria-hidden="true"><span>{t.byType}</span><span>{t.net} · USDT</span></div>
        <ul className={s.list}>{byType.map(([type, item]) => <li key={type}>
          <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
            <span className={s.rowMain}><b>{a.types[type] ?? a.otherType}</b><small className={s.num}>{item.count} · {t.entries}</small></span>
            <span className={s.rowFig}><b className={`${s.num} ${toneClass(item.net)}`} dir="ltr">{bare(item.net, true)}</b></span>
          </div>
        </li>)}</ul>

        <SectionHead index="02" title={t.lines} note={String(rows.length)} />
        <LedgerRows rows={rows} byDay />
      </>}
    <SectionHead index="03" title={t.official} note="PDF · UTC" />
    <FormalDocumentsPanel />
  </MaisonPage>
}

const WEEK = [0, 1, 2, 3, 4, 5, 6]
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** `/assets/yield-calendar?month=YYYY-MM` — credited distributions plus product-term-based expected dates. */
export function YieldCalendarScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].calendar
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const products = useProducts()
  const credits = useQuery('portfolio:yield', listYield, { staleTime: 60_000 })
  const schedule = useQuery('portfolio:yield-schedule', () => listExpectedDistributions(18), { staleTime: 60_000 })
  const all = useMemo(() => credits.data ?? [], [credits.data])
  const credited = useMemo(() => all.filter((item) => item.state === 'credited' && monthOf(item.creditedAt) && big(item.atomicAmount) !== null)
    .sort((x, y) => Date.parse(y.creditedAt) - Date.parse(x.creditedAt)), [all])
  const open = useMemo(() => all.filter((item) => item.state !== 'credited'), [all])
  const thisMonth = monthOf(new Date().toISOString())!
  const earliest = credited.length ? monthOf(credited[credited.length - 1].creditedAt)! : thisMonth
  const expected = useMemo(() => schedule.data ?? [], [schedule.data])
  const latestExpected = expected.length ? expected[expected.length - 1].paymentDate.slice(0, 7) : thisMonth
  const latest = latestExpected > thisMonth ? latestExpected : thisMonth
  const [picked, setPicked] = useState(() => { const value = queryParam(query, 'month'); return value && MONTH_RE.test(value) ? value : null })
  const month = picked ?? (credited.length ? monthOf(credited[0].creditedAt)! : thisMonth)
  const [day, setDay] = useState<string | null>(null)
  const go = (by: number) => { const next = shiftMonth(month, by); setPicked(next); setDay(null); setQuery('month', next) }

  const inMonth = useMemo(() => credited.filter((item) => monthOf(item.creditedAt) === month), [credited, month])
  const expectedInMonth = useMemo(() => expected.filter((item) => item.paymentDate.slice(0, 7) === month), [expected, month])
  const perDay = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const item of inMonth) { const key = dayKey(new Date(item.creditedAt)); map.set(key, (map.get(key) ?? ZERO) + BigInt(item.atomicAmount)) }
    return map
  }, [inMonth])
  const expectedPerDay = useMemo(() => {
    const map = new Map<string, bigint | null>()
    for (const item of expectedInMonth) {
      const amount = big(item.expectedAtomicAmount)
      const previous = map.get(item.paymentDate)
      map.set(item.paymentDate, amount === null || previous === null ? null : (previous ?? ZERO) + amount)
    }
    return map
  }, [expectedInMonth])
  const monthSum = inMonth.reduce((sum, item) => sum + BigInt(item.atomicAmount), ZERO)
  const allSum = credited.reduce((sum, item) => sum + BigInt(item.atomicAmount), ZERO)
  const byProduct = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const item of inMonth) map.set(item.productId, (map.get(item.productId) ?? ZERO) + BigInt(item.atomicAmount))
    return [...map.entries()].sort((x, y) => x[1] === y[1] ? 0 : x[1] > y[1] ? -1 : 1)
  }, [inMonth])
  const shown = day ? inMonth.filter((item) => dayKey(new Date(item.creditedAt)) === day) : inMonth
  const expectedShown = day ? expectedInMonth.filter((item) => item.paymentDate === day) : expectedInMonth
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 220 })

  // Monday-first grid; weekday names from Intl (2024-01-01 was a Monday).
  const first = monthDate(month)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const today = dayKey(new Date())
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const dayLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })

  return <MaisonPage page="yield-calendar" dock topbar={<RwaTopbar screen="yield-calendar" title={t.title} onBack={() => backOr('/assets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>
    {(credits.error && !credits.data) || (schedule.error && !schedule.data) ? <StateBlock tone="error" title={common.errorGeneric} body={(credits.error ?? schedule.error)?.message ?? common.errorGeneric} retry={() => { credits.refetch(); schedule.refetch() }} retryLabel={common.retry} />
      : !credits.data || !schedule.data ? <Skeleton rows={6} />
      : <>
        <Lacquer aria-live="polite">
          <span className={s.kicker}>{t.monthTotal} · USDT</span>
          <p className={`${s.bigFigure} ${s.num}`} dir="ltr"><Figure value={Number(fromAtomic(monthSum.toString(), DECIMALS))} locale={locale} prefix={monthSum > ZERO ? '+' : ''} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /><small>USDT</small></p>
          <StatStrip fit items={[
            { label: t.credits, value: String(inMonth.length) },
            { label: `${t.allTime} · USDT`, value: bare(allSum, true), tone: toneOf(allSum) },
            { label: t.open, value: String(open.length) },
          ]} />
        </Lacquer>

        <div className={s.monthNav}>
          <button type="button" aria-label={t.prev} onClick={() => go(-1)} disabled={month <= earliest}><ChevronLeft size={16} /></button>
          <b aria-live="polite">{monthLabel(month, locale)}</b>
          <button type="button" aria-label={t.next} onClick={() => go(1)} disabled={month >= latest}><ChevronRight size={16} /></button>
        </div>
        <div className={s.calGrid} role="group" aria-label={monthLabel(month, locale)}>
          {WEEK.map((index) => <span key={`w${index}`} aria-hidden="true">{weekday.format(new Date(2024, 0, 1 + index))}</span>)}
          {Array.from({ length: lead }, (_, index) => <i key={`b${index}`} className={s.calDay} data-blank="" aria-hidden="true" />)}
          {Array.from({ length: days }, (_, index) => {
            const date = new Date(first.getFullYear(), first.getMonth(), index + 1)
            const key = dayKey(date)
            const amount = perDay.get(key)
            const expectedAmount = expectedPerDay.get(key)
            const hasExpected = expectedPerDay.has(key)
            const parts = [dayLabel.format(date)]
            if (amount) parts.push(`+${bare(amount)} USDT`)
            if (hasExpected) parts.push(expectedAmount === null ? (locale === 'zh-CN' ? '预计派息' : 'Estimated distribution') : `${locale === 'zh-CN' ? '预计' : 'Estimated'} ${bare(expectedAmount)} USDT`)
            return amount || hasExpected
              ? <button key={key} type="button" className={s.calDay} data-credit={amount ? '' : undefined} data-estimated={hasExpected || undefined} data-today={key === today || undefined} aria-pressed={day === key} aria-label={parts.join(' · ')} onClick={() => setDay(day === key ? null : key)}>{index + 1}</button>
              : <span key={key} className={s.calDay} data-today={key === today || undefined} aria-label={dayLabel.format(date)}>{index + 1}</span>
          })}
        </div>

        {!credited.length && !expectedInMonth.length ? <div style={{ marginTop: 18 }}><StateBlock title={t.none} body={t.noneBody} /></div>
          : !inMonth.length && !expectedInMonth.length ? <div style={{ marginTop: 18 }}><StateBlock title={t.empty} body={t.emptyBody} /></div>
          : inMonth.length ? <>
            <SectionHead index="01" title={t.byProduct} note={monthLabel(month, locale)} />
            <ul className={s.list}>{byProduct.map(([productId, sum]) => <li key={productId}>
              <button type="button" className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }} onClick={() => openPath(`/assets/positions/${encodeURIComponent(productId)}`)}>
                <span className={s.rowMain}><b>{nameFor(products.data, productId, p.product)}</b><small className={s.num}>{inMonth.filter((item) => item.productId === productId).length} · {t.credits}</small></span>
                <span className={s.rowFig}><b className={`${s.num} ${s.up}`} dir="ltr">{bare(sum, true)}</b></span>
              </button>
            </li>)}</ul>

            <SectionHead index="02" title={day ? fill(t.listDay, { d: dayLabel.format(new Date(`${day}T00:00:00`)) }) : t.list}
              action={day ? <button type="button" className={s.sectionMore} onClick={() => setDay(null)}>{t.wholeMonth}</button> : undefined} />
            <ul className={s.list} ref={list}>{shown.map((item) => <CreditRow key={item.id} item={item} products={products.data} />)}</ul>
          </> : null}

        {open.length > 0 && <>
          <SectionHead index="03" title={t.open} note={t.openNote} />
          <ul className={s.list}>{open.map((item) => <CreditRow key={item.id} item={item} products={products.data} />)}</ul>
        </>}
        {expectedShown.length > 0 && <>
          <SectionHead index="04" title={locale === 'zh-CN' ? '预计派息' : 'Expected distributions'} note={locale === 'zh-CN' ? '按产品条款生成 · 非保证' : 'Generated from product terms · not guaranteed'} />
          <ul className={s.list}>{expectedShown.map((item) => <ExpectedDistributionRow key={item.id} item={item} />)}</ul>
        </>}
      </>}
  </MaisonPage>
}

function ExpectedDistributionRow({ item }: { item: ExpectedDistribution }) {
  const { locale } = useI18n()
  const amount = big(item.expectedAtomicAmount)
  return <li><div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
    <span className={s.rowMain}><b>{item.productName}</b><small>{locale === 'zh-CN' ? '资格截止' : 'Record date'} {fmtDate(item.recordDate, locale)} · {item.timezone}</small></span>
    <span className={s.rowFig}><b className={`${s.num} ${s.muted}`} dir="ltr">{amount === null ? '—' : `${bare(amount)} USDT`}</b><small><span className={s.badge} data-tone="warn">{locale === 'zh-CN' ? '预计' : 'Estimated'} · {fmtDate(item.paymentDate, locale)}</span></small></span>
  </div></li>
}

function CreditRow({ item, products }: { item: YieldCredit; products: CatalogProduct[] | undefined }) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].calendar
  const p = portfolioCopy[locale]
  const amount = big(item.atomicAmount)
  const credited = item.state === 'credited'
  return <li>
    <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
      <span className={s.rowMain}><b>{nameFor(products, item.productId, p.product)}</b><small>{t.period} {fmtDate(item.periodStart, locale)} – {fmtDate(item.periodEnd, locale)}</small></span>
      <span className={s.rowFig}>
        <b className={`${s.num} ${credited ? s.up : s.muted}`} dir="ltr">{amount === null ? '—' : credited ? bare(amount, true) : bare(amount)}</b>
        <small>{credited ? <span className={s.muted}>{fmtDateTime(item.creditedAt, locale)}</span> : <span className={s.badge} data-tone={item.state === 'failed' ? 'down' : 'warn'}>{t.states[item.state as 'pending' | 'failed'] ?? item.state}</span>}</small>
      </span>
    </div>
  </li>
}

/** Percent string (≤ 2 dp) → basis points; null when malformed. */
const toBps = (value: string) => { const atomic = value === '' ? null : toAtomic(value, 2); return atomic === null ? null : BigInt(atomic) }
const pctText = (bps: bigint) => fromAtomic(bps.toString(), 2).replace(/\.?0+$/, '') || '0'
const pctLabel = (bps: bigint, locale: string) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(Number(bps) / 10_000)

/** `/assets/rebalance` — sell settlement first, then a separately confirmed buy stage. */
export function RebalanceScreen() {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].rebalance
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const products = useProducts()
  const positions = useQuery('portfolio:positions', listPositions, { staleTime: 15_000 })
  const plans = useQuery('portfolio:rebalances', listRebalances, { staleTime: 10_000, pollInterval: 15_000 })
  const totals = useMemo(() => positions.data ? totalsFor(positions.data) : null, [positions.data])
  const rows = useMemo(() => (totals?.rows ?? []).filter((row) => row.value !== null && row.value > ZERO)
    .map((row) => ({ key: `${row.position.productId}:${row.position.outcomeKey}`, productId: row.position.productId, value: row.value as bigint })), [totals])
  const whole = rows.reduce((sum, row) => sum + row.value, ZERO)
  const current = useMemo(() => {
    const bps = rows.map((row) => whole > ZERO ? row.value * BPS / whole : ZERO)
    // Rounding down leaves a remainder; give it to the largest weight so the starting draft totals 100%.
    const rest = BPS - bps.reduce((sum, value) => sum + value, ZERO)
    if (bps.length && rest > ZERO) { const top = bps.indexOf(bps.reduce((x, y) => y > x ? y : x)); bps[top] += rest }
    return Object.fromEntries(rows.map((row, index) => [row.key, bps[index]]))
  }, [rows, whole])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [sellConsent, setSellConsent] = useState(false)
  const [buyConsent, setBuyConsent] = useState(false)
  const [busy, setBusy] = useState<'sell' | 'buy' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState('')
  const [sellKey, setSellKey] = useState<string | null>(null)
  const [buyKey, setBuyKey] = useState<string | null>(null)
  const valueOf = (key: string) => draft[key] ?? pctText(current[key] ?? ZERO)
  const targets = rows.map((row) => toBps(valueOf(row.key)))
  const valid = targets.every((bps) => bps !== null && bps <= BPS)
  const sum = targets.reduce<bigint>((acc, bps) => acc + (bps ?? ZERO), ZERO)
  const balanced = valid && sum === BPS
  const activePlan = plans.data?.find((plan) => plan.state !== 'completed' && plan.state !== 'canceled')
  const latestPlan = activePlan ?? plans.data?.[0]
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 220 })

  const equal = () => {
    const n = BigInt(rows.length)
    if (!n) return
    const each = BPS / n
    const rest = BPS - each * n
    setDraft(Object.fromEntries(rows.map((row, index) => [row.key, pctText(each + (BigInt(index) < rest ? BigInt(1) : ZERO))])))
  }
  const topbar = <RwaTopbar screen="rebalance" title={t.title} onBack={() => backOr('/assets')} />
  const cn = locale === 'zh-CN'
  const stateText: Record<RebalancePlan['state'], string> = cn ? {
    submitting_redemptions: '正在提交卖出申请', redemptions_submitted: '等待卖出实际到账', awaiting_buy_confirmation: '等待你确认买入',
    submitting_buys: '正在提交买入申请', buy_orders_submitted: '买入申请已提交', completed: '再平衡已完成', canceled: '再平衡已取消', attention: '需要人工处理',
  } : {
    submitting_redemptions: 'Submitting redemptions', redemptions_submitted: 'Waiting for actual redemption proceeds', awaiting_buy_confirmation: 'Waiting for your buy confirmation',
    submitting_buys: 'Submitting buy orders', buy_orders_submitted: 'Buy orders submitted', completed: 'Rebalance completed', canceled: 'Rebalance canceled', attention: 'Manual attention required',
  }
  const submitSells = async () => {
    if (!balanced || !sellConsent || activePlan) return
    const key = sellKey ?? crypto.randomUUID()
    setSellKey(key); setBusy('sell'); setActionError('')
    try {
      const result = await createRebalance(rows.map((row, index) => ({ productId: row.productId, targetBps: Number(targets[index]!) })), key)
      if (!result.ok) throw new Error(result.error.message)
      setSellConsent(false); setSellKey(null)
      await Promise.all([plans.refetch(), positions.refetch()])
    } catch (error) { setActionError(error instanceof Error ? error.message : common.errorGeneric) }
    finally { setBusy(null) }
  }
  const submitBuys = async () => {
    const retryable = latestPlan?.state === 'attention' && latestPlan.buyConfirmedAt && latestPlan.legs.some((leg) => leg.kind === 'buy' && !leg.orderId)
    if (!latestPlan || (latestPlan.state !== 'awaiting_buy_confirmation' && !retryable) || !buyConsent) return
    const key = buyKey ?? crypto.randomUUID()
    setBuyKey(key); setBusy('buy'); setActionError('')
    try {
      const result = await confirmRebalanceBuys(latestPlan.id, key)
      if (!result.ok) throw new Error(result.error.message)
      setBuyConsent(false); setBuyKey(null)
      await Promise.all([plans.refetch(), positions.refetch()])
    } catch (error) { setActionError(error instanceof Error ? error.message : common.errorGeneric) }
    finally { setBusy(null) }
  }
  const cancelActive = async () => {
    if (!activePlan) return
    setBusy('cancel'); setActionError('')
    try {
      const result = await cancelRebalance(activePlan.id)
      if (!result.ok) throw new Error(result.error.message)
      await Promise.all([plans.refetch(), positions.refetch()])
    } catch (error) { setActionError(error instanceof Error ? error.message : common.errorGeneric) }
    finally { setBusy(null) }
  }

  return <MaisonPage page="rebalance" dock topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>
    {positions.error && !positions.data ? <StateBlock tone="error" title={common.errorGeneric} body={positions.error.message} retry={positions.refetch} retryLabel={common.retry} />
      : !totals ? <Skeleton rows={5} />
      : !totals.rows.length ? <StateBlock title={p.positionsEmpty} body={p.positionsEmptyBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{p.browse}</button>} />
      : rows.length < 2 ? <StateBlock title={t.needTwo} body={t.needTwoBody} action={<button type="button" className={s.link} onClick={() => openPath('/assets?tab=positions')}>{p.positions}</button>} />
      : <>
        <Lacquer aria-live="polite">
          <span className={s.kicker}>{t.total} · USDT</span>
          <p className={`${s.bigFigure} ${s.num}`}><Figure value={Number(fromAtomic(whole.toString(), DECIMALS))} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /><small>USDT</small></p>
          <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--m-lacquer-muted)' }}>{t.reference}</p>
        </Lacquer>
        {totals.unpriced > 0 && <div className={s.notice} data-tone="info"><Info size={16} /><span>{fill(t.unpriced, { n: String(totals.unpriced) })}</span></div>}

        <div className={s.actionsRow}>
          <button type="button" className={s.ghost} data-size="s" onClick={equal}><Scale size={13} />{t.equal}</button>
          <button type="button" className={s.ghost} data-size="s" onClick={() => setDraft({})}>{t.reset}</button>
        </div>

        <SectionHead index="01" title={`${t.current} → ${t.target}`} note={t.delta} />
        <ul className={s.targets} ref={list}>{rows.map((row, index) => {
          const name = nameFor(products.data, row.productId, p.product)
          const target = targets[index]
          const delta = target === null ? null : whole * target / BPS - row.value
          const cur = current[row.key] ?? ZERO
          return <li key={row.key} className={s.targetRow}>
            <button type="button" onClick={() => openPath(`/assets/positions/${encodeURIComponent(row.productId)}`)} aria-label={`${t.open} · ${name}`}>
              <b>{name}</b>
              <small className={s.num}>{bare(row.value)} USDT · {t.current} {pctLabel(cur, locale)}</small>
            </button>
            <label className={s.targetInput} data-invalid={target === null || target > BPS || undefined}>
              <input inputMode="decimal" autoComplete="off" value={valueOf(row.key)} aria-label={fill(t.targetFor, { n: name })} aria-invalid={target === null || target > BPS}
                onChange={(event) => { const next = event.target.value.replace(',', '.').replace(/[^\d.]/g, ''); setDraft((prev) => ({ ...prev, [row.key]: next })) }} />
              <span>%</span>
            </label>
            <span className={s.targetBar} aria-hidden="true" style={{ ['--c' as string]: Number(cur) / 10_000, ['--t' as string]: Math.min(1, Number(target ?? ZERO) / 10_000) }}><i /><b /></span>
            <span className={s.targetMeta}>
              <span>{t.target} {target === null ? '—' : pctLabel(target, locale)}</span>
              <span className={delta === null ? s.muted : toneClass(delta)}>{delta === null ? '—' : delta === ZERO ? t.hold : <>{delta > ZERO ? t.buy : t.sell} <bdi dir="ltr" className={s.num}>{bare(delta < ZERO ? -delta : delta)} USDT</bdi></>}</span>
            </span>
          </li>
        })}</ul>
        <div className={s.targetSum} role="status">
          <span className={balanced ? s.muted : s.down}>{fill(t.sum, { v: pctLabel(sum, locale) })}</span>
          {!balanced && <span className={s.down}>{t.sumOff}</span>}
        </div>

        {actionError && <div className={s.notice} data-tone="down" role="alert"><Info size={16} /><span>{actionError}</span></div>}
        {plans.error && !plans.data && <StateBlock tone="error" title={common.errorGeneric} body={plans.error.message} retry={plans.refetch} retryLabel={common.retry} />}
        {latestPlan && <RebalanceProgress plan={latestPlan} locale={locale} stateText={stateText} onRefresh={plans.refetch} />}
        {activePlan && !activePlan.buyConfirmedAt && activePlan.legs.every((leg) => leg.kind !== 'sell' || leg.redemptionState !== 'completed') && <div className={s.actionsRow}>
          <button type="button" className={s.ghost} data-tone="down" disabled={busy !== null} aria-busy={busy === 'cancel'} onClick={() => void cancelActive()}>{cn ? '取消本次再平衡' : 'Cancel this rebalance'}</button>
        </div>}

        {!activePlan && <>
          <label className={s.notice} data-tone="info" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={sellConsent} onChange={(event) => setSellConsent(event.target.checked)} />
            <span>{cn ? '我确认先按上述目标提交卖出申请；实际到账前不会买入。' : 'I confirm the sell requests above. No buy order will be placed before actual proceeds arrive.'}</span>
          </label>
          <button type="button" className={s.cta} style={{ marginTop: 14, width: '100%' }} disabled={!balanced || !sellConsent || busy !== null || !plans.data} aria-busy={busy === 'sell'} onClick={() => void submitSells()}>
            <span>{busy === 'sell' ? (cn ? '正在提交…' : 'Submitting…') : (cn ? '确认并提交卖出' : 'Confirm and submit sells')}</span><span className={s.ctaIcon}><ChevronRight size={17} /></span>
          </button>
        </>}

        {(latestPlan?.state === 'awaiting_buy_confirmation' || (latestPlan?.state === 'attention' && latestPlan.buyConfirmedAt && latestPlan.legs.some((leg) => leg.kind === 'buy' && !leg.orderId))) && <>
          <label className={s.notice} data-tone="info" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={buyConsent} onChange={(event) => setBuyConsent(event.target.checked)} />
            <span>{cn ? '我已核对实际卖出到账净额和重新计算的买入金额，并确认提交买入申请。' : 'I reviewed the actual net proceeds and recalculated buy amounts, and confirm the buy orders.'}</span>
          </label>
          <button type="button" className={s.cta} style={{ marginTop: 14, width: '100%' }} disabled={!buyConsent || busy !== null} aria-busy={busy === 'buy'} onClick={() => void submitBuys()}>
            <span>{busy === 'buy' ? (cn ? '正在提交…' : 'Submitting…') : latestPlan.state === 'attention' ? (cn ? '重试未提交的买入' : 'Retry unsubmitted buys') : (cn ? '二次确认并提交买入' : 'Second confirmation and submit buys')}</span><span className={s.ctaIcon}><ChevronRight size={17} /></span>
          </button>
        </>}
      </>}
  </MaisonPage>
}

function RebalanceProgress({ plan, locale, stateText, onRefresh }: { plan: RebalancePlan; locale: string; stateText: Record<RebalancePlan['state'], string>; onRefresh: () => Promise<void> }) {
  const cn = locale === 'zh-CN'
  return <>
    <SectionHead index="02" title={cn ? '执行进度' : 'Execution progress'} note={stateText[plan.state]} />
    <div className={s.notice} data-tone={plan.state === 'attention' ? 'down' : plan.state === 'completed' ? 'up' : 'info'} role="status">
      <Info size={16} /><span><b>{stateText[plan.state]}</b>{plan.state === 'redemptions_submitted' && ` · ${cn ? '后台录入实际到账凭证后，系统才会计算买入金额。' : 'Buy amounts are calculated only after actual settlement evidence is posted.'}`}</span>
    </div>
    {BigInt(plan.sellProceedsAtomic) > ZERO && <StatStrip fit items={[{ label: cn ? '实际卖出到账 · USDT' : 'Actual redemption proceeds · USDT', value: bare(plan.sellProceedsAtomic) }]} />}
    <ul className={s.list}>{plan.legs.map((leg) => <li key={leg.id}>
      <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
        <span className={s.rowMain}><b>{leg.productName}</b><small>{leg.kind === 'sell' ? (cn ? '卖出申请' : 'Sell request') : (cn ? '买入申请' : 'Buy request')} · {leg.state}</small></span>
        <span className={s.rowFig}><b className={s.num} dir="ltr">{leg.kind === 'buy' ? `${bare(leg.requestedAmountAtomic)} USDT` : `${leg.requestedQuantityAtomic ?? '—'} atomic`}</b><small>{leg.failureCode ? <span className={s.badge} data-tone="down">{leg.failureCode}</span> : leg.actualAmountAtomic ? `${cn ? '实际到账' : 'Actual'} ${bare(leg.actualAmountAtomic)} USDT` : leg.redemptionState ?? leg.orderState ?? ''}</small></span>
      </div>
    </li>)}</ul>
    <div className={s.actionsRow}><button type="button" className={s.ghost} onClick={() => void onRefresh()}>{cn ? '刷新进度' : 'Refresh status'}</button></div>
  </>
}

/** `/assets/recurring` — user-authorized investment schedules and their execution records. */
export function RecurringScreen() {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].recurring
  return <MaisonPage page="recurring" dock topbar={<RwaTopbar screen="recurring" title={t.title} onBack={() => backOr('/assets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>
    <RecurringForm />
    <div className={s.actionsRow}>
      <button type="button" className={s.ghost} onClick={() => openPath('/markets')}>{t.markets}<ChevronRight size={14} /></button>
      <button type="button" className={s.ghost} onClick={() => openPath('/assets')}>{t.assets}</button>
    </div>
  </MaisonPage>
}
