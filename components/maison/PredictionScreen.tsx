'use client'

import { AlertTriangle, ArrowRight, Check, Info } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { POLL } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { getPolymarketMarket, getPredictionStatus, getWallet, placePredictionBet, type PlaceBetBody, type PolymarketMarket, type PredictionBet } from '@/lib/api/markets'
import { translatePolymarketMarkets, type PolymarketTranslation } from '@/lib/api/polymarket-translations'
import { fmtUsd, toAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { polymarketTranslationCopy } from '@/lib/polymarket-translation-copy'
import { estimatePredictionBet } from '@/lib/prediction-bet-estimate'
import { backOr, openPath, signInThenReturn, useSignedIn } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, Sparkline, StateBlock, maison as s } from './primitives'
import { fmtAtomic, fmtDate, fmtDateTime } from './format'

const MARKET_ID = /^[A-Za-z0-9-]{1,120}$/
const BET_PATH = '/v1/predictions/bets'
const DEC_6 = /^\d+(\.\d{1,6})?$/

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`

/**
 * Indicative price for an outcome, mirroring the server (best ask of that token).
 * The proxy only carries the first token's book, so the second outcome uses 1 − best bid.
 */
function indicativePrice(data: PolymarketMarket, index: number): number | null {
  const book = data.orderbook
  const asks = (book?.asks ?? []).map((level) => level.price).filter((price) => price > 0 && price <= 1)
  const bids = (book?.bids ?? []).map((level) => level.price).filter((price) => price > 0 && price < 1)
  const fromBook = index === 0 ? (asks.length ? Math.min(...asks) : null) : (bids.length ? 1 - Math.max(...bids) : null)
  const fallback = data.market.prices[index]
  const price = fromBook ?? (Number.isFinite(fallback) ? fallback : null)
  return price !== null && price > 0 && price <= 1 ? price : null
}

/** `/prediction/:id` — Polymarket data is public; betting uses the internal market and needs a session and eligibility. */
export function PredictionScreen({ id }: { id: string | null }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].prediction
  const validId = id && MARKET_ID.test(id) ? id : null
  const market = useQuery(validId ? `prediction:market:${validId}` : null, () => getPolymarketMarket(validId!), { staleTime: 30_000, pollInterval: POLL.quote })
  const translation = useQuery(validId && locale !== 'en' ? `prediction:translation:${validId}:${locale}` : null,
    () => translatePolymarketMarkets([validId!], locale as Exclude<typeof locale, 'en'>, true), { staleTime: 10 * 60_000 })
  const [expanded, setExpanded] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const data = market.data
  const topbar = <RwaTopbar screen="prediction-detail" title={t.kicker.split(' · ')[0]} onBack={() => backOr('/markets?tab=predictions')} />
  const toMarkets = <button type="button" className={s.link} onClick={() => openPath('/markets?tab=predictions')}>{t.toMarkets}</button>

  if (!validId) return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}><StateBlock title={copy.detail.notFound} action={toMarkets} /></div></MaisonPage>
  if (!data && !market.error) return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}><Skeleton rows={5} /></div></MaisonPage>
  if (!data) return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}>
    <StateBlock tone="error" title={t.loadError} body={market.error?.status === 404 ? copy.detail.notFound : undefined} retry={market.refetch} retryLabel={copy.common.retry} action={toMarkets} />
  </div></MaisonPage>

  const m = data.market
  const localized = locale !== 'en' ? translation.data?.items.find((item) => item.id === m.id) : undefined
  const translated = showOriginal ? undefined : localized
  const translationLabels = polymarketTranslationCopy[locale]
  const history = data.pricing.history.filter((point) => Number.isFinite(point.price) && Number.isFinite(point.time) && point.time > 0)
  const partial = !data.orderbook || history.length < 2

  return <MaisonPage page="prediction" dock topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}{m.category ? ` · ${m.category}` : ''}</p>
      <h1 className={s.titleL}>{translated?.question ?? m.question}</h1>
      <p className={s.lede} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className={s.badge} data-tone={m.acceptingOrders ? 'live' : 'warn'}>{t.source}</span>
        {m.endDate && <span>{t.closes} {fmtDate(m.endDate, locale)}</span>}
      </p>
      {locale !== 'en' && <p className={s.foot}>
        <span>{localized ? translationLabels.translated : translation.loading ? translationLabels.loading : translationLabels.unavailable}</span>
        {localized && <button type="button" className={s.link} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? translationLabels.hideOriginal : translationLabels.original}</button>}
      </p>}
    </header>

    <section className={s.lacquer}>
      <div className={s.prob} style={{ marginTop: 0 }}>{m.outcomes.map((label, index) => <div key={label} className={s.probRow}>
        <span>{translated?.outcomes[index] ?? outcomeLabel(label, copy)}</span><b className={s.num}>{pct(m.prices[index])}</b>
        <span className={s.probBar}><i style={{ ['--p' as string]: Math.max(0, Math.min(1, m.prices[index] ?? 0)) }} /></span>
      </div>)}</div>
      <dl className={s.stats} style={{ marginTop: 18 }}>
        <div><dt>{t.volume}</dt><dd className={s.num}>{fmtUsd(String(m.volume24h ?? ''), { compact: true, locale })}</dd></div>
        <div><dt>{t.liquidity}</dt><dd className={s.num}>{fmtUsd(String(m.liquidity ?? ''), { compact: true, locale })}</dd></div>
      </dl>
      <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(data.fetchedAt, locale) })}</span></p>
    </section>
    {partial && <div className={s.notice}><Info size={16} /><span>{t.partial}</span></div>}

    <SectionHead index="01" title={t.history} note={m.outcomes[0] ? translated?.outcomes[0] ?? outcomeLabel(m.outcomes[0], copy) : undefined} />
    {history.length >= 2 ? <>
      <Sparkline points={history.map((point) => point.price)} label={t.history} />
      <div className={s.chartAxis}><span>{fmtDate(new Date(history[0].time * 1000).toISOString(), locale)}</span><span>{fmtDate(new Date(history[history.length - 1].time * 1000).toISOString(), locale)}</span></div>
    </> : <StateBlock title={t.historyEmpty} />}

    <SectionHead index="02" title={t.place} />
    <BetTicket data={data} translation={translated} />

    {m.description && <>
      <SectionHead index="03" title={t.rules} />
      <p className={s.prose} style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{translated?.rules ?? m.description}</p>
      {!expanded && <button type="button" className={s.link} onClick={() => setExpanded(true)}>{tradeCopy[locale].basketOrder.readMore}</button>}
    </>}
  </MaisonPage>
}

function outcomeLabel(label: string, copy: (typeof marketCopy)[keyof typeof marketCopy]) {
  const key = label.trim().toLowerCase()
  return key === 'yes' ? copy.review.yes : key === 'no' ? copy.review.no : label
}

function BetTicket({ data, translation }: { data: PolymarketMarket; translation?: PolymarketTranslation }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].prediction
  const signedIn = useSignedIn()
  const status = useQuery('prediction:status', getPredictionStatus, { staleTime: 60_000, pollInterval: POLL.list })
  const wallet = useQuery(signedIn ? 'wallet:summary:prediction' : null, getWallet, { staleTime: 15_000 })
  // 默认选中第一个方向。若初始为 null，price 恒为 null，
  // 「预计份数 / 派彩费 / 中奖净到账」会全部显示「—」——用户填了金额却看不到任何结果。
  const [outcome, setOutcome] = useState<number | null>(0)
  const [stake, setStake] = useState('')
  const [risk, setRisk] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState<PredictionBet | null>(null)
  const keys = useRef(new Map<string, string>())

  const m = data.market
  const limits = status.data?.limits
  const decimals = limits?.assetDecimals ?? 6
  const atomic = stake && DEC_6.test(stake) ? toAtomic(stake, decimals) : null
  const available = wallet.data?.balances.availableAtomic ?? null
  const price = outcome === null ? null : indicativePrice(data, outcome)
  const tokenId = outcome === null ? null : m.tokenIds[outcome] ?? null

  const fieldError = useMemo(() => {
    if (!stake) return null
    if (!atomic || atomic === '0') return t.errors.format
    if (limits && BigInt(atomic) > BigInt(limits.maxStakeAtomic)) return fill(t.errors.max, { v: fmtAtomic(limits.maxStakeAtomic, decimals, 'USDT', 0) })
    if (available !== null && (wallet.data?.asset.decimals ?? 6) === decimals && BigInt(atomic) > BigInt(available)) return tradeCopy[locale].basketOrder.errors.balance
    return null
  }, [atomic, available, decimals, limits, locale, stake, t.errors, wallet.data?.asset.decimals])

  // A+C 混合收费：下注先抽「下注费」，只有净额进池并折算份额；赢家派彩再抽「派彩费」。
  // 费率以服务端 /v1/predictions/status 为权威（下方 status.data.fees），前端不硬编码。
  const placeFeeRate = status.data?.fees?.placeFeeRate ?? 0
  const payoutFeeRate = status.data?.fees?.payoutFeeRate ?? 0
  const estimate = estimatePredictionBet({
    stakeAtomic: atomic,
    decimals,
    price,
    placeFeeRate,
    payoutFeeRate,
  })
  const { shares, payoutFee, netPayout, placeFeeAtomic } = estimate

  if (!status.data && !status.error) return <Skeleton rows={2} />
  if (status.error && !status.data) return <StateBlock tone="error" title={copy.common.errorGeneric} body={status.error.message} retry={status.refetch} retryLabel={copy.common.retry} />
  if (!status.data?.enabled) return <StateBlock tone="unavailable" title={t.disabled} />
  if (!m.acceptingOrders) return <StateBlock tone="unavailable" title={t.notAccepting} />
  if (!signedIn) return <button type="button" className={s.cta} style={{ width: '100%' }} onClick={() => signInThenReturn()}><span>{t.signIn}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>

  if (done) return <section className={s.lacquer} aria-live="polite">
    <div className={s.statusMark} data-tone="up"><Check size={26} strokeWidth={1.6} /></div>
    <h2 className={s.titleL} style={{ marginTop: 0, fontSize: 30 }}>{t.done}</h2>
    <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55 }}>{fill(t.doneBody, { s: Number(done.shares).toLocaleString(locale, { maximumFractionDigits: 4 }), p: pct(Number(done.price)) })}</p>
    <dl className={s.summary} style={{ marginTop: 16 }}>
      <div data-strong="true"><dt>{t.stake}</dt><dd className={s.num}>{fmtAtomic(done.stakeAtomic, decimals, 'USDT')}</dd></div>
      {done.feeAtomic && <div><dt>{fill(t.feePlace, { r: pct(placeFeeRate) })}</dt><dd className={s.num}>{fmtAtomic(done.feeAtomic, decimals, 'USDT')}</dd></div>}
      <div><dt>{marketCopy[locale].status.orderId}</dt><dd className={s.num}>{done.id.slice(0, 8)}…</dd></div>
    </dl>
    <div className={s.actions2} style={{ marginTop: 16 }}>
      <button type="button" className={s.ghost} onClick={() => { setDone(null); setStake(''); setRisk(false) }}>{t.place}</button>
      <button type="button" className={s.ghost} onClick={() => openPath('/assets')}>{t.toAssets}</button>
    </div>
  </section>

  const ready = Boolean(tokenId && atomic && !fieldError && risk && !pending)
  const submit = async () => {
    if (!ready || !tokenId || !atomic) return
    const intent: Omit<PlaceBetBody, 'idempotencyKey'> = { tokenId, stakeAtomic: BigInt(atomic).toString(), ...(price ? { expectedPrice: price.toFixed(6) } : {}) }
    // Keyed on token + stake only, so a retry at a refreshed price still maps to the same bet.
    const idempotencyKey = idempotencyKeyForIntent(keys.current, 'POST', BET_PATH, { tokenId: intent.tokenId, stakeAtomic: intent.stakeAtomic })
    setPending(true)
    setServerError(null)
    const result = await placePredictionBet({ ...intent, idempotencyKey })
    setPending(false)
    if (!result.ok) { setServerError(t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric); return }
    keys.current.clear()
    invalidate(['wallet:', 'portfolio:', 'home:', 'prediction:bets'])
    setDone(result.data)
  }

  return <div>
    <div className={s.outcome} role="group" aria-label={copy.review.outcome}>
      {m.outcomes.slice(0, 2).map((label, index) => <button key={label} type="button" data-side={index === 0 ? 'yes' : 'no'} aria-pressed={outcome === index} disabled={!m.tokenIds[index]}
        onClick={() => { setOutcome(index); setServerError(null) }}>
        {translation?.outcomes[index] ?? outcomeLabel(label, copy)} <span className={s.num} style={{ opacity: .7, fontWeight: 600 }}>{pct(m.prices[index])}</span>
      </button>)}
    </div>
    <label className={s.kicker} htmlFor="bet-stake" style={{ display: 'block', marginTop: 20 }}>{t.stake}</label>
    <div className={s.amount}>
      <input id="bet-stake" inputMode="decimal" autoComplete="off" placeholder="0.00" value={stake} aria-invalid={Boolean(fieldError)} aria-describedby="bet-stake-meta"
        onChange={(event) => { setStake(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); setServerError(null) }} />
      <span>USDT</span>
    </div>
    <div className={s.fieldMeta} id="bet-stake-meta">
      <span>{!wallet.data && !wallet.error ? '…' : wallet.error && !wallet.data ? <button type="button" className={s.link} onClick={wallet.refetch}>{copy.common.unavailable} · {copy.common.retry}</button> : fill(copy.review.available, { v: fmtAtomic(available, wallet.data?.asset.decimals ?? 6, wallet.data?.asset.code ?? 'USDT') })}</span>
      {limits && <span className={s.num}>{fill(t.limit, { v: fmtAtomic(limits.maxStakeAtomic, decimals, 'USDT', 0) })}</span>}
    </div>
    {fieldError && <p className={s.fieldError} role="alert">{fieldError}</p>}

    <section className={s.lacquer} style={{ marginTop: 20 }} aria-live="polite">
      <dl className={s.summary}>
        <div><dt>{t.price}</dt><dd className={s.num}>{price ? pct(price) : '—'}</dd></div>
        <div><dt>{t.shares}</dt><dd className={s.num}>{shares ? `≈ ${shares.toLocaleString(locale, { maximumFractionDigits: 2 })}` : '—'}</dd></div>
        <div><dt>{t.stake}</dt><dd className={s.num}>{estimate.stakeAmount !== null ? `≈ ${estimate.stakeAmount.toLocaleString(locale, { maximumFractionDigits: 2 })} USDT` : '—'}</dd></div>
        <div><dt>{fill(t.feePlace, { r: pct(placeFeeRate) })}</dt><dd className={s.num}>{atomic ? fmtAtomic(placeFeeAtomic.toString(), decimals, 'USDT') : '—'}</dd></div>
        <div><dt>{t.payout}</dt><dd className={s.num}>{estimate.grossPayout !== null ? `≈ ${estimate.grossPayout.toLocaleString(locale, { maximumFractionDigits: 2 })} USDT` : '—'}</dd></div>
        <div><dt>{fill(t.feePayout, { r: pct(payoutFeeRate) })}</dt><dd className={s.num}>{payoutFee !== null ? `${payoutFee.toLocaleString(locale, { maximumFractionDigits: 2 })} USDT` : '—'}</dd></div>
        <div data-strong="true"><dt>{t.netPayout}</dt><dd className={s.num}>{netPayout !== null ? `≈ ${netPayout.toLocaleString(locale, { maximumFractionDigits: 2 })} USDT` : '—'}</dd></div>
      </dl>
    </section>
    {outcome !== null && !tokenId && <p className={s.fieldError}>{t.noToken}</p>}
    {outcome !== null && price !== null && Number.isFinite(m.prices[outcome]) && Math.abs(price - m.prices[outcome]) > 0.1 && <div className={s.notice} role="note"><Info size={16} /><span>{fill(t.wide, { p: pct(price), m: pct(m.prices[outcome]) })}</span></div>}

    <label className={s.consent}>
      <input type="checkbox" checked={risk} onChange={(event) => { setRisk(event.target.checked); setServerError(null) }} />
      <span>{t.risk}</span>
    </label>
    {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
    <button type="button" className={s.cta} style={{ marginTop: 16, width: '100%' }} onClick={submit} disabled={!ready} aria-busy={pending}>
      <span>{pending ? t.placing : t.place}</span>
      <span className={s.ctaIcon}><ArrowRight size={17} /></span>
    </button>
  </div>
}
