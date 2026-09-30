'use client'

import { ChevronRight, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { request, type ApiError } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { contentErrors, planCopy, type ContentErrors, type PlanCopy } from '@/lib/maison-content-copy'
import { fill } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import RwaTopbar from '../rwa-topbar'
import { fmtDateTime } from './format'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import c from './content.module.css'

type Risk = 'low' | 'medium' | 'high'
type Goals = { title: string; budgetUsdt: string; horizonMonths: number; riskTolerance: Risk; notes: string; locale: string }
type Saved = { revision: number; content: Goals | null }
type Plan = { id: string; state: 'generating' | 'ready' | 'failed'; goals: Goals; catalog: { id: string; displayName: string; externalRef?: string }[]; model?: string | null; createdAt: string; result: { cashBps: number; explanation: string; allocations: { productId: string; weightBps: number; reason: string }[] } | null }
type PlanRow = { id: string; state: Plan['state']; createdAt: string }
type Draft = { title: string; budgetUsdt: string; horizon: string; riskTolerance: Risk; notes: string }

const base = '/v1/ai/planning'
// Same bounds as SaveAiGoalsDto; checked here so the user sees the field, not a 400.
const BUDGET = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/
const RISKS: Risk[] = ['low', 'medium', 'high']

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`
const toDraft = (g: Goals | null): Draft => g
  ? { title: g.title, budgetUsdt: g.budgetUsdt, horizon: String(g.horizonMonths), riskTolerance: g.riskTolerance, notes: g.notes ?? '' }
  : { title: '', budgetUsdt: '', horizon: '12', riskTolerance: 'low', notes: '' }

function validate(d: Draft) {
  const horizon = Number(d.horizon)
  return {
    title: d.title.trim() ? '' : 'errName',
    budgetUsdt: BUDGET.test(d.budgetUsdt) && Number(d.budgetUsdt) > 0 ? '' : 'errBudget',
    horizon: Number.isInteger(horizon) && horizon >= 1 && horizon <= 600 ? '' : 'errHorizon',
  } as const
}

function errorText(error: ApiError, p: PlanCopy, e: ContentErrors) {
  if (error.status === 0) return e.network
  if (error.status === 503) return e.aiOff
  if (error.status === 429) return e.busyAi
  if (error.status === 409) return /product/i.test(error.message) ? e.noProducts : p.conflict
  return e.generic
}

export function AiPlanningScreen({ id }: { id?: string }) {
  const { locale } = useI18n()
  const p = planCopy[locale], e = contentErrors[locale]
  return <MaisonPage page="ai-planning" topbar={<RwaTopbar screen={id ? 'ai-plan' : 'ai'} title={id ? p.titlePlan : p.titleGoals} onBack={() => backOr(id ? '/ai/goals' : '/ai')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{p.kicker}</p>
      <h1 className={s.display}>{id ? p.titlePlan : p.titleGoals}</h1>
      <p className={s.lede}>{p.lede}</p>
    </header>
    {id ? <PlanView id={id} p={p} e={e} locale={locale} /> : <GoalsView p={p} e={e} locale={locale} />}
  </MaisonPage>
}

function GoalsView({ p, e, locale }: { p: PlanCopy; e: ContentErrors; locale: string }) {
  const goals = useQuery('ai-planning:goals', () => request<Saved>(`${base}/goals`))
  const history = useQuery('ai-planning:history', () => request<PlanRow[]>(`${base}/plans`))
  const saved = goals.data ?? null
  const [draft, setDraft] = useState<Draft>(() => toDraft(null))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState<'' | 'save' | 'generate'>('')
  const [banner, setBanner] = useState<{ tone: 'ok' | 'error'; text: string; reload?: boolean } | null>(null)
  const intent = useRef<{ revision: number; key: string } | null>(null)

  // Adopt the server copy whenever a new revision arrives (first load, save, reload).
  const revision = saved?.revision
  useEffect(() => { if (saved) setDraft(toDraft(saved.content)) }, [revision])

  const errors = validate(draft)
  const invalid = Boolean(errors.title || errors.budgetUsdt || errors.horizon)
  const serverDraft = toDraft(saved?.content ?? null)
  const dirty = !saved?.content
    || (Object.keys(draft) as (keyof Draft)[]).some(k => (k === 'title' || k === 'notes' ? draft[k].trim() : draft[k]) !== serverDraft[k])
    || saved.content.locale !== locale
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft(d => ({ ...d, [k]: v })); setBanner(null) }

  const save = async () => {
    if (!saved || busy) return
    setTouched(true)
    if (invalid) return
    setBusy('save'); setBanner(null)
    const body = { title: draft.title.trim(), budgetUsdt: draft.budgetUsdt, horizonMonths: Number(draft.horizon), riskTolerance: draft.riskTolerance, notes: draft.notes.trim(), locale, expectedRevision: saved.revision }
    const result = await request<Saved>(`${base}/goals`, { method: 'PUT', body: JSON.stringify(body) })
    setBusy('')
    if (!result.ok) { setBanner({ tone: 'error', text: errorText(result.error, p, e), reload: result.error.status === 409 }); return }
    intent.current = null; setTouched(false)
    await goals.refetch()
    setBanner({ tone: 'ok', text: p.saved })
  }

  const generate = async () => {
    if (!saved?.content || busy) return
    if (dirty) { setBanner({ tone: 'error', text: p.needSave }); return }
    // One key per saved revision: a retried click or lost response returns the same plan.
    if (intent.current?.revision !== saved.revision) intent.current = { revision: saved.revision, key: crypto.randomUUID() }
    setBusy('generate'); setBanner(null)
    const result = await request<Plan>(`${base}/plans`, { method: 'POST', body: JSON.stringify({ expectedRevision: saved.revision }), idempotencyKey: intent.current.key, timeoutMs: 95_000 })
    setBusy('')
    if (!result.ok) { setBanner({ tone: 'error', text: errorText(result.error, p, e), reload: result.error.status === 409 && !/product/i.test(result.error.message) }); return }
    intent.current = null
    void history.refetch()
    openPath(`/ai/plan/${result.data.id}`)
  }

  const show = (k: keyof typeof errors) => touched && errors[k] ? p[errors[k] as 'errName'] : ''

  return <>
    <SectionHead index="01" title={p.sGoals} note={p.sGoalsNote} action={saved?.content && dirty && !busy ? <span className={c.dirty}>{p.unsaved}</span> : undefined} />
    {goals.error ? <StateBlock tone="error" title={errorText(goals.error, p, e)} retry={goals.refetch} retryLabel={p.retry} />
      : !saved ? <Skeleton rows={5} />
        : <form noValidate onSubmit={ev => { ev.preventDefault(); void save() }}>
          <fieldset className={c.form} disabled={Boolean(busy)} aria-busy={Boolean(busy)}>
            <label className={c.label}>
              <span>{p.name}</span>
              <input className={c.input} dir="auto" maxLength={160} value={draft.title} aria-invalid={Boolean(show('title'))} aria-describedby="goal-title-err" onChange={ev => set('title', ev.target.value)} />
              {show('title') && <p id="goal-title-err" className={c.error}>{show('title')}</p>}
            </label>
            <label className={c.label}>
              <span>{p.budget}</span>
              <span className={c.affix}>
                <input className={`${c.input} ${c.numeric}`} inputMode="decimal" autoComplete="off" maxLength={19} value={draft.budgetUsdt} aria-invalid={Boolean(show('budgetUsdt'))} aria-describedby="goal-budget-err" onChange={ev => set('budgetUsdt', ev.target.value.replace(/[^\d.]/g, ''))} />
                <i aria-hidden="true">USDT</i>
              </span>
              {show('budgetUsdt') && <p id="goal-budget-err" className={c.error}>{show('budgetUsdt')}</p>}
            </label>
            <label className={c.label}>
              <span>{p.horizon}</span>
              <span className={c.affix}>
                <input className={`${c.input} ${c.numeric}`} inputMode="numeric" autoComplete="off" maxLength={3} value={draft.horizon} aria-invalid={Boolean(show('horizon'))} aria-describedby="goal-horizon-err" onChange={ev => set('horizon', ev.target.value.replace(/\D/g, ''))} />
                <i aria-hidden="true">{p.months}</i>
              </span>
              {show('horizon') && <p id="goal-horizon-err" className={c.error}>{show('horizon')}</p>}
            </label>
            <div className={c.label} role="radiogroup" aria-labelledby="goal-risk-label">
              <span id="goal-risk-label">{p.risk}<small>{p.riskNote}</small></span>
              <div className={c.risk}>
                {RISKS.map(r => <button key={r} type="button" role="radio" aria-checked={draft.riskTolerance === r} tabIndex={draft.riskTolerance === r ? 0 : -1}
                  onClick={() => set('riskTolerance', r)}
                  onKeyDown={ev => {
                    const step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0
                    if (!step) return
                    ev.preventDefault()
                    const rtl = document.dir === 'rtl' && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') ? -1 : 1
                    const next = RISKS[(RISKS.indexOf(draft.riskTolerance) + step * rtl + 3) % 3]
                    set('riskTolerance', next)
                    ;(ev.currentTarget.parentElement?.children[RISKS.indexOf(next)] as HTMLElement | undefined)?.focus()
                  }}>{p.riskLevels[r]}</button>)}
              </div>
            </div>
            <label className={c.label}>
              <span>{p.notes}<small>{draft.notes.length}/1000</small></span>
              <textarea className={c.input} dir="auto" maxLength={1000} value={draft.notes} onChange={ev => set('notes', ev.target.value)} />
              <p className={c.hint}>{p.notesHint}</p>
            </label>
            {banner && <div className={c.banner} data-tone={banner.tone} role={banner.tone === 'error' ? 'alert' : 'status'}>
              <p>{banner.text}</p>
              {banner.reload && <button type="button" className={s.link} onClick={() => { setBanner(null); intent.current = null; void goals.refetch() }}>{p.reload}</button>}
            </div>}
            {busy === 'generate' ? <div className={c.generating} role="status" aria-live="polite">
              <span className={c.pulse} aria-hidden="true" />
              <b>{p.genTitle}</b>
              <p>{p.genBody}</p>
            </div> : <div className={c.actions}>
              <button type="submit" className={s.cta} disabled={Boolean(busy) || !dirty}>{busy === 'save' ? p.saving : p.save}</button>
              <button type="button" className={s.ghost} disabled={Boolean(busy) || !saved.content} onClick={() => void generate()}>{p.generate}</button>
            </div>}
            <p className={s.notice}><ShieldCheck size={15} aria-hidden="true" /><span>{p.provider}</span></p>
          </fieldset>
        </form>}

    <SectionHead index="02" title={p.sHistory} note={p.sHistoryNote} />
    {history.error ? <StateBlock tone="error" title={errorText(history.error, p, e)} retry={history.refetch} retryLabel={p.retry} />
      : !history.data ? <Skeleton rows={2} />
        : !history.data.length ? <StateBlock title={p.historyEmpty} />
          : <ul className={s.list}>{history.data.map(row => <li key={row.id}>
            <button type="button" className={s.row} onClick={() => openPath(`/ai/plan/${row.id}`)}>
              <span className={s.led} data-tone={row.state === 'ready' ? 'live' : row.state === 'failed' ? 'down' : 'warn'} aria-hidden="true" />
              <span className={s.rowMain}><b>{p.state[row.state]}</b><small>{fmtDateTime(row.createdAt, locale)}</small></span>
              <ChevronRight size={16} className={s.chev} aria-hidden="true" />
            </button>
          </li>)}</ul>}
  </>
}

function PlanView({ id, p, e, locale }: { id: string; p: PlanCopy; e: ContentErrors; locale: string }) {
  const query = useQuery(`ai-planning:plan:${id}`, () => request<Plan>(`${base}/plans/${encodeURIComponent(id)}`))
  const plan = query.data
  const [ack, setAck] = useState<Record<string, boolean>>({})
  // The server finishes or times out a plan (10 min); poll only while it is still generating.
  useEffect(() => {
    if (plan?.state !== 'generating') return
    const timer = setInterval(() => void query.refetch(), 5000)
    return () => clearInterval(timer)
  }, [plan?.state, query.refetch])

  const manage = <button type="button" className={s.ghost} onClick={() => openPath('/ai/goals')}>{p.manage}</button>
  if (query.error) return query.error.status === 404
    ? <StateBlock tone="unavailable" title={p.notFound} body={p.notFoundBody} action={manage} />
    : <StateBlock tone="error" title={errorText(query.error, p, e)} retry={query.refetch} retryLabel={p.retry} />
  if (!plan) return <Skeleton rows={5} />

  const goalLine = <p className={c.goalLine}><bdi>{fill(p.goalLine, { title: plan.goals.title, budget: plan.goals.budgetUsdt, months: String(plan.goals.horizonMonths) })}</bdi> · {p.riskLevels[plan.goals.riskTolerance]}</p>
  if (plan.state === 'generating') return <>{goalLine}<div className={c.generating} role="status" aria-live="polite"><span className={c.pulse} aria-hidden="true" /><b>{p.genTitle}</b><p>{p.genBody}</p></div></>
  if (plan.state === 'failed' || !plan.result) return <>{goalLine}<StateBlock tone="error" title={p.failTitle} body={p.failBody} action={<button type="button" className={s.ghost} onClick={() => openPath('/ai/goals')}>{p.regenerate}</button>} /></>

  const { result } = plan
  const product = (pid: string) => plan.catalog.find(x => x.id === pid)
  return <>
    {goalLine}
    <SectionHead index="01" title={p.sAlloc} note={p.sAllocNote} />
    <div className={s.alloc} role="img" aria-label={[...result.allocations.map(a => `${product(a.productId)?.displayName ?? p.unknownProduct} ${pct(a.weightBps)}`), `${p.cash} ${pct(result.cashBps)}`].join(', ')}>
      {result.allocations.map(a => <i key={a.productId} style={{ flexGrow: a.weightBps }} />)}
      {result.cashBps > 0 && <i style={{ flexGrow: result.cashBps, ['--c' as string]: 'var(--m-faint)' }} />}
    </div>
    <ul className={s.allocLegend}>
      {result.allocations.map(a => <li key={a.productId}><span className={s.allocKey} aria-hidden="true" /><span dir="auto">{product(a.productId)?.displayName ?? p.unknownProduct}</span><b className={s.num}>{pct(a.weightBps)}</b><small /></li>)}
      <li><span className={s.allocKey} style={{ ['--c' as string]: 'var(--m-faint)' }} aria-hidden="true" /><span>{p.cash}</span><b className={s.num}>{pct(result.cashBps)}</b><small /></li>
    </ul>

    <SectionHead index="02" title={p.sExplain} />
    <p className={c.explain} dir="auto">{result.explanation}</p>

    <div>{result.allocations.map(a => {
      const item = product(a.productId)
      const ref = item?.externalRef ?? item?.id
      const ackId = `ack-${a.productId}`
      return <article key={a.productId} className={c.pick} aria-labelledby={`${ackId}-h`}>
        <div className={c.pickHead}><h3 id={`${ackId}-h`} dir="auto">{item?.displayName ?? p.unknownProduct}</h3><b><bdi>{pct(a.weightBps)}</bdi></b></div>
        <p dir="auto">{a.reason}</p>
        <label className={s.consent} htmlFor={ackId}>
          <input id={ackId} type="checkbox" checked={ack[a.productId] ?? false} disabled={!ref} onChange={ev => setAck(v => ({ ...v, [a.productId]: ev.target.checked }))} />
          <span>{p.ack}</span>
        </label>
        <button type="button" className={s.ghost} disabled={!ref || !ack[a.productId]} onClick={() => ref && openPath(`/asset/${encodeURIComponent(ref)}`)}>{p.review}</button>
      </article>
    })}</div>

    <p className={s.notice}><ShieldCheck size={15} aria-hidden="true" /><span>{p.notAdvice}</span></p>
    <p className={s.foot}>{plan.model ? <><bdi>{fill(p.model, { v: plan.model })}</bdi> · </> : null}{fmtDateTime(plan.createdAt, locale)}</p>
    <div className={c.actions}>{manage}</div>
  </>
}
