'use client'

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import styles from './polymarket-detail-panel.module.css'

type PricePoint = { time: number; price: number }
type BookLevel = { price: number; size: number }

type MarketPayload = {
  source: 'polymarket-gamma-clob' | 'unavailable'
  fetchedAt?: string
  error?: string
  integration?: {
    marketDataReady?: boolean
    relayerConfigured?: boolean
    tradingEnabled?: boolean
  }
  market?: {
    id: string
    question: string
    description: string
    category: string
    outcomes: string[]
    prices: number[]
    tokenIds: string[]
    volume: number
    volume24h: number
    liquidity: number
    endDate: string | null
    acceptingOrders: boolean
  }
  orderbook?: {
    bids: BookLevel[]
    asks: BookLevel[]
    tickSize: number
    minimumOrderSize: number
  } | null
  pricing?: {
    midpoint: number
    spread: number
    history: PricePoint[]
  }
}

export type PredictionOrderPreview = {
  marketId: string
  question: string
  outcome: 'YES' | 'NO'
  amount: number
  probability: number
  estimatedShares: number
  maximumPayout: number
  mode: 'read-only-preview'
}

export type PolymarketDetailPanelProps = {
  marketId: string
  marketHint?: {
    question?: string
    yesProbability?: number
  }
  regionStatus?: 'allowed' | 'restricted' | 'unknown'
  className?: string
  onReviewOrder?: (preview: PredictionOrderPreview) => void
}

type LoadState = 'loading' | 'live' | 'degraded' | 'error'
type Outcome = 'YES' | 'NO'
type ChartRange = '1H' | '1D' | '1W' | 'ALL'

const ranges: ChartRange[] = ['1H', '1D', '1W', 'ALL']

function clampProbability(value: number | undefined, fallback = 0.5) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(0.995, Math.max(0.005, Number(value)))
}

function compactCurrency(value: number) {
  if (!Number.isFinite(value)) return 'Unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value)
}

function formatAmount(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No close date supplied'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Close date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function formatFreshness(value: string | undefined) {
  if (!value) return 'Awaiting source timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Source timestamp unavailable'
  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

function makeIllustrativePayload(marketId: string, hint?: PolymarketDetailPanelProps['marketHint']): MarketPayload {
  const yes = clampProbability(hint?.yesProbability, 0.63)
  const now = Math.floor(Date.now() / 1000)
  const history = Array.from({ length: 32 }, (_, index) => {
    const drift = Math.sin(index * 0.58) * 0.018 + (index - 16) * 0.0022
    return { time: now - (31 - index) * 3600, price: clampProbability(yes + drift) }
  })
  const bids = Array.from({ length: 6 }, (_, index) => ({
    price: clampProbability(yes - 0.01 - index * 0.01),
    size: 840 - index * 88,
  }))
  const asks = Array.from({ length: 6 }, (_, index) => ({
    price: clampProbability(yes + 0.01 + index * 0.01),
    size: 710 - index * 61,
  }))

  return {
    source: 'unavailable',
    fetchedAt: new Date().toISOString(),
    integration: { marketDataReady: false, relayerConfigured: false, tradingEnabled: false },
    market: {
      id: marketId,
      question: hint?.question ?? 'Will the selected event resolve YES?',
      description: 'Illustrative fallback view. Live Polymarket metadata is currently unavailable and no order can be sent from this state.',
      category: 'Prediction market',
      outcomes: ['Yes', 'No'],
      prices: [yes, 1 - yes],
      tokenIds: [],
      volume: 3_820_400,
      volume24h: 412_700,
      liquidity: 684_200,
      endDate: null,
      acceptingOrders: false,
    },
    orderbook: { bids, asks, tickSize: 0.01, minimumOrderSize: 5 },
    pricing: { midpoint: yes, spread: 0.02, history },
  }
}

function chartSample(points: PricePoint[], range: ChartRange) {
  const desired = range === '1H' ? 8 : range === '1D' ? 24 : range === '1W' ? 64 : points.length
  return points.slice(-Math.min(desired, points.length))
}

function makeChartPath(points: PricePoint[], width = 640, height = 176) {
  if (points.length < 2) return { line: '', area: '', min: 0, max: 1 }
  const prices = points.map((point) => clampProbability(point.price))
  const rawMin = Math.min(...prices)
  const rawMax = Math.max(...prices)
  const padding = Math.max(0.018, (rawMax - rawMin) * 0.2)
  const min = Math.max(0, rawMin - padding)
  const max = Math.min(1, rawMax + padding)
  const range = Math.max(0.01, max - min)
  const coordinates = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width
    const y = height - ((price - min) / range) * height
    return [x, y] as const
  })
  const line = coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  return { line, area, min, max }
}

