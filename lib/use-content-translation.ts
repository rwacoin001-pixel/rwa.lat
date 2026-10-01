'use client'
import {useEffect,useState} from 'react'
import {useI18n} from './i18n'
import {request} from './api/_http'
const cache=new Map<string,string>()
export function useContentTranslation(texts:string[],translateEnglish=false) {
  const {locale}=useI18n(),[,render]=useState(0)
  const sources=JSON.stringify([...new Set(texts.filter(t=>t.trim()&&t.length<=4000))])
  useEffect(()=>{
    if(locale==='en'&&!translateEnglish)return
    let active=true
    const missing=(JSON.parse(sources) as string[]).filter(t=>!cache.has(`${locale}:${t}`))
    void(async()=>{for(let i=0;i<missing.length;i+=10){if(!active)return;const response=await request<{items:Array<{source:string;text:string}>}>('/v1/polymarket/translations/content',{method:'POST',body:JSON.stringify({locale,texts:missing.slice(i,i+10)}),timeoutMs:120000,loading:'silent'});if(response.ok){for(const item of response.data.items)cache.set(`${locale}:${item.source}`,item.text);if(active)render(n=>n+1)}}})()
    return()=>{active=false}
  },[locale,sources,translateEnglish])
  return (source:string)=>cache.get(`${locale}:${source}`)??source
}
