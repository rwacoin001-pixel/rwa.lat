'use client'
import {useEffect,useRef,useState} from 'react'
import {useI18n} from '@/lib/i18n'
import {request} from '@/lib/api/_http'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import styles from './community-text.module.css'
type Translation={text:string;sourceLang:string}
const cache=new Map<string,Translation>()
const flights=new Map<string,Promise<Translation>>()
/** Already in the reader's language? Then "show translation" is noise (2026-10-28). Uses the stored language when there is one. */
function sameLanguage(body:string,lang:string|undefined,locale:string){
  const base=(value:string)=>value.toLowerCase().split('-')[0]
  if(lang)return base(lang)===base(locale)
  const letters=body.replace(/[\s\d\p{P}\p{S}]/gu,'')
  if(!letters)return true
  const han=(letters.match(/\p{Script=Han}/gu)??[]).length,kana=(letters.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)??[]).length,latin=(letters.match(/\p{Script=Latin}/gu)??[]).length
  if(base(locale)==='zh')return han/letters.length>.5&&kana===0
  if(base(locale)==='en')return latin/letters.length>.95&&han===0&&kana===0
  return false
}
export function CommunityText({body,targetId,targetType='post',className,compact=false,onOpen,lang}:{body:string;targetId:string;targetType?:'post'|'comment';className?:string;compact?:boolean;onOpen?:()=>void;lang?:string}){
  const {locale}=useI18n(),copy=communityExperienceCopy[locale]
  const targetLang=locale==='zh-CN'?'zh-Hans':locale
  const key=JSON.stringify([targetType,targetId,body,targetLang])
  const [shown,setShown]=useState<string|null>(null),[state,setState]=useState<{key:string;value?:Translation;busy?:boolean;failed?:boolean}|null>(null)
  const current=useRef(key);current.current=key
  const identity=JSON.stringify([targetType,targetId,body]),bodyRef=useRef<HTMLParagraphElement>(null)
  const [expandedFor,setExpandedFor]=useState<string|null>(null),[measured,setMeasured]=useState<{key:string;overflow:boolean}|null>(null)
  const expanded=expandedFor===identity,collapsed=compact&&!expanded
  const value=(state?.key===key?state.value:undefined)??cache.get(key),translated=shown===key&&Boolean(value),busy=state?.key===key&&state.busy&&flights.has(key),failed=state?.key===key&&state.failed
  const text=translated?value!.text:body
  const translate=async()=>{
    if(translated){setShown(null);return}
    if(value){setShown(key);return}
    if(busy)return
    setState({key,busy:true})
    if(!flights.has(key))flights.set(key,request<Translation>('/v1/community/translate',{method:'POST',body:JSON.stringify({targetType,targetId,targetLang}),loading:'silent',timeoutMs:35000}).then(r=>{if(!r.ok)throw new Error(r.error.code);cache.set(key,r.data);if(cache.size>300)cache.delete(cache.keys().next().value!);return r.data}).finally(()=>flights.delete(key)))
    try{const result=await flights.get(key)!;if(current.current===key){setState({key,value:result});setShown(key)}}catch{if(current.current===key)setState({key,failed:true})}
  }
  useEffect(()=>{
    const el=bodyRef.current
    if(!collapsed||!el)return
    const measure=()=>{const overflow=el.scrollHeight>el.clientHeight+1;setMeasured(prev=>prev?.key===identity&&prev.overflow===overflow?prev:{key:identity,overflow})}
    measure()
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure),fonts=typeof document==='undefined'?undefined:document.fonts
    observer?.observe(el)
    fonts?.addEventListener?.('loadingdone',measure)
    return()=>{observer?.disconnect();fonts?.removeEventListener?.('loadingdone',measure)}
  },[collapsed,identity,text])
  const canExpand=compact&&(expanded||(measured?.key===identity&&measured.overflow))
  let language=value?.sourceLang??''
  try{language=new Intl.DisplayNames([locale],{type:'language'}).of(language)||language}catch{}
  return <div className={styles.root}>
    <div className={styles.text}>
      <p ref={bodyRef} className={`${className??''} ${styles.body}`} data-collapsed={collapsed} dir="auto">{text}</p>
      {onOpen&&<button type="button" className={styles.open} aria-label={copy.open} onClick={onOpen}/>}
    </div>
    <div className={styles.controls} onClick={e=>e.stopPropagation()}>
      {canExpand&&<button type="button" onClick={()=>setExpandedFor(expanded?null:identity)} aria-expanded={expanded}>{expanded?copy.collapse:copy.expand}</button>}
      {translated&&<span>{copy.from.replace('{language}',language)}</span>}
      {body.trim()&&(translated||!sameLanguage(body,lang,locale))&&<button type="button" disabled={Boolean(busy)} onClick={()=>void translate()}>{busy?copy.translating:translated?copy.original:failed?copy.retry:copy.translate}</button>}
    </div>
  </div>
}
