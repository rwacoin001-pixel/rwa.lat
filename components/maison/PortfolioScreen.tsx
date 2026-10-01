'use client'
import { usePageState } from '@/lib/app-navigation'

import { ArrowRight, ArrowUpFromLine, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { POLL } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { getWallet, isListed, listProducts, TERMINAL_ORDER_STATES, type CatalogProduct, type Order } from '@/lib/api/markets'
import { getPortfolioHistory, listOrders, listPositions, listYield, share, totalsFor, type PositionRow, type YieldCredit } from '@/lib/api/portfolio'
import { fromAtomic, fmtUsdt } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { portfolioCopy } from '@/lib/maison-portfolio-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Figure, Lacquer, PollBar, PriceChart, Segmented, StatStrip, useAutoAnimate } from './motion'
import { RedeemDone, RedeemSheet, RedemptionsSection } from './RedeemSheet'
import { assetToolsCopy } from '@/lib/maison-assets-tools-copy'
import type { Redemption } from '@/lib/api/portfolio'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'
import { playMoment } from '@/lib/moment'

// Portfolio amounts are in the platform unit (USDT / USD quote, 6 decimals).
const DECIMALS = 6
const TABS = ['overview', 'positions', 'income', 'orders'] as const
type Tab = (typeof TABS)[number]

/** Display-only float for rolling figures; every sum above this line is BigInt. */
const asNumber = (atomic: bigint) => Number(fromAtomic(atomic.toString(), DECIMALS))
const signed = (atomic: bigint | null, locale: string) => atomic === null ? '—' : `${atomic > BigInt(0) ? '+' : ''}${fmtUsdt(atomic.toString(), { locale })}`
/** Unit-less amount for dense strips; the unit sits in the strip's caption. */
const bare = (atomic: string | bigint | null | undefined, sign = false) => {
  if (atomic === null || atomic === undefined) return '—'
  const text = fmtAtomic(atomic.toString(), DECIMALS, '', 2).trim()
  return sign && typeof atomic === 'bigint' && atomic > BigInt(0) ? `+${text}` : text
}
const toneOfBig = (atomic: bigint | null) => atomic === null || atomic === BigInt(0) ? undefined : atomic > BigInt(0) ? 'up' as const : 'down' as const
const pct = (ratio: number, locale: string) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(ratio)

function nameFor(products: CatalogProduct[] | undefined, productId: string, fallback: string) {
  return products?.find((product) => product.id === productId)?.displayName ?? `${fallback} ${productId.slice(0, 8)}`
}

function useProducts() {
  return useQuery('markets:catalog', listProducts, { staleTime: 60_000 })
}

function usePortfolio() {
  const positions = useQuery('portfolio:positions', listPositions, { staleTime: 15_000 })
  const wallet = useQuery('wallet:overview', getWallet, { staleTime: 15_000 })
  const totals = useMemo(() => positions.data ? totalsFor(positions.data) : null, [positions.data])
  return { positions, wallet, totals }
}

function orderTone(state: string) {
  return state === 'filled' ? 'live' : state === 'failed' || state === 'cancelled' ? 'down' : state === 'partially_filled' ? 'warn' : 'accent'
}

/** `/assets` — portfolio overview. Signed-in only (route guard); each section fails on its own. */
export function PortfolioScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const initial = new URLSearchParams(query).get('tab')
  const [tab, setTabState] = usePageState<Tab>('portfolio:tab', TABS.includes(initial as Tab) ? initial as Tab : 'overview')
  const setTab = (next: Tab) => {
    setTabState(next)
    const url = new URL(window.location.href)
    if (next === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }
  const products = useProducts()
  const { positions, wallet, totals } = usePortfolio()
  const balances = wallet.data?.balances
  const cash = balances ? BigInt(balances.availableAtomic) + BigInt(balances.lockedAtomic) : null
  // Only a complete total is shown as a total: positions and wallet must both be loaded.
  const total = totals && cash !== null ? totals.value + cash : null
  const pnlRatio = totals && totals.cost > BigInt(0) ? Number(totals.pnl * BigInt(1_000_000) / totals.cost) / 1_000_000 : null
  const retryAll = () => { positions.refetch(); wallet.refetch() }
  const bothFailed = positions.error && wallet.error

  return <MaisonPage page="portfolio" dock topbar={<RwaTopbar screen="portfolio" title={p.title} />}>
    <header className={s.hero}>
      <p className={s.kicker}><span className={s.liveDot} aria-hidden="true" />{p.kicker}</p>
      <h1 className={s.display}>{p.title}</h1>
    </header>

    {bothFailed ? <StateBlock tone="error" title={common.errorGeneric} body={positions.error?.message} retry={retryAll} retryLabel={common.retry} />
      : <Lacquer aria-live="polite">
        <span className={s.kicker}>{p.total} · USDT</span>
        {total === null && !positions.error && !wallet.error ? <Skeleton rows={1} />
          : <p className={`${s.bigFigure} ${s.num}`}>{total === null ? '—' : <Figure value={asNumber(total)} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />}<small>USDT</small></p>}
        <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 11.5 }}>
          {totals && totals.rows.length > 0 && <span dir="ltr" className={toneOfBig(totals.pnl) === 'up' ? s.up : toneOfBig(totals.pnl) === 'down' ? s.down : undefined} style={{ fontWeight: 600 }}>{signed(totals.pnl, locale)}{pnlRatio !== null && ` · ${pnlRatio > 0 ? '+' : ''}${pct(pnlRatio, locale)}`} </span>}
          {p.totalNote}
        </p>
        {/* Cards set into the total: holdings and income side by side, cash below with its three balances. */}
        <div className={s.nest}>
          <div>
            <span>{p.positions}</span>
            <b className={s.num}>{bare(totals?.value)}</b>
            <small className={s.num}>{p.cost} {bare(totals?.cost)}</small>
          </div>
          <div>
            <span>{p.yield}</span>
            <b className={`${s.num} ${totals && toneOfBig(totals.yield) === 'up' ? s.up : totals && toneOfBig(totals.yield) === 'down' ? s.down : ''}`}>{bare(totals?.yield, true)}</b>
            <small className={s.num}>{p.pnl} {bare(totals?.pnl, true)}</small>
          </div>
          <div data-wide="true">
            <span>{p.cash}</span>
            <StatStrip fit items={[
              { label: p.available, value: bare(balances?.availableAtomic) },
              { label: p.locked, value: bare(balances?.lockedAtomic) },
              { label: p.pending, value: bare(balances?.pendingAtomic) },
            ]} />
          </div>
        </div>
        {(positions.error || wallet.error) && <p className={s.muted} role="alert" style={{ margin: '10px 0 0', fontSize: 11.5 }}>
          {p.loadError} · <button type="button" className={s.link} onClick={retryAll}>{common.retry}</button>
        </p>}
      </Lacquer>}

    <div style={{ marginTop: 20 }}>
      <Segmented value={tab} onChange={setTab} label={p.title} sticky options={TABS.map((key, index) => ({ value: key, label: p.tabs[index] }))} />
    </div>

    {tab === 'overview' && <div className={s.tabPanel} role="tabpanel">
      <Allocation rows={totals?.rows} cash={cash} loading={positions.loading || wallet.loading} error={Boolean(positions.error)} retry={positions.refetch} products={products.data} />
      <History />
      <SectionHead index="03" title={p.positions} action={totals && totals.rows.length > 3 ? <button type="button" className={s.sectionMore} onClick={() => setTab('positions')}>{p.tabs[1]}<ChevronRight size={14} /></button> : undefined} />
      <PositionTable rows={totals?.rows.slice(0, 3)} whole={totals?.value ?? BigInt(0)} state={positions} products={products.data} />
      <SectionHead index="04" title={p.tools.cash} />
      <Tools />
    </div>}
    {tab === 'positions' && <div className={s.tabPanel} role="tabpanel">
      <SectionHead index="01" title={p.positions} note={totals ? `${totals.rows.length} · ${fmtUsdt(totals.value.toString(), { locale })}` : undefined} />
      <PositionTable rows={totals?.rows} whole={totals?.value ?? BigInt(0)} state={positions} products={products.data} />
    </div>}
    {tab === 'income' && <div className={s.tabPanel} role="tabpanel"><Income products={products.data} /></div>}
    {tab === 'orders' && <div className={s.tabPanel} role="tabpanel"><OpenOrders /></div>}
  </MaisonPage>
}

