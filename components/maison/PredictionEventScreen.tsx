'use client'
import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {usePageState} from '@/lib/app-navigation'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n,type AppLocale} from '@/lib/i18n'
import {useQuery} from '@/lib/api/_query'
import {getSessionToken,SESSION_CHANGED,type ApiResult} from '@/lib/api/_http'
import {listPredictionFavorites,setPredictionFavorite} from '@/lib/api/markets'
import {backOr,openPath} from '@/lib/maison-nav'
import {HISTORY_PERIODS,formatProbability,type HistoryPeriod} from '@/lib/polymarket-data'
import {PredictionHero,PredictionMarketScreen} from './PredictionScreen'
import {PredictionProbabilityChart,PROBABILITY_COLORS,type ProbabilityCurve} from './PredictionProbabilityChart'
import {MaisonPage,SectionHead,Skeleton,StateBlock,Logo,maison as s} from './primitives'
import {tradeCopy} from '@/lib/maison-trade-copy'
import {fmtUsd} from '@/lib/money'
import {fmtDate} from './format'
import {PredictionHowTo} from './PredictionHowTo'
import ui from './prediction-experience.module.css'
import {PredictionTranslationButton} from './PredictionTranslationButton'
import {predictionInterfaceText} from '@/lib/prediction-interface-copy'
import {Check,Info,RefreshCw,Star,X} from 'lucide-react'
import {PredictionCountdown} from './PredictionCountdown'
import {hideUnavailablePrediction,type PredictionDirectionAvailability} from '@/lib/prediction-availability'
import {useHideUnavailablePrediction,usePredictionDirections,usePredictionRowVisibility} from '@/lib/use-prediction-directions'
import {predictionAvailabilityText} from '@/lib/prediction-availability-copy'
import availabilityUi from './prediction-availability.module.css'
import {isPredictionDiscoverable,openPredictionItems} from '@/lib/prediction-lifecycle'
import {usePredictionExpiryClock} from '@/lib/use-prediction-expiry-clock'

