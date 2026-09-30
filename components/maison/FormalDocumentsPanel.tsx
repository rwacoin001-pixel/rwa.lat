'use client'
import { useEffect, useState } from 'react'
import { request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { formalDocsCopy } from '@/lib/maison-formal-docs-copy'
import { AlertTriangle, Download, FileCheck2, FileText, Info, RefreshCw, ScrollText } from 'lucide-react'
import { maison as s, Skeleton, StateBlock } from './primitives'
import f from './formal-docs.module.css'
type Issued={id:string;kind:string;title:string;documentNo:string;state:string;scanStatus:string|null;createdAt:string;errorCode?:string}
type Agreement={company:{companyName:string;registration:string};companyRevision:number;template:{title:string;introduction:string;terms:string[]};templateRevision:number}
const root='/v1/documents'
export function FormalDocumentsPanel(){
  const {locale}=useI18n(),c=formalDocsCopy[locale]
  const query=useQuery('documents:formal',()=>request<Issued[]>(root),{staleTime:5000})
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[agreement,setAgreement]=useState<Agreement|null>(null),[accepted,setAccepted]=useState(false)
  const [month,setMonth]=useState(()=>{const date=new Date();date.setUTCMonth(date.getUTCMonth()-1,1);return date.toISOString().slice(0,7)})
  useEffect(()=>{if(!query.data?.some(row=>row.state==='queued'||row.state==='rendering'||row.state==='ready'&&row.scanStatus==='pending'))return;const timer=setInterval(query.refetch,5000);return()=>clearInterval(timer)},[query.data,query.refetch])
  async function action(path:string,body?:unknown){
    if(busy)return
    setBusy(true);setError('');setNotice('')
    const result=await request<{url?:string}>(root+path,{method:'POST',body:JSON.stringify(body??{})})
    setBusy(false)
    if(!result.ok){setError(result.error.message);return}
    if(result.data.url)window.location.assign(result.data.url)
    else{query.refetch();setNotice(c.requestNotice)}
    if(path==='/agreement/consent'){setAgreement(null);setAccepted(false)}
  }
  async function readAgreement(){if(busy)return;setBusy(true);setError('');setAccepted(false);const result=await request<Agreement>(root+'/agreement');setBusy(false);if(result.ok)setAgreement(result.data);else setError(result.error.message)}
  const state=(row:Issued)=>row.state==='failed'?c.states.failed:row.state!=='ready'?c.states.generating:row.scanStatus==='clean'?c.states.ready:row.scanStatus==='pending'?c.states.awaitingScan:c.states.blocked
  const busyLabel=c.busy
  return <section aria-label={c.section} aria-busy={busy}>
    <p className={f.intro}>{c.intro}</p>
    <div className={s.actionsRow} style={{ marginTop: 0 }}>
      <button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>void action('/trade-confirmations')}><FileCheck2 size={14} aria-hidden="true"/>{c.actions.syncTrades}</button>
      <button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>void readAgreement()}><ScrollText size={14} aria-hidden="true"/>{c.actions.readAgreement}</button>
      <button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={query.refetch}><RefreshCw size={14} aria-hidden="true"/>{c.actions.refresh}</button>
    </div>
    {error&&<p className={s.notice} data-tone="error" role="alert"><AlertTriangle size={15} aria-hidden="true"/><span>{error}</span></p>}
    {notice&&<p className={s.notice} data-tone="info" role="status"><Info size={15} aria-hidden="true"/><span>{notice}</span></p>}
    <form className={f.request} onSubmit={e=>{e.preventDefault();if(month)void action('/statements',{month})}}>
      <label>{c.month.label}<input aria-label={c.month.aria} type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
      <div className={f.requestFoot}><small>PDF · UTC</small><button type="submit" className={s.ghost} data-size="s" disabled={busy||!month}>{busy?busyLabel:c.month.generate}</button></div>
    </form>
    {agreement&&<div className={f.agreement}>
      <h3>{agreement.template.title}<small>v{agreement.templateRevision}</small></h3>
      <p className={f.entity}>{agreement.company.companyName} · {agreement.company.registration} · {c.agreement.companyVersion} {agreement.companyRevision}</p>
      <p>{agreement.template.introduction}</p>
      <ol className={f.terms}>{agreement.template.terms.map((term,index)=><li key={index}>{term}</li>)}</ol>
      <label className={s.consent}><input type="checkbox" disabled={busy} checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>{c.agreement.consent}</label>
      <div className={s.actionsRow}>
        <button type="button" className={s.cta} style={{ width: 'auto', justifyContent: 'center', padding: '0 20px' }} disabled={!accepted||busy} onClick={()=>void action('/agreement/consent',{accepted:true,templateRevision:agreement.templateRevision,companyRevision:agreement.companyRevision})}><span>{c.agreement.confirm}</span></button>
        <button type="button" className={s.ghost} disabled={busy} onClick={()=>{setAgreement(null);setAccepted(false)}}>{c.agreement.close}</button>
      </div>
    </div>}
    <div className={f.files}>
      {query.error&&!query.data?<StateBlock tone="error" title={c.error.title} body={query.error.message} retry={query.refetch} retryLabel={c.error.retry}/>
        :query.loading&&!query.data?<Skeleton rows={2}/>
        :query.data?.length===0?<StateBlock title={c.empty.title} body={c.empty.body}/>
        :<ul className={s.list}>{query.data?.map(row=><li key={row.id}><div className={`${s.row} ${f.fileRow}`} data-static="true">
          <span className={s.logo} aria-hidden="true"><FileText size={15}/></span>
          <span className={f.rowText}><b dir="auto">{row.title}</b><small><span className={f.no}>{row.documentNo}</span> · {new Date(row.createdAt).toLocaleString(locale)}</small></span>
          <span className={f.fileEnd}><span className={s.badge} data-tone={row.state==='failed'||row.state==='ready'&&row.scanStatus!=='clean'&&row.scanStatus!=='pending'?'down':row.state==='ready'&&row.scanStatus==='clean'?'live':'warn'}>{state(row)}</span>
            {row.state==='ready'&&row.scanStatus==='clean'&&<button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>void action(`/${row.id}/download`)}><Download size={13} aria-hidden="true"/>{c.download}</button>}
            {row.state==='failed'&&<button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>void action(`/${row.id}/retry`)}><RefreshCw size={13} aria-hidden="true"/>{c.retryGeneration}</button>}
          </span>
        </div></li>)}</ul>}
    </div>
  </section>
}