function Allocation({ rows, cash, loading, error, retry, products }: { rows: PositionRow[] | undefined; cash: bigint | null; loading: boolean; error: boolean; retry: () => void; products: CatalogProduct[] | undefined }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const slices = useMemo(() => {
    const priced = (rows ?? []).filter((row) => row.value !== null && row.value > BigInt(0)).map((row) => ({ key: row.position.productId + row.position.outcomeKey, label: nameFor(products, row.position.productId, p.product), value: row.value as bigint, cash: false }))
    const all = cash !== null && cash > BigInt(0) ? [...priced, { key: 'cash', label: p.cash, value: cash, cash: true }] : priced
    const whole = all.reduce((sum, slice) => sum + slice.value, BigInt(0))
    return { whole, items: all.sort((a, b) => a.value === b.value ? 0 : a.value > b.value ? -1 : 1).map((slice) => ({ ...slice, ratio: share(slice.value, whole) })) }
  }, [cash, p.cash, p.product, products, rows])
  return <>
    <SectionHead index="01" title={p.allocation} note={p.allocationNote} />
    {error ? <StateBlock tone="error" title={p.loadError} retry={retry} retryLabel={common.retry} />
      : loading && !rows ? <Skeleton rows={3} />
      : slices.items.length === 0 ? <StateBlock title={p.positionsEmpty} body={p.positionsEmptyBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{p.browse}</button>} />
      : <>
        <div className={s.alloc} role="img" aria-label={slices.items.map((slice) => `${slice.label} ${pct(slice.ratio, locale)}`).join(', ')}>
          {slices.items.map((slice, index) => <i key={slice.key} data-cash={slice.cash || undefined} style={{ flexBasis: `${slice.ratio * 100}%`, animationDelay: `${index * 60}ms` }} />)}
        </div>
        <ul className={s.allocLegend}>{slices.items.map((slice) => <li key={slice.key} data-cash={slice.cash || undefined}>
          <span className={s.allocKey} aria-hidden="true" />
          <span>{slice.label}</span>
          <small className={s.num}>{bare(slice.value)}</small>
          <b className={s.num}>{pct(slice.ratio, locale)}</b>
        </li>)}</ul>
      </>}
  </>
}

