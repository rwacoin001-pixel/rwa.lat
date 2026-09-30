'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { aiCustomer, type AccountScope, type Citation, type MandateContent, type MandateState, type Run } from '@/lib/api/ai-customer'
import { useI18n } from '@/lib/i18n'
import { SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import { containsWalletSecret } from '@/lib/ai-input-guard'
import styles from './page.module.css'
import AiQuestionCard from '@/components/maison/AiQuestionCard'
import type { AiQuestion } from '@/lib/api/ai-customer'

const amounts = ['cashBudgetAtomic','cashReserveAtomic','maxManagedValueAtomic','maxActionAtomic','maxDailyTurnoverAtomic','maxTotalTurnoverAtomic','maxFeeAtomic'] as const
const integers = ['maxProductWeightBps','maxUnrealizedLossBps','horizonDays','maxLockDays','maxFeeBps','scheduleIntervalMinutes','minTradeIntervalMinutes','rebalanceThresholdBps'] as const
const labels:Record<string,string>={cashBudgetAtomic:'管理现金',cashReserveAtomic:'账户现金保留',maxManagedValueAtomic:'管理总额上限',maxActionAtomic:'单次申请上限',maxDailyTurnoverAtomic:'每日申请上限',maxTotalTurnoverAtomic:'累计申请上限',maxFeeAtomic:'单次费用上限',maxProductWeightBps:'单产品比例上限（基点）',maxUnrealizedLossBps:'浮亏停止阈值（基点）',horizonDays:'投资期限（天）',maxLockDays:'最长锁定（天）',maxFeeBps:'费用比例上限（基点）',scheduleIntervalMinutes:'检查间隔（分钟）',minTradeIntervalMinutes:'交易最短间隔（分钟）',rebalanceThresholdBps:'调整偏离阈值（基点）'}
const english:Record<string,string>={cashBudgetAtomic:'Managed cash',cashReserveAtomic:'Cash reserve',maxManagedValueAtomic:'Managed value limit',maxActionAtomic:'Per-application limit',maxDailyTurnoverAtomic:'Daily turnover limit',maxTotalTurnoverAtomic:'Lifetime turnover limit',maxFeeAtomic:'Fee limit',maxProductWeightBps:'Product concentration (%)',maxUnrealizedLossBps:'Loss review threshold (%)',horizonDays:'Investment horizon (days)',maxLockDays:'Maximum lock (days)',maxFeeBps:'Fee rate limit (%)',scheduleIntervalMinutes:'Review interval (minutes)',minTradeIntervalMinutes:'Minimum trade interval (minutes)',rebalanceThresholdBps:'Rebalance threshold (%)'}
type Message={role:'user'|'assistant';text:string;citations?:Citation[];questions?:AiQuestion[]}
const fromAtomic=(value:string)=>{ const n=BigInt(value);return `${n/BigInt(1000000)}.${(n%BigInt(1000000)).toString().padStart(6,'0')}` }
const toAtomic=(value:string)=>{if(!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value))throw new Error('Enter a USDT amount with at most 6 decimals');const [a,b='']=value.split('.');return (BigInt(a)*BigInt(1000000)+BigInt(b.padEnd(6,'0'))).toString()}

