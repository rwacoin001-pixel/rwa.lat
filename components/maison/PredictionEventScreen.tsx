'use client'
import {useRef,useState,type CSSProperties} from 'react'
import {usePageState} from '@/lib/app-navigation'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {useQuery} from '@/lib/api/_query'
import type {ApiResult} from '@/lib/api/_http'
import {backOr} from '@/lib/maison-nav'
import {HISTORY_PERIODS,formatProbability,type HistoryPeriod} from '@/lib/polymarket-data'
import {PredictionMarketScreen} from './PredictionScreen'
import {PredictionProbabilityChart,PROBABILITY_COLORS,type ProbabilityCurve} from './PredictionProbabilityChart'
import {MaisonPage,Skeleton,StateBlock,Logo,maison as s} from './primitives'
import {PredictionHowTo} from './PredictionHowTo'
import ui from './prediction-experience.module.css'
import {PredictionTranslationButton} from './PredictionTranslationButton'
import {predictionInterfaceText} from '@/lib/prediction-interface-copy'
import {RefreshCw} from 'lucide-react'
import {PredictionCountdown} from './PredictionCountdown'
import {hideUnavailablePrediction,type PredictionDirectionAvailability} from '@/lib/prediction-availability'
import {useHideUnavailablePrediction,usePredictionDirections,usePredictionRowVisibility} from '@/lib/use-prediction-directions'
import {predictionAvailabilityText} from '@/lib/prediction-availability-copy'
import availabilityUi from './prediction-availability.module.css'

type Event={id:string;title:string;image:string|null;volume:number;fetchedAt:string;endAt:string|null;closed?:boolean;markets:Array<{id:string;label:string;question:string;image:string|null;prices:number[];tokenIds?:string[];closed:boolean;acceptingOrders?:boolean;volume:number}>;curves:ProbabilityCurve[]}
async function readEvent(id:string,period:HistoryPeriod,curves:string[]):Promise<ApiResult<Event>> {
  try {const r=await fetch(`/api/polymarket/event/${id}?period=${period}&markets=${curves.join(',')}`,{cache:'no-store'});if(!r.ok)throw new Error();return {ok:true,data:await r.json() as Event}}catch{return {ok:false,error:{status:502,code:'POLYMARKET_UNAVAILABLE',message:'Event data unavailable'}}}
}
export function PredictionEventScreen({id}:{id:string}) {
  const {locale}=useI18n()
  const [showGuide,setShowGuide]=useState(false)
  const [hideUnavailable,setHideUnavailable]=useHideUnavailablePrediction()
  const [period,setPeriod]=usePageState<HistoryPeriod>(`event:${id}:period`,'max'), [curves,setCurves]=usePageState<string[]>(`event:${id}:curves`,[]), [selected,setSelected]=usePageState<string|null>(`event:${id}:selected`,null),[side,setSide]=useState(0),[resolved,setResolved]=usePageState(`event:${id}:resolved`,false),[ticketOpen,setTicketOpen]=useState(false)
  const query=useQuery(`prediction:event:${id}`,()=>readEvent(id,'max',[]),{staleTime:30000,pollInterval:30000})
  const event=query.data
  const sources=event?[event.title,...event.markets.flatMap(m=>[m.label,m.question])]:[]
  const translation=useContentTranslation(sources)
  const [original,setOriginal]=useState(false)
  const content=(text:string)=>original?text:translation(text)
  const tr=(key:string)=>predictionInterfaceText(locale,key)
  const topbar=<RwaTopbar screen="prediction-detail" title={tr('Predictions')} onBack={()=>backOr('/markets?tab=predictions')} action={{label:predictionAvailabilityText(locale,'How to play'),onClick:()=>setShowGuide(true)}}/>
  if(!event)return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}>{query.error?<StateBlock title={query.error.message} retry={query.refetch} retryLabel={tr('Retry')}/>:<Skeleton rows={5}/>}</div><PredictionHowTo open={showGuide} onOpenChange={setShowGuide} hideTrigger/></MaisonPage>
  const current=event.markets.find(m=>m.id===selected)??event.markets.find(m=>!m.closed)??event.markets[0]
  const chartIds=curves.length?curves:event.curves.map(c=>c.id)
  const toggle=(id:string)=>setCurves(chartIds.includes(id)?chartIds.length>1?chartIds.filter(x=>x!==id):chartIds:[...chartIds.slice(-3),id])
  const label=(m:Event['markets'][number])=>content(event.markets.filter(other=>other.label===m.label).length>1?m.question:m.label)
  const legend=(markets:Event['markets'])=><div className={ui.legend}>{markets.map(m=>{const index=chartIds.indexOf(m.id);return <button key={m.id} type="button" className={ui.legendButton} style={{'--curve':index>=0?PROBABILITY_COLORS[index%4]:'var(--m-faint)'} as CSSProperties} aria-pressed={index>=0} onClick={()=>toggle(m.id)}><i className={ui.dot}/><span className={ui.legendAvatar}><Logo src={m.image} name={label(m)}/></span><span className={ui.legendName}>{label(m)}</span><b className={ui.legendValue}>{formatProbability(m.prices[0],locale)}</b></button>})}</div>
  const header=<section style={{marginBottom:28}}>
