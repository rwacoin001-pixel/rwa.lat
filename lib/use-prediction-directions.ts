'use client'
import {useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {useQuery} from './api/_query'
import type {ApiResult} from './api/_http'
import type {PredictionBook} from './prediction-quote'
import {evaluatePredictionDirections,type PredictionAvailabilityMarket} from './prediction-availability'

type CachedBook={book:PredictionBook|null;receivedAt:number}
const books=new Map<string,CachedBook>()
const pending=new Map<string,{promise:Promise<PredictionBook|null>;resolve:(book:PredictionBook|null)=>void}>()
let scheduled:ReturnType<typeof setTimeout>|undefined
let activeBatches=0
const queued=new Set<string>()
const startBatches=()=>{
  scheduled=undefined
  while(queued.size&&activeBatches<2){
    const tokens=Array.from(queued).slice(0,8)
    tokens.forEach(token=>queued.delete(token))
    activeBatches++
    void (async()=>{
      let values:Record<string,PredictionBook|null>={}
      try {
        const response=await fetch(`/api/polymarket/books?tokens=${tokens.join(',')}`,{cache:'no-store',signal:AbortSignal.timeout(15000)})
        if(response.ok)values=((await response.json()) as {books:Record<string,PredictionBook|null>}).books??{}
      }catch{/* Retain rows when public quotes fail. */}
      finally {
        for(const token of tokens){const book=values[token]??null;books.set(token,{book,receivedAt:Date.now()});pending.get(token)?.resolve(book);pending.delete(token)}
        activeBatches--
        startBatches()
      }
    })()
  }
}
function readTokenBook(token:string):Promise<PredictionBook|null> {
  if(!/^\d{1,90}$/.test(token))return Promise.resolve(null)
  const cached=books.get(token)
  if(cached&&Date.now()-cached.receivedAt<(cached.book?20000:3000))return Promise.resolve(cached.book)
  const existing=pending.get(token)
  if(existing)return existing.promise
  let resolve!:(book:PredictionBook|null)=>void
  const promise=new Promise<PredictionBook|null>(done=>{resolve=done})
  pending.set(token,{promise,resolve});queued.add(token)
  if(!scheduled)scheduled=setTimeout(startBatches,0)
  return promise
}
async function readDirectionBooks(tokens:readonly string[]):Promise<ApiResult<Array<PredictionBook|null>>> {
  return {ok:true,data:await Promise.all([0,1].map(side=>tokens[side]?readTokenBook(tokens[side]):Promise.resolve(null)))}
}
export function usePredictionDirections(market:PredictionAvailabilityMarket,enabled=true) {
  const tokens=market.tokenIds??[]
  const key=enabled&&!market.closed&&market.acceptingOrders!==false&&tokens.length>=2?`prediction:availability:${tokens.slice(0,2).join(':')}`:null
  const query=useQuery(key,()=>readDirectionBooks(tokens),{staleTime:30000,pollInterval:45000,loading:'silent'})
  const [now,setNow]=useState(()=>Date.now())
  useEffect(()=>{if(!key)return;const timer=setInterval(()=>setNow(Date.now()),10000);return ()=>clearInterval(timer)},[key])
  const directions=evaluatePredictionDirections(market,query.data??[],Math.max(now,Date.now()))
  return {directions,loading:query.loading,failed:Boolean(query.error||query.data?.some(book=>!book)),refresh:query.refetch}
}
/** The first quote fetch occurs near the viewport; previously seen rows continue modest polling. */
export function usePredictionRowVisibility() {
  const ref=useRef<HTMLElement|null>(null)
  const [seen,setSeen]=useState(false)
  useEffect(()=>{
    if(seen)return
    const element=ref.current
    if(!element)return
    if(typeof IntersectionObserver==='undefined'){setSeen(true);return}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setSeen(true);observer.disconnect()}},{rootMargin:'200px'})
    observer.observe(element)
    return ()=>observer.disconnect()
  },[seen])
  return {ref,seen}
}
const HIDE_KEY='rwa.prediction.hide-unavailable'
const HIDE_EVENT='rwa:prediction-availability-filter'
let hideFallback=false
export function useHideUnavailablePrediction() {
  const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener(HIDE_EVENT,notify);return ()=>{window.removeEventListener('storage',notify);window.removeEventListener(HIDE_EVENT,notify)}}
  const snapshot=()=>{try{return window.localStorage.getItem(HIDE_KEY)==='1'}catch{return hideFallback}}
  const hidden=useSyncExternalStore(subscribe,snapshot,()=>false)
  const setHidden=(value:boolean)=>{hideFallback=value;try{window.localStorage.setItem(HIDE_KEY,value?'1':'0')}catch{/* Optional display preference only. */}window.dispatchEvent(new Event(HIDE_EVENT))}
  return [hidden,setHidden] as const
}
