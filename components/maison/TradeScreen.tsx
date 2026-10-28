'use client'

import { AlertTriangle, ArrowRight, Check, Info } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { POLL } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { CANDLE_INTERVALS, OPEN_TRADING_STATES, cancelTradingOrder, getCandles, getOrderBook, getPair, getPairTrades, listPairs, listTradingOrders, placeTradingOrder, type CandleInterval, type MarketPair, type PlaceTradingOrderBody, type PublicTrade, type TradeLevel, type TradingOrder } from '@/lib/api/markets'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { backOr, openPath, signInThenReturn, useSignedIn } from '@/lib/maison-nav'
import { proCopy } from '@/lib/maison-pro-copy'
import { Logo, MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { DepthChart, Figure, PollBar, PriceChart, Segmented, StatStrip, useAutoAnimate } from './motion'
import { fmtDateTime } from './format'

const NUMBER = /^\d+(\.\d+)?$/
const ORDER_PATH = '/v1/market/orders'
const BOOK_POLL = 8_000
const LADDER_DEPTH = 8

/** Decimal places implied by a tick size such as 0.0001 → 4. */
function tickDigits(tick: number | null | undefined) {
  if (!tick || !Number.isFinite(tick) || tick >= 1) return 0
  return Math.min(10, Math.max(0, Math.ceil(-Math.log10(tick) - 1e-9)))
}

function fmtNum(value: number | null | undefined, digits: number) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits })
}

function baseOf(pair: Pick<MarketPair, 'symbol' | 'quoteAssetCode'>) {
  return pair.symbol.replace(new RegExp(`-${pair.quoteAssetCode}$`), '')
}

/** `/trade` and `/trade/:symbol` — public market data; placing and cancelling need a session. */
export function TradeScreen({ symbol }: { symbol: string | null }) {
  return symbol ? <PairScreen key={symbol} symbol={symbol} /> : <PairPicker />
}

function PairPicker() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].trade
  const pairs = useQuery('markets:pairs', listPairs, { staleTime: 30_000 })
  return <MaisonPage page="trade" dock topbar={<RwaTopbar screen="trade" title={t.pairs} onBack={() => backOr('/markets')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.pairs}</h1>
      <p className={s.lede}>{t.pairsBody}</p>
    </header>
    {!pairs.data && !pairs.error ? <Skeleton rows={3} />
      : pairs.error && !pairs.data ? <StateBlock tone="error" title={t.loadError} body={pairs.error.message} retry={pairs.refetch} retryLabel={copy.common.retry} />
      : pairs.data?.length ? <ul className={s.list}>{pairs.data.map((pair) => <li key={pair.id}>
        <button type="button" className={s.row} onClick={() => openPath(`/trade/${encodeURIComponent(pair.symbol)}`)}>
          <Logo name={baseOf(pair)} />
          <span className={s.rowMain}><b className={s.num}>{baseOf(pair)} / {pair.quoteAssetCode}</b><small>{pair.state === 'active' ? copy.markets.active : copy.markets.paused}</small></span>
          <span className={s.rowFig}><b className={s.num}>{fmtNum(pair.lastPrice, tickDigits(pair.tickSize))}</b></span>
        </button>
      </li>)}</ul>
      : <StateBlock title={copy.common.empty} />}
    <div className={s.notice}><Info size={16} /><span>{t.settlement}</span></div>
  </MaisonPage>
}