<div className={ui.eventTitle}><Logo src={event.image} name={content(event.title)}/><h1 className={s.titleL}>{content(event.title)}</h1><PredictionHowTo open={showGuide} onOpenChange={setShowGuide}/></div>
    <PredictionTranslationButton translation={translation} original={original} onOriginal={setOriginal} sources={sources}/>
    {event.endAt&&<p className={s.foot}>{tr('Closes')} · {new Date(event.endAt).toLocaleDateString(locale)}</p>}
    <PredictionCountdown endAt={event.endAt} closed={event.closed}/>
    {legend(event.markets.filter(m=>chartIds.includes(m.id)))}
    {event.markets.filter(m=>!m.closed).length>4&&<details><summary className={s.link}>{tr('Select up to 4 probability curves')}</summary>{legend(event.markets.filter(m=>!m.closed&&!chartIds.includes(m.id)))}</details>}
    <div className={s.chips}>{HISTORY_PERIODS.map(p=><button key={p} className={s.chip} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{tr(({'1h':'1 hour','1d':'1 day','1w':'1 week','1m':'1 month','max':'All'} as const)[p])}</button>)}</div>
    <EventHistoryChart id={id} period={period} selected={curves} initial={event.curves} label={c=>event.markets.find(m=>m.id===c.id)?label(event.markets.find(m=>m.id===c.id)!):content(c.label)} retryLabel={tr('Retry')}/>
    <p className={s.foot}>Polymarket · {tr('Select up to 4 probability curves')}</p>
    <p className={s.foot}>{tr('Volume')} · ${event.volume.toLocaleString(locale)} · {tr('Updated')} {new Date(event.fetchedAt).toLocaleTimeString(locale)}</p>
    <div className={availabilityUi.controls}><button type="button" role="switch" aria-checked={hideUnavailable} className={availabilityUi.toggle} onClick={()=>setHideUnavailable(!hideUnavailable)}>{predictionAvailabilityText(locale,'Hide unavailable')}<span className={availabilityUi.switch} aria-hidden="true"><i/></span></button></div>
    {event.markets.filter(m=>resolved||!m.closed).map(m=><EventMarketRow key={m.id} market={m} label={label(m)} hideUnavailable={hideUnavailable} selected={current?.id===m.id?side:null} onSelect={selectedSide=>{setSelected(m.id);setSide(selectedSide);setTicketOpen(true)}}/>)}
    {event.markets.some(m=>m.closed)&&<button className={s.link} onClick={()=>setResolved(v=>!v)}>{tr('Resolved options')} {resolved?'−':'+'}</button>}
  </section>
  if(!current)return <MaisonPage page="prediction" dock topbar={topbar}>{header}</MaisonPage>
  return <PredictionMarketScreen key={id} id={current.id} eventHeader={header} eventId={id} initialOutcome={side} ticketOpen={ticketOpen} onTicketClose={()=>setTicketOpen(false)} ticketLabel={label(current)} ticketImage={current.image} ticketEventTitle={content(event.title)}/>
}

function EventMarketRow({market,label,hideUnavailable,selected,onSelect}:{market:Event['markets'][number];label:string;hideUnavailable:boolean;selected:number|null;onSelect:(side:number)=>void}) {
  const {locale}=useI18n()
  const {ref,seen}=usePredictionRowVisibility()
  const quote=usePredictionDirections(market,seen)
  const tr=(key:string)=>predictionInterfaceText(locale,key)
  const hidden=hideUnavailable&&hideUnavailablePrediction(quote.directions)
  const status=(direction:PredictionDirectionAvailability)=>predictionAvailabilityText(locale,direction.reason==='empty_book'?'No sell orders':direction.reason==='thin_book'?'Small capacity':direction.reason==='closed'?'Closed':direction.reason==='paused'?'Paused':'Price unavailable')
  const retry=quote.failed||quote.directions.some(direction=>direction.reason==='expired')
  return <section ref={ref} className={`${ui.row} ${availabilityUi.row}`} hidden={hidden} data-market-id={market.id}>
    <div className={ui.rowHead}><span className={ui.rowIdentity}><Logo src={market.image} name={label}/><b>{label}</b></span><b className={`${s.num} ${ui.rowProbability}`}>{formatProbability(market.prices[0],locale)}</b></div>
    <p className={s.foot}>{tr('Volume')} · ${market.volume.toLocaleString(locale)}</p>
    <div className={s.outcome}>{[0,1].map(side=>{const probability=market.prices[side],direction=quote.directions[side],unavailable=direction.state==='unavailable';return <button key={side} type="button" data-side={side?'no':'yes'} className={unavailable?availabilityUi.unavailable:undefined} disabled={unavailable} title={unavailable?status(direction):undefined} aria-label={`${side?tr('Buy No'):tr('Buy Yes')} · ${label}${unavailable?` · ${status(direction)}`:''}`} aria-pressed={selected===side} onClick={()=>onSelect(side)}>{side?tr('Buy No'):tr('Buy Yes')} · {Number.isFinite(probability)?`≈ ${(probability*100).toFixed(1)}¢`:'—'}</button>})}</div>
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