function LoadingState() {
  return (
    <section className={styles.loading} aria-live="polite" aria-busy="true">
      <div className={styles.loadingHeader}>
        <span className={styles.skeletonPill} />
        <span className={styles.skeletonLine} />
        <span className={styles.skeletonLineShort} />
      </div>
      <div className={styles.loadingProbability}>
        <span className={styles.skeletonMetric} />
        <span className={styles.skeletonRing}><LoaderCircle aria-hidden="true" /></span>
        <span className={styles.skeletonMetric} />
      </div>
      <div className={styles.skeletonChart} />
      <p><LoaderCircle className={styles.spinner} aria-hidden="true" /> Loading Gamma metadata and the public CLOB order book…</p>
    </section>
  )
}

function ErrorState({ message, onRetry, onUseIllustrative }: { message: string; onRetry: () => void; onUseIllustrative: () => void }) {
  return (
    <section className={styles.errorState} role="alert">
      <span className={styles.errorIcon}><XCircle aria-hidden="true" /></span>
      <p>Live market data is temporarily unavailable</p>
      <h2>The market could not be verified.</h2>
      <small>{message} No live price or availability claim is being shown.</small>
      <div className={styles.errorActions}>
        <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" /> Retry live data</button>
        <button type="button" onClick={onUseIllustrative}>Open illustrative preview <ArrowRight aria-hidden="true" /></button>
      </div>
    </section>
  )
}