type EventCopy={open:string;total:string;yes:string;no:string;starts:string;ends:string;vol24h:string;note:string;related:string;save:string;saved:string}
const eventCopy:Record<AppLocale,EventCopy>={
  en:{open:'open markets',total:'Total volume',yes:'Yes',no:'No',starts:'Starts',ends:'Ends',vol24h:'24h volume',note:'Additional context',related:'Related events',save:'Add to watchlist',saved:'Remove from watchlist'},
  'zh-CN':{open:'个进行中市场',total:'总成交量',yes:'是',no:'否',starts:'开始时间',ends:'结束时间',vol24h:'24小时成交量',note:'补充说明',related:'相关事件',save:'收藏',saved:'取消收藏'},
  hi:{open:'खुले बाज़ार',total:'कुल वॉल्यूम',yes:'हाँ',no:'नहीं',starts:'शुरुआत',ends:'समाप्ति',vol24h:'24 घंटे का वॉल्यूम',note:'अतिरिक्त जानकारी',related:'संबंधित इवेंट',save:'वॉचलिस्ट में जोड़ें',saved:'वॉचलिस्ट से हटाएँ'},
  es:{open:'mercados abiertos',total:'Volumen total',yes:'Sí',no:'No',starts:'Inicio',ends:'Cierre',vol24h:'Volumen 24 h',note:'Contexto adicional',related:'Eventos relacionados',save:'Guardar',saved:'Quitar de guardados'},
  ar:{open:'أسواق مفتوحة',total:'إجمالي الحجم',yes:'نعم',no:'لا',starts:'البداية',ends:'النهاية',vol24h:'حجم 24 ساعة',note:'معلومات إضافية',related:'أحداث ذات صلة',save:'حفظ',saved:'إزالة من المحفوظات'},
  fr:{open:'marchés ouverts',total:'Volume total',yes:'Oui',no:'Non',starts:'Début',ends:'Fin',vol24h:'Volume 24 h',note:'Contexte',related:'Événements liés',save:'Enregistrer',saved:'Retirer des favoris'},
  pt:{open:'mercados abertos',total:'Volume total',yes:'Sim',no:'Não',starts:'Início',ends:'Término',vol24h:'Volume 24 h',note:'Contexto adicional',related:'Eventos relacionados',save:'Salvar',saved:'Remover dos salvos'},
}
// Polymarket-style cents: whole cents in the middle of the range, one decimal at the thin ends.
const cents=(price:number|undefined)=>price==null||!Number.isFinite(price)?'—':`${price*100<1||price*100>99?(price*100).toFixed(1):Math.round(price*100)}¢`
// Below this resting liquidity a market is "unavailable" for the hide switch even before its book is probed.
const LOW_LIQUIDITY=100
type RelatedEvent={id:string;title:string;image:string|null;volume:number;leadLabel:string|null;leadPrice:number|null}
type Event={id:string;title:string;description?:string;image:string|null;volume:number;volume24h?:number;tags?:Array<{id:string;label:string}>;related?:RelatedEvent[];fetchedAt:string;startAt?:string|null;endAt:string|null;closed?:boolean;resolved?:boolean;active?:boolean;archived?:boolean;markets:Array<{id:string;label:string;question:string;image:string|null;prices:number[];tokenIds?:string[];closed:boolean;resolved?:boolean;active?:boolean;acceptingOrders?:boolean;endAt?:string|null;volume:number;volume24h?:number;liquidity?:number|null}>;curves:ProbabilityCurve[]}
// Watchlist follows the account (/v1/predictions/favorites). A signed-out tap goes to login and returns here.
// The old device-local list is pushed up once after sign-in, then dropped.
const LEGACY_FAVORITES_KEY='rwa:prediction:favorite-events'
let legacyFavoritesMoved=false
async function moveLegacyFavorites():Promise<boolean> {
  if(legacyFavoritesMoved)return false
  legacyFavoritesMoved=true
  let ids:string[]=[]
  try{const v:unknown=JSON.parse(localStorage.getItem(LEGACY_FAVORITES_KEY)??'[]');ids=Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&/^\d{1,20}$/.test(x)).slice(0,200):[]}catch{return false}
  const results=await Promise.all(ids.map(x=>setPredictionFavorite(x,true)))
  if(results.every(r=>r.ok))try{localStorage.removeItem(LEGACY_FAVORITES_KEY)}catch{}
  return ids.length>0
}
function useFavoriteEvent(id:string):[boolean,()=>void] {
  const [signedIn,setSignedIn]=useState(false)
  const [override,setOverride]=useState<{id:string;on:boolean}|null>(null)
  const query=useQuery(signedIn?'prediction:favorites':null,listPredictionFavorites,{staleTime:60000,loading:'silent'})
  const refetch=useRef(query.refetch)
  refetch.current=query.refetch
  useEffect(()=>{const sync=()=>setSignedIn(Boolean(getSessionToken()));sync();window.addEventListener(SESSION_CHANGED,sync);return ()=>window.removeEventListener(SESSION_CHANGED,sync)},[])
  useEffect(()=>{if(signedIn)void moveLegacyFavorites().then(moved=>{if(moved)refetch.current()})},[signedIn])
  const on=override?.id===id?override.on:query.data?.some(f=>f.eventId===id)??false
  return [on,()=>{
    if(!getSessionToken()){window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname+window.location.search)}`);return}
    // Optimistic star; a failed write rolls back only if no newer tap superseded it. A 401 here is handled by request() (→ login).
    const next=!on
    setOverride({id,on:next})
    void setPredictionFavorite(id,next).then(r=>{if(r.ok)refetch.current();else setOverride(o=>o?.id===id&&o.on===next?{id,on:!next}:o)})
  }]
}
async function readEvent(id:string,period:HistoryPeriod,curves:string[]):Promise<ApiResult<Event>> {
  try {const r=await fetch(`/api/polymarket/event/${id}?period=${period}&markets=${curves.join(',')}`,{cache:'no-store'});if(!r.ok)throw new Error();return {ok:true,data:await r.json() as Event}}catch{return {ok:false,error:{status:502,code:'POLYMARKET_UNAVAILABLE',message:'Event data unavailable'}}}
}
export function PredictionEventScreen({id}:{id:string}) {
  const {locale}=useI18n()
  const [showGuide,setShowGuide]=useState(false)
  const [hideUnavailable,setHideUnavailable]=useHideUnavailablePrediction()
  const [period,setPeriod]=usePageState<HistoryPeriod>(`event:${id}:period`,'max'), [curves,setCurves]=usePageState<string[]>(`event:${id}:curves`,[]), [selected,setSelected]=usePageState<string|null>(`event:${id}:selected`,null),[side,setSide]=useState(0),[ticketOpen,setTicketOpen]=useState(false)
  const [favorite,toggleFavorite]=useFavoriteEvent(id),[noteOpen,setNoteOpen]=useState(false),[noteClamped,setNoteClamped]=useState(false)
  const query=useQuery(`prediction:event:${id}`,()=>readEvent(id,'max',[]),{staleTime:30000,pollInterval:30000})
  const event=query.data
  const now=usePredictionExpiryClock(event?[event,...event.markets]:[])
  const visibleMarkets=event&&isPredictionDiscoverable(event,now)?openPredictionItems(event.markets,now):[]
  const related=event?.related??[]
  const sources=event?[event.title,...visibleMarkets.flatMap(m=>[m.label,m.question]),...(event.tags??[]).map(tag=>tag.label),...(event.description?[event.description]:[]),...related.flatMap(r=>r.leadLabel?[r.title,r.leadLabel]:[r.title])]:[]
  const translation=useContentTranslation(sources)
  const [original,setOriginal]=useState(false)
  const content=(text:string)=>original?text:translation(text)
  const tr=(key:string)=>predictionInterfaceText(locale,key)
  const topbar=<RwaTopbar screen="prediction-detail" title={tr('Predictions')} onBack={()=>backOr('/markets?tab=predictions')} action={{label:predictionAvailabilityText(locale,'How to play'),Icon:Info,onClick:()=>setShowGuide(true)}}/>
  if(!event)return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}>{query.error?<StateBlock title={query.error.message} retry={query.refetch} retryLabel={tr('Retry')}/>:<Skeleton rows={5}/>}</div><PredictionHowTo open={showGuide} onOpenChange={setShowGuide} hideTrigger/></MaisonPage>
  const selectedMarket=visibleMarkets.find(m=>m.id===selected)
  const current=selectedMarket??visibleMarkets[0]
  const chartIds=(curves.length?curves:event.curves.map(c=>c.id)).filter(curveId=>visibleMarkets.some(m=>m.id===curveId))
  const toggle=(id:string)=>setCurves(chartIds.includes(id)?chartIds.length>1?chartIds.filter(x=>x!==id):chartIds:[...chartIds.slice(-3),id])
  const label=(m:Event['markets'][number])=>content(visibleMarkets.filter(other=>other.label===m.label).length>1?m.question:m.label)
  const legend=(markets:Event['markets'])=><div className={ui.legend}>{markets.map(m=>{const index=chartIds.indexOf(m.id);return <button key={m.id} type="button" className={ui.legendButton} style={{'--curve':index>=0?PROBABILITY_COLORS[index%4]:'var(--m-faint)'} as CSSProperties} aria-pressed={index>=0} onClick={()=>toggle(m.id)}><i className={ui.dot}/><span className={ui.legendAvatar}><Logo src={m.image} name={label(m)}/></span><span className={ui.legendName}>{label(m)}</span><b className={ui.legendValue}>{formatProbability(m.prices[0],locale)}</b></button>})}</div>
  const t=tradeCopy[locale].prediction
  const ec=eventCopy[locale]
  // A figure we can't source is dropped, never shown as "—"; the grid re-flows on data-count (1–4 cells).
  const usd=(n:number)=>fmtUsd(String(n),{compact:true,locale})
  const figures=[
    event.startAt?{key:'starts',label:ec.starts,value:fmtDate(event.startAt,locale)}:null,
    event.endAt?{key:'ends',label:ec.ends,value:fmtDate(event.endAt,locale)}:null,
    event.volume24h!=null&&Number.isFinite(event.volume24h)&&event.volume24h>0?{key:'vol24h',label:ec.vol24h,value:usd(event.volume24h),lead:true}:null,
    Number.isFinite(event.volume)?{key:'total',label:ec.total,value:usd(event.volume),lead:true}:null,
  ].filter((f):f is {key:string;label:string;value:string;lead?:boolean}=>f!=null)
  // Reference skeleton in our lacquer: title + tags → two pairs of key figures (when | how much) → range + chart → markets
  // → context → related. The old leaders card is gone: the legend and every market row already carry the live odds.
  const header=<div className={ui.eventPage}>
    <PredictionHero kicker={t.kicker} image={event.image} title={content(event.title)}
      meta={<>
        <span className={s.badge} data-tone={visibleMarkets.length?'live':'warn'}>{t.source}</span>
        {(event.tags??[]).slice(0,6).map(tag=><span key={tag.id} className={ui.eventTag}>{content(tag.label)}</span>)}
        <button type="button" className={ui.eventStar} aria-pressed={favorite} aria-label={favorite?ec.saved:ec.save} title={favorite?ec.saved:ec.save} onClick={toggleFavorite}><Star size={15} strokeWidth={2} fill={favorite?'currentColor':'none'} aria-hidden="true"/></button>
      </>}>
      <PredictionCountdown endAt={event.endAt} closed={event.closed}/>
      <PredictionTranslationButton translation={translation} original={original} onOriginal={setOriginal} sources={sources}/>
    </PredictionHero>
    {figures.length>0&&<dl className={`${s.lacquer} ${ui.eventFigures}`} data-count={figures.length}>
      {figures.map(f=><div key={f.key}><dt>{f.label}</dt><dd className={f.lead?`${s.num} ${ui.eventFigureLead}`:s.num}>{f.value}</dd></div>)}
    </dl>}
    <section className={ui.chart}>
      <SectionHead index="01" title={t.history}/>
      <div className={s.chips} data-dense="true">{HISTORY_PERIODS.map(p=><button key={p} type="button" className={s.chip} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{tr(({'1h':'1 hour','1d':'1 day','1w':'1 week','1m':'1 month','max':'All'} as const)[p])}</button>)}</div>
      <EventHistoryChart id={id} period={period} selected={curves} initial={event.curves} label={c=>event.markets.find(m=>m.id===c.id)?label(event.markets.find(m=>m.id===c.id)!):content(c.label)} retryLabel={tr('Retry')}/>
      {legend(visibleMarkets.filter(m=>chartIds.includes(m.id)))}
      {visibleMarkets.length>4&&<details className={ui.eventMoreCurves}><summary className={s.link}>{tr('Select up to 4 probability curves')}</summary>{legend(visibleMarkets.filter(m=>!chartIds.includes(m.id)))}</details>}
      <p className={s.foot}><span className={s.num}>Polymarket · {visibleMarkets.length} {ec.open} · {tr('Updated')} {new Date(event.fetchedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</span></p>
    </section>
  </div>
  const options=<div className={ui.eventPage}>
    <div className={availabilityUi.controls}><button type="button" role="switch" aria-checked={hideUnavailable} className={availabilityUi.toggle} onClick={()=>setHideUnavailable(!hideUnavailable)}>{predictionAvailabilityText(locale,'Hide unavailable')}<span className={availabilityUi.switch} aria-hidden="true"><i/></span></button></div>
    {visibleMarkets.map(m=><EventMarketRow key={m.id} market={m} label={label(m)} hideUnavailable={hideUnavailable} selected={current?.id===m.id?side:null} onSelect={selectedSide=>{if(!isPredictionDiscoverable(event)||!isPredictionDiscoverable(m))return;setSelected(m.id);setSide(selectedSide);setTicketOpen(true)}}/>)}
    {!visibleMarkets.length&&<StateBlock tone="unavailable" title={predictionAvailabilityText(locale,'Closed')}/>}
    {event.description&&<section className={ui.eventBlock}>
      <h2 className={ui.eventBlockHead}>{ec.note}</h2>
      {/* "More" follows the real 3-line clamp, not a character count — translated CJK fills three lines far sooner. */}
      <p ref={el=>{if(el&&!noteOpen){const clamped=el.scrollHeight>el.clientHeight+1;if(clamped!==noteClamped)setNoteClamped(clamped)}}} className={ui.eventNote} data-open={noteOpen||undefined}>{content(event.description)}</p>
      {!noteOpen&&noteClamped&&<button type="button" className={s.link} onClick={()=>setNoteOpen(true)}>{tradeCopy[locale].basketOrder.readMore}</button>}
    </section>}
    {related.length>0&&<section className={ui.eventBlock}>
      <h2 className={ui.eventBlockHead}>{ec.related}</h2>
      <ul className={ui.eventRelated}>{related.map(r=><li key={r.id}><button type="button" onClick={()=>openPath(`/prediction/event-${encodeURIComponent(r.id)}`)}>
        <Logo src={r.image} name={r.title}/>
        <span className={ui.eventRelatedName}><b>{content(r.title)}</b><small className={s.num}>{r.leadLabel?`${content(r.leadLabel)} · `:''}{fmtUsd(String(r.volume),{compact:true,locale})}</small></span>
        <b className={s.num}>{r.leadPrice!=null?formatProbability(r.leadPrice,locale):''}</b>
      </button></li>)}</ul>
    </section>}
  </div>
  if(!current)return <MaisonPage page="prediction" dock topbar={topbar}>{header}<section className={ui.place}><SectionHead index="02" title={t.place}/>{options}</section><PredictionHowTo open={showGuide} onOpenChange={setShowGuide} hideTrigger/></MaisonPage>
  return <PredictionMarketScreen key={id} id={current.id} eventHeader={header} eventOptions={options} eventId={id} initialOutcome={side} ticketOpen={ticketOpen&&Boolean(selectedMarket)} onTicketClose={()=>setTicketOpen(false)} ticketLabel={label(current)} ticketImage={current.image} ticketEventTitle={content(event.title)}/>
}

function EventMarketRow({market,label,hideUnavailable,selected,onSelect}:{market:Event['markets'][number];label:string;hideUnavailable:boolean;selected:number|null;onSelect:(side:number)=>void}) {
  const {locale}=useI18n()
  const {ref,seen}=usePredictionRowVisibility()
  const quote=usePredictionDirections(market,seen)
  const tr=(key:string)=>predictionInterfaceText(locale,key)
  const hidden=hideUnavailable&&(hideUnavailablePrediction(quote.directions)||(market.liquidity!=null&&market.liquidity<LOW_LIQUIDITY))
  const status=(direction:PredictionDirectionAvailability)=>predictionAvailabilityText(locale,direction.reason==='empty_book'?'No sell orders':direction.reason==='thin_book'?'Small capacity':direction.reason==='closed'?'Closed':direction.reason==='paused'?'Paused':'Price unavailable')
  const retry=quote.failed||quote.directions.some(direction=>direction.reason==='expired')
  const ec=eventCopy[locale]
  return <section ref={ref} className={`${ui.row} ${ui.eventRow} ${availabilityUi.row}`} hidden={hidden} data-market-id={market.id}>
    <div className={ui.rowHead}><span className={ui.rowIdentity}><Logo src={market.image} name={label}/><span className={ui.eventRowName}><b>{label}</b><small className={s.num}>{tr('Volume')} {fmtUsd(String(market.volume),{compact:true,locale})}{market.volume24h?<> · 24h {fmtUsd(String(market.volume24h),{compact:true,locale})}</>:null}</small></span></span><b className={`${s.num} ${ui.rowProbability}`}>{formatProbability(market.prices[0],locale)}</b></div>
    <div className={`${s.outcome} ${ui.eventOutcome}`}>{[0,1].map(side=>{const direction=quote.directions[side],unavailable=direction.state==='unavailable',Icon=side?X:Check;return <button key={side} type="button" data-side={side?'no':'yes'} className={unavailable?availabilityUi.unavailable:undefined} disabled={unavailable} title={unavailable?status(direction):undefined} aria-label={`${side?tr('Buy No'):tr('Buy Yes')} · ${label} · ${cents(market.prices[side])}${unavailable?` · ${status(direction)}`:''}`} aria-pressed={selected===side} onClick={()=>onSelect(side)}><i className={ui.eventOutcomeIcon} aria-hidden="true"><Icon size={14} strokeWidth={2.6}/></i><span>{side?ec.no:ec.yes}</span><b className={s.num}>{cents(market.prices[side])}</b></button>})}</div>
    {retry&&<button type="button" className={availabilityUi.retry} disabled={quote.loading} onClick={quote.refresh}><RefreshCw size={12} aria-hidden="true"/>{predictionAvailabilityText(locale,quote.loading?'Checking quotes':'Refresh quotes')}</button>}
  </section>
}

function EventHistoryChart({id,period,selected,initial,label,retryLabel}:{id:string;period:HistoryPeriod;selected:string[];initial:ProbabilityCurve[];label:(curve:ProbabilityCurve)=>string;retryLabel:string}) {
  const {locale}=useI18n()
  const baseline=period==='max'&&!selected.length
  const query=useQuery(baseline?null:`prediction:history:${id}:${period}:${selected.join(',')}`,()=>readEvent(id,period,selected),{staleTime:30000,pollInterval:30000,loading:'silent'})
  const previous=useRef(initial)
  const data=baseline?initial:query.data?.curves
  if(data)previous.current=data
  return <div className={ui.historyRegion} aria-busy={query.loading} data-history-period={period}>
    <div style={{opacity:query.loading?.45:1,transition:'opacity .15s'}}><PredictionProbabilityChart curves={(data??previous.current).map(c=>({...c,label:label(c)}))} onRetry={query.refetch}/></div>
    {query.loading&&<span className={ui.chartLoading} role="status" aria-label={predictionInterfaceText(locale,'Loading chart')}><i/></span>}
    {query.error&&<button className={s.link} onClick={query.refetch}>{retryLabel}</button>}
  </div>
}