export default function AiAssistantPage(){
  const [generation,setGeneration]=useState(0)
  useEffect(()=>{const reset=()=>setGeneration(n=>n+1);window.addEventListener(SESSION_CHANGED,reset);window.addEventListener(SESSION_EXPIRED,reset);return()=>{window.removeEventListener(SESSION_CHANGED,reset);window.removeEventListener(SESSION_EXPIRED,reset)}},[])
  return <AiAssistantContent key={generation}/>
}
function AiAssistantContent(){
  const {locale}=useI18n();const zh=locale==='zh-CN'
  const [tab,setTab]=useState<'chat'|'mandate'>('chat'),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[session,setSession]=useState<string>()
  const [scopes,setScopes]=useState<AccountScope[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[source,setSource]=useState<{title:string;body:string}|null>(null)
  const [mandate,setMandate]=useState<MandateState|null>(null),[runs,setRuns]=useState<Run[]>([]),[fields,setFields]=useState<Record<string,string>>({}),[actions,setActions]=useState({allowBuy:false,allowRedeem:false,reinvestProceeds:false}),[confirmed,setConfirmed]=useState(false)
  const [draft,setDraft]=useState<{id:string;content:{subject:string;body:string};expiresAt:string}|null>(null),[ticketConfirmed,setTicketConfirmed]=useState(false)
  const [choices,setChoices]=useState<{products:Array<{id:string;name:string}>;positions:Array<{id:string;productId:string;name:string;decimals:number;quantityAtomic:string}>}>({products:[],positions:[]})
  const [provider,setProvider]=useState<string>()
  const [access,setAccess]=useState<'loading'|'ready'|'login'|'error'>('loading')
  useEffect(()=>{let alive=true;void aiCustomer.status().then(r=>{if(alive&&r.ok)setProvider(r.data.provider)});return()=>{alive=false}},[])
  useEffect(()=>{let alive=true;const params=new URLSearchParams(window.location.search),id=params.get('knowledge'),revision=Number(params.get('revision'));if(id&&/^[0-9a-f-]{36}$/i.test(id)&&Number.isSafeInteger(revision)&&revision>0)void aiCustomer.source({id,revision,title:'',locale:'',sourceId:''}).then(r=>{if(!alive)return;if(r.ok)setSource(r.data);else setError(r.error.message)});return()=>{alive=false}},[])
  const copy=(cn:string,en:string)=>zh?cn:en
  async function load(){const [m,r,candidates]=await Promise.all([aiCustomer.mandate(),aiCustomer.runs(),aiCustomer.choices()]);if(candidates.ok)setChoices(candidates.data);if(m.ok){setAccess('ready');setMandate(m.data);const c=m.data.mandate?.content;if(c){const next:Record<string,string>={...Object.fromEntries(amounts.map(k=>[k,fromAtomic(c[k])])),...Object.fromEntries(integers.map(k=>[k,String(c[k])])),allowedProductIds:c.allowedProductIds.join('\n'),positions:JSON.stringify(c.positions),riskBand:c.riskBand,effectiveAt:c.effectiveAt,expiresAt:c.expiresAt,goals:c.goals};setFields(next);setActions({allowBuy:c.allowBuy,allowRedeem:c.allowRedeem,reinvestProceeds:c.reinvestProceeds})}}else{setAccess(m.error.status===401?'login':'error');if(m.error.status!==401)setError(m.error.message)}if(r.ok)setRuns(r.data)}
  useEffect(()=>{if(tab==='mandate')void load()},[tab])
  async function perform(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await work()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const change=(k:string,v:string)=>{setFields(f=>({...f,[k]:v}));setConfirmed(false)}
  const sendAnswer=async(question:string):Promise<boolean>=>{
    if(busy||!question.trim())return false
    setBusy(true);setError('')
    try{
      if(question.length>4000)throw new Error(copy('答案过长，请缩短后重试','Please shorten your answer'))
      if(containsWalletSecret(question))throw new Error(copy('请勿发送私钥或助记词','Do not send private keys or recovery phrases'))
      const reply=await aiCustomer.chat(question,zh?'zh-CN':locale,session,scopes)
      if(!reply.ok)throw new Error(reply.error.message)
      setMessages(m=>[...m,{role:'user',text:question},{role:'assistant',text:reply.data.reply,citations:reply.data.citations,questions:reply.data.questions}]);setSession(reply.data.sessionId)
      return true
    }catch(e){setError((e as Error).message);return false}finally{setBusy(false)}
  }
  const send=async()=>{if(await sendAnswer(text.trim()))setText('')}
  const save=()=>perform(async()=>{if(!confirmed || !mandate)return;const content:MandateContent={...Object.fromEntries(amounts.map(k=>[k,toAtomic(fields[k]??'')])),...Object.fromEntries(integers.map(k=>[k,Number(fields[k]||'NaN')])),allowedProductIds:(fields.allowedProductIds??'').split(/[\s,]+/).filter(Boolean),positions:JSON.parse(fields.positions||'[]'),riskBand:fields.riskBand,effectiveAt:new Date(fields.effectiveAt).toISOString(),expiresAt:new Date(fields.expiresAt).toISOString(),goals:fields.goals,locale:zh?'zh-CN':locale,notifications:['in_app'],...actions} as MandateContent;const r=await aiCustomer.saveMandate(content,mandate.mandate?.revision??0,mandate.termsVersion);if(!r.ok)throw new Error(r.error.message);setConfirmed(false);await load()})
  return <main className={styles.page}><header><Link href="/">RWA.LAT</Link><nav><button aria-pressed={tab==='chat'} onClick={()=>setTab('chat')}>{copy('客服','Support')}</button><button aria-pressed={tab==='mandate'} onClick={()=>setTab('mandate')}>{copy('投资授权','Investment mandate')}</button></nav></header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {tab==='chat'?<section className={styles.card}>
      <div className={styles.messages} aria-live="polite">{messages.map((m,i)=><article key={i} data-role={m.role}><p>{m.text}</p> {m.citations?.map(c=><button key={c.sourceId} onClick={()=>perform(async()=>{const r=await aiCustomer.source(c);if(!r.ok)throw new Error(r.error.message);setSource(r.data)})}>{c.title} · v{c.revision}</button>)}</article>)}{busy&&<span role="status">…</span>}</div>
      <fieldset disabled={busy||!provider}><legend>{copy('向模型服务商分享本人信息','Share my account information with the model provider')} · {provider??'…'}</legend>{(['balances','positions','orders','qualification'] as AccountScope[]).map(s=><label key={s}><input type="checkbox" checked={scopes.includes(s)} onChange={e=>setScopes(a=>e.target.checked?[...a,s]:a.filter(v=>v!==s))}/>{zh?({balances:'余额',positions:'持仓',orders:'订单',qualification:'资格'})[s]:s}</label>)}</fieldset>
      <div className={styles.composerDock}>
        {(() => { const index = messages.findLastIndex(m => m.role === 'assistant'); const latest = messages[index]; return latest?.questions?.length ? <AiQuestionCard key={index} questions={latest.questions} locale={locale} disabled={busy} onConfirm={sendAnswer}/> : null })()}
        <form onSubmit={e=>{e.preventDefault();void send()}}><textarea aria-label={copy('消息','Message')} value={text} maxLength={4000} onChange={e=>setText(e.target.value)}/><button disabled={busy||!text.trim()}>{copy('发送','Send')}</button></form>
      </div>
      <details><summary>{copy('创建工单','Create ticket')}</summary><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void perform(async()=>{const r=await aiCustomer.draftTicket(String(data.get('subject')),String(data.get('body')));if(!r.ok)throw new Error(r.error.message);setDraft(r.data);setTicketConfirmed(false)})}}><input name="subject" required maxLength={200} placeholder={copy('主题','Subject')}/><textarea name="body" required maxLength={5000} placeholder={copy('问题详情','Details')}/><button disabled={busy}>{copy('预览','Preview')}</button></form>{draft&&<div><h3>{draft.content.subject}</h3><p>{draft.content.body}</p><label><input type="checkbox" checked={ticketConfirmed} onChange={e=>setTicketConfirmed(e.target.checked)}/>{copy('确认提交以上内容','Confirm the content above')}</label><button disabled={busy||!ticketConfirmed} onClick={()=>perform(async()=>{const r=await aiCustomer.confirmTicket(draft.id);if(!r.ok)throw new Error(r.error.message);setDraft(null);setMessages(m=>[...m,{role:'assistant',text:r.data.reference}])})}>{copy('提交工单','Submit ticket')}</button></div>}</details>
    </section>:access!=='ready'?<section className={styles.card}>{access==='login'?<Link href="/login?returnTo=%2Fai-assistant">{copy('登录','Log in')}</Link>:access==='loading'?<span role="status">…</span>:<button disabled={busy} onClick={()=>perform(load)}>{copy('重试','Retry')}</button>}</section>:<section className={styles.card}>
      {mandate&&!mandate.executionEnabled&&<p>{copy('自动执行待验收，当前不会交易。','Automatic execution awaits acceptance. Trading is disabled.')}</p>}
      {mandate?.mandate&&<div className={styles.row}><span>{mandate.mandate.status} · v{mandate.mandate.revision}</span>{(['pause','resume','revoke'] as const).map(a=><button key={a} disabled={busy||mandate.mandate?.status==='revoked'} onClick={()=>perform(async()=>{if(!window.confirm(copy('确认更改授权状态？已提交申请仍按真实状态处理。','Confirm mandate change? Submitted applications remain in progress.')))return;const r=await aiCustomer.changeState(a,mandate.mandate!.revision);if(!r.ok)throw new Error(r.error.message);await load()})}>{zh?({pause:'暂停',resume:'恢复',revoke:'撤销'})[a]:a}</button>)}</div>}
      <form onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={busy} className={styles.grid}>
        {amounts.map(k=><label key={k}>{zh?labels[k]:english[k]} (USDT)<input inputMode="decimal" required value={fields[k]??''} onChange={e=>change(k,e.target.value)}/></label>)}
        {integers.map(k=><label key={k}>{zh?labels[k].replace('（基点）','（%）'):english[k]}<input type="number" step={k.endsWith('Bps')?'0.01':'1'} required value={fields[k]===undefined?'':k.endsWith('Bps')?Number(fields[k])/100:fields[k]} onChange={e=>change(k,k.endsWith('Bps')?String(Math.round(Number(e.target.value)*100)):e.target.value)}/></label>)}
        <div><p>{copy('允许的产品','Allowed products')}</p>{choices.products.map(p=><label key={p.id}><input type="checkbox" checked={(fields.allowedProductIds??'').split('\n').includes(p.id)} onChange={e=>{const ids=(fields.allowedProductIds??'').split('\n').filter(Boolean);change('allowedProductIds',(e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id)).join('\n'))}}/>{p.name}</label>)}{choices.products.length===0&&<p>{copy('尚无已发布执行规则的产品','No products with published execution terms')}</p>}</div>
        <div><p>{copy('纳入管理的已有持仓','Existing holdings to manage')}</p>{choices.positions.map(p=>{const selected=JSON.parse(fields.positions||'[]') as Array<{positionId:string;quantityAtomic:string}>;return <label key={p.id}><input type="checkbox" checked={selected.some(v=>v.positionId===p.id)} disabled={!(fields.allowedProductIds??'').split('\n').includes(p.productId)} onChange={e=>change('positions',JSON.stringify(e.target.checked?[...selected,{positionId:p.id,quantityAtomic:p.quantityAtomic}]:selected.filter(v=>v.positionId!==p.id)))}/>{p.name} · {(Number(p.quantityAtomic)/10**p.decimals).toLocaleString()}</label>})}</div>
        <label>{copy('风险等级','Risk band')}<select required value={fields.riskBand??''} onChange={e=>change('riskBand',e.target.value)}><option value="">—</option>{['conservative','balanced','growth','aggressive'].map(v=><option key={v}>{v}</option>)}</select></label>
        {(['effectiveAt','expiresAt'] as const).map(k=><label key={k}>{copy(k==='effectiveAt'?'生效日期':'失效日期',k)}<input required type="datetime-local" value={fields[k]?new Date(new Date(fields[k]).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''} onChange={e=>change(k,e.target.value?new Date(e.target.value).toISOString():'')}/></label>)}
        <label>{copy('投资目标','Investment goals')}<textarea required maxLength={2000} value={fields.goals??''} onChange={e=>change('goals',e.target.value)}/></label>
      </fieldset><div className={styles.row}>{(['allowBuy','allowRedeem','reinvestProceeds'] as const).map(k=><label key={k}><input type="checkbox" checked={actions[k]} onChange={e=>{setActions(a=>({...a,[k]:e.target.checked}));setConfirmed(false)}}/>{zh?({allowBuy:'自动买入',allowRedeem:'自动赎回',reinvestProceeds:'赎回到账后再投资'})[k]:k}</label>)}</div>
      <p>{copy('授权内由 AI 动态选择产品及比例；不包含提现或外部转账。风险阈值不保证最大回撤，暂停和撤销不回滚已提交申请。','AI may select products and weights within this mandate. Withdrawals and external transfers are excluded. Risk thresholds do not guarantee a maximum loss. Pausing or revoking does not reverse submitted applications.')}</p>
      <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{copy('我确认以上范围、限额及条款','I confirm the scope, limits and terms above')} · {mandate?.termsVersion}</label><button disabled={busy||!confirmed||!mandate}>{copy('保存授权','Save mandate')}</button></form>
      <div className={styles.row}><button disabled={busy||!mandate?.executionEnabled||mandate.mandate?.status!=='active'} onClick={()=>perform(async()=>{const r=await aiCustomer.evaluate(mandate!.mandate!.revision,crypto.randomUUID());if(!r.ok)throw new Error(r.error.message);await load()})}>{copy('检查配置','Evaluate allocation')}</button><button disabled={busy} onClick={()=>perform(load)}>{copy('刷新','Refresh')}</button></div>
      {runs.map(r=><details key={r.id}><summary>{new Date(r.createdAt).toLocaleString()} · {r.state}</summary><p>{r.result?.explanation??r.failureCode}</p><button disabled={busy} onClick={()=>perform(async()=>{const detail=await aiCustomer.run(r.id);if(!detail.ok)throw new Error(detail.error.message);setSource({title:r.state,body:detail.data.legs.map(l=>[l.productName,l.kind==='buy'?copy('买入','Buy'):copy('赎回','Redeem'),l.state,fromAtomic(l.actualAmountAtomic??l.notionalAtomic)+' USDT'].join(' · ')).join('\n')})})}>{copy('明细','Details')}</button><button disabled={busy||['completed','failed','canceled','no_change'].includes(r.state)} onClick={()=>perform(async()=>{const result=await aiCustomer.cancelRun(r.id);if(!result.ok)throw new Error(result.error.message);await load()})}>{copy('取消未提交任务','Cancel unsubmitted work')}</button></details>)}
    </section>}
    {source&&<dialog open className={styles.dialog}><button onClick={()=>setSource(null)} aria-label={copy('关闭','Close')}>×</button><h3>{source.title}</h3><p>{source.body}</p></dialog>}
  </main>
}