function PairScreen({ symbol }: { symbol: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].trade
  const pro = proCopy[locale]
  const signedIn = useSignedIn()
  const [interval, setCandleInterval] = useState<CandleInterval>('1h')
  const [picked, setPicked] = useState<{ price: number; n: number } | null>(null)
  const pair = useQuery(`trade:pair:${symbol}`, () => getPair(symbol), { staleTime: 15_000, pollInterval: 30_000 })
  const book = useQuery(pair.data ? `trade:book:${symbol}` : null, () => getOrderBook(symbol), { staleTime: 4_000, pollInterval: BOOK_POLL })
  const trades = useQuery(pair.data ? `trade:trades:${symbol}` : null, () => getPairTrades(symbol), { staleTime: 8_000, pollInterval: 15_000 })
  const candles = useQuery(pair.data ? `trade:candles:${symbol}:${interval}` : null, () => getCandles(symbol, interval), { staleTime: 60_000, pollInterval: POLL.list })
  const orders = useQuery(signedIn && pair.data ? 'trade:orders' : null, listTradingOrders, { staleTime: 5_000, pollInterval: 15_000 })
  const title = pair.data ? `${baseOf(pair.data)} / ${pair.data.quoteAssetCode}` : symbol
  const topbar = <RwaTopbar screen="trade" title={title} onBack={() => backOr('/markets?tab=trade')} />

  const series = useMemo(() => (candles.data?.candles ?? [])
    .map((candle) => ({ time: Date.parse(candle.time) / 1000, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume }))
    .filter((candle) => Number.isFinite(candle.time) && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)), [candles.data])

  if (!pair.data && !pair.error) return <MaisonPage page="trade" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (!pair.data) return <MaisonPage page="trade" dock topbar={topbar}><div className={s.hero}>
    {pair.error?.status === 404 ? <StateBlock title={t.notFound} body={t.notFoundBody} action={<button type="button" className={s.link} onClick={() => openPath('/trade')}>{t.pairs}</button>} />
      : <StateBlock tone="error" title={t.loadError} body={pair.error?.message} retry={pair.refetch} retryLabel={copy.common.retry} />}
  </div></MaisonPage>

  const p = pair.data
  const digits = tickDigits(p.tickSize)
  const active = p.state === 'active'
  const mine = (orders.data ?? []).filter((order) => order.symbol === p.symbol)
  const bestBid = book.data?.bids[0]?.price ?? null
  const bestAsk = book.data?.asks[0]?.price ?? null
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null
  const last = book.data?.lastPrice ?? p.lastPrice
  const high = series.length ? Math.max(...series.map((candle) => candle.high)) : null
  const low = series.length ? Math.min(...series.map((candle) => candle.low)) : null
  const volume = series.length ? series.reduce((sum, candle) => sum + (Number.isFinite(candle.volume) ? candle.volume : 0), 0) : null
  const change = series.length >= 2 && series[0].open ? (series[series.length - 1].close - series[0].open) / series[0].open : null
  const priceFormat = { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits }

  return <MaisonPage page="trade" dock topbar={topbar}>
    <header className={s.hero} style={{ paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo name={baseOf(p)} />
        <div style={{ minWidth: 0 }}>
          <h1 className={`${s.titleL} ${s.num}`} style={{ margin: 0, fontSize: 22 }}>{title}</h1>
          <p className={s.kicker} style={{ marginTop: 4 }}>{active ? <><span className={s.liveDot} aria-hidden="true" />{pro.live}</> : copy.markets.paused}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 12px', marginTop: 16 }}>
        <p className={s.bigFigure} style={{ margin: 0 }} aria-label={t.last}><Figure value={last} format={priceFormat} /><small>{p.quoteAssetCode}</small></p>
        {change !== null && <span className={`${s.pill} ${s.num} ${change > 0 ? s.up : change < 0 ? s.down : ''}`}>{change > 0 ? '+' : ''}{(change * 100).toFixed(2)}%</span>}
      </div>
      <StatStrip items={[
        { label: pro.bestBid, value: fmtNum(bestBid, digits), tone: bestBid !== null ? 'up' : undefined },
        { label: pro.bestAsk, value: fmtNum(bestAsk, digits), tone: bestAsk !== null ? 'down' : undefined },
        { label: pro.spread, value: spread === null ? '—' : `${fmtNum(spread, digits)}${bestAsk ? ` · ${(spread / bestAsk * 100).toFixed(2)}%` : ''}` },
        { label: `${pro.high} · ${interval}`, value: fmtNum(high, digits) },
        { label: `${pro.low} · ${interval}`, value: fmtNum(low, digits) },
        { label: `${pro.volume} · ${interval}`, value: volume === null ? '—' : volume.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 }) },
      ]} />
      <div style={{ marginTop: 12 }}><PollBar every={BOOK_POLL} stamp={book.data?.updatedAt} label={fill(pro.refresh, { s: BOOK_POLL / 1000 })} /></div>
    </header>

    <section className={s.panel} aria-label={t.chart}>
      <div className={s.panelHead}>
        <h3>{t.chart}</h3>
        <div className={s.chips} data-dense="true" role="group" aria-label={t.chart}>
          {CANDLE_INTERVALS.map((value) => <button key={value} type="button" className={s.chip} aria-pressed={interval === value} onClick={() => setCandleInterval(value)}>{value}</button>)}
        </div>
      </div>
      {!candles.data && !candles.error ? <Skeleton rows={2} />
        : candles.error && !candles.data ? <StateBlock tone="error" title={t.loadError} body={candles.error.message} retry={candles.refetch} retryLabel={copy.common.retry} />
        : series.length >= 2 ? <>
          <PriceChart key={interval} candles={series} digits={digits} locale={locale} label={`${title} · ${interval}`} unit={p.quoteAssetCode} height={200} />
          <p className={s.foot} style={{ marginTop: 6 }}><span className={s.num}>{fill(pro.candles, { n: series.length })} · {interval}</span></p>
        </>
        : <StateBlock title={t.chartEmpty} />}
    </section>

    <section className={s.panel} aria-label={t.book}>
      <div className={s.panelHead}><h3>{t.book}</h3>{book.data && <small className={s.muted} style={{ fontSize: 11 }}>{active && signedIn ? pro.tapLevel : fmtDateTime(book.data.updatedAt, locale, { timeStyle: 'medium' })}</small>}</div>
      {!book.data && !book.error ? <Skeleton rows={3} />
        : book.error && !book.data ? <StateBlock tone="error" title={t.loadError} body={book.error.message} retry={book.refetch} retryLabel={copy.common.retry} />
        : book.data && (book.data.bids.length || book.data.asks.length) ? <>
          {book.data.bids.length + book.data.asks.length >= 3 && <DepthChart bids={book.data.bids} asks={book.data.asks} label={pro.depth} />}
          <Ladder bids={book.data.bids} asks={book.data.asks} last={last} spread={spread} digits={digits} quote={p.quoteAssetCode}
            onPick={active && signedIn ? (price) => setPicked((current) => ({ price, n: (current?.n ?? 0) + 1 })) : undefined} />
        </>
        : <StateBlock title={t.bookEmpty} />}
    </section>

    <section className={s.panel} aria-label={t.trades}>
      <div className={s.panelHead}><h3>{t.trades}</h3></div>
      {!trades.data && !trades.error ? <Skeleton rows={2} />
        : trades.error && !trades.data ? <StateBlock tone="error" title={t.loadError} body={trades.error.message} retry={trades.refetch} retryLabel={copy.common.retry} />
        : trades.data?.length ? <TradeTape trades={trades.data.slice(0, 14)} digits={digits} />
        : <StateBlock title={t.noTrades} />}
    </section>

    <SectionHead title={t.place} />
    <div className={s.notice} role="note"><AlertTriangle size={16} /><span>{t.settlement}</span></div>
    {!active ? <div style={{ marginTop: 12 }}><StateBlock tone="unavailable" title={t.paused} /></div>
      : signedIn ? <Ticket pair={p} digits={digits} bestBid={bestBid} bestAsk={bestAsk} picked={picked} />
      : <button type="button" className={s.cta} style={{ marginTop: 16, width: '100%' }} onClick={() => signInThenReturn()}><span>{t.signIn}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>}

    {signedIn && <>
      <SectionHead title={t.myOrders} action={mine.length ? <small className={`${s.muted} ${s.num}`}>{mine.length}</small> : undefined} />
      {!orders.data && !orders.error ? <Skeleton rows={2} />
        : orders.error && !orders.data ? <StateBlock tone="error" title={copy.common.errorGeneric} body={orders.error.message} retry={orders.refetch} retryLabel={copy.common.retry} />
        : mine.length ? <MyOrders orders={mine} digits={digits} />
        : <StateBlock title={t.noOrders} />}
    </>}
  </MaisonPage>
}

