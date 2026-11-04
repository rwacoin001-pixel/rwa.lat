'use client'

import { ArrowRight, Check, Info } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { predictionQuote } from '@/lib/prediction-quote'
import { PredictionEventScreen } from './PredictionEventScreen'
import { PredictionDiscussion } from './PredictionDiscussion'
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
import {PredictionSheet} from './PredictionSheet'
import {PredictionHowTo} from './PredictionHowTo'
import {Logo} from './primitives'
import ui from './prediction-experience.module.css'
import availabilityUi from './prediction-availability.module.css'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import { usePageState } from '@/lib/app-navigation'
import { evaluatePredictionDirections } from '@/lib/prediction-availability'
import { PredictionCountdown } from './PredictionCountdown'
import { PredictionBetForm } from './PredictionBetForm'
import { predictionTicketCopy } from '@/lib/prediction-ticket-copy'
import { predictionCapacityStake, predictionWalletAction } from '@/lib/prediction-ticket-state'
import { useHideUnavailablePrediction } from '@/lib/use-prediction-directions'
import { predictionAvailabilityText } from '@/lib/prediction-availability-copy'
import {hasPredictionEnded,isPredictionDiscoverable} from '@/lib/prediction-lifecycle'
import {usePredictionExpiryClock} from '@/lib/use-prediction-expiry-clock'
import { bestCoupon, discountOn, rewardWalletQuery, vouchers } from '@/lib/rewards'

const fromAtomicStr = (atomic: string, decimals: number) => { const v = BigInt(atomic), d = BigInt('1' + '0'.repeat(decimals)); const frac = (v % d).toString().padStart(decimals, '0').replace(/0+$/, ''); return frac ? `${v / d}.${frac}` : `${v / d}` }
import { useRewardsCopy } from '@/components/rewards/rewards-copy'
import { usePurchasePin } from './usePurchasePin'
import { share } from './flow-kit'
import { PURCHASE_DONE_PATH, savePurchaseDone } from '@/lib/purchase-done'

