'use client'
import { useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { listProducts } from '@/lib/api/markets'
import { changeRecurring, createRecurring, listRecurring } from '@/lib/api/investment-tools'
import { fromAtomic, toAtomic } from '@/lib/money'
import { maison as s } from './primitives'
import r from './recurring.module.css'

const texts = {
  en: ['Product','Amount (USDT)','Frequency','Daily','Weekly','Monthly','First execution (UTC)','I authorize automatic investment requests using my balance. Failed installments are skipped without catch-up charges.','Create plan','Pause','Resume','Cancel plan','Plan created','Please complete the form and authorization.','Active','Paused','Cancelled','Next execution','Submitted','Failed','Refresh'],
  'zh-CN': ['产品','金额（USDT）','频率','每天','每周','每月','首次执行时间（UTC）','我授权系统按计划使用余额提交投资申请。失败期次跳过，不自动补扣。','创建计划','暂停','恢复','取消计划','计划已创建','请完整填写并确认授权。','执行中','已暂停','已取消','下次执行','已提交','失败','刷新'],
  hi: ['उत्पाद','राशि (USDT)','आवृत्ति','दैनिक','साप्ताहिक','मासिक','पहला निष्पादन (UTC)','मैं शेष राशि से स्वचालित निवेश अनुरोधों की अनुमति देता हूँ। असफल किस्तों की बाद में कटौती नहीं होगी।','योजना बनाएँ','रोकें','फिर शुरू करें','योजना रद्द करें','योजना बनाई गई','फ़ॉर्म और अनुमति पूरी करें।','सक्रिय','रुका हुआ','रद्द','अगला निष्पादन','प्रस्तुत','असफल','रीफ़्रेश'],
  es: ['Producto','Importe (USDT)','Frecuencia','Diaria','Semanal','Mensual','Primera ejecución (UTC)','Autorizo solicitudes automáticas de inversión con mi saldo. Las cuotas fallidas se omiten sin cobros posteriores.','Crear plan','Pausar','Reanudar','Cancelar plan','Plan creado','Complete el formulario y la autorización.','Activo','Pausado','Cancelado','Próxima ejecución','Enviada','Fallida','Actualizar'],
  ar: ['المنتج','المبلغ (USDT)','التكرار','يومي','أسبوعي','شهري','أول تنفيذ (UTC)','أفوض تقديم طلبات الاستثمار تلقائياً باستخدام رصيدي. تُتخطى الدفعات الفاشلة دون خصم لاحق.','إنشاء خطة','إيقاف مؤقت','استئناف','إلغاء الخطة','تم إنشاء الخطة','أكمل النموذج والتفويض.','نشطة','متوقفة','ملغاة','التنفيذ التالي','تم الإرسال','فشل','تحديث'],
  fr: ['Produit','Montant (USDT)','Fréquence','Quotidienne','Hebdomadaire','Mensuelle','Première exécution (UTC)',"J’autorise les demandes automatiques utilisant mon solde. Les échéances échouées sont ignorées sans prélèvement ultérieur.",'Créer le plan','Suspendre','Reprendre','Annuler le plan','Plan créé','Complétez le formulaire et l’autorisation.','Actif','Suspendu','Annulé','Prochaine exécution','Soumise','Échec','Actualiser'],
  pt: ['Produto','Valor (USDT)','Frequência','Diária','Semanal','Mensal','Primeira execução (UTC)','Autorizo pedidos automáticos de investimento com meu saldo. Parcelas que falharem serão ignoradas sem cobrança posterior.','Criar plano','Pausar','Retomar','Cancelar plano','Plano criado','Preencha o formulário e a autorização.','Ativo','Pausado','Cancelado','Próxima execução','Enviado','Falhou','Atualizar'],
}
export function RecurringForm() {
  const { locale } = useI18n(); const t = texts[locale]
  const products = useQuery('markets:catalog', listProducts)
  const plans = useQuery('investments:recurring', listRecurring)
  const [productId,setProductId] = useState(''), [amount,setAmount] = useState(''), [frequency,setFrequency] = useState('monthly'), [firstRun,setFirstRun] = useState('')
  const [consent,setConsent] = useState(false), [busy,setBusy] = useState(false), [message,setMessage] = useState('')
  const freqId = useId()
  const attempt = useRef<{ body: string; key: string } | null>(null)
  async function run(work: () => Promise<void>) { setBusy(true); setMessage(''); try { await work(); plans.refetch() } catch(e) { setMessage(e instanceof Error ? e.message : t[13]) } finally { setBusy(false) } }
  const create = () => void run(async()=>{
    const atomic=toAtomic(amount,6)
    if (!consent || !productId || !atomic || BigInt(atomic)<=BigInt(0)) throw new Error(t[13])
    const input={productId,amountAtomic:atomic,frequency,firstRunAt:new Date(`${firstRun}Z`).toISOString(),consent:true as const}
    const body=JSON.stringify(input)
    if(attempt.current?.body!==body) attempt.current={body,key:crypto.randomUUID()}
    const result=await createRecurring(input,attempt.current.key)
    if(!result.ok) throw new Error(result.error.message)
    attempt.current=null;setMessage(t[12]);setConsent(false)
  })
  const loadError = products.error?.message ?? plans.error?.message
  return <div>
    <form className={r.form} aria-busy={busy} onSubmit={e=>{e.preventDefault();if(!busy)create()}}>
      <fieldset disabled={busy} className={r.fields}>
        <label className={r.field}><span>{t[0]}</span><span className={r.select}><select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">—</option>{(products.data ?? []).filter(p=>p.state==='published' && p.assetClassId!=='prediction').map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
        <label className={r.field}><span>{t[1]}</span><span className={r.amount}><input inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} /><em>USDT</em></span></label>
        <div className={r.field} role="group" aria-labelledby={freqId}><span id={freqId}>{t[2]}</span><div className={r.segment}>{['daily','weekly','monthly'].map((value,i)=><button type="button" key={value} aria-pressed={frequency===value} onClick={()=>setFrequency(value)}>{t[i+3]}</button>)}</div></div>
        <label className={r.field}><span>{t[6]}</span><input className={r.input} type="datetime-local" value={firstRun} onChange={e=>setFirstRun(e.target.value)} /></label>
        <label className={s.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />{t[7]}</label>
        <button type="submit" className={s.cta} style={{ justifyContent: 'center' }} disabled={!consent || !productId || !amount || !firstRun}><span>{t[8]}</span></button>
      </fieldset>
    </form>
    {message && <p className={s.notice} data-tone={message===t[12]?'info':'error'} role={message===t[12]?'status':'alert'}>{message===t[12]?<CheckCircle2 size={15} aria-hidden="true" />:<AlertTriangle size={15} aria-hidden="true" />}<span>{message}</span></p>}
    {loadError && <p className={s.notice} data-tone="error" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>{loadError}</span></p>}
    <div className={r.plansHead}><button type="button" className={s.ghost} data-size="s" disabled={busy} onClick={()=>plans.refetch()}><RefreshCw size={13} aria-hidden="true" />{t[20]}</button></div>
    {(plans.data ?? []).length>0 && <ul className={s.list}>{(plans.data ?? []).map(plan=><li key={plan.id} className={r.plan}>
      <div className={r.planTop}><b dir="auto">{plan.productName}</b><span className={`${s.num} ${r.planAmt}`} dir="ltr">{fromAtomic(plan.amountAtomic,6)} USDT</span></div>
      <div className={r.planMeta}><span className={s.badge} data-tone={plan.state==='active'?'live':plan.state==='paused'?'warn':undefined}>{t[plan.state==='active'?14:plan.state==='paused'?15:16]}</span><small>{t[17]} · <span dir="ltr">{new Date(plan.nextRunAt).toLocaleString(locale,{timeZone:'UTC'})} UTC</span></small></div>
      {plan.state!=='cancelled' && <div className={s.actionsRow} style={{ marginTop: 10 }}>{([plan.state==='active'?'paused':'active','cancelled'] as const).map(state=><button type="button" className={s.ghost} data-size="s" data-tone={state==='cancelled'?'down':undefined} key={state} disabled={busy} onClick={()=>void run(async()=>{const result=await changeRecurring(plan.id,state);if(!result.ok)throw new Error(result.error.message)})}>{t[state==='paused'?9:state==='active'?10:11]}</button>)}</div>}
      {plan.runs.length>0 && <ol className={r.runs}>{plan.runs.map(row=><li key={row.scheduledAt} data-state={row.state}><span dir="ltr">{new Date(row.scheduledAt).toLocaleString(locale)}</span><span>{t[row.state==='submitted'?18:19]} {row.failureCode ?? ''}</span></li>)}</ol>}
    </li>)}</ul>}
  </div>
}