function History({ productId }: { productId?: string }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const history = useQuery(`portfolio:history:${productId ?? 'all'}`, () => getPortfolioHistory(productId), { staleTime: 60_000 })
  const points = useMemo(() => (history.data ?? [])
    .map((point) => ({ time: Date.parse(point.capturedAt) / 1000, value: /^-?\d+$/.test(point.totalValueAtomicAmount) ? Number(fromAtomic(point.totalValueAtomicAmount, DECIMALS)) : NaN }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time)
    // lightweight-charts needs strictly increasing times.
    .filter((point, index, all) => index === 0 || point.time > all[index - 1].time), [history.data])
  return <>
    <SectionHead index="02" title={p.history} note={p.historyNote} />
    {history.error ? <StateBlock tone="error" title={p.loadError} body={history.error.message} retry={history.refetch} retryLabel={common.retry} />
      : !history.data ? <Skeleton rows={3} />
      : points.length < 2 ? <StateBlock title={p.historyEmpty} body={p.historyEmptyBody} />
      : <>
        <PriceChart points={points} digits={2} locale={locale} label={p.history} unit="USDT" height={180} />
        <p className={s.foot}><span>{fill(p.valued, { t: fmtDateTime(new Date(points[points.length - 1].time * 1000).toISOString(), locale) })}</span><span>{fmtDate(new Date(points[0].time * 1000).toISOString(), locale)} – {fmtDate(new Date(points[points.length - 1].time * 1000).toISOString(), locale)}</span></p>
      </>}
  </>
}

function PositionTable({ rows, whole, state, products }: { rows: PositionRow[] | undefined; whole: bigint; state: { error?: { message: string } | null; refetch: () => void }; products: CatalogProduct[] | undefined }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 240 })
  if (state.error) return <StateBlock tone="error" title={p.loadError} body={state.error.message} retry={state.refetch} retryLabel={common.retry} />
  if (!rows) return <Skeleton rows={3} />
  if (!rows.length) return <StateBlock title={p.positionsEmpty} body={p.positionsEmptyBody} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{p.browse}</button>} />
  return <>
    <div className={s.tableHead} aria-hidden="true"><span>{p.product} · {p.qty}</span><span>{p.value} · {p.pnl}</span></div>
    <ul className={`${s.list} ${s.listCard}`} ref={list}>{rows.map((row) => {
      const name = nameFor(products, row.position.productId, p.product)
      const weight = share(row.value, whole)
      return <li key={row.position.productId + row.position.outcomeKey}>
        <button type="button" className={s.row} onClick={() => openPath(`/assets/positions/${encodeURIComponent(row.position.productId)}`)}>
          <Logo name={name} />
          <span className={s.rowMain}>
            <b>{name}</b>
            <small className={s.num}>{fmtAtomic(row.position.quantityAtomicAmount, row.position.assetDecimals, '', 4).trim()} · {pct(weight, locale)}</small>
            <span className={s.fillMeter} aria-hidden="true"><i style={{ ['--f' as string]: weight }} /></span>
          </span>
          <span className={s.rowFig}>
            <b className={s.num}>{row.value === null ? '—' : fmtUsdt(row.value.toString(), { locale })}</b>
            <small className={`${s.num} ${toneOfBig(row.pnl) === 'up' ? s.up : toneOfBig(row.pnl) === 'down' ? s.down : s.muted}`}>{signed(row.pnl, locale)}</small>
          </span>
        </button>
      </li>
    })}</ul>
  </>
}

