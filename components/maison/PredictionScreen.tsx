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
import { addPredictionStake, predictionCapacityStake, predictionWalletAction } from '@/lib/prediction-ticket-state'
import { useHideUnavailablePrediction } from '@/lib/use-prediction-directions'
import { predictionAvailabilityText } from '@/lib/prediction-availability-copy'
import {hasPredictionEnded,isPredictionDiscoverable} from '@/lib/prediction-lifecycle'
import {usePredictionExpiryClock} from '@/lib/use-prediction-expiry-clock'

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
  const localized = locale !== 'en' ? translation.data?.items.find((item) => item.id === m.id) : undefined
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
  // 默认选中第一个方向。若初始为 null，price 恒为 null，
  // 「预计份数 / 派彩费 / 中奖净到账」会全部显示「—」——用户填了金额却看不到任何结果。
  const [outcome, setOutcome] = useState<number | null>(initialOutcome)
  const [stake, setStake] = usePageState(`prediction:ticket:${data.market.id}:stake`, '')
  const [risk, setRisk] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState<PredictionBet | null>(null)
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
  const walletAction = predictionWalletAction({availableAtomic: available, walletDecimals: wallet.data?.asset.decimals, walletAsset: wallet.data?.asset.code, expectedDecimals: decimals, loading: wallet.loading && !wallet.data, error: Boolean(wallet.error)})
  const quote = predictionQuote(outcome === null ? null : data.outcomeBooks?.[outcome], outcome === null ? undefined : m.prices[outcome], atomic ? Number(atomic)/(10**decimals)*(1-(status.data?.fees?.placeFeeRate??0)) : 0, now)
  const directions = evaluatePredictionDirections(m, data.outcomeBooks, now)
  const price = quote.available ? quote.price : null
  const tokenId = outcome === null ? null : m.tokenIds[outcome] ?? null

  const fieldError = useMemo(() => {
    if (!stake) return null
    if (!atomic || atomic === '0') return t.errors.format
    if (limits?.maxStakeAtomic && BigInt(atomic) > BigInt(limits.maxStakeAtomic)) return fill(t.errors.max, { v: fmtAtomic(limits.maxStakeAtomic, decimals, 'USDT', 0) })
    if (available !== null && /^\d+$/.test(available) && (wallet.data?.asset.decimals ?? 6) === decimals && BigInt(atomic) > BigInt(available)) return tradeCopy[locale].basketOrder.errors.balance
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
    <h2 className={s.titleL} style={{ marginTop: 0, fontSize: 28 }}>{t.done}</h2>
    <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55 }}>{fill(t.doneBody, { s: Number(done.shares).toLocaleString(locale, { maximumFractionDigits: 4 }), p: pct(Number(done.price)) })}</p>
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

  const ready = Boolean(walletAction==='bet' && tokenId && atomic && atomic!=='0' && quote.available && !fieldError && risk && !pending && !quoteRefreshing && !quoteError)
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

  const amountTooLarge = Boolean(atomic && atomic !== '0' && quote.reason==='no_liquidity' && outcome!==null && directions[outcome]?.state==='available')
  let smallerStake = amountTooLarge ? predictionCapacityStake(quote.depth, placeFeeRate, decimals) : null
  if (smallerStake && available && /^\d+$/.test(available) && BigInt(toAtomic(smallerStake,decimals)??'0')>BigInt(available)) smallerStake = null
  return <PredictionBetForm
    stake={stake} onStake={value=>{setStake(value);setServerError(null)}} onAdd={amount=>{setStake(addPredictionStake(stake,amount,decimals));setServerError(null)}}
    outcomes={m.outcomes.slice(0,2).map((label,index)=>({label:translation?.outcomes[index]??outcomeLabel(label,copy),probability:pct(m.prices[index]),disabled:!m.tokenIds[index] || directions[index].state==='unavailable'}))}
    outcome={outcome} onOutcome={index=>{setOutcome(index);setServerError(null)}} walletAction={walletAction} balance={fmtAtomic(available,decimals,'USDT')}
    price={price ? `${(price*100).toLocaleString(locale,{maximumFractionDigits:2})}¢` : '—'} shares={shares ? `≈ ${shares.toLocaleString(locale,{maximumFractionDigits:2})}` : '—'}
    fees={atomic ? `${fmtAtomic(placeFeeAtomic.toString(),decimals,'USDT')} + ${payoutFee!==null?payoutFee.toLocaleString(locale,{maximumFractionDigits:2}):'—'} USDT` : '—'}
    netPayout={netPayout!==null?`≈ ${netPayout.toLocaleString(locale,{maximumFractionDigits:2})} USDT`:'—'} updatedAt={fmtDateTime(data.fetchedAt,locale)} limit={limits?.maxStakeAtomic?fill(t.limit,{v:fmtAtomic(limits.maxStakeAtomic,decimals,'USDT',0)}):undefined}
    fieldError={fieldError} serverError={serverError} quoteReason={quote.reason} quoteError={Boolean(quoteError)} amountTooLarge={amountTooLarge} smallerStake={smallerStake}
    refreshing={quoteRefreshing} pending={pending} risk={risk} ready={ready} onRisk={value=>{setRisk(value);setServerError(null)}}
    onRefresh={()=>{setServerError(null);void onRefreshQuote()}} onLower={()=>{if(smallerStake){setStake(smallerStake);setServerError(null)}}} onReload={()=>void wallet.refetch()} onDeposit={()=>openPath('/wallet/deposit')} onSubmit={()=>void submit()}
  />
}
