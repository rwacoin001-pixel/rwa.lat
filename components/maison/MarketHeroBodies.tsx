'use client'

import { ArrowRight, ChevronRight } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { POLL } from '@/lib/api/_http'
import { getCandles, getOrderBook, listPairs, listRwaAssets, type Candle, type TradeLevel } from '@/lib/api/markets'
import { fmtUsd } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { heroCardCopy } from '@/lib/hero-card-copy'
import { HENGXU_FEATURED, HENGXU_PRODUCTS, hengxuImage } from '@/lib/hengxu-products'
import { hengxuCopy, hengxuText } from '@/lib/hengxu-copy'
import { openPath } from '@/lib/maison-nav'
import { minText, names, riskLabel, useListings } from './HengxuScreen'
import { maison as s } from './primitives'
import { Figure } from './motion'
import { fmtDateTime, fmtWhen } from './format'
import h from './hero-card.module.css'

const at = (i: number) => ({ '--i': i }) as CSSProperties
const HOUR = 3_600_000
const SLOTS = 24
const DEPTH = 10
const TOP = 8
const digits = (value: number) => value >= 1000 ? 2 : value >= 1 ? 4 : 6
const fmtPrice = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits(value) })
const notional = (levels: TradeLevel[] | undefined) => (levels ?? []).reduce((sum, level) => sum + level.price * level.quantity, 0)
const share = (value: number, locale: string) => `${(value * 100).toLocaleString(locale, { maximumFractionDigits: value < .1 ? 1 : 0 })}%`
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`
const FEATURED = HENGXU_PRODUCTS.find((product) => product.id === HENGXU_FEATURED) ?? HENGXU_PRODUCTS[0]

/** The risk line under the baskets card: a concept strategy carries the concept disclaimer, a listed one the NAV line. */
export function useBasketNote() {
  const { locale } = useI18n()
  return useListings().has(FEATURED.id) ? heroCardCopy[locale].basketNote : hengxuCopy[locale].ctaNote
}

/** Baskets body — a film poster: full-bleed art, the billing block read bottom-up, one gold action. Deliberately no
 *  return or NAV figure (a promotional surface must not advertise yield), and an unlisted strategy always says it is
 *  not open. Until portrait art exists the landscape derivative is cropped around the product's own focus point. */
export function BasketPoster() {
  const { locale } = useI18n()
  const copy = hengxuCopy[locale]
  const listing = useListings().get(FEATURED.id)
  const product = FEATURED
  const text = hengxuText(product, locale)
  const { mark, sub, lang } = names(product, locale)
  const level = typeof product.risk === 'number' ? product.risk : 0
  const research = product.stage === 'research' || product.stage === 'special'
  // Body copy only exists in zh/en; other locales read English.
  const body = locale === 'zh-CN' || locale === 'en' ? {} : { lang: 'en', dir: 'auto' as const }
  const [loaded, setLoaded] = useState(false)
  const open = () => openPath(`/strategy/${product.id}`)

  return <div className={h.poster} data-loaded={loaded || undefined}>
    <span className={h.posterArt}>
      <Image src={hengxuImage(product, 1440)} alt={text.alt} fill sizes="(max-width: 520px) 100vw, 480px" onLoad={() => setLoaded(true)} style={{ objectFit: 'cover', objectPosition: product.image.focus }} />
    </span>
    <span className={h.posterScrim} aria-hidden="true" />
    <div className={h.posterBody}>
      <div className={`${h.tier} ${h.posterTop}`} data-tier="1">
        <span className={`${h.posterNo} ${h.reveal}`} style={at(0)} dir="ltr">{copy.tab} · No.{product.no} / {HENGXU_PRODUCTS.length}</span>
        <span className={`${s.badge} ${h.reveal}`} style={at(0)} data-tone={listing ? 'live' : research ? 'warn' : 'accent'}>{listing ? copy.listed : `${copy.stage[product.stage]} · ${copy.terms.closed}`}</span>
      </div>
      <div>
        <div className={h.tier} data-tier="2">
          <button type="button" className={`${h.posterMark} ${h.reveal}`} style={at(1)} onClick={open} lang={lang}>{mark}</button>
          <p className={`${h.posterSub} ${h.reveal}`} style={at(2)}>{sub}</p>
          <p className={`${h.posterLine} ${h.reveal}`} style={at(2)} {...body}>{text.oneLiner}</p>
        </div>
        <div className={h.tier} data-tier="3">
          <dl className={`${h.posterCredits} ${h.reveal}`} style={at(3)}>
            <div><dt>{copy.fields.risk}</dt><dd><span className={h.posterTicks} aria-hidden="true">{[1, 2, 3, 4].map((tick) => <i key={tick} data-on={tick <= level || undefined} />)}</span>{riskLabel(copy, product.risk)}</dd></div>
            <div><dt>{copy.fields.hold}</dt><dd>{copy.horizon[product.horizon]}</dd></div>
            <div><dt>{copy.fields.min}</dt><dd className={h.num}>{minText(product, copy)}</dd></div>
          </dl>
          <div className={`${h.posterActions} ${h.reveal}`} style={at(4)}>
            <button type="button" className={h.posterCta} onClick={open}><span>{listing ? copy.subscribe : copy.learn}</span><ArrowRight size={15} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
}

/** 24 hourly slots placed by time, right-aligned on the newest candle: a quiet hour stays an empty slot instead of
 *  stretching its neighbours. Non-uniform scaling is fine for bodies; wicks keep a 1px stroke. */
function Candles({ rows, label }: { rows: Candle[]; label: string }) {
  const high = Math.max(...rows.map((row) => row.high))
  const low = Math.min(...rows.map((row) => row.low))
  const span = high - low || Math.abs(high) * .01 || 1
  const y = (value: number) => 4 + (high - value) / span * 92
  const last = Date.parse(rows[rows.length - 1].time)
  return <svg className={h.candles} viewBox={`0 0 ${SLOTS * 10} 100`} preserveAspectRatio="none" role="img" aria-label={label}>
    {rows.map((row) => {
      const slot = SLOTS - 1 - Math.round((last - Date.parse(row.time)) / HOUR)
      if (slot < 0) return null
      const top = y(Math.max(row.open, row.close))
      return <g key={row.time} data-tone={row.close < row.open ? 'down' : undefined} style={at(slot)}>
        <line x1={slot * 10 + 5} x2={slot * 10 + 5} y1={y(row.high)} y2={y(row.low)} vectorEffect="non-scaling-stroke" />
        <rect x={slot * 10 + 2} width={6} y={top} height={Math.max(1, y(Math.min(row.open, row.close)) - top)} />
      </g>
    })}
  </svg>
}

/** Trade body — no art: the first active pair's last price, its last 24 hourly candles and the book's buy/sell
 *  weight. Every figure comes from /v1/market/*; the 24h stats are derived from those candles (see 后端需求 §9c/§12).
 *  Gold is the buy side only; sell is the outline pill, mirroring Yes/No on predictions. */
export function TradeGauge() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const text = heroCardCopy[locale]
  const pairs = useQuery('markets:pairs', listPairs, { staleTime: 30_000, pollInterval: POLL.market, loading: 'silent' })
  const pair = pairs.data?.find((entry) => entry.state === 'active' && entry.lastPrice !== null) ?? pairs.data?.[0]
  const symbol = pair?.symbol
  const candles = useQuery(symbol ? `markets:hero:candles:${symbol}` : null, () => getCandles(symbol!, '1h', SLOTS), { staleTime: 60_000, pollInterval: 60_000, loading: 'silent' })
  const book = useQuery(symbol ? `markets:hero:book:${symbol}` : null, () => getOrderBook(symbol!, DEPTH), { staleTime: POLL.market, pollInterval: POLL.market, loading: 'silent' })
  const day = useMemo(() => {
    const since = Date.now() - 24 * HOUR
    const rows = (candles.data?.candles ?? []).filter((row) => Date.parse(row.time) > since && [row.open, row.high, row.low, row.close].every(Number.isFinite)).sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    if (!rows.length) return null
    const first = rows[0]
    const last = rows[rows.length - 1]
    return { rows, close: last.close, high: Math.max(...rows.map((row) => row.high)), low: Math.min(...rows.map((row) => row.low)), change: first.open > 0 ? (last.close - first.open) / first.open * 100 : null }
  }, [candles.data])
  const bid = book.data?.bids.length ? Math.max(...book.data.bids.map((level) => level.price)) : null
  const ask = book.data?.asks.length ? Math.min(...book.data.asks.map((level) => level.price)) : null
  const bidWeight = notional(book.data?.bids)
  const total = bidWeight + notional(book.data?.asks)
  const buyShare = total > 0 ? bidWeight / total : null
  const price = pair?.lastPrice ?? day?.close ?? null
  const base = pair ? pair.symbol.replace(new RegExp(`-${pair.quoteAssetCode}$`), '') : ''
  const live = pair?.state === 'active'
  const open = () => symbol && openPath(`/trade/${encodeURIComponent(symbol)}`)
  const depth = fill(text.depth, { n: DEPTH.toLocaleString(locale) })
  // Loaded, and nothing rests on the book and no candle exists: the pair is listed but quiet. Say that plainly
  // instead of drawing an empty chart, an empty depth bar and three dashes under a "trading" badge.
  const settled = (candles.data || candles.error) && (book.data || book.error)
  const quiet = Boolean(settled) && !day && bid === null && ask === null

  return <div className={h.inner} data-quiet={quiet || undefined}>
    {!pairs.data && !pairs.error ? <div className={h.skeleton} aria-busy="true"><i /><i /><i /></div>
      : !pair ? <div className={h.state} role={pairs.error ? 'alert' : 'status'}>
        <span>{pairs.error ? copy.markets.loadError : copy.markets.pairsEmpty}</span>
        {pairs.error && <button type="button" onClick={() => void pairs.refetch()}>{copy.common.retry}</button>}
      </div>
      : <>
        <div className={h.tier} data-tier="1">
          <div className={`${h.top} ${h.reveal}`} style={at(0)}>
            <span className={`${h.tag} ${h.num}`}>{base} / {pair.quoteAssetCode}</span>
            <span className={h.live} data-on={(live && !quiet) || undefined}>{!live ? copy.markets.paused : quiet ? text.quietBadge : copy.markets.active}</span>
          </div>
          <div className={`${h.prob} ${h.reveal}`} style={at(1)}>
            <span className={`${h.big} ${h.bigPrice} ${h.num}`}><Figure value={price} locale="en-US" format={{ minimumFractionDigits: 2, maximumFractionDigits: digits(price ?? 0) }} /><small>{pair.quoteAssetCode}</small></span>
            {day?.change != null && <span className={`${h.delta} ${h.num}`} data-tone={day.change < 0 ? 'down' : undefined}>
              <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d={day.change < 0 ? 'M5 8.5 9 1.5H1Z' : 'M5 1.5 9 8.5H1Z'} fill="currentColor" /></svg>
              {signed(day.change)}<i>· 24h</i>
            </span>}
          </div>
          <p className={`${h.cap} ${h.reveal}`} style={at(2)}>{text.lastPrice}{pair.updatedAt ? ` · ${fmtWhen(pair.updatedAt, locale)}` : ''}</p>
        </div>
        {quiet ? <div className={h.tier} data-tier="2" data-quiet="true"><p className={`${h.quietNote} ${h.reveal}`} style={at(3)}>{text.quietNote}</p></div>
        : <div className={`${h.tier} ${h.chart}`} data-tier="2">
          <div className={`${h.chartHead} ${h.reveal}`} style={at(3)}><span className={h.chartLead}>{text.candles}</span></div>
          <div className={h.reveal} style={at(3)}>
            {day && day.rows.length > 1 ? <Candles rows={day.rows} label={`${base} · ${text.candles}`} />
              : candles.loading || (!candles.data && !candles.error) ? <div className={h.skeleton} aria-busy="true"><i style={{ width: '100%', height: 72 }} /></div>
              : <p className={h.trendEmpty}>{text.historyEmpty}</p>}
          </div>
          <div className={`${h.power} ${h.reveal}`} style={at(3)}>
            <div className={h.powerBar} data-empty={buyShare === null || undefined} role="img" aria-label={`${depth}: ${fill(text.bids, { p: buyShare === null ? '—' : share(buyShare, locale) })}, ${fill(text.asks, { p: buyShare === null ? '—' : share(1 - buyShare, locale) })}`}>
              <i style={{ flexGrow: buyShare ?? .5 }} /><i style={{ flexGrow: buyShare === null ? .5 : 1 - buyShare }} />
            </div>
            <div className={h.powerLegend} aria-hidden="true">
              <span data-side="bid">{fill(text.bids, { p: buyShare === null ? '—' : share(buyShare, locale) })}</span>
              <span>{depth}</span>
              <span data-side="ask">{fill(text.asks, { p: buyShare === null ? '—' : share(1 - buyShare, locale) })}</span>
            </div>
          </div>
        </div>}
        <div className={h.tier} data-tier="3">
          <div className={`${h.actions} ${h.reveal}`} style={at(4)}>
            <button type="button" className={h.buy} onClick={open}>
              <span>{text.buyNow}</span>
              {ask !== null && <span className={`${h.price} ${h.num}`}>{fmtPrice(ask)}</span>}
            </button>
            <button type="button" className={h.buy} data-quiet onClick={open}>
              <span>{text.sell}</span>
              {bid !== null && <span className={`${h.price} ${h.num}`}>{fmtPrice(bid)}</span>}
            </button>
          </div>
          {!quiet && <dl className={`${h.facts} ${h.reveal}`} style={at(5)}>
            <div><dt>{text.high24}</dt><dd className={h.num}>{fmtPrice(day?.high)}</dd></div>
            <div><dt>{text.low24}</dt><dd className={h.num}>{fmtPrice(day?.low)}</dd></div>
            <div><dt>{text.spread}</dt><dd className={h.num}>{bid !== null && ask !== null && ask + bid > 0 ? `${((ask - bid) / ((ask + bid) / 2) * 100).toFixed(2)}%` : '—'}</dd></div>
          </dl>}
        </div>
      </>}
  </div>
}

/** Assets body — the eight largest RWA assets by market cap as one proportion bar plus a ranked legend. Titled and
 *  summed as "top N" on purpose: the client cannot know the whole market's total (后端需求 §12). The weighted 24h move
 *  is shown only when every one of the N carries a change figure. */
export function AssetAlmanac() {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const text = heroCardCopy[locale]
  const list = useQuery('markets:hero:almanac', () => listRwaAssets({ sort: 'market_cap', limit: TOP }), { staleTime: 60_000, pollInterval: POLL.list, loading: 'silent' })
  const top = useMemo(() => {
    const rows = (list.data?.items ?? []).map((asset) => ({ asset, cap: Number(asset.marketCapUsd) })).filter((row) => Number.isFinite(row.cap) && row.cap > 0).sort((a, b) => b.cap - a.cap).slice(0, TOP)
    const total = rows.reduce((sum, row) => sum + row.cap, 0)
    const moves = rows.map((row) => row.asset.change24hPct == null ? NaN : Number(row.asset.change24hPct))
    const weighted = rows.length && moves.every(Number.isFinite) ? rows.reduce((sum, row, index) => sum + row.cap * moves[index], 0) / total : null
    return { rows, total, weighted }
  }, [list.data])
  const n = (top.rows.length || TOP).toLocaleString(locale)
  const label = (asset: (typeof top.rows)[number]['asset']) => asset.symbol && asset.symbol !== '-' ? asset.symbol : asset.name
  const stamp = top.rows[0]?.asset.dataTimestamp

  return <div className={h.inner}>
    {!list.data && !list.error ? <div className={h.skeleton} aria-busy="true"><i /><i /><i /></div>
      : !top.rows.length ? <div className={h.state} role={list.error ? 'alert' : 'status'}>
        <span>{list.error ? copy.markets.loadError : copy.common.empty}</span>
        {list.error && <button type="button" onClick={() => void list.refetch()}>{copy.common.retry}</button>}
      </div>
      : <>
        <div className={h.tier} data-tier="1">
          <div className={`${h.top} ${h.reveal}`} style={at(0)}><span className={h.tag}>{fill(text.almanacTitle, { n })}</span></div>
          <div className={`${h.prob} ${h.reveal}`} style={at(1)}>
            <span className={`${h.big} ${h.bigPrice} ${h.num}`}>{fmtUsd(String(top.total), { compact: true, locale })}</span>
          </div>
          <p className={`${h.cap} ${h.reveal}`} style={at(2)}>{fill(text.almanacSum, { n })}</p>
        </div>
        <div className={`${h.tier} ${h.chart}`} data-tier="2">
          <div className={`${h.shareBar} ${h.reveal}`} style={at(3)} role="img" aria-label={top.rows.map((row) => `${label(row.asset)} ${share(row.cap / top.total, locale)}`).join(', ')}>
            {top.rows.map((row, index) => <i key={row.asset.slug} style={{ flexGrow: row.cap / top.total, '--k': index } as CSSProperties} />)}
          </div>
          <ul className={`${h.legend} ${h.reveal}`} style={at(3)}>
            {top.rows.map((row, index) => <li key={row.asset.slug}>
              <button type="button" onClick={() => openPath(`/asset/${encodeURIComponent(row.asset.slug)}`)}>
                <i style={{ '--k': index } as CSSProperties} aria-hidden="true" />
                <span>{label(row.asset)}</span>
                <b className={h.num}>{share(row.cap / top.total, locale)}</b>
              </button>
            </li>)}
          </ul>
        </div>
        <div className={h.tier} data-tier="3">
          <div className={`${h.actions} ${h.reveal}`} style={at(4)}>
            <button type="button" className={`${h.more} ${h.solid}`} onClick={() => openPath('/compare')}><span>{copy.markets.compare}</span><ChevronRight size={14} aria-hidden="true" /></button>
            <button type="button" className={h.more} onClick={() => openPath('/issuers')}><span>{copy.markets.issuers}</span><ChevronRight size={14} aria-hidden="true" /></button>
          </div>
          <dl className={`${h.facts} ${h.reveal}`} style={at(5)}>
            <div><dt>{text.almanacLead}</dt><dd className={h.num}>{share(top.rows[0].cap / top.total, locale)}</dd></div>
            <div><dt>{text.almanacWeighted}</dt><dd className={h.num} data-tone={top.weighted !== null && top.weighted < 0 ? 'down' : undefined}>{top.weighted === null ? '—' : signed(top.weighted)}</dd></div>
            <div><dt>{text.asOf}</dt><dd className={h.num}>{stamp ? fmtDateTime(stamp, locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
          </dl>
        </div>
      </>}
  </div>
}
