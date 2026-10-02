'use client'
import {useEffect,useRef,useState} from 'react'
import {useQuery} from '@/lib/api/_query'
import type {ApiResult} from '@/lib/api/_http'
import type {PolymarketFeedMarket} from '@/lib/api/polymarket-feed'
import {useI18n} from '@/lib/i18n'
import {Figure} from './motion'
import {maison as s} from './primitives'
type Trade={id:string;side:number;amount:number;timestamp:number}
async function readTrades(id:string):Promise<ApiResult<{items:Trade[]}>> {
  try {const response=await fetch(`/api/polymarket/trades/${id}`);if(!response.ok)throw new Error();return {ok:true,data:await response.json()}}catch{return {ok:false,error:{status:502,code:'TRADES_UNAVAILABLE',message:'Trades unavailable'}}}
}
export function PredictionPulse({item,content}:{item:PolymarketFeedMarket;content:(text:string)=>string}) {
  const {locale}=useI18n(),ref=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false)
  useEffect(()=>{if(!ref.current)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(ref.current);return()=>observer.disconnect()},[])
  const query=useQuery(visible&&item.conditionId?`prediction:trades:${item.conditionId}`:null,()=>readTrades(item.conditionId!),{pollInterval:8000,staleTime:8000,loading:'silent'})
  const p=item.outcomes[0]?.impliedProbability??0
  const latest=query.data?.items[0]
  const live=latest&&Date.now()/1000-latest.timestamp<60
  return <span ref={ref} className={s.predPulse}>
    <span className={s.predGauge} aria-label={`${content(item.outcomes[0]?.label??'Up')} ${(p*100).toFixed(0)}%`}>
      <svg viewBox="0 0 100 60" aria-hidden="true"><path d="M8 52 A42 42 0 0 1 92 52" pathLength="100" fill="none" stroke="var(--m-line)" strokeWidth="7" strokeLinecap="round"/><path d="M8 52 A42 42 0 0 1 92 52" pathLength="100" fill="none" stroke="var(--m-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${p*100} 100`}/></svg>
      <b><Figure value={p} format={{style:'percent',maximumFractionDigits:0}} locale={locale}/></b><small>{content(item.outcomes[0]?.label??'Up')}</small>
    </span>
    <span className={s.predTradeColumns} aria-hidden="true">{[0,1].map(side=><span key={side} data-side={side}>{query.data?.items.filter(t=>t.side===side).slice(0,3).map((t,index)=><i key={t.id} style={{animationDelay:`${index*.5}s`}}>+{t.amount.toLocaleString(locale,{style:'currency',currency:'USD',maximumFractionDigits:2})}</i>)}</span>)}</span>
    <span className={s.predBinaryOutcomes}>{item.outcomes.slice(0,2).map((outcome,index)=><span key={outcome.label} className={s.predBinaryOutcome} data-side={index}><b>{content(outcome.label)}</b></span>)}</span>
    {latest&&<span className={s.predPulseTime}>{live&&<i/>}Polymarket · {new Date(latest.timestamp*1000).toLocaleTimeString(locale)}</span>}
  </span>
}