function Tools() {
  const { locale } = useI18n()
  const t = portfolioCopy[locale].tools
  const items: Array<[string, string]> = [[t.cash, '/assets/cash'], [t.activity, '/assets/activity'], [t.calendar, '/assets/yield-calendar'], [t.rebalance, '/assets/rebalance'], [t.statements, '/assets/statements']]
  return <div className={s.toolGrid}>{items.map(([label, path]) => <button key={path} type="button" onClick={() => openPath(path)}><span>{label}</span><ChevronRight size={15} /></button>)}</div>
}

function Income({ products, productId }: { products: CatalogProduct[] | undefined; productId?: string }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const credits = useQuery('portfolio:yield', listYield, { staleTime: 60_000, pollInterval: 60_000 })
  const rows = useMemo(() => (credits.data ?? []).filter((item) => !productId || item.productId === productId).sort((a, b) => Date.parse(b.creditedAt) - Date.parse(a.creditedAt)), [credits.data, productId])
  const sum = useMemo(() => rows.reduce((total, item) => total + (/^\d+$/.test(item.atomicAmount) ? BigInt(item.atomicAmount) : BigInt(0)), BigInt(0)), [rows])
  const knownCredits = useRef<Set<string> | null>(null)
  const momentNode = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!credits.data) return
    const previous = knownCredits.current
    const newlyCredited = previous ? rows.filter((item) => !previous.has(item.id)) : []
    const current = previous ?? new Set<string>()
    rows.forEach((item) => current.add(item.id))
    knownCredits.current = current
    if (newlyCredited[0]?.id === rows[0]?.id) playMoment(momentNode.current, 'credit')
  }, [credits.data, rows])
  return <>
    <SectionHead index={productId ? '03' : '01'} title={productId ? p.detail.incomeFor : p.income} note={credits.data && rows.length ? `${rows.length} · ${signed(sum, locale)}` : p.incomeNote} />
    {credits.error ? <StateBlock tone="error" title={p.loadError} body={credits.error.message} retry={credits.refetch} retryLabel={common.retry} />
      : !credits.data ? <Skeleton rows={3} />
      : !rows.length ? <StateBlock title={p.incomeEmpty} body={p.incomeEmptyBody} />
      : <>
        <div className={s.tableHead} aria-hidden="true"><span>{p.product} · {p.period}</span><span>{p.income}</span></div>
        <ul className={s.list}>{rows.map((item: YieldCredit) => <li key={item.id}>
          <div ref={item.id === rows[0]?.id ? momentNode : undefined} className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
            <span className={s.rowMain}><b>{nameFor(products, item.productId, p.product)}</b><small>{fmtDate(item.periodStart, locale)} – {fmtDate(item.periodEnd, locale)}</small></span>
            <span className={s.rowFig}><b className={`${s.num} ${s.up}`}>{signed(/^\d+$/.test(item.atomicAmount) ? BigInt(item.atomicAmount) : null, locale)}</b><small className={s.muted}>{fmtDate(item.creditedAt, locale)}</small></span>
          </div>
        </li>)}</ul>
      </>}
  </>
}