/** Exchange ladder: asks above (best ask nearest the mid), last price + spread in the middle, bids below. */
function Ladder({ bids, asks, last, spread, digits, quote, onPick }: { bids: TradeLevel[]; asks: TradeLevel[]; last: number | null; spread: number | null; digits: number; quote: string; onPick?: (price: number) => void }) {
  const { locale } = useI18n()
  const t = tradeCopy[locale].trade
  const pro = proCopy[locale]
  const rows = (levels: TradeLevel[]) => { let total = 0; return levels.slice(0, LADDER_DEPTH).map((level) => ({ ...level, total: (total += level.quantity) })) }
  const b = rows(bids), a = rows(asks)
  const max = Math.max(b[b.length - 1]?.total ?? 0, a[a.length - 1]?.total ?? 0) || 1
  const bidQty = b[b.length - 1]?.total ?? 0, askQty = a[a.length - 1]?.total ?? 0
  const share = bidQty + askQty ? bidQty / (bidQty + askQty) : null
  const level = (row: TradeLevel & { total: number }) => <li key={row.price} style={{ ['--d' as string]: Math.min(1, row.total / max) }}>
    <button type="button" disabled={!onPick} onClick={() => onPick?.(row.price)} aria-label={`${t.price} ${fmtNum(row.price, digits)}`}>
      <b>{fmtNum(row.price, digits)}</b><span>{fmtNum(row.quantity, 4)}</span><span>{fmtNum(row.total, 4)}</span>
    </button>
  </li>
  const empty = <li><button type="button" disabled><span>—</span></button></li>
  return <div className={s.ladder}>
    <div className={s.ladderHead}><span>{t.price} · {quote}</span><span>{pro.size}</span><span>{pro.sum}</span></div>
    <ol data-side="ask" aria-label={t.asks}>{a.length ? a.map(level) : empty}</ol>
    <div className={s.ladderMid}>
      <b><Figure value={last} format={{ minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits }} /></b>
      <span>{pro.spread} {spread === null ? '—' : fmtNum(spread, digits)}</span>
    </div>
    <ol data-side="bid" aria-label={t.bids}>{b.length ? b.map(level) : empty}</ol>
    {share !== null && <div className={s.pressure} role="img" aria-label={`${pro.pressure} ${(share * 100).toFixed(0)}% / ${(100 - share * 100).toFixed(0)}%`}>
      <span>{(share * 100).toFixed(0)}%</span><i><i style={{ width: `${share * 100}%` }} /></i><span>{(100 - share * 100).toFixed(0)}%</span>
    </div>}
  </div>
}

