'use client'
import {useEffect,useState,useCallback} from 'react'
import {useI18n} from './i18n'
import {request} from './api/_http'
const cache=new Map<string,string>()
const pending=new Map<string,Promise<void>>()
const listeners=new Set<()=>void>()
let running=0
const queue:Array<()=>void>=[]
async function limited<T>(run:()=>Promise<T>):Promise<T> {
  if(running>=3)await new Promise<void>(resolve=>queue.push(resolve))
  running++
  try{return await run()}finally{running--;queue.shift()?.()}
}
async function translate(locale:string,texts:string[]) {
  const missing=texts.filter(t=>!cache.has(`${locale}:${t}`)&&!pending.has(`${locale}:${t}`))
  for(let i=0;i<missing.length;i+=10){
    const batch=missing.slice(i,i+10)
    const task=limited(()=>request<{items:Array<{source:string;text:string}>}>('/v1/polymarket/translations/content',{method:'POST',body:JSON.stringify({locale,texts:batch}),timeoutMs:30000,loading:'silent'})).then(response=>{
      if(response.ok)for(const item of response.data.items)if(item.text?.trim())cache.set(`${locale}:${item.source}`,item.text)
    }).catch(()=>{}).finally(()=>{for(const t of batch)pending.delete(`${locale}:${t}`);listeners.forEach(notify=>notify())})
    for(const t of batch)pending.set(`${locale}:${t}`,task)
  }
  await Promise.all(texts.map(t=>pending.get(`${locale}:${t}`)))
  return texts.every(t=>cache.has(`${locale}:${t}`))
}
export function useContentTranslation(texts:string[],translateEnglish=false) {
  const {locale}=useI18n(),[,render]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0)
  const sources=JSON.stringify([...new Set(texts.filter(t=>t.trim()&&t.length<=4000))])
  useEffect(()=>{const notify=()=>render(n=>n+1);listeners.add(notify);return()=>{listeners.delete(notify)}},[])
  useEffect(()=>{
    if(locale==='en'&&!translateEnglish){setLoading(false);setError(false);return}
    let active=true
    setLoading(true);setError(false)
    void translate(locale,JSON.parse(sources) as string[]).then(ok=>{if(active){setError(!ok);render(n=>n+1);setLoading(false)}})
    return()=>{active=false}
  },[locale,sources,translateEnglish,attempt])
  const retry=useCallback((selected?:string[])=>{
    if(!selected){setAttempt(n=>n+1);return}
    setLoading(true);setError(false)
    void translate(locale,selected.filter(t=>t.trim()&&t.length<=4000)).then(ok=>{setError(!ok);setLoading(false);render(n=>n+1)})
  },[locale])
  return Object.assign((source:string)=>cache.get(`${locale}:${source}`)??source,{retry,loading,error,hasTranslation:(source:string)=>cache.has(`${locale}:${source}`),isPending:(source:string)=>pending.has(`${locale}:${source}`)})
}