function OrderRows({ orders, empty }: { orders: Order[]; empty: ReactNode }) {
  const { locale } = useI18n()
  const st = marketCopy[locale].status
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 240 })
  if (!orders.length) return <>{empty}</>
  return <ul className={s.list} ref={list}>{orders.map((order) => {
    const open = !TERMINAL_ORDER_STATES.has(order.state)
    return <li key={order.id}>
      <button type="button" className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }} onClick={() => openPath(open ? `/orders/status?id=${encodeURIComponent(order.id)}` : `/orders/${encodeURIComponent(order.id)}`)}>
        <span className={s.rowMain}><b>{order.productName}</b><small className={s.num}>{fmtDateTime(order.submittedAt, locale)} · {order.id.slice(0, 8)}</small></span>
        <span className={s.rowFig}><b className={s.num}>{fmtUsdt(order.requestedAtomicAmount, { locale })}</b><small><span className={s.badge} data-tone={orderTone(order.state)}>{st.states[order.state] ?? order.state}</span></small></span>
      </button>
    </li>
  })}</ul>
}

function OpenOrders({ productId }: { productId?: string }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const common = marketCopy[locale].common
  const [live, setLive] = useState(false)
  const orders = useQuery('orders:list', listOrders, { staleTime: 10_000, pollInterval: live ? POLL.pendingOrder : undefined })
  const scoped = useMemo(() => (orders.data ?? []).filter((order) => !productId || order.productId === productId).sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)), [orders.data, productId])
  const open = scoped.filter((order) => !TERMINAL_ORDER_STATES.has(order.state))
  const hasOpen = open.length > 0
  useEffect(() => { setLive(hasOpen) }, [hasOpen])
  const [beat, setBeat] = useState(0)
  useEffect(() => { if (orders.data) setBeat((value) => value + 1) }, [orders.data])
  // Product scope shows its full record; the overview tab shows what is still moving.
  const shown = productId ? scoped.slice(0, 8) : open
  return <>
    <SectionHead index={productId ? '04' : '01'} title={productId ? p.detail.ordersFor : p.orders} note={hasOpen ? p.ordersNote : undefined}
      action={<button type="button" className={s.sectionMore} onClick={() => openPath('/profile/documents')}>{p.allOrders}<ChevronRight size={14} /></button>} />
    {hasOpen && <PollBar every={POLL.pendingOrder} stamp={beat} label={p.ordersNote} />}
    {orders.error ? <StateBlock tone="error" title={p.loadError} body={orders.error.message} retry={orders.refetch} retryLabel={common.retry} />
      : !orders.data ? <Skeleton rows={3} />
      : <OrderRows orders={shown} empty={<StateBlock title={p.ordersEmpty} />} />}
  </>
}

