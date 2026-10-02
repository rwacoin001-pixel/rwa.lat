'use client'
import {useRef,useState} from 'react'
import {useI18n} from '@/lib/i18n'
import {request} from '@/lib/api/_http'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import styles from './community-text.module.css'
type Translation={text:string;sourceLang:string}
const cache=new Map<string,Translation>()
const flights=new Map<string,Promise<Translation>>()
export function CommunityText({body,targetId,targetType='post',className,compact=false,onOpen}:{body:string;targetId:string;targetType?:'post'|'comment';className?:string;compact?:boolean;onOpen?:()=>void}){
  const {locale}=useI18n(),copy=communityExperienceCopy[locale]
  const targetLang=locale==='zh-CN'?'zh-Hans':locale
  const key=JSON.stringify([targetType,targetId,body,targetLang])
  const [shown,setShown]=useState<string|null>(null),[state,setState]=useState<{key:string;value?:Translation;busy?:boolean;failed?:boolean}|null>(null),[expanded,setExpanded]=useState(false)
  const current=useRef(key);current.current=key
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
  let language=value?.sourceLang??''
  try{language=new Intl.DisplayNames([locale],{type:'language'}).of(language)||language}catch{}
  return <div className={styles.root}>
    <p className={`${className??''} ${styles.body}`} onClick={onOpen} data-collapsed={compact&&!expanded} dir="auto">{text}</p>
    <div className={styles.controls} onClick={e=>e.stopPropagation()}>
      {compact&&(text.length>140||text.split('\n').length>4)&&<button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?copy.collapse:copy.expand}</button>}
      {translated&&<span>{copy.from.replace('{language}',language)}</span>}
      {body.trim()&&<button type="button" disabled={Boolean(busy)} onClick={()=>void translate()}>{busy?copy.translating:translated?copy.original:failed?copy.retry:copy.translate}</button>}
    </div>
  </div>
}
