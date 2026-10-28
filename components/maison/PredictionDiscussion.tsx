'use client'
import {useEffect,useRef,useState} from 'react'
import {polymarketTranslationCopy} from '@/lib/polymarket-translation-copy'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {request} from '@/lib/api/_http'
import {idempotencyKeyForIntent} from '@/lib/api/idempotency'
import {signInThenReturn,useSignedIn} from '@/lib/maison-nav'
import {Skeleton,maison as s} from './primitives'
type Comment={id:string;body:string;createdAt:string;parentId:string|null;likeCount:number;author:{displayName:string}|null}
type Page={items:Comment[];nextOffset?:number|null;nextBefore?:string|null}
export function PredictionDiscussion({eventId}:{eventId:string}) {
  const {locale,t}=useI18n(), zh=locale.startsWith('zh'),signedIn=useSignedIn()
  const [source,setSource]=useState<'polymarket'|'rwa'>('polymarket'),[items,setItems]=useState<Comment[]>([]),[cursor,setCursor]=useState<string|null>(null),[next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0),[body,setBody]=useState(''),[parent,setParent]=useState<Comment|null>(null),[pending,setPending]=useState(false),[liked,setLiked]=useState(new Set<string>())
  const keys=useRef(new Map<string,string>())
  const content=useContentTranslation(items.map(c=>c.body),true)
  const [original,setOriginal]=useState(false)
  const tr=useContentTranslation(["Polymarket discussion unavailable", "Report submitted", "Discussion", "Read only", "Reply to", "Your comment", "Share your perspective…", "Post comment", "Sign in to join the discussion", "Member", "Reply", "Report", "Retry", "No discussions yet", "Load more"])
  useEffect(()=>{let active=true;setLoading(true);setError(null)
    const read=async()=>{
      if(source==='rwa')return request<Page>(`/v1/predictions/events/${eventId}/comments?limit=20${cursor?`&before=${encodeURIComponent(cursor)}`:''}`)
      try{const r=await fetch(`/api/polymarket/discussion/${eventId}?offset=${cursor??0}`);if(!r.ok)throw new Error();return {ok:true as const,data:await r.json() as Page}}catch{return {ok:false as const,error:{message:tr('Polymarket discussion unavailable')}}}
    }
    void read().then(async r=>{if(!active)return;if(!r.ok){setError(r.error.message);return}setItems(old=>cursor?(source==='rwa'?[...r.data.items.filter(c=>!old.some(x=>x.id===c.id)),...old]:[...old,...r.data.items.filter(c=>!old.some(x=>x.id===c.id))]):r.data.items);setNext(source==='rwa'?r.data.nextBefore??null:r.data.nextOffset==null?null:String(r.data.nextOffset))
      if(source==='rwa'&&signedIn&&r.data.items.length){const likes=await request<{likedIds:string[]}>(`/v1/community/me/comments/likes?ids=${r.data.items.map(c=>c.id).join(',')}`);if(active&&likes.ok)setLiked(old=>new Set([...old,...likes.data.likedIds]))}
    }).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[eventId,source,cursor,refresh,zh,signedIn])
  const change=(v:'polymarket'|'rwa')=>{setSource(v);setItems([]);setCursor(null);setNext(null);setError(null)}
  const submit=async()=>{if(pending||!body.trim())return;setPending(true);setError(null)
    const input={body:body.trim(),lang:locale,...(parent?{parentId:parent.id}:{})},path=`/v1/predictions/events/${eventId}/comments`
    const result=await request<{id:string}>(path,{method:'POST',body:JSON.stringify(input),idempotencyKey:idempotencyKeyForIntent(keys.current,'POST',path,input)})
    setPending(false);if(!result.ok){setError(result.error.message);return}keys.current.clear();setBody('');setParent(null);setCursor(null);setRefresh(v=>v+1)
  }
  const like=async(c:Comment)=>{const desired=!liked.has(c.id),r=await request<{likeCount:number}>(`/v1/community/me/comments/${c.id}/like`,{method:desired?'PUT':'DELETE'});if(!r.ok){setError(r.error.message);return}setLiked(old=>{const n=new Set(old);if(desired)n.add(c.id);else n.delete(c.id);return n});setItems(old=>old.map(x=>x.id===c.id?{...x,likeCount:r.data.likeCount}:x))}
  const report=async(c:Comment)=>{const r=await request('/v1/community/reports',{method:'POST',body:JSON.stringify({targetType:'comment',targetId:c.id,reason:'Prediction discussion content report'})});setError(r.ok?(tr('Report submitted')):r.error.message)}
  return <section id="prediction-discussion" style={{marginTop:32}}>
    <div className={s.chips} role="group" aria-label={tr('Discussion')} style={{position:'sticky',top:0,zIndex:2,backdropFilter:'blur(18px)'}}>
      <button className={s.chip} aria-pressed={source==='polymarket'} onClick={()=>change('polymarket')}>Polymarket · {tr('Read only')}</button><button className={s.chip} aria-pressed={source==='rwa'} onClick={()=>change('rwa')}>A-REIT · {t('community.comments')}</button>
    </div>
    {source==='rwa'&&(signedIn?<div style={{padding:'12px 0'}}>
      {parent&&<p className={s.foot}>{tr('Reply to')} {parent.author?.displayName}<button className={s.link} onClick={()=>setParent(null)}> × </button></p>}
      <textarea maxLength={2000} rows={3} value={body} onChange={e=>setBody(e.target.value)} aria-label={tr('Your comment')} placeholder={tr('Share your perspective…')} style={{width:'100%',padding:12,borderRadius:12,border:'1px solid #9b8f7b55',background:'transparent',color:'inherit'}}/>
      <button className={s.ghost} disabled={pending||!body.trim()} onClick={submit}>{pending?'…':tr('Post comment')}</button>
    </div>:<button className={s.ghost} onClick={()=>signInThenReturn()}>{tr('Sign in to join the discussion')}</button>)}
    <button className={s.link} onClick={()=>setOriginal(v=>!v)}>{original?polymarketTranslationCopy[locale].hideOriginal:polymarketTranslationCopy[locale].original}</button>
    {items.map(c=><article key={c.id} style={{padding:'20px 0',borderBottom:'1px solid #9b8f7b33'}}>
      <div className={s.foot}><b>{c.author?.displayName??(tr('Member'))}</b> · {c.createdAt?new Date(c.createdAt).toLocaleString(locale):''}</div>
      {c.parentId&&<small className={s.muted}>{tr('Reply')}</small>}
      <p className={s.prose} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{original?c.body:content(c.body)}</p>
      {source==='rwa'?<div style={{display:'flex',gap:20}}><button className={s.link} disabled={!signedIn} aria-pressed={liked.has(c.id)} onClick={()=>void like(c)}>♡ {c.likeCount}</button><button className={s.link} disabled={!signedIn} onClick={()=>setParent(c)}>{tr('Reply')}</button><button className={s.link} onClick={()=>void report(c)}>{tr('Report')}</button></div>:<p className={s.foot}>♡ {c.likeCount}</p>}
    </article>)}
    {loading&&<Skeleton rows={2}/>}
    {error&&<p className={s.fieldError} role="status">{error} <button className={s.link} onClick={()=>setRefresh(v=>v+1)}>{tr('Retry')}</button></p>}
    {!loading&&!error&&!items.length&&<p className={s.muted}>{tr('No discussions yet')}</p>}
    {next&&!loading&&<button className={s.ghost} onClick={()=>setCursor(next)}>{tr('Load more')}</button>}
  </section>
}