/** Recent fills, newest first. Tick direction (vs the next older fill) colours the price; new rows slide in. */
function TradeTape({ trades, digits }: { trades: PublicTrade[]; digits: number }) {
  const { locale } = useI18n()
  const pro = proCopy[locale]
  const [list] = useAutoAnimate<HTMLOListElement>({ duration: 260 })
  return <>
    <div className={s.ladderHead} style={{ paddingInline: 0 }}><span>{pro.time}</span><span>{pro.price}</span><span>{pro.size}</span></div>
    <ol className={s.trades} ref={list}>{trades.map((trade, index) => {
      const older = trades[index + 1]?.price
      const tone = older === undefined || older === trade.price ? '' : trade.price > older ? s.up : s.down
      return <li key={trade.id}>
        <time dateTime={trade.at}>{fmtDateTime(trade.at, locale, { timeStyle: 'medium' })}</time>
        <b className={tone} style={{ fontWeight: 600 }}>{fmtNum(trade.price, digits)}</b>
        <span>{fmtNum(trade.quantity, 4)}</span>
      </li>
    })}</ol>
  </>
}

function Ticket({ pair, digits, bestBid, bestAsk, picked }: { pair: MarketPair; digits: number; bestBid: number | null; bestAsk: number | null; picked: { price: number; n: number } | null }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].trade
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [type, setType] = useState<'limit' | 'market'>('limit')
  const [price, setPrice] = useState(() => pair.lastPrice ? String(pair.lastPrice) : '')
  const [quantity, setQuantity] = useState('')
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())

  // A tap on a ladder level fills the limit price (and switches to limit, since market has no price).
  useEffect(() => {
    if (!picked) return
    setType('limit')
    setPrice(picked.price.toFixed(digits))
    setServerError(null)
    setPlaced(null)
  }, [digits, picked])

  const error = useMemo(() => {
    if (quantity && (!NUMBER.test(quantity) || Number(quantity) <= 0)) return t.errors.qty
    if (quantity && Number(quantity) < pair.minQuantity) return fill(t.errors.min, { v: pair.minQuantity })
    if (type === 'limit' && price && (!NUMBER.test(price) || Number(price) <= 0)) return t.errors.price
    return null
  }, [pair.minQuantity, price, quantity, t.errors, type])
  const refPrice = type === 'limit' ? (NUMBER.test(price) ? Number(price) : null) : side === 'buy' ? bestAsk : bestBid
  const total = refPrice && quantity && !error ? refPrice * Number(quantity) : null
  const ready = Boolean(quantity && !error && (type === 'market' || price) && !pending)

  const clear = () => { setServerError(null); setPlaced(null) }
  const nudge = (steps: number) => {
    if (!pair.tickSize) return
    const base = NUMBER.test(price) ? Number(price) : pair.lastPrice ?? 0
    const next = Math.max(0, Math.round((base + steps * pair.tickSize) / pair.tickSize) * pair.tickSize)
    setPrice(next.toFixed(digits))
    clear()
  }
  const submit = async () => {
    if (!ready) return
    const intent: Omit<PlaceTradingOrderBody, 'idempotencyKey'> = { symbol: pair.symbol, side, type, quantity: Number(quantity), ...(type === 'limit' ? { price: Number(price) } : {}) }
    // Same intent → same key, so a retry after a timeout cannot rest a second order.
    const idempotencyKey = idempotencyKeyForIntent(keys.current, 'POST', ORDER_PATH, intent)
    setPending(true)
    clear()
    const result = await placeTradingOrder({ ...intent, idempotencyKey })
    setPending(false)
    if (!result.ok) { setServerError(t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric); return }
    // Confirmed: the next identical ticket is a new, deliberate order.
    keys.current.clear()
    setQuantity('')
    setPlaced(fill(t.placed, { s: t.states[result.data.state] ?? result.data.state }))
    invalidate(['trade:'])
  }

  return <section className={s.panel} style={{ marginTop: 12 }} aria-label={t.place}>
    <div className={s.outcome} role="group" aria-label={t.place} style={{ marginTop: 0 }}>
      <button type="button" data-side="yes" aria-pressed={side === 'buy'} onClick={() => { setSide('buy'); clear() }}>{t.buy}</button>
      <button type="button" data-side="no" aria-pressed={side === 'sell'} onClick={() => { setSide('sell'); clear() }}>{t.sell}</button>
    </div>
    <div style={{ marginTop: 12 }}>
      <Segmented role="group" label={t.place} value={type} onChange={(value) => { setType(value); clear() }} options={[{ value: 'limit', label: t.limit }, { value: 'market', label: t.market }]} />
    </div>
    {type === 'limit' && <div className={s.field}>
      <span id="ticket-price-label">{t.price} · {pair.quoteAssetCode}</span>
      <span className={s.stepper}>
        <button type="button" onClick={() => nudge(-1)} aria-label={`− ${pair.tickSize}`}>−</button>
        <input inputMode="decimal" autoComplete="off" value={price} placeholder={fmtNum(pair.lastPrice, digits)} aria-invalid={error === t.errors.price} aria-labelledby="ticket-price-label"
          onChange={(event) => { setPrice(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); clear() }} />
        <button type="button" onClick={() => nudge(1)} aria-label={`+ ${pair.tickSize}`}>+</button>
      </span>
    </div>}
    <label className={s.field}>
      <span>{t.qty} · {baseOf(pair)}</span>
      <input inputMode="decimal" autoComplete="off" value={quantity} placeholder={String(pair.minQuantity)} aria-invalid={Boolean(error && error !== t.errors.price)}
        onChange={(event) => { setQuantity(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); clear() }} />
    </label>
    <div className={s.fieldMeta}><span>{fill(t.min, { v: pair.minQuantity })} · {fill(t.tick, { v: pair.tickSize })}</span><span className={s.num}>{t.total} {total === null ? '—' : `${fmtNum(total, Math.max(2, digits))} ${pair.quoteAssetCode}`}</span></div>
    {error && <p className={s.fieldError} role="alert">{error}</p>}
    {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
    {placed && <div className={s.notice} role="status"><Check size={16} /><span>{placed}</span></div>}
    <button type="button" className={s.cta} style={{ marginTop: 12, width: '100%' }} onClick={submit} disabled={!ready} aria-busy={pending}>
      <span>{pending ? t.placing : `${side === 'buy' ? t.buy : t.sell} · ${t.place}`}</span>
      <span className={s.ctaIcon}><ArrowRight size={17} /></span>
    </button>
  </section>
}