function ProbabilityChart({ points, range, setRange, probability }: { points: PricePoint[]; range: ChartRange; setRange: (range: ChartRange) => void; probability: number }) {
  const chartId = useId().replace(/:/g, '')
  const sampled = useMemo(() => chartSample(points, range), [points, range])
  const chart = useMemo(() => makeChartPath(sampled), [sampled])
  const first = sampled[0]?.price ?? probability
  const last = sampled.at(-1)?.price ?? probability
  const change = (last - first) * 100

  return (
    <section className={styles.chartCard} aria-labelledby={`${chartId}-title`}>
      <div className={styles.sectionHeading}>
        <div>
          <span>Probability trend</span>
          <strong id={`${chartId}-title`}>{Math.round(probability * 100)}¢ YES <i className={change >= 0 ? styles.positive : styles.negative}>{change >= 0 ? '+' : ''}{change.toFixed(1)} pts</i></strong>
        </div>
        <div className={styles.rangeControl} aria-label="Chart range">
          {ranges.map((item) => <button type="button" key={item} className={range === item ? styles.activeRange : ''} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}
        </div>
      </div>
      {sampled.length > 1 ? (
        <div className={styles.chartWrap}>
          <svg className={styles.chart} viewBox="0 0 640 176" role="img" aria-label={`YES probability moved from ${Math.round(first * 100)} to ${Math.round(last * 100)} percent`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2fe6bf" stopOpacity=".28" />
                <stop offset="1" stopColor="#2fe6bf" stopOpacity="0" />
              </linearGradient>
              <filter id={`${chartId}-glow`} x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g className={styles.gridLines}>
              <line x1="0" y1="1" x2="640" y2="1" />
              <line x1="0" y1="58" x2="640" y2="58" />
              <line x1="0" y1="117" x2="640" y2="117" />
              <line x1="0" y1="175" x2="640" y2="175" />
            </g>
            <path d={chart.area} fill={`url(#${chartId}-fill)`} />
            <path className={styles.chartGlow} d={chart.line} filter={`url(#${chartId}-glow)`} />
            <path className={styles.chartLine} d={chart.line} />
            <circle className={styles.chartDot} cx="640" cy={176 - ((last - chart.min) / Math.max(0.01, chart.max - chart.min)) * 176} r="5" />
          </svg>
          <div className={styles.chartAxis}><span>{Math.round(chart.max * 100)}%</span><span>{Math.round(chart.min * 100)}%</span></div>
        </div>
      ) : <div className={styles.chartEmpty}><BarChart3 aria-hidden="true" /><span>Historical price points are not available from CLOB.</span></div>}
      <div className={styles.chartFoot}><span>Public CLOB midpoint history</span><span>{sampled.length ? `${sampled.length} source points` : 'Current price only'}</span></div>
    </section>
  )
}

function OrderBook({ bids, asks }: { bids: BookLevel[]; asks: BookLevel[] }) {
  const visibleBids = bids.slice(0, 6)
  const visibleAsks = asks.slice(0, 6)
  const maximum = Math.max(1, ...visibleBids.map((level) => level.size), ...visibleAsks.map((level) => level.size))

  return (
    <section className={styles.bookCard} aria-labelledby="order-book-title">
      <div className={styles.sectionHeading}>
        <div><span>Market depth</span><strong id="order-book-title">YES order book</strong></div>
        <small><i className={styles.liveDot} /> Public CLOB</small>
      </div>
      {visibleBids.length || visibleAsks.length ? <>
        <div className={styles.bookLegend}><span>Bid price</span><span>Shares</span><span>Ask price</span></div>
        <div className={styles.bookRows}>
          {Array.from({ length: Math.max(visibleBids.length, visibleAsks.length) }, (_, index) => {
            const bid = visibleBids[index]
            const ask = visibleAsks[index]
            return <div className={styles.bookRow} key={`${bid?.price ?? 'x'}-${ask?.price ?? 'x'}-${index}`}>
              <span className={styles.bidPrice}>{bid ? `${Math.round(bid.price * 100)}¢` : '—'}</span>
              <span className={styles.bidDepth}><i style={{ width: `${bid ? Math.max(4, bid.size / maximum * 100) : 0}%` }} /></span>
              <span className={styles.bookSize}>{bid ? Math.round(bid.size).toLocaleString() : '—'}<b>/</b>{ask ? Math.round(ask.size).toLocaleString() : '—'}</span>
              <span className={styles.askDepth}><i style={{ width: `${ask ? Math.max(4, ask.size / maximum * 100) : 0}%` }} /></span>
              <span className={styles.askPrice}>{ask ? `${Math.round(ask.price * 100)}¢` : '—'}</span>
            </div>
          })}
        </div>
      </> : <div className={styles.bookEmpty}><Info aria-hidden="true" /> No resting orders were returned for this token.</div>}
    </section>
  )
}

function RegionNotice({ status }: { status: NonNullable<PolymarketDetailPanelProps['regionStatus']> }) {
  if (status === 'allowed') return <div className={`${styles.regionNotice} ${styles.regionAllowed}`}><ShieldCheck aria-hidden="true" /><span><strong>Region check passed for preview</strong><small>Final execution still requires wallet signature and partner controls.</small></span></div>
  if (status === 'restricted') return <div className={`${styles.regionNotice} ${styles.regionRestricted}`}><ShieldAlert aria-hidden="true" /><span><strong>Trading is unavailable in this region</strong><small>Market data remains view-only. The order preview is disabled.</small></span></div>
  return <div className={`${styles.regionNotice} ${styles.regionUnknown}`}><LockKeyhole aria-hidden="true" /><span><strong>Eligibility check required</strong><small>Country, wallet and product eligibility are checked before execution.</small></span></div>
}

export default function PolymarketDetailPanel({ marketId, marketHint, regionStatus = 'unknown', className = '', onReviewOrder }: PolymarketDetailPanelProps) {
  const [payload, setPayload] = useState<MarketPayload | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState('The public market endpoint did not return a usable response.')
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('YES')
  const [amount, setAmount] = useState(100)
  const [range, setRange] = useState<ChartRange>('1D')
  const [preview, setPreview] = useState<PredictionOrderPreview | null>(null)

  const loadMarket = useCallback(async (signal?: AbortSignal) => {
    setState('loading')
    setPreview(null)
    try {
      const response = await fetch(`/api/polymarket/market/${encodeURIComponent(marketId)}`, { cache: 'no-store', signal })
      const data = await response.json() as MarketPayload
      if (!response.ok || !data.market) throw new Error(data.error ?? `Market endpoint returned ${response.status}`)
      const isPartial = !data.orderbook || !data.pricing?.history?.length
      setPayload(data)
      setState(isPartial ? 'degraded' : 'live')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setPayload(null)
      setError(caught instanceof Error ? caught.message : 'Market request failed')
      setState('error')
    }
  }, [marketId])

  useEffect(() => {
    const controller = new AbortController()
    void loadMarket(controller.signal)
    return () => controller.abort()
  }, [loadMarket])

  const market = payload?.market
  const yesProbability = clampProbability(market?.prices?.[0] || payload?.pricing?.midpoint, clampProbability(marketHint?.yesProbability, 0.5))
  const noProbability = clampProbability(market?.prices?.[1], 1 - yesProbability)
  const selectedProbability = selectedOutcome === 'YES' ? yesProbability : noProbability
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0)
  const estimatedShares = selectedProbability > 0 ? safeAmount / selectedProbability : 0
  const history = payload?.pricing?.history ?? []
  const isIllustrative = state === 'degraded' && payload?.source === 'unavailable'
  const hasTradingSource = Boolean(market?.acceptingOrders && payload?.orderbook && !isIllustrative)
  const reviewDisabled = regionStatus === 'restricted' || !safeAmount || safeAmount < (payload?.orderbook?.minimumOrderSize ?? 1)
  const sourceLabel = state === 'live' ? 'Live via Polymarket' : isIllustrative ? 'Illustrative fallback' : 'Live metadata · partial CLOB'

  const openReview = () => {
    if (!market || reviewDisabled) return
    const nextPreview: PredictionOrderPreview = {
      marketId: market.id,
      question: market.question,
      outcome: selectedOutcome,
      amount: safeAmount,
      probability: selectedProbability,
      estimatedShares,
      maximumPayout: estimatedShares,
      mode: 'read-only-preview',
    }
    setPreview(nextPreview)
    onReviewOrder?.(nextPreview)
  }

  if (state === 'loading') return <div className={`${styles.panel} ${className}`}><LoadingState /></div>
  if (state === 'error') return <div className={`${styles.panel} ${className}`}><ErrorState message={error} onRetry={() => void loadMarket()} onUseIllustrative={() => { setPayload(makeIllustrativePayload(marketId, marketHint)); setState('degraded') }} /></div>
  if (!market) return null

  return (
    <div className={`${styles.panel} ${className}`} data-state={state}>
      <div className={`${styles.sourceBar} ${state === 'live' ? styles.sourceLive : styles.sourceDegraded}`} role="status">
        <span><i />{sourceLabel}</span>
        <small>{formatFreshness(payload?.fetchedAt)}</small>
        <button type="button" aria-label="Refresh market data" onClick={() => void loadMarket()}><RefreshCw aria-hidden="true" /></button>
      </div>

      {state === 'degraded' && <div className={styles.degradedBanner} role="status"><AlertTriangle aria-hidden="true" /><span><strong>{isIllustrative ? 'Illustrative data only' : 'Partial market data'}</strong><small>{isIllustrative ? 'Live APIs are unavailable. Values below demonstrate layout and cannot be used for a decision.' : 'Some CLOB history or order-book fields were not returned. Current metadata remains visible.'}</small></span></div>}

      <article className={styles.marketHero}>
        <div className={styles.marketLabel}><span>{market.category || 'Prediction market'}</span><i>Market #{market.id}</i></div>
        <h1>{market.question}</h1>
        <p>{market.description || 'Outcome terms are supplied by the source market. Review the original resolution rules before any transaction.'}</p>
        <dl className={styles.heroFacts}>
          <div><dt><Clock3 aria-hidden="true" /> Closes</dt><dd>{formatDate(market.endDate)}</dd></div>
          <div><dt><TrendingUp aria-hidden="true" /> 24h volume</dt><dd>{compactCurrency(market.volume24h)}</dd></div>
          <div><dt><ShieldCheck aria-hidden="true" /> Availability</dt><dd>{market.acceptingOrders ? 'Source accepts orders' : 'View only / closed'}</dd></div>
        </dl>
      </article>

      <section className={styles.probabilityStage} aria-label="Current outcome probabilities">
        <button type="button" className={`${styles.probabilitySide} ${styles.yesSide} ${selectedOutcome === 'YES' ? styles.selectedSide : ''}`} aria-pressed={selectedOutcome === 'YES'} onClick={() => { setSelectedOutcome('YES'); setPreview(null) }}>
          <span>{market.outcomes[0] || 'YES'}</span>
          <strong>{Math.round(yesProbability * 100)}%</strong>
          <small>{Math.round(yesProbability * 100)}¢ per share</small>
        </button>
        <div className={styles.probabilityRing}>
          <svg viewBox="0 0 180 180" role="img" aria-label={`${Math.round(yesProbability * 100)} percent YES and ${Math.round(noProbability * 100)} percent NO`}>
            <circle className={styles.ringTrack} cx="90" cy="90" r="70" />
            <circle className={styles.ringNo} cx="90" cy="90" r="70" pathLength="100" strokeDasharray={`${noProbability * 100} ${yesProbability * 100}`} strokeDashoffset={-yesProbability * 100} />
            <circle className={styles.ringYes} cx="90" cy="90" r="70" pathLength="100" strokeDasharray={`${yesProbability * 100} ${noProbability * 100}`} />
          </svg>
          <span><b>{Math.round(yesProbability * 100)}%</b><small>YES</small></span>
          <i />
        </div>
        <button type="button" className={`${styles.probabilitySide} ${styles.noSide} ${selectedOutcome === 'NO' ? styles.selectedSide : ''}`} aria-pressed={selectedOutcome === 'NO'} onClick={() => { setSelectedOutcome('NO'); setPreview(null) }}>
          <span>{market.outcomes[1] || 'NO'}</span>
          <strong>{Math.round(noProbability * 100)}%</strong>
          <small>{Math.round(noProbability * 100)}¢ per share</small>
        </button>
      </section>

      <ProbabilityChart points={history} range={range} setRange={setRange} probability={yesProbability} />

      <section className={styles.metrics} aria-label="Market statistics">
        <div><span>Total volume</span><strong>{compactCurrency(market.volume)}</strong><small>Lifetime source volume</small></div>
        <div><span>Liquidity</span><strong>{compactCurrency(market.liquidity)}</strong><small>Current reported liquidity</small></div>
        <div><span>Midpoint</span><strong>{payload?.pricing?.midpoint ? `${Math.round(payload.pricing.midpoint * 100)}¢` : '—'}</strong><small>YES token midpoint</small></div>
        <div><span>Spread</span><strong>{payload?.pricing?.spread ? `${(payload.pricing.spread * 100).toFixed(1)}¢` : '—'}</strong><small>Current bid / ask spread</small></div>
      </section>

      <OrderBook bids={payload?.orderbook?.bids ?? []} asks={payload?.orderbook?.asks ?? []} />

      <section className={styles.ticket} aria-labelledby="preview-ticket-title">
        <div className={styles.ticketHeading}>
          <span><WalletCards aria-hidden="true" /></span>
          <div><small>Order simulator</small><h2 id="preview-ticket-title">Prepare a read-only preview</h2></div>
          <i>{selectedOutcome}</i>
        </div>
        <div className={styles.outcomeTabs}>
          <button type="button" className={selectedOutcome === 'YES' ? styles.selectedYes : ''} onClick={() => { setSelectedOutcome('YES'); setPreview(null) }}>YES <b>{Math.round(yesProbability * 100)}¢</b></button>
          <button type="button" className={selectedOutcome === 'NO' ? styles.selectedNo : ''} onClick={() => { setSelectedOutcome('NO'); setPreview(null) }}>NO <b>{Math.round(noProbability * 100)}¢</b></button>
        </div>
        <label className={styles.amountField}>
          <span>Amount <small>USDT</small></span>
          <div><b>₮</b><input type="number" min={payload?.orderbook?.minimumOrderSize || 1} max="100000" step="1" value={amount} onChange={(event) => { setAmount(Number(event.target.value)); setPreview(null) }} aria-describedby="order-estimate" /><button type="button" onClick={() => { setAmount(1000); setPreview(null) }}>1,000</button></div>
        </label>
        <dl className={styles.orderEstimate} id="order-estimate">
          <div><dt>Estimated shares</dt><dd>{formatAmount(estimatedShares)} {selectedOutcome}</dd></div>
          <div><dt>Maximum payout if correct</dt><dd>{formatAmount(estimatedShares)} USDT</dd></div>
          <div><dt>Indicative price</dt><dd>{Math.round(selectedProbability * 100)}¢</dd></div>
          <div><dt>Minimum order</dt><dd>{formatAmount(payload?.orderbook?.minimumOrderSize || 1, 0)} USDT</dd></div>
        </dl>
        <div className={styles.executionDisclosure}><Info aria-hidden="true" /><span><strong>{hasTradingSource ? 'Source market is accepting orders' : 'Execution is not enabled here'}</strong><small>RWA.LAT currently reads public market data. This control creates a preview only and never submits, signs or settles an order.</small></span></div>
        <button type="button" className={styles.reviewButton} disabled={reviewDisabled} onClick={openReview}>
          <span><small>{regionStatus === 'restricted' ? 'Unavailable in your region' : 'No wallet signature requested'}</small>{regionStatus === 'restricted' ? 'Preview disabled' : `Review ${selectedOutcome} preview`}</span>
          <i><ArrowRight aria-hidden="true" /></i>
        </button>
        {preview && <div className={styles.previewReceipt} role="status">
          <CheckCircle2 aria-hidden="true" />
          <span><strong>Preview prepared — no order sent</strong><small>{formatAmount(preview.amount)} USDT at {Math.round(preview.probability * 100)}¢ estimates {formatAmount(preview.estimatedShares)} {preview.outcome} shares.</small></span>
        </div>}
      </section>

      <RegionNotice status={regionStatus} />
      <footer className={styles.dataFootnote}>
        <LockKeyhole aria-hidden="true" />
        <span><strong>Public market-data connection</strong><small>Metadata: Gamma API · pricing and depth: CLOB API · transactions: disabled</small></span>
      </footer>
    </div>
  )
}