/** `/assets/positions/:id` — one product position, joined to its quote, income and orders. */
export function PositionDetailScreen({ id }: { id: string | null }) {
  const { locale } = useI18n()
  const p = portfolioCopy[locale]
  const d = p.detail
  const common = marketCopy[locale].common
  const products = useProducts()
  const { positions, totals } = usePortfolio()
  const rows = totals?.rows.filter((row) => row.position.productId === id) ?? []
  const product = products.data?.find((item) => item.id === id)
  const name = id ? nameFor(products.data, id, p.product) : d.title
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemed, setRedeemed] = useState<Redemption | null>(null)
  const topbar = <RwaTopbar screen="position-detail" title={d.title} onBack={() => backOr('/assets')} />

  if (!id) return <MaisonPage page="position" topbar={topbar}><div className={s.hero}><StateBlock title={d.notFound} body={d.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/assets')}>{d.back}</button>} /></div></MaisonPage>
  if (!totals) return <MaisonPage page="position" topbar={topbar}><div className={s.hero}>
    {positions.error ? <StateBlock tone="error" title={common.errorGeneric} body={positions.error.message} retry={positions.refetch} retryLabel={common.retry} /> : <Skeleton rows={4} />}
  </div></MaisonPage>
  if (!rows.length) return <MaisonPage page="position" topbar={topbar}><div className={s.hero}><StateBlock title={d.notFound} body={d.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/assets')}>{d.back}</button>} /></div></MaisonPage>

  const value = rows.every((row) => row.value !== null) ? rows.reduce((sum, row) => sum + (row.value as bigint), BigInt(0)) : null
  const cost = rows.reduce((sum, row) => sum + row.cost, BigInt(0))
  const earned = rows.reduce((sum, row) => sum + row.yield, BigInt(0))
  const pnl = value === null ? null : value - cost
  const first = rows[0].position
  const slug = product?.externalRef ?? product?.id

  const listed = Boolean(product && isListed(product))
  const long = rows.find((row) => row.position.outcomeKey === 'long')?.position
  const r = assetToolsCopy[locale].redeem

  return <MaisonPage page="position" topbar={topbar} cta={listed || Boolean(long)}>
    <header className={s.hero}>
      <p className={s.kicker}>{d.title}</p>
      <h1 className={s.titleL}>{name}</h1>
    </header>
    <Lacquer aria-live="polite">
      <span className={s.kicker}>{p.marketValue} · USDT</span>
      <p className={`${s.bigFigure} ${s.num}`}>{value === null ? '—' : <Figure value={asNumber(value)} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />}<small>USDT</small></p>
      <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 11.5 }}>
        <span dir="ltr" className={toneOfBig(pnl) === 'up' ? s.up : toneOfBig(pnl) === 'down' ? s.down : undefined} style={{ fontWeight: 600 }}>{signed(pnl, locale)}</span> · {fill(p.valued, { t: fmtDateTime(first.valuedAt, locale) })}
      </p>
      <StatStrip fit items={[
        { label: d.quantity, value: fmtAtomic(rows.reduce((sum, row) => sum + BigInt(row.position.quantityAtomicAmount), BigInt(0)).toString(), first.assetDecimals, '', 4).trim() },
        { label: `${d.unitPrice} · ${first.currency}`, value: fmtAtomic(first.unitPriceAtomicAmount, first.unitPriceDecimals, '', 4).trim() },
        { label: p.cost, value: bare(cost) },
      ]} />
      <StatStrip fit items={[
        { label: p.pnl, value: bare(pnl, true), tone: toneOfBig(pnl) },
        { label: p.yield, value: bare(earned, true), tone: toneOfBig(earned) },
        { label: d.outcome, value: rows.map((row) => row.position.outcomeKey).join(' / ') },
      ]} />
    </Lacquer>
    <div className={s.tabPanel}>
      <History productId={id} />
      <Income products={products.data} productId={id} />
      <OpenOrders productId={id} />
      {redeemed && <RedeemDone item={redeemed} onDismiss={() => setRedeemed(null)} />}
      <RedemptionsSection productId={id} decimals={long?.assetDecimals ?? first.assetDecimals} index="05" />
      <p className={s.foot}><span>{d.source}: {first.source}</span>{slug && <button type="button" className={s.link} onClick={() => openPath(`/asset/${encodeURIComponent(slug)}`)}>{d.research}<ChevronRight size={13} /></button>}</p>
    </div>
    {(listed || long) && <div className={s.stickyCta}>
      {listed && <p>{marketCopy[locale].review.eligibility}</p>}
      <div className={listed && long ? s.ctaPair : undefined}>
        {long && <button type="button" className={listed ? s.ghost : s.cta} onClick={() => { setRedeemed(null); setRedeemOpen(true) }}>
          {listed ? r.action : <><span>{r.action}</span><span className={s.ctaIcon}><ArrowUpFromLine size={17} /></span></>}
        </button>}
        {listed && product && <button type="button" className={s.cta} onClick={() => openPath(`/orders/review?product=${encodeURIComponent(product.id)}`)}>
          <span>{d.investMore}</span>
          <span className={s.ctaIcon}><ArrowRight size={17} /></span>
        </button>}
      </div>
    </div>}
    {long && <RedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} onDone={(item) => { setRedeemOpen(false); setRedeemed(item) }}
      productId={id} name={name} positions={positions.data ?? []} unitPriceAtomic={long.unitPriceAtomicAmount} unitPriceDecimals={long.unitPriceDecimals} currency={long.currency} />}
  </MaisonPage>
}