const MARKET_ID = /^[A-Za-z0-9-]{1,120}$/
const BET_PATH = '/v1/predictions/bets'
const DEC_6 = /^\d+(\.\d{1,6})?$/

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`

/** `/prediction/:id` — Polymarket data is public; betting uses the internal market and needs a session and eligibility. */
export function PredictionScreen({id}:{id:string|null}) {
  return id?.startsWith('event-') && /^event-\d+$/.test(id) ? <PredictionEventScreen key={id} id={id.slice(6)}/> : <PredictionMarketScreen key={id} id={id}/>
}
/** Shared hero for both entries: kicker, logo + full-width title, source · close date, then extras. */
export function PredictionHero({kicker,image,title,meta,children}:{kicker:string;image?:string|null;title:string;meta:ReactNode;children?:ReactNode}) {
  return <header className={ui.hero}>
    <p className={s.kicker}>{kicker}</p>
    <div className={ui.heroTitle}><Logo src={image??null} name={title}/><h1 className={s.titleL}>{title}</h1></div>
    <div className={ui.heroMeta}>{meta}</div>
    {children}
  </header>
}
export function PredictionMarketScreen({ id, eventHeader, eventOptions, eventId, initialOutcome=0, ticketOpen, onTicketClose, ticketLabel, ticketImage, ticketEventTitle }: { id: string | null; eventHeader?: ReactNode; eventOptions?: ReactNode; eventId?: string; initialOutcome?: number; ticketOpen?:boolean; onTicketClose?:()=>void; ticketLabel?:string; ticketImage?:string|null; ticketEventTitle?:string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].prediction
  const validId = id && MARKET_ID.test(id) ? id : null
  const freshRequest=useRef(false)
  const [quoteRefreshing,setQuoteRefreshing]=useState(false)
  const market = useQuery(validId ? `prediction:market:${validId}` : null, () => getPolymarketMarket(validId!, 'max', freshRequest.current), { staleTime: 30_000, pollInterval: POLL.quote, loading:'silent' })
  const refreshQuote=async()=>{if(quoteRefreshing)return;freshRequest.current=true;setQuoteRefreshing(true);try{const wasLoading=market.loading;await market.refetch();if(wasLoading)await market.refetch()}finally{freshRequest.current=false;setQuoteRefreshing(false)}}
  // A market that belongs to an event opens the event page (2026-10-29): links from My predictions and older bets
  // carried the bare market id and landed on the single-market layout instead of the page the markets tab uses.
  const parentEvent = market.data?.market.eventId
  useEffect(() => {
    if (eventId === undefined && !eventHeader && parentEvent && /^\d+$/.test(parentEvent)) openPath(`/prediction/event-${encodeURIComponent(parentEvent)}`, { replace: true })
  }, [parentEvent, eventId, eventHeader])
  const translation = useQuery(validId && locale !== 'en' ? `prediction:translation:${validId}:${locale}` : null,
    () => translatePolymarketMarkets([validId!], locale as Exclude<typeof locale, 'en'>, true), { staleTime: 10 * 60_000, loading: 'silent' })
  const [localTicketOpen,setLocalTicketOpen]=useState(false),[ticketSide,setTicketSide]=useState(initialOutcome),[busy,setBusy]=useState(false)
  const isTicketOpen=ticketOpen??localTicketOpen
  const closeTicket=()=>{if(!busy){onTicketClose?.();setLocalTicketOpen(false)}}
  const [expanded, setExpanded] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [hideUnavailable, setHideUnavailable] = useHideUnavailablePrediction()
  const data = market.data
  const now=usePredictionExpiryClock(data?[data.market]:[])
  const topbar = <RwaTopbar screen="prediction-detail" title={t.kicker.split(' · ')[0]} onBack={() => backOr('/markets?tab=predictions')} action={{label: predictionAvailabilityText(locale,'How to play'), Icon: Info, onClick: () => setShowGuide(true)}} />
  const guide = <PredictionHowTo open={showGuide} onOpenChange={setShowGuide} hideTrigger />
  const toMarkets = <button type="button" className={s.link} onClick={() => openPath('/markets?tab=predictions')}>{t.toMarkets}</button>
  // How-to lives on the short "Place" heading, never beside the question title.
  const howTo = <button type="button" className={ui.howTo} onClick={() => setShowGuide(true)}><Info size={14} aria-hidden="true" />{predictionAvailabilityText(locale,'How to play')}</button>
  const place = (body: ReactNode) => <section className={ui.place}><SectionHead index="02" title={t.place} action={howTo} />{body}</section>

  if (!validId) return <MaisonPage page="prediction" dock topbar={topbar}>{guide}<div className={s.hero}><StateBlock title={copy.detail.notFound} action={toMarkets} /></div></MaisonPage>
  if (!data && !market.error) return <MaisonPage page="prediction" dock topbar={topbar}>{guide}{eventHeader}{eventHeader?<>{eventOptions&&place(eventOptions)}<PredictionSheet open={isTicketOpen} onClose={closeTicket} title={predictionTicketCopy[locale].buy} busy={busy} compact><div className={`${ui.identity} ${ui.ticketIdentity}`}><Logo src={ticketImage} name={ticketLabel??ticketEventTitle??''}/><div>{ticketEventTitle&&ticketEventTitle!==ticketLabel&&<small>{ticketEventTitle}</small>}<b>{ticketLabel}</b></div></div><Skeleton rows={3}/></PredictionSheet></>:<div className={s.hero}><Skeleton rows={5} /></div>}</MaisonPage>
  if (!data) return <MaisonPage page="prediction" dock topbar={topbar}>{guide}{eventHeader}{eventOptions&&place(eventOptions)}<div className={s.hero}>
    <StateBlock tone="error" title={t.loadError} body={market.error?.status === 404 ? copy.detail.notFound : undefined} retry={market.refetch} retryLabel={copy.common.retry} action={toMarkets} />
  </div></MaisonPage>

  const m = data.market
  const ended=!isPredictionDiscoverable(m,now)
  const localized = locale !== 'en' ? translation.data?.items?.find((item) => item.id === m.id) : undefined
  const translated = showOriginal ? undefined : localized
  const translationLabels = polymarketTranslationCopy[locale]
  const history = data.pricing.history.filter((point) => Number.isFinite(point.price) && Number.isFinite(point.time) && point.time > 0)
  const partial = !data.orderbook || history.length < 2
  const directions = evaluatePredictionDirections(m, data.outcomeBooks)

  const numericHeader = <>
    <PredictionHero kicker={`${t.kicker}${m.category ? ` · ${m.category}` : ''}`} title={translated?.question ?? m.question}
      meta={<><span className={s.badge} data-tone={m.acceptingOrders ? 'live' : 'warn'}>{t.source}</span>{m.endDate && <span>{t.closes} {fmtDate(m.endDate, locale)}</span>}</>}>
      <PredictionCountdown endAt={m.endDate} closed={hasPredictionEnded(m,now)} />
      {locale !== 'en' && <p className={s.foot}>
        <span>{localized ? translationLabels.translated : translation.loading ? translationLabels.loading : translationLabels.unavailable}</span>
        {localized && <button type="button" className={s.link} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? translationLabels.hideOriginal : translationLabels.original}</button>}
      </p>}
    </PredictionHero>

    <section className={`${s.lacquer} ${ui.odds}`}>
      <div className={s.prob} style={{ marginTop: 0 }}>{m.outcomes.map((label, index) => <div key={label} className={s.probRow}>
        <span>{translated?.outcomes[index] ?? outcomeLabel(label, copy)}</span><b className={s.num}>{pct(m.prices[index])}</b>
        <span className={s.probBar}><i style={{ ['--p' as string]: Math.max(0, Math.min(1, m.prices[index] ?? 0)) }} /></span>
      </div>)}</div>
      <dl className={s.stats} style={{ marginTop: 20 }}>
        <div><dt>{t.volume}</dt><dd className={s.num}>{fmtUsd(String(m.volume24h ?? ''), { compact: true, locale })}</dd></div>
        <div><dt>{t.liquidity}</dt><dd className={s.num}>{fmtUsd(String(m.liquidity ?? ''), { compact: true, locale })}</dd></div>
      </dl>
      <p className={s.foot}><span>{fill(copy.common.updated, { t: fmtDateTime(data.fetchedAt, locale) })}</span></p>
    </section>
    {partial && <div className={s.notice}><Info size={16} /><span>{t.partial}</span></div>}

    <section className={ui.chart}><SectionHead index="01" title={t.history} note={m.outcomes[0] ? translated?.outcomes[0] ?? outcomeLabel(m.outcomes[0], copy) : undefined} />
    {history.length >= 2 ? <>
      <Sparkline points={history.map((point) => point.price)} label={t.history} />
      <div className={s.chartAxis}><span>{fmtDate(new Date(history[0].time * 1000).toISOString(), locale)}</span><span>{fmtDate(new Date(history[history.length - 1].time * 1000).toISOString(), locale)}</span></div>
    </> : <StateBlock title={t.historyEmpty} />}
    </section>
  </>
  const numericOptions = ended?<StateBlock tone="unavailable" title={predictionAvailabilityText(locale,'Closed')}/>:<><div className={availabilityUi.controls}><button type="button" role="switch" aria-checked={hideUnavailable} className={availabilityUi.toggle} onClick={()=>setHideUnavailable(!hideUnavailable)}>{predictionAvailabilityText(locale,'Hide unavailable')}<span className={availabilityUi.switch} aria-hidden="true"><i/></span></button></div><div className={s.outcome}>{m.outcomes.slice(0,2).map((label,i)=>hideUnavailable&&directions[i].state==='unavailable'?null:<button key={label} type="button" data-side={i?'no':'yes'} className={directions[i].state==='unavailable'?ui.unavailableButton:undefined} disabled={directions[i].state==='unavailable'} title={directions[i].state==='unavailable'?predictionTicketCopy[locale].unavailable:undefined} onClick={()=>{if(!isPredictionDiscoverable(m))return;setTicketSide(i);setLocalTicketOpen(true)}}>{translated?.outcomes[i]??outcomeLabel(label,copy)} · {pct(m.prices[i])}</button>)}</div></>

  // Both entries share one skeleton: hero → odds card → 01 chart → 02 place (+ how-to) → 03 rules → discussion.
  return <MaisonPage page="prediction" dock topbar={topbar}>
    {guide}
    {eventHeader ?? numericHeader}
    {place(eventOptions ?? numericOptions)}
    <PredictionSheet open={isTicketOpen&&!ended} onClose={closeTicket} title={predictionTicketCopy[locale].buy} busy={busy} compact>
      <div className={`${ui.identity} ${ui.ticketIdentity}`}><Logo src={ticketImage} name={ticketLabel??translated?.question??m.question}/><div>{ticketEventTitle&&ticketEventTitle!==ticketLabel&&<small>{ticketEventTitle}</small>}<b>{ticketLabel??translated?.question??m.question}</b></div></div>
      {isTicketOpen&&<BetTicket key={m.id} data={data} translation={translated} initialOutcome={eventHeader?initialOutcome:ticketSide} onBusyChange={setBusy} onRefreshQuote={refreshQuote} quoteRefreshing={quoteRefreshing} quoteError={market.error?.message}/>}
    </PredictionSheet>

    {m.description && <>
      <SectionHead index="03" title={t.rules} note={eventHeader?(ticketLabel??m.question):undefined} />
      {locale!=='en'&&<button type="button" className={s.predTranslate} disabled={translation.loading} onClick={()=>localized?setShowOriginal(v=>!v):void translation.refetch()}>{translation.loading?communityExperienceCopy[locale].translating:localized&&!showOriginal?communityExperienceCopy[locale].original:communityExperienceCopy[locale].translate}</button>}
      <p className={s.prose} style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{translated?.rules ?? m.description}</p>
      {!expanded && <button type="button" className={s.link} onClick={() => setExpanded(true)}>{tradeCopy[locale].basketOrder.readMore}</button>}
    </>}
    {(eventId || m.eventId) && <PredictionDiscussion key={eventId??m.eventId} eventId={(eventId??m.eventId)!}/>}
  </MaisonPage>
}

/** A side's price as Polymarket shows it: 52¢ (under 1¢ reads <1¢). */
function cents(price: unknown) {
  const value = Number(price) * 100
  return !Number.isFinite(value) ? '—' : value > 0 && value < 1 ? '<1¢' : `${Math.round(value)}¢`
}
function outcomeLabel(label: string, copy: (typeof marketCopy)[keyof typeof marketCopy]) {
  const key = label.trim().toLowerCase()
  return key === 'yes' ? copy.review.yes : key === 'no' ? copy.review.no : label
}

function BetTicket({ data, translation, initialOutcome=0, onBusyChange, onRefreshQuote, quoteRefreshing, quoteError }: { data: PolymarketMarket; translation?: PolymarketTranslation; initialOutcome?: number; onBusyChange?:(busy:boolean)=>void;onRefreshQuote:()=>Promise<void>;quoteRefreshing:boolean;quoteError?:string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const t = tradeCopy[locale].prediction
  const signedIn = useSignedIn()
  const status = useQuery('prediction:status', getPredictionStatus, { staleTime: 60_000, pollInterval: POLL.list })
  const wallet = useQuery(signedIn ? 'wallet:summary:prediction' : null, getWallet, { staleTime: 15_000 })
  // Stage 3 (2026-11-01): a bet fee coupon, when the user has one; the server works out the real discount.
  const rewards = useQuery(signedIn ? 'rewards:wallet' : null, rewardWalletQuery, { staleTime: 30_000, loading: 'silent' })
  const coupon = bestCoupon(rewards.data, 'prediction_place_fee')
  const [useCoupon, setUseCoupon] = useState(true)
  // v2 (2026-11-02): a 下注券 pays the whole stake (stake = its face, no place fee, a win is paid in full).
  const myVouchers = vouchers(rewards.data)
  const [voucherId, setVoucherId] = useState<string | null>(null)
  const voucher = myVouchers.find(v => v.id === voucherId) ?? null
  const rk = useRewardsCopy()
  // 默认选中第一个方向。若初始为 null，price 恒为 null，
  // 「预计份数 / 派彩费 / 中奖净到账」会全部显示「—」——用户填了金额却看不到任何结果。
  const [outcome, setOutcome] = useState<number | null>(initialOutcome)
  const [stake, setStake] = usePageState(`prediction:ticket:${data.market.id}:stake`, '')
  const [risk, setRisk] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState<PredictionBet | null>(null)
  const pin = usePurchasePin<PredictionBet & { duplicate?: boolean }>()
  const keys = useRef(new Map<string, string>())
  useEffect(()=>{onBusyChange?.(pending)},[pending,onBusyChange])
  useEffect(()=>{setOutcome(initialOutcome)},[initialOutcome])

  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer) }, [])
  const m = data.market
  const limits = status.data?.limits
  const decimals = limits?.assetDecimals ?? 6
  const atomic = stake && DEC_6.test(stake) ? toAtomic(stake, decimals) : null
  const available = wallet.data?.balances.availableAtomic ?? null
  const cashAction = predictionWalletAction({availableAtomic: available, walletDecimals: wallet.data?.asset.decimals, walletAsset: wallet.data?.asset.code, expectedDecimals: decimals, loading: wallet.loading && !wallet.data, error: Boolean(wallet.error)})
  const walletAction = voucher && cashAction === 'deposit' ? 'bet' : cashAction
  const quote = predictionQuote(outcome === null ? null : data.outcomeBooks?.[outcome], outcome === null ? undefined : m.prices[outcome], atomic ? Number(atomic)/(10**decimals)*(1-(status.data?.fees?.placeFeeRate??0)) : 0, now)
  const directions = evaluatePredictionDirections(m, data.outcomeBooks, now)
  const price = quote.available ? quote.price : null
  const tokenId = outcome === null ? null : m.tokenIds[outcome] ?? null

  const fieldError = useMemo(() => {
    if (!stake) return null
    if (!atomic || atomic === '0') return t.errors.format
    if (limits?.maxStakeAtomic && BigInt(atomic) > BigInt(limits.maxStakeAtomic)) return fill(t.errors.max, { v: fmtAtomic(limits.maxStakeAtomic, decimals, 'USDT', 0) })
    if (!voucher && available !== null && /^\d+$/.test(available) && (wallet.data?.asset.decimals ?? 6) === decimals && BigInt(atomic) > BigInt(available)) return tradeCopy[locale].basketOrder.errors.balance
    return null
  }, [atomic, available, decimals, limits, locale, stake, t.errors, wallet.data?.asset.decimals, voucher])

  // A+C 混合收费：下注先抽「下注费」，只有净额进池并折算份额；赢家派彩再抽「派彩费」。
  // 费率以服务端 /v1/predictions/status 为权威（下方 status.data.fees），前端不硬编码。
  const placeFeeRate = status.data?.fees?.placeFeeRate ?? 0
  const payoutFeeRate = status.data?.fees?.payoutFeeRate ?? 0
  const estimate = estimatePredictionBet({
    stakeAtomic: atomic,
    decimals,
    price,
    placeFeeRate: voucher ? 0 : placeFeeRate,
    payoutFeeRate,
  })
  const { shares, payoutFee, netPayout, placeFeeAtomic } = estimate
  const couponOn = Boolean(coupon && useCoupon && !voucher)
  const discount = couponOn ? discountOn(coupon, BigInt(placeFeeAtomic.toString())) : BigInt(0)
  const chargedFee = BigInt(placeFeeAtomic.toString()) - discount

  if (!status.data && !status.error) return <Skeleton rows={2} />
  if (status.error && !status.data) return <StateBlock tone="error" title={copy.common.errorGeneric} body={status.error.message} retry={status.refetch} retryLabel={copy.common.retry} />
  if (!status.data?.enabled) return <StateBlock tone="unavailable" title={t.disabled} />
  if (!m.acceptingOrders) return <StateBlock tone="unavailable" title={t.notAccepting} />
  if (!signedIn) return <button type="button" className={s.cta} style={{ width: '100%' }} onClick={() => signInThenReturn()}><span>{t.signIn}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>

  if (done) return <section className={s.lacquer} aria-live="polite">
    <div className={s.statusMark} data-tone="up"><Check size={26} strokeWidth={1.6} /></div>
    <h2 className={s.titleL} style={{ marginTop: 0, fontSize: 28 }}>{t.done}</h2>
    <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55 }}>{fill(t.doneBody, { s: Number(done.shares).toLocaleString(locale, { maximumFractionDigits: 4 }), p: pct(Number(done.price)) })}</p>
    <dl className={s.summary} style={{ marginTop: 16 }}>
      <div data-strong="true"><dt>{t.stake}</dt><dd className={s.num}>{fmtAtomic(done.stakeAtomic, decimals, 'USDT')}</dd></div>
      {done.feeAtomic && <div><dt>{fill(t.feePlace, { r: pct(placeFeeRate) })}</dt><dd className={s.num}>{fmtAtomic(done.feeAtomic, decimals, 'USDT')}</dd></div>}
      {done.feeDiscountAtomic && done.feeDiscountAtomic !== '0' && <div><dt>{rk.useCoupon}</dt><dd className={s.num}>{rk.discount(fmtAtomic(done.feeDiscountAtomic, decimals, 'USDT'))}</dd></div>}
      <div><dt>{marketCopy[locale].status.orderId}</dt><dd className={s.num}>{done.id.slice(0, 8)}…</dd></div>
    </dl>
    <div className={s.actions2} style={{ marginTop: 16 }}>
      <button type="button" className={s.ghost} onClick={() => { setDone(null); setStake(''); setRisk(false) }}>{t.place}</button>
      <button type="button" className={s.ghost} onClick={() => openPath('/assets')}>{t.toAssets}</button>
    </div>
  </section>

  const ready = Boolean(walletAction==='bet' && tokenId && atomic && atomic!=='0' && quote.available && !fieldError && risk && !pending && !quoteRefreshing && !quoteError)
  const submit = async () => {
    if (!ready || !tokenId || !atomic) return
    const intent: Omit<PlaceBetBody, 'idempotencyKey'> = { tokenId, stakeAtomic: BigInt(atomic).toString(), ...(price ? { expectedPrice: price.toFixed(6) } : {}), ...(voucher ? { voucherId: voucher.id } : couponOn && coupon ? { couponId: coupon.id } : {}) }
    // Keyed on token + stake only, so a retry at a refreshed price still maps to the same bet.
    const idempotencyKey = idempotencyKeyForIntent(keys.current, 'POST', BET_PATH, { tokenId: intent.tokenId, stakeAtomic: intent.stakeAtomic, couponId: intent.couponId ?? '', voucherId: intent.voucherId ?? '' })
    setPending(true)
    setServerError(null)
    // The payment PIN confirms the bet (2026-11-05).
    const result = await pin.ask([{ label: t.stake, value: fmtAtomic(intent.stakeAtomic, decimals, 'USDT') }], (code) => placePredictionBet({ ...intent, idempotencyKey, transactionPin: code }))
    setPending(false)
    if (result === null) return
    if (!result.ok && rk.voucherErrors[result.error.code]) { setServerError(rk.voucherErrors[result.error.code]); return }
    if (!result.ok && result.error.code === 'REWARD_COUPON_INVALID' && voucher) { setVoucherId(null); invalidate(['rewards:']); setServerError(rk.couponInvalid); return }
    if (!result.ok && result.error.code === 'REWARD_COUPON_INVALID') { setUseCoupon(false); invalidate(['rewards:']); setServerError(rk.couponInvalid); return }
    if (!result.ok) { setServerError(t.server[result.error.code] ?? result.error.message ?? copy.common.errorGeneric); return }
    keys.current.clear()
    invalidate(['wallet:', 'portfolio:', 'home:', 'prediction:bets', 'rewards:'])
    setDone(result.data)
    // Then the success page (2026-11-05): the event, the side and price, shares, what it pays if right, the order number.
    const bet = result.data
    const side = outcome !== null ? (translation?.outcomes[outcome] ?? outcomeLabel(m.outcomes[outcome] ?? '', copy)) : '—'
    savePurchaseDone({
      kind: 'prediction', title: locale === 'zh-CN' ? '下单成功' : 'Prediction placed', amount: fmtAtomic(bet.stakeAtomic, decimals, ''), unit: 'USDT',
      rows: [
        { label: locale === 'zh-CN' ? '事件' : 'Event', value: translation?.question ?? m.question },
        { label: locale === 'zh-CN' ? '方向' : 'Side', value: `${side} · ${pct(Number(bet.price))}` },
        { label: t.shares, value: Number(bet.shares).toLocaleString(locale, { maximumFractionDigits: 4 }) },
        ...(netPayout !== null ? [{ label: t.payout, value: `≈ ${netPayout.toLocaleString(locale, { maximumFractionDigits: 2 })} USDT` }] : []),
        { label: marketCopy[locale].status.orderId, value: `${bet.id.slice(0, 8).toUpperCase()}` },
      ],
      note: fill(t.doneBody, { s: Number(bet.shares).toLocaleString(locale, { maximumFractionDigits: 4 }), p: pct(Number(bet.price)) }),
      donePath: '/assets', againPath: `${window.location.pathname}${window.location.search}`, recordsPath: '/my-predictions',
    })
    openPath(PURCHASE_DONE_PATH)
  }

  const amountTooLarge = Boolean(atomic && atomic !== '0' && quote.reason==='no_liquidity' && outcome!==null && directions[outcome]?.state==='available')
  // The quick keys' 最大 (2026-11-05): all the cash, or the per-bet cap when that is lower; cut, never rounded up.
  const capAtomic = available && /^\d+$/.test(available) && (wallet.data?.asset.decimals ?? 6) === decimals
    ? (limits?.maxStakeAtomic && BigInt(limits.maxStakeAtomic) < BigInt(available) ? limits.maxStakeAtomic : available) : null
  const maxStake = capAtomic ? share(capAtomic, 100, decimals) : null
  const stakeNum = atomic ? Number(atomic) / 10 ** decimals : 0
  const gain = netPayout !== null && stakeNum > 0 ? (() => { const r = Math.round((netPayout / stakeNum - 1) * 100); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString(locale)}%` })() : null
  const loss = stakeNum > 0 && !voucher ? fmtAtomic(atomic, decimals, 'USDT') : null
  let smallerStake = amountTooLarge ? predictionCapacityStake(quote.depth, placeFeeRate, decimals) : null
  if (smallerStake && available && /^\d+$/.test(available) && BigInt(toAtomic(smallerStake,decimals)??'0')>BigInt(available)) smallerStake = null
  return <>{pin.ui}<PredictionBetForm
    stake={stake} onStake={value=>{setStake(value);setServerError(null)}} maxStake={maxStake} decimals={decimals} gain={gain} loss={loss}
    outcomes={m.outcomes.slice(0,2).map((label,index)=>({label:translation?.outcomes[index]??outcomeLabel(label,copy),probability:cents(m.prices[index]),disabled:!m.tokenIds[index] || directions[index].state==='unavailable'}))}
    outcome={outcome} onOutcome={index=>{setOutcome(index);setServerError(null)}} walletAction={walletAction} balance={fmtAtomic(available,decimals,'USDT')}
    price={price ? `${(price*100).toLocaleString(locale,{maximumFractionDigits:2})}¢` : '—'} shares={shares ? `≈ ${shares.toLocaleString(locale,{maximumFractionDigits:2})}` : '—'}
    fees={atomic ? `${fmtAtomic(chargedFee.toString(),decimals,'USDT')} + ${payoutFee!==null?payoutFee.toLocaleString(locale,{maximumFractionDigits:2}):'—'} USDT` : '—'}
    netPayout={netPayout!==null?`≈ ${netPayout.toLocaleString(locale,{maximumFractionDigits:2})} USDT`:'—'} updatedAt={fmtDateTime(data.fetchedAt,locale)} limit={limits?.maxStakeAtomic?fill(t.limit,{v:fmtAtomic(limits.maxStakeAtomic,decimals,'USDT',0)}):undefined}
    fieldError={fieldError} serverError={serverError} quoteReason={quote.reason} quoteError={Boolean(quoteError)} amountTooLarge={amountTooLarge} smallerStake={smallerStake}
    voucher={myVouchers.length ? { label: rk.useVoucher, hint: rk.voucherHint, off: rk.voucherNone, options: myVouchers.map(v => ({ id: v.id, label: fmtAtomic(v.maxDiscountAtomic, v.assetDecimals, v.assetCode, 0) })), selected: voucherId, onSelect: (id) => { setVoucherId(id); setServerError(null); const v = myVouchers.find(x => x.id === id); setStake(v ? fromAtomicStr(v.maxDiscountAtomic, v.assetDecimals) : '') } } : undefined}
    stakeLocked={Boolean(voucher)}
    coupon={!voucher && coupon ? { label: rk.useCoupon, sub: `${rk.upTo} ${fmtAtomic(coupon.maxDiscountAtomic, coupon.assetDecimals, coupon.assetCode)} · ${rk.validUntil(fmtDate(coupon.expiresAt, locale))}`, discount: couponOn && discount > BigInt(0) ? rk.discount(fmtAtomic(discount.toString(), decimals, 'USDT')) : null, on: useCoupon, onToggle: setUseCoupon } : undefined}
    refreshing={quoteRefreshing} pending={pending} risk={risk} ready={ready} onRisk={value=>{setRisk(value);setServerError(null)}}
    onRefresh={()=>{setServerError(null);void onRefreshQuote()}} onLower={()=>{if(smallerStake){setStake(smallerStake);setServerError(null)}}} onReload={()=>void wallet.refetch()} onDeposit={()=>openPath('/wallet/deposit')} onSubmit={()=>void submit()}
  /></>
}
