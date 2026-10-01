'use client'
import {useState} from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {useQuery} from '@/lib/api/_query'
import type {ApiResult} from '@/lib/api/_http'
import {backOr} from '@/lib/maison-nav'
import {HISTORY_PERIODS,type HistoryPeriod} from '@/lib/polymarket-data'
import {PredictionMarketScreen} from './PredictionScreen'
import {PredictionProbabilityChart,type ProbabilityCurve} from './PredictionProbabilityChart'
import {MaisonPage,Skeleton,StateBlock,maison as s} from './primitives'
type Event={id:string;title:string;endAt:string|null;markets:Array<{id:string;label:string;question:string;prices:number[];closed:boolean;volume:number}>;curves:ProbabilityCurve[]}
async function readEvent(id:string,period:HistoryPeriod,curves:string[]):Promise<ApiResult<Event>> {
  try {const r=await fetch(`/api/polymarket/event/${id}?period=${period}&markets=${curves.join(',')}`,{cache:'no-store'});if(!r.ok)throw new Error();return {ok:true,data:await r.json() as Event}}catch{return {ok:false,error:{status:502,code:'POLYMARKET_UNAVAILABLE',message:'Event data unavailable'}}}
}
export function PredictionEventScreen({id}:{id:string}) {
  const {locale}=useI18n(), zh=locale.startsWith('zh')
  const [period,setPeriod]=useState<HistoryPeriod>('max'), [curves,setCurves]=useState<string[]>([]), [selected,setSelected]=useState<string|null>(null),[side,setSide]=useState(0),[resolved,setResolved]=useState(false)
  const query=useQuery(`prediction:event:${id}:${period}:${curves.join(',')}`,()=>readEvent(id,period,curves),{staleTime:30000,pollInterval:30000})
  const event=query.data
  const content=useContentTranslation(event?[event.title,...event.markets.map(m=>m.label)]:[])
  const tr=useContentTranslation(["Predictions", "Closes", "All", "Select up to 4 probability curves", "Volume", "Buy No", "Buy Yes", "Resolved options", "Retry"])
  const topbar=<RwaTopbar screen="prediction-detail" title={tr('Predictions')} onBack={()=>backOr('/markets?tab=predictions')}/>
  if(!event)return <MaisonPage page="prediction" dock topbar={topbar}><div className={s.hero}>{query.error?<StateBlock title={query.error.message} retry={query.refetch} retryLabel={tr('Retry')}/>:<Skeleton rows={5}/>}</div></MaisonPage>
  const current=event.markets.find(m=>m.id===selected)??event.markets.find(m=>!m.closed)??event.markets[0]
  const chartIds=curves.length?curves:event.curves.map(c=>c.id)
  const toggle=(id:string)=>setCurves(chartIds.includes(id)?chartIds.length>1?chartIds.filter(x=>x!==id):chartIds:[...chartIds.slice(-3),id])
  const header=<section style={{marginBottom:28}}>
    <h1 className={s.titleL}>{content(event.title)}</h1>
    {event.endAt&&<p className={s.foot}>{tr('Closes')} · {new Date(event.endAt).toLocaleDateString(locale)}</p>}
    <div className={s.chips}>{HISTORY_PERIODS.map(p=><button key={p} className={s.chip} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{p==='max'?(tr('All')):p}</button>)}</div>
    <PredictionProbabilityChart curves={event.curves.map(c=>({...c,label:content(c.label)}))} onRetry={query.refetch}/>
    <p className={s.foot}>Polymarket · {tr('Select up to 4 probability curves')}</p>
    <div className={s.chips}>{event.markets.filter(m=>!m.closed).map(m=><button key={m.id} className={s.chip} aria-pressed={chartIds.includes(m.id)} onClick={()=>toggle(m.id)}>{content(m.label)}</button>)}</div>
    {event.markets.filter(m=>resolved||!m.closed).map(m=><section key={m.id} style={{padding:'18px 0',borderBottom:'1px solid var(--maison-line, #9b8f7b33)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12}}><b>{content(m.label)}</b><b className={s.num}>{Number.isFinite(m.prices[0])?`${(m.prices[0]*100).toFixed(1)}%`:'—'}</b></div>
      <p className={s.foot}>{tr('Volume')} · ${m.volume.toLocaleString(locale)}</p>
      <div className={s.outcome}>{m.prices.slice(0,2).map((p,i)=><button key={i} type="button" data-side={i?'no':'yes'} disabled={m.closed} aria-pressed={current?.id===m.id&&side===i} onClick={()=>{setSelected(m.id);setSide(i);requestAnimationFrame(()=>document.getElementById('prediction-ticket')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}))}}>{i?(tr('Buy No')):(tr('Buy Yes'))} · {Number.isFinite(p)?`${(p*100).toFixed(1)}¢`:'—'}</button>)}</div>
    </section>)}
    {event.markets.some(m=>m.closed)&&<button className={s.link} onClick={()=>setResolved(v=>!v)}>{tr('Resolved options')} {resolved?'−':'+'}</button>}
  </section>
  if(!current)return <MaisonPage page="prediction" dock topbar={topbar}>{header}</MaisonPage>
  return <PredictionMarketScreen key={id} id={current.id} eventHeader={header} eventId={id} initialOutcome={side}/>
}
