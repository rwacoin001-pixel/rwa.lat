'use client'
import { useRef, useState } from 'react'
import { request, type ApiError } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { openPath } from '@/lib/maison-nav'
import { shareCopy, type ShareCopy } from '@/lib/maison-trust-copy'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './maison/primitives'

const shareError = (error: ApiError, c: ShareCopy) => error.status === 0 ? c.network : error.status === 401 ? c.signIn : c.failed
// Only same-origin app paths; a shared record must never navigate off-site.
const safePath = (path: string) => /^\/(?![/\\])/.test(path) ? path : null

export function PublicShareButton({ kind, resourceId }: { kind: 'product'|'community_post'; resourceId: string }) {
  const {locale}=useI18n(),c=shareCopy[locale]
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[url,setUrl]=useState(''),[copied,setCopied]=useState(false)
  const [historyOpen,setHistoryOpen]=useState(false)
  const history=useQuery(historyOpen?`shares:owned:${kind}:${resourceId}`:null,()=>request<{id:string;createdAt:string;revokedAt:string|null}[]>(`/v1/shares/owned/links?kind=${kind}&resourceId=${encodeURIComponent(resourceId)}`),{staleTime:0})
  const shareId=useRef<string|null>(null)
  async function create() {
    if(busy)return
    setBusy(true);setError('');setCopied(false)
    const result=await request<{id:string;token:string}>('/v1/shares',{method:'POST',body:JSON.stringify({kind,resourceId})})
    setBusy(false)
    if(!result.ok){setError(shareError(result.error,c));return}
    shareId.current=result.data.id;setUrl(`${window.location.origin}/share/${result.data.token}`);history.refetch()
  }
  async function revoke(id=shareId.current){if(!id||busy)return;setBusy(true);setError('');const result=await request(`/v1/shares/${encodeURIComponent(id)}/revoke`,{method:'POST',body:'{}'});setBusy(false);if(result.ok){if(id===shareId.current){setUrl('');shareId.current=null;setCopied(false)}history.refetch()}else setError(shareError(result.error,c))}
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setCopied(false)}}
  return <div className="my-3 space-y-2">
    <button type="button" className={s.ctaSoft} disabled={busy||Boolean(url)} onClick={()=>void create()}>{c.create}</button>
    <button type="button" className={s.ctaSoft} disabled={busy} aria-expanded={historyOpen} onClick={()=>setHistoryOpen(open=>!open)}>{c.manage}</button>
    {error&&<p role="alert">{error}</p>}
    {url&&<><label className="block">{c.created}<input className="w-full rounded border bg-transparent p-2" dir="ltr" readOnly value={url} onFocus={e=>e.target.select()}/></label>
      <button type="button" className={s.ctaSoft} onClick={()=>void copy()}>{c.copy}</button>
      <p role="status" aria-live="polite">{copied?c.copied:''}</p>
      <button type="button" className={s.ctaSoft} disabled={busy} onClick={()=>void revoke()}>{c.revoke}</button></>}
    {historyOpen&&<div>{history.error&&<p role="alert">{shareError(history.error,c)} <button type="button" className={s.link} onClick={history.refetch}>{c.retry}</button></p>}{history.loading&&!history.data&&<p>{c.historyLoading}</p>}{history.data?.length===0&&<p>{c.historyEmpty}</p>}{history.data?.map(link=><p key={link.id}>{new Date(link.createdAt).toLocaleString(locale)} · {link.revokedAt?c.revoked:<button type="button" className={s.ctaSoft} disabled={busy} onClick={()=>void revoke(link.id)}>{c.revokeOne}</button>}</p>)}</div>}
  </div>
}

type SharedResource={kind:'product'|'community_post';title:string;summary:string;path:string}
export function PublicShareLanding({token}:{token:string|null}) {
  const {locale}=useI18n(),c=shareCopy[locale]
  const shared=useQuery(token?`shares:${token}`:null,()=>request<SharedResource>(`/v1/shares/${encodeURIComponent(token??'')}`),{staleTime:0})
  const status=shared.error?.status
  // 404/400/410 mean the token itself is dead: no retry. Network and server errors can be retried.
  const dead=!token||status===404||status===400||status===410
  const path=shared.data?safePath(shared.data.path):null
  return <MaisonPage page="share"><header className={s.hero}><p className={s.kicker}>a-reit.com</p><h1 className={s.titleL}>{c.title}</h1></header>
    {dead?<StateBlock tone="error" title={c.invalid} body={c.invalidBody}/>
    :shared.error?<StateBlock tone="error" title={c.unavailable} body={status===0?c.network:c.failed} retry={shared.refetch} retryLabel={c.retry}/>
    :!shared.data?<Skeleton rows={3}/>
    :<article className={s.list}><div className="p-4"><h2 dir="auto">{shared.data.title}</h2><p className="my-4 whitespace-pre-wrap" dir="auto">{shared.data.summary}</p><p>{c.privacy}</p>{path&&<button type="button" className={s.ctaSoft} onClick={()=>openPath(path)}>{c.open}</button>}</div></article>}
    <button type="button" className={s.ghost} onClick={()=>openPath('/home')}>{c.home}</button></MaisonPage>
}
