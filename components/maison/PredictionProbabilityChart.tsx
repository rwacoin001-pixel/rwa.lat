'use client'
import {useState} from 'react'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {maison as s} from './primitives'
import {probabilityHistoryState} from '@/lib/polymarket-data'
export type ProbabilityCurve={id:string;label:string;available:boolean;points:Array<{time:number;price:number}>}
const COLORS=['#b58b43','#518d83','#a2719a','#6c85b0']
export function PredictionProbabilityChart({curves,onRetry}:{curves:ProbabilityCurve[];onRetry?:()=>void}) {
  const {locale}=useI18n(), [hover,setHover]=useState<number|null>(null)
  const points=curves.flatMap(c=>c.points), min=Math.min(...points.map(p=>p.time)), max=Math.max(...points.map(p=>p.time))
  const state=probabilityHistoryState(curves)
  
  const tr=useContentTranslation(["Historical data unavailable", "Retry", "No available history for this period", "Some histories are unavailable", "Historical probability chart"])
  if(state==='unavailable')return <p className={s.fieldError} role="status">{tr('Historical data unavailable')} <button className={s.link} onClick={onRetry}>{tr('Retry')}</button></p>
  if(!points.length)return <p className={s.muted}>{tr('No available history for this period')}</p>
  const x=(time:number)=>40+(time-min)/Math.max(1,max-min)*640, y=(p:number)=>220-p*200
  return <div>
    {state==='partial'&&<p className={s.foot} role="status">{tr('Some histories are unavailable')} <button className={s.link} onClick={onRetry}>{tr('Retry')}</button></p>}
    <svg viewBox="0 0 720 265" role="img" aria-label={tr('Historical probability chart')} style={{width:'100%',height:'auto',touchAction:'pan-y'}} onPointerLeave={()=>setHover(null)} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();setHover(min+Math.max(0,Math.min(1,((e.clientX-r.left)/r.width*720-40)/640))*(max-min))}}>
      {[0,.25,.5,.75,1].map(p=><g key={p}><line x1="40" x2="680" y1={y(p)} y2={y(p)} stroke="currentColor" opacity=".12" strokeDasharray="3 4"/><text x="688" y={y(p)+4} fill="currentColor" fontSize="12">{p*100}%</text></g>)}
      {curves.map((c,i)=><path key={c.id} d={c.points.map((p,j)=>`${j?'L':'M'}${x(p.time).toFixed(2)},${y(p.price).toFixed(2)}`).join(' ')} fill="none" stroke={COLORS[i%4]} strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
      {hover!==null&&<line x1={x(hover)} x2={x(hover)} y1="20" y2="220" stroke="currentColor" opacity=".3"/>}
      <text x="40" y="252" fill="currentColor" fontSize="12">{new Date(min*1000).toLocaleDateString(locale)}</text><text x="680" y="252" fill="currentColor" fontSize="12" textAnchor="end">{new Date(max*1000).toLocaleDateString(locale)}</text>
    </svg>
    {hover!==null&&<p className={s.foot}>{new Date(hover*1000).toLocaleString(locale)}</p>}
    <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{curves.map((c,i)=>{const p=hover===null?c.points.at(-1):c.points.reduce<{time:number;price:number}|undefined>((a,p)=>!a||Math.abs(p.time-hover)<Math.abs(a.time-hover)?p:a,undefined);return <span key={c.id} className={s.foot} style={{color:COLORS[i%4]}}>● {c.label} {p?`${(p.price*100).toFixed(1)}%`:'—'}</span>})}</div>
  </div>
}
