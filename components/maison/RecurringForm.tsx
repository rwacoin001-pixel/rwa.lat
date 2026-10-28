'use client'
import { useId, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { listProducts } from '@/lib/api/markets'
import { changeRecurring, createRecurring, listRecurring } from '@/lib/api/investment-tools'
import { fromAtomic, toAtomic } from '@/lib/money'
import { fill } from '@/lib/maison-market-copy'
import { recurringCopy } from '@/lib/maison-recurring-copy'
import { maison as s } from './primitives'
import r from './recurring.module.css'

/** `datetime-local` gives wall-clock time with no zone; read it as the user's own time, then show the UTC it becomes. */
const toInstant = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date }
const utcClock = (date: Date) => `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`

export function RecurringForm() {
  const { locale } = useI18n(); const t = recurringCopy[locale]
  const products = useQuery('markets:catalog', listProducts)
  const plans = useQuery('investments:recurring', listRecurring)
  const [productId,setProductId] = useState(''), [amount,setAmount] = useState(''), [frequency,setFrequency] = useState('monthly'), [firstRun,setFirstRun] = useState('')
  const [consent,setConsent] = useState(false), [busy,setBusy] = useState(false), [message,setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const freqId = useId(), utcId = useId()
  const attempt = useRef<{ body: string; key: string } | null>(null)
  const firstAt = firstRun ? toInstant(firstRun) : null
  const frequencies = [['daily', t.daily], ['weekly', t.weekly], ['monthly', t.monthly]] as const
  async function run(work: () => Promise<void>) { setBusy(true); setMessage(null); try { await work(); plans.refetch() } catch(e) { setMessage({ tone: 'error', text: e instanceof Error ? e.message : t.incomplete }) } finally { setBusy(false) } }
  const create = () => void run(async()=>{
    const atomic=toAtomic(amount,6)
    if (!consent || !productId || !atomic || BigInt(atomic)<=BigInt(0) || !firstAt) throw new Error(t.incomplete)
    const input={productId,amountAtomic:atomic,frequency,firstRunAt:firstAt.toISOString(),consent:true as const}
    const body=JSON.stringify(input)
    if(attempt.current?.body!==body) attempt.current={body,key:crypto.randomUUID()}
    const result=await createRecurring(input,attempt.current.key)
    if(!result.ok) throw new Error(result.error.message)
    attempt.current=null;setMessage({ tone: 'info', text: t.created });setConsent(false)
  })
  const loadError = products.error?.message ?? plans.error?.message
  return <div>
    <form className={r.form} aria-busy={busy} onSubmit={e=>{e.preventDefault();if(!busy)create()}}>
      <fieldset disabled={busy} className={r.fields}>
        <label className={r.field}><span>{t.product}</span><span className={r.select}><select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">—</option>{(products.data ?? []).filter(p=>p.state==='published' && p.assetClassId!=='prediction').map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
        <label className={r.field}><span>{t.amount}</span><span className={r.amount}><input inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} /><em>USDT</em></span></label>
        <div className={r.field} role="group" aria-labelledby={freqId}><span id={freqId}>{t.frequency}</span><div className={r.segment}>{frequencies.map(([value,label])=><button type="button" key={value} aria-pressed={frequency===value} onClick={()=>setFrequency(value)}>{label}</button>)}</div></div>
        <label className={r.field}><span>{t.firstRun}</span><input className={r.input} type="datetime-local" value={firstRun} aria-describedby={utcId} onChange={e=>setFirstRun(e.target.value)} />
          <small id={utcId} className={r.utc} dir="ltr">{firstAt ? fill(t.utc, { t: utcClock(firstAt) }) : null}</small></label>
        <label className={s.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />{t.consent}</label>
        <button type="submit" className={s.cta} disabled={!consent || !productId || !amount || !firstAt}><span>{t.create}</span><span className={s.ctaIcon}><ArrowRight size={17} /></span></button>
      </fieldset>
    </form>
    {message && <p className={s.notice} data-tone={message.tone} role={message.tone==='info'?'status':'alert'}>{message.tone==='info'?<CheckCircle2 size={15} aria-hidden="true" />:<AlertTriangle size={15} aria-hidden="true" />}<span>{message.text}</span></p>}
    {loadError && <p className={s.notice} data-tone="error" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>{loadError}</span></p>}
    <div className={r.plansHead}><button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>plans.refetch()}><RefreshCw size={13} aria-hidden="true" />{t.refresh}</button></div>
    {(plans.data ?? []).length>0 && <ul className={s.list}>{(plans.data ?? []).map(plan=><li key={plan.id} className={r.plan}>
      <div className={r.planTop}><b dir="auto">{plan.productName}</b><span className={`${s.num} ${r.planAmt}`} dir="ltr">{fromAtomic(plan.amountAtomic,6)} USDT</span></div>
      <div className={r.planMeta}><span className={s.badge} data-tone={plan.state==='active'?'live':plan.state==='paused'?'warn':undefined}>{plan.state==='active'?t.active:plan.state==='paused'?t.paused:t.cancelled}</span><small>{t.next} · <span dir="ltr">{new Date(plan.nextRunAt).toLocaleString(locale,{timeZone:'UTC'})} UTC</span></small></div>
      {plan.state!=='cancelled' && <div className={s.actionsRow} style={{ marginTop: 12 }}>{([plan.state==='active'?'paused':'active','cancelled'] as const).map(state=><button type="button" className={s.ghost} data-size="s" data-tone={state==='cancelled'?'down':undefined} key={state} disabled={busy} onClick={()=>void run(async()=>{const result=await changeRecurring(plan.id,state);if(!result.ok)throw new Error(result.error.message)})}>{state==='paused'?t.pause:state==='active'?t.resume:t.cancel}</button>)}</div>}
      {plan.runs.length>0 && <ol className={r.runs}>{plan.runs.map(row=><li key={row.scheduledAt} data-state={row.state}><span dir="ltr">{new Date(row.scheduledAt).toLocaleString(locale)}</span><span>{row.state==='submitted'?t.submitted:t.failed} {row.failureCode ?? ''}</span></li>)}</ol>}
    </li>)}</ul>}
  </div>
}