function MyOrders({ orders, digits }: { orders: TradingOrder[]; digits: number }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].trade
  const [cancelling, setCancelling] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const cancel = async (id: string) => {
    if (cancelling.has(id)) return
    setCancelling((current) => new Set(current).add(id))
    setErrors(({ [id]: _drop, ...rest }) => rest)
    const result = await cancelTradingOrder(id)
    setCancelling((current) => { const next = new Set(current); next.delete(id); return next })
    if (!result.ok) { setErrors((current) => ({ ...current, [id]: t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric })); return }
    invalidate(['trade:'])
  }

  const [list] = useAutoAnimate<HTMLDivElement>({ duration: 240 })
  return <div ref={list}>{orders.map((order) => {
    const busy = cancelling.has(order.id)
    const filled = order.quantity > 0 ? Math.min(1, order.filledQuantity / order.quantity) : 0
    return <div key={order.id}>
      <div className={s.orderLine}>
        <span>
          <b className={order.side === 'buy' ? s.up : s.down}>{order.side === 'buy' ? t.buy : t.sell} · <span className={s.num}>{fmtNum(order.quantity, 4)}</span> @ <span className={s.num}>{order.type === 'market' || !order.price ? t.market : fmtNum(order.price, digits)}</span></b>
          <small>{t.states[order.state] ?? order.state} · {fill(t.filled, { v: fmtNum(order.filledQuantity, 4) })} · {fmtDateTime(order.createdAt, locale)}</small>
          <span className={s.fillMeter} aria-hidden="true"><i style={{ ['--f' as string]: filled }} /></span>
        </span>
        {OPEN_TRADING_STATES.has(order.state) && <button type="button" className={s.ghost} onClick={() => void cancel(order.id)} disabled={busy} aria-busy={busy}>{busy ? t.cancelling : t.cancel}</button>}
      </div>
      {errors[order.id] && <p className={s.fieldError} role="alert">{errors[order.id]}</p>}
    </div>
  })}</div>
}
