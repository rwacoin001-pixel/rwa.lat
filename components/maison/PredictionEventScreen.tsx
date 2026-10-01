'use client'
import {useState,type CSSProperties} from 'react'
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

type Event={id:string;title:string;image:string|null;volume:number;fetchedAt:string;endAt:string|null;markets:Array<{id:string;label:string;question:string;image:string|null;prices:number[];closed:boolean;volume:number}>;curves:ProbabilityCurve[]}
async function readEvent(id:string,period:HistoryPeriod,curves:string[]):Promise<ApiResult<Event>> {
  try {const r=await fetch(`/api/polymarket/event/${id}?period=${period}&markets=${curves.join(',')}`,{cache:'no-store'});if(!r.ok)throw new Error();return {ok:true,data:await r.json() as Event}}catch{return {ok:false,error:{status:502,code:'POLYMARKET_UNAVAILABLE',message:'Event data unavailable'}}}
}
export function PredictionEventScreen({id}:{id:string}) {
  const {locale}=useI18n()
  const [period,setPeriod]=usePageState<HistoryPeriod>(`event:${id}:period`,'max'), [curves,setCurves]=usePageState<string[]>(`event:${id}:curves`,[]), [selected,setSelected]=usePageState<string|null>(`event:${id}:selected`,null),[side,setSide]=useState(0),[resolved,setResolved]=usePageState(`event:${id}:resolved`,false),[ticketOpen,setTicketOpen]=useState(false)
  const query=useQuery(`prediction:event:${id}:${period}:${curves.join(',')}`,()=>readEvent(id,period,curves),{staleTime:30000,pollInterval:30000})
  const event=query.data
  const content=useContentTranslation(event?[event.title,...event.markets.flatMap(m=>[m.label,m.question])]:[])
  const tr=useContentTranslation(["Predictions", "Closes", "All", "Select up to 4 probability curves", "Volume", "Buy No", "Buy Yes", "Resolved options", "Retry", "Updated", "1 hour", "1 day", "1 week", "1 month"])
  const topbar=<RwaTopbar screen="prediction-detail" title={tr('Predictions')} onBack={()=>backOr('/markets?tab=predictions')}/>
  if(!event)return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}>{query.error?<StateBlock title={query.error.message} retry={query.refetch} retryLabel={tr('Retry')}/>:<Skeleton rows={5}/>}</div></MaisonPage>
  const current=event.markets.find(m=>m.id===selected)??event.markets.find(m=>!m.closed)??event.markets[0]
  const chartIds=curves.length?curves:event.curves.map(c=>c.id)
  const toggle=(id:string)=>setCurves(chartIds.includes(id)?chartIds.length>1?chartIds.filter(x=>x!==id):chartIds:[...chartIds.slice(-3),id])
  const label=(m:Event['markets'][number])=>content(event.markets.filter(other=>other.label===m.label).length>1?m.question:m.label)
  const legend=(markets:Event['markets'])=><div className={ui.legend}>{markets.map(m=>{const index=chartIds.indexOf(m.id);return <button key={m.id} type="button" className={ui.legendButton} style={{'--curve':index>=0?PROBABILITY_COLORS[index%4]:'var(--m-faint)'} as CSSProperties} aria-pressed={index>=0} onClick={()=>toggle(m.id)}><i className={ui.dot}/><span className={ui.legendAvatar}><Logo src={m.image} name={label(m)}/></span><span className={ui.legendName}>{label(m)}</span><b className={ui.legendValue}>{formatProbability(m.prices[0],locale)}</b></button>})}</div>
  const header=<section style={{marginBottom:28}}>
<div className={ui.eventTitle}><Logo src={event.image} name={content(event.title)}/><h1 className={s.titleL}>{content(event.title)}</h1><PredictionHowTo/></div>
    {event.endAt&&<p className={s.foot}>{tr('Closes')} · {new Date(event.endAt).toLocaleDateString(locale)}</p>}
    {legend(event.markets.filter(m=>chartIds.includes(m.id)))}
    {event.markets.filter(m=>!m.closed).length>4&&<details><summary className={s.link}>{tr('Select up to 4 probability curves')}</summary>{legend(event.markets.filter(m=>!m.closed&&!chartIds.includes(m.id)))}</details>}
    <div className={s.chips}>{HISTORY_PERIODS.map(p=><button key={p} className={s.chip} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{tr(({'1h':'1 hour','1d':'1 day','1w':'1 week','1m':'1 month','max':'All'} as const)[p])}</button>)}</div>
    <PredictionProbabilityChart curves={event.curves.map(c=>({...c,label:event.markets.find(m=>m.id===c.id)?label(event.markets.find(m=>m.id===c.id)!):content(c.label)}))} onRetry={query.refetch}/>
    <p className={s.foot}>Polymarket · {tr('Select up to 4 probability curves')}</p>
    <p className={s.foot}>{tr('Volume')} · ${event.volume.toLocaleString(locale)} · {tr('Updated')} {new Date(event.fetchedAt).toLocaleTimeString(locale)}</p>
    {event.markets.filter(m=>resolved||!m.closed).map(m=><section key={m.id} className={ui.row}>
      <div className={ui.rowHead}><span className={ui.rowIdentity}><Logo src={m.image} name={label(m)}/><b>{label(m)}</b></span><b className={`${s.num} ${ui.rowProbability}`}>{formatProbability(m.prices[0],locale)}</b></div>
      <p className={s.foot}>{tr('Volume')} · ${m.volume.toLocaleString(locale)}</p>
      <div className={s.outcome}>{m.prices.slice(0,2).map((p,i)=><button key={i} type="button" data-side={i?'no':'yes'} disabled={m.closed} aria-pressed={current?.id===m.id&&side===i} onClick={()=>{setSelected(m.id);setSide(i);setTicketOpen(true)}}>{i?(tr('Buy No')):(tr('Buy Yes'))} · {Number.isFinite(p)?`≈ ${(p*100).toFixed(1)}¢`:'—'}</button>)}</div>
    </section>)}
    {event.markets.some(m=>m.closed)&&<button className={s.link} onClick={()=>setResolved(v=>!v)}>{tr('Resolved options')} {resolved?'−':'+'}</button>}
  </section>
  if(!current)return <MaisonPage page="prediction" dock topbar={topbar}>{header}</MaisonPage>
  return <PredictionMarketScreen key={id} id={current.id} eventHeader={header} eventId={id} initialOutcome={side} ticketOpen={ticketOpen} onTicketClose={()=>setTicketOpen(false)} ticketLabel={label(current)} ticketImage={current.image} ticketEventTitle={content(event.title)}/>
}
