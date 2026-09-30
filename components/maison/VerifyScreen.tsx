'use client'

import {
  AlertTriangle, ArrowLeft, BadgeCheck, Camera, Check, ChevronRight, ExternalLink, Fingerprint, Gauge, Globe, Hourglass,
  IdCard, Info, Lock, Pencil, RotateCw, Scale, ScanFace, ShieldCheck, ShieldX, Trash2, UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import type { ApiError, ApiResult } from '@/lib/api/_http'
import { invalidate, useQuery } from '@/lib/api/_query'
import {
  createKycSession, getKycCaptureConfig, deleteRiskProfile, evaluateEligibility, getEligibility, getKyc, getRiskProfile, getRiskQuestionnaire, getSessionInfo, submitRiskProfile,
  type Eligibility, type EligibilityDecision, type KycCase, type KycState, type RiskBand, type RiskProfile, type RiskQuestion, type RiskQuestionnaire,
} from '@/lib/api/account'
import { isListed, listProducts } from '@/lib/api/markets'
import { RISK_COPY_VERSION, verifyCopy, type VerifyCopy } from '@/lib/maison-verify-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, StatStrip } from './motion'
import { fmtDate, fmtDateTime } from './format'
import KycCapture from './KycCapture'
import { kycCaptureCopy } from '@/lib/kyc-capture-copy'

type Tone = 'live' | 'warn' | 'down' | 'accent' | undefined
const kycTone = (state: KycState | undefined): Tone => state === 'approved' ? 'live' : state === 'rejected' || state === 'expired' ? 'down' : state === 'needs_information' ? 'warn' : state && state !== 'not_started' ? 'accent' : undefined
const decisionTone: Record<EligibilityDecision, Tone> = { eligible: 'live', browse_only: 'accent', manual_review: 'warn', ineligible: 'down' }
/** Signal bars on the access meter — how much of the product range this decision opens. */
const DECISION_LEVEL: Record<EligibilityDecision, number> = { ineligible: 1, manual_review: 2, browse_only: 3, eligible: 4 }
const BANDS: RiskBand[] = ['conservative', 'balanced', 'growth', 'aggressive']
/** Display-only mirror of the server's 2026.1 score bands (see 接口需求-F1b · F1b-4); the band itself always comes from the server. */
const BAND_EDGES = [0, 30, 55, 80, 100]
const BASE_SCOPES = ['default', 'trading', 'basket', 'prediction']

/** 404 on a per-scope read means "never evaluated", not a failure. */
async function orNull<T>(pending: Promise<ApiResult<T>>): Promise<ApiResult<T | null>> {
  const result = await pending
  return !result.ok && result.error.status === 404 ? { ok: true, data: null } : result
}

const scopeLabel = (c: VerifyCopy, scope: string) => (c.scopes as Record<string, string>)[scope] ?? scope
const shortId = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))

function ErrorBlock({ error, retry }: { error: ApiError; retry: () => void }) {
  const { locale } = useI18n()
  const common = marketCopy[locale].common
  return <StateBlock tone="error" title={common.errorGeneric} body={<span className={s.mono}>{error.status || '—'} · {error.code}</span>} retry={retry} retryLabel={common.retry} />
}

function Hero({ kicker, a, b, lede, children }: { kicker: string; a: string; b: string; lede: string; children?: ReactNode }) {
  return <header className={s.hero}>
    <p className={s.kicker}>{kicker}</p>
    <h1 className={s.display}>{a} <em>{b}</em></h1>
    <p className={s.lede}>{lede}</p>
    {children}
  </header>
}

function Signal({ decision }: { decision: EligibilityDecision | null }) {
  const level = decision ? DECISION_LEVEL[decision] : 0
  return <span className={s.signal} data-tone={decision ? decisionTone[decision] : undefined} aria-hidden="true">
    {[1, 2, 3, 4].map((bar) => <i key={bar} data-on={bar <= level} />)}
  </span>
}

function Dots({ value, of = 5 }: { value: number | undefined; of?: number }) {
  return <span className={s.scale} aria-hidden="true">{Array.from({ length: of }, (_, index) => <i key={index} data-on={value !== undefined && index < value} />)}</span>
}

/** Localised question text for the known questionnaire version; anything else keeps the server's wording. */
function questionText(c: VerifyCopy, version: string | undefined, question: RiskQuestion) {
  const local = version === RISK_COPY_VERSION ? (c.questions as Record<string, { prompt: string; options: string[] }>)[question.key] : undefined
  return local && local.options.length === question.options.length ? { prompt: local.prompt, options: local.options, local: true } : { prompt: question.prompt, options: question.options, local: false }
}

/* ───────────────────────── /profile/verification ───────────────────────── */

/** `/profile/verification` — the investor credential: identity, access and risk on one card, then each record and what it allows. */
export function VerificationCenterScreen() {
  const { locale } = useI18n()
  const c = verifyCopy[locale]
  const t = c.center
  const session = useQuery('verify:session', getSessionInfo, { staleTime: 60_000 })
  const kyc = useQuery('verify:kyc', getKyc, { staleTime: 20_000 })
  const elig = useQuery('verify:elig:default', () => orNull(getEligibility('default')), { staleTime: 20_000 })
  const risk = useQuery('verify:risk', getRiskProfile, { staleTime: 30_000 })

  const kycState: KycState | undefined = kyc.data === undefined ? undefined : kyc.data?.state ?? 'not_started'
  const decision = elig.data === undefined ? undefined : elig.data?.decision ?? null
  const profile = risk.data
  const done = { kyc: kycState === 'approved', eligibility: decision === 'eligible', risk: Boolean(profile && !profile.stale) }
  const count = Object.values(done).filter(Boolean).length
  const loaded = kycState !== undefined && decision !== undefined && profile !== undefined
  const next = !loaded ? undefined
    : !done.kyc ? { body: t.nextKyc, path: '/profile/verification/kyc' }
    : !done.eligibility ? { body: t.nextEligibility, path: '/profile/verification/eligibility' }
    : !done.risk ? { body: profile ? t.nextRiskStale : t.nextRisk, path: '/profile/verification/risk-profile' }
    : null
  const label = session.data?.accountLabel?.trim() || t.holder
  const accessTitle = decision === undefined ? (elig.error ? c.common.unknown : '…') : decision ? c.decisions[decision].title : c.notAssessed.title
  const firstError = kyc.error && kyc.data === undefined ? { error: kyc.error, retry: kyc.refetch }
    : elig.error && elig.data === undefined ? { error: elig.error, retry: elig.refetch }
    : risk.error && risk.data === undefined ? { error: risk.error, retry: risk.refetch } : null

  const kycCase = kyc.data
  const kycMeta = !kycCase ? t.meta.notStarted
    : kycCase.decidedAt ? fill(t.meta.decided, { t: fmtDate(kycCase.decidedAt, locale) })
    : kycCase.submittedAt ? fill(t.meta.submitted, { t: fmtDate(kycCase.submittedAt, locale) })
    : fill(t.meta.started, { t: fmtDate(kycCase.createdAt, locale) })
  const steps: { key: 'kyc' | 'eligibility' | 'risk'; path: string; Icon: typeof Fingerprint; badge: ReactNode; meta: ReactNode; loading: boolean; failed: boolean }[] = [
    { key: 'kyc', path: '/profile/verification/kyc', Icon: Fingerprint, loading: kyc.data === undefined && !kyc.error, failed: Boolean(kyc.error && kyc.data === undefined),
      badge: kycState && <span className={s.badge} data-tone={kycTone(kycState)}>{c.kyc[kycState].title}</span>, meta: kycMeta },
    { key: 'eligibility', path: '/profile/verification/eligibility', Icon: Scale, loading: elig.data === undefined && !elig.error, failed: Boolean(elig.error && elig.data === undefined),
      badge: decision !== undefined && <span className={s.badge} data-tone={decision ? decisionTone[decision] : undefined}>{decision ? c.decisions[decision].title : c.notAssessed.title}</span>,
      meta: elig.data ? fill(t.meta.checked, { t: fmtDate(elig.data.decidedAt, locale) }) : t.meta.notStarted },
    { key: 'risk', path: '/profile/verification/risk-profile', Icon: Gauge, loading: risk.data === undefined && !risk.error, failed: Boolean(risk.error && risk.data === undefined),
      badge: profile !== undefined && <span className={s.badge} data-tone={!profile ? undefined : profile.stale ? 'warn' : 'live'}>{!profile ? t.meta.notStarted : profile.stale ? c.kyc.expired.title : c.bands[profile.band].title}</span>,
      meta: profile ? fill(t.meta.validUntil, { t: fmtDate(profile.expiresAt, locale) }) : t.meta.notStarted },
  ]

  return <MaisonPage page="verification" topbar={<RwaTopbar screen="kyc" template="T-Child" l1="back" title={t.kicker} onBack={() => backOr('/profile')} />}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />

    <Lacquer className={s.credential} aria-live="polite">
      <i className={s.guilloche} data-foil={done.eligibility && done.kyc} aria-hidden="true" />
      <div className={s.credTop}>
        <span className={s.kicker}>{t.card}</span>
        <span className={s.credRing} style={{ ['--p' as string]: count / 3 } as CSSProperties} role="img" aria-label={fill(t.progress, { n: count })}>
          <b className={s.num}>{loaded ? count : '·'}<small>/3</small></b>
        </span>
      </div>
      <span className={s.credChip} aria-hidden="true"><i /><i /><i /></span>
      <div className={s.credMain}>
        <small>{t.access}</small>
        <b>{accessTitle}</b>
        <Signal decision={decision ?? null} />
      </div>
      <StatStrip fit items={[
        { label: t.identity, value: kycState ? c.kyc[kycState].title : kyc.error ? c.common.unknown : '…', tone: kycState === 'approved' ? 'up' : kycState === 'rejected' || kycState === 'expired' ? 'down' : undefined },
        { label: t.access, value: decision === undefined ? (elig.error ? c.common.unknown : '…') : decision ? c.decisions[decision].title : c.common.none, tone: decision === 'eligible' ? 'up' : decision === 'ineligible' ? 'down' : undefined },
        { label: t.risk, value: profile === undefined ? (risk.error ? c.common.unknown : '…') : profile ? c.bands[profile.band].title : c.common.none, tone: profile && !profile.stale ? 'up' : undefined },
      ]} />
      <p className={s.credFoot}>
        <span dir="auto">{label}</span>
        {session.data && <span className={s.mono}>•••• {session.data.userId.slice(-4)}</span>}
        {elig.data && <span className={s.mono}>{fill(t.policy, { v: elig.data.policyVersion })}</span>}
      </p>
    </Lacquer>

    {firstError && <div style={{ marginTop: 12 }}><ErrorBlock error={firstError.error} retry={firstError.retry} /></div>}

    {next === null ? <div className={s.notice} data-tone="info" role="status"><BadgeCheck size={16} /><span>{t.allSet}</span></div>
      : next && <button type="button" className={s.nextStep} onClick={() => openPath(next.path)}>
        <span><small>{t.next}</small><b>{next.body}</b></span>
        <span className={s.nextGo}>{t.open}<ChevronRight size={15} /></span>
      </button>}

    <SectionHead index="01" title={t.steps} note={t.stepsNote} />
    <ol className={s.stepList}>
      {steps.map(({ key, path, Icon, badge, meta, loading, failed }, index) => <li key={key}>
        <button type="button" className={s.stepCard} data-done={done[key]} onClick={() => openPath(path)}>
          <span className={s.stepNum} aria-hidden="true">{done[key] ? <Check size={14} strokeWidth={2.4} /> : String(index + 1).padStart(2, '0')}</span>
          <span className={s.stepMain}>
            <b><Icon size={14} strokeWidth={1.8} aria-hidden="true" />{t.stepItems[key].title}</b>
            <small>{key === 'kyc' ? kycCaptureCopy[locale].flow : t.stepItems[key].body}</small>
            <span className={s.stepMeta}>{loading ? '…' : failed ? c.common.unknown : meta}</span>
          </span>
          <span className={s.stepEnd}>{failed ? <span className={s.badge} data-tone="down">{c.common.unknown}</span> : badge}<ChevronRight size={16} className={s.chev} /></span>
        </button>
      </li>)}
    </ol>

    <SectionHead index="02" title={t.allows} note={t.allowsNote} />
    <ul className={s.list} style={{ borderTop: 0 }}>
      {([['browse', Globe, 'yes'], ['invest', ShieldCheck, decision === undefined ? null : decision === 'eligible' ? 'yes' : 'needs'], ['hold', Lock, 'unaffected']] as const).map(([key, Icon, state]) => <li key={key}>
        <div className={s.row} data-static="true">
          <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
          <span className={s.rowMain}>
            <b className={s.clamp2}>{t.allowItems[key].title}</b><small className={s.clamp2}>{t.allowItems[key].body}</small>
            <span className={s.allowState}>{state ? <span className={s.badge} data-tone={state === 'yes' ? 'live' : state === 'needs' ? 'warn' : 'accent'}>{t.allowStates[state]}</span> : '…'}</span>
          </span>
        </div>
      </li>)}
    </ul>

    <SectionHead index="03" title={t.privacy} note={t.privacyNote} />
    <ol className={s.notes}>{t.privacyItems.map((item, index) => <li key={item}>{index === 0 ? kycCaptureCopy[locale].privacy : item}</li>)}</ol>
  </MaisonPage>
}

/* ───────────────────────── /profile/verification/kyc ───────────────────────── */

type KycNote = 'unavailable' | 'insecure' | 'already' | { failed: ApiError } | null

/** Verification uses in-app capture when the API enables it, otherwise the hosted Didit flow. */
export function KycScreen() {
  const { locale } = useI18n()
  const c = verifyCopy[locale]
  const t = c.kycPage
  const kyc = useQuery('verify:kyc', getKyc, { staleTime: 15_000, pollInterval: 15_000 })
  const captureConfig = useQuery('verify:capture-config', getKycCaptureConfig, { staleTime: 60_000 })
  const [capturing, setCapturing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<KycNote>(null)
  const topbar = <RwaTopbar screen="kyc" template="T-Child" l1="back" title={t.card} onBack={() => backOr('/profile/verification')} />

  if (kyc.error && kyc.data === undefined) return <MaisonPage page="kyc" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={kycCaptureCopy[locale].intro} />
    <ErrorBlock error={kyc.error} retry={kyc.refetch} />
  </MaisonPage>

  const record: KycCase | null | undefined = kyc.data
  const state: KycState | undefined = record === undefined ? undefined : record?.state ?? 'not_started'
  const action = state && state !== 'approved' && state !== 'submitted' ? t.actions[state] : null
  const stage = !record ? 0 : record.decidedAt ? 3 : record.submittedAt ? 2 : 1
  const markTone = state === 'approved' ? 'up' : state === 'needs_information' ? 'warn' : state === 'rejected' || state === 'expired' ? 'down' : state === 'submitted' || state === 'in_progress' ? 'pending' : undefined
  const MarkIcon = state === 'approved' ? BadgeCheck : state === 'rejected' || state === 'expired' ? ShieldX : state === 'submitted' ? Hourglass : state === 'needs_information' ? AlertTriangle : Fingerprint
  const reason = record?.reasonCode ? t.reasonCodes[record.reasonCode] : undefined
  const stamps = [record?.createdAt, record?.submittedAt, record?.decidedAt]

  // In-app capture only when the API offers it; an API without the endpoint (404) or with it
  // switched off keeps the hosted Didit flow, so verification is never blocked.
  const captureMissing = captureConfig.error?.status === 404
  const nativeCapture = captureConfig.data?.enabled === true
  const hosted = captureMissing || captureConfig.data?.enabled === false
  const startHosted = async () => {
    if (busy) return
    setBusy(true)
    setNote(null)
    const result = await createKycSession(locale)
    if (result.ok) {
      invalidate(['verify:', 'account:kyc'])
      let secure = false
      try { secure = new URL(result.data.verificationUrl).protocol === 'https:' } catch { secure = false }
      if (secure) { window.location.assign(result.data.verificationUrl); return }
      setNote('insecure')
    } else if (result.error.status === 503) setNote('unavailable')
    else if (result.error.status === 409) { setNote('already'); invalidate(['verify:', 'account:kyc']) }
    else setNote({ failed: result.error })
    setBusy(false)
  }

  if (capturing) return <MaisonPage page="kyc" topbar={topbar}><KycCapture onClose={() => setCapturing(false)} onComplete={() => { setCapturing(false); void invalidate(['verify:', 'account:kyc']) }} /></MaisonPage>

  return <MaisonPage page="kyc" cta={Boolean(action)} topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={kycCaptureCopy[locale].intro} />

    <Lacquer aria-live="polite">
      <i className={s.guilloche} data-foil={state === 'approved'} aria-hidden="true" />
      {!state ? <Skeleton rows={3} /> : <>
        <div className={s.sealHead}>
          <span className={s.statusMark} data-tone={markTone}><MarkIcon size={24} strokeWidth={1.5} /></span>
          <div>
            <span className={s.kicker}>{t.card}</span>
            <b className={s.sealTitle}>{c.kyc[state].title}</b>
            <p className={s.plateLine}>{c.kyc[state].body}</p>
          </div>
        </div>
        <ol className={s.rail} data-n="3" style={{ ['--p' as string]: Math.max(0, stage - 1) / 2 } as CSSProperties} aria-label={t.card}>
          {t.stages.map((name, index) => <li key={name} data-state={index < stage - 1 || (index === stage - 1 && stage === 3) ? 'done' : index === stage - 1 || (stage === 0 && index === 0) ? 'now' : 'next'} aria-current={index === Math.max(0, stage - 1) ? 'step' : undefined}>
            <i aria-hidden="true" /><span>{name}</span>
            <small className={s.num}>{stamps[index] ? fmtDate(stamps[index], locale) : '—'}</small>
          </li>)}
        </ol>
      </>}
    </Lacquer>

    {record && <dl className={s.summary} style={{ marginTop: 14 }}>
      <div><dt>{t.provider}</dt><dd className={s.mono}>{record.provider}</dd></div>
      <div><dt>{t.caseRef}</dt><dd className={s.mono}>{shortId(record.id)}</dd></div>
      {record.decidedAt && <div><dt>{t.decided}</dt><dd>{fmtDateTime(record.decidedAt, locale)}</dd></div>}
      <div><dt>{t.expires}</dt><dd>{record.expiresAt ? fmtDate(record.expiresAt, locale) : c.common.none}</dd></div>
      {record.reasonCode && <div><dt>{t.reason}</dt><dd>{reason ?? t.reasonRaw} <span className={s.srcTag}>{record.reasonCode}</span></dd></div>}
    </dl>}

    {captureConfig.error && !captureMissing && <ErrorBlock error={captureConfig.error} retry={captureConfig.refetch} />}
    {note === 'unavailable' && <div style={{ marginTop: 12 }}><StateBlock tone="unavailable" title={t.unavailableTitle} body={t.unavailableBody} /></div>}
    {note === 'insecure' && <div className={s.notice} data-tone="error" role="alert"><ShieldX size={16} /><span>{t.insecure}</span></div>}
    {note === 'already' && <div className={s.notice} data-tone="info" role="status"><BadgeCheck size={16} /><span>{t.already}</span></div>}
    {note && typeof note === 'object' && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{t.failed} <span className={s.mono}>{note.failed.status || '—'} · {note.failed.code}</span></span></div>}

    <div className={s.actionsRow}>
      <button type="button" className={s.ghost} data-size="s" onClick={() => void kyc.refetch()} disabled={kyc.loading} aria-busy={kyc.loading}>
        <RotateCw size={13} className={kyc.loading ? s.spin : undefined} />{kyc.loading ? c.common.refreshing : c.common.refresh}
      </button>
      {state === 'approved' && <button type="button" className={s.ghost} data-size="s" onClick={() => openPath('/profile/verification/eligibility')}><Scale size={13} />{t.toEligibility}</button>}
    </div>

    <SectionHead index="01" title={t.needs} note={t.needsNote} />
    <ul className={s.list} style={{ borderTop: 0 }}>
      {t.needItems.map((item, index) => { const Icon = [IdCard, Camera, UserRound][index]; return <li key={item.title}>
        <div className={s.row} data-static="true">
          <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
          <span className={s.rowMain}><b>{item.title}</b><small className={s.clamp2}>{item.body}</small></span>
        </div>
      </li> })}
    </ul>

    {action && <div className={s.stickyCta}>
      {hosted
        ? <button type="button" className={s.cta} onClick={() => void startHosted()} disabled={busy} aria-busy={busy}>
          <span>{busy ? t.opening : action}</span><span className={s.ctaIcon}>{busy ? <RotateCw size={17} /> : <ExternalLink size={17} />}</span>
        </button>
        : <button type="button" className={s.cta} onClick={() => setCapturing(true)} disabled={!nativeCapture}>
          <span>{action}</span><span className={s.ctaIcon}><ScanFace size={17} /></span>
        </button>}
    </div>}
  </MaisonPage>
}

/* ───────────────────────── /profile/verification/eligibility ───────────────────────── */

/** `/profile/verification/eligibility` — the policy decision, its evidence and reasons, and a per-product matrix. */
export function EligibilityScreen() {
  const { locale } = useI18n()
  const c = verifyCopy[locale]
  const t = c.elig
  const main = useQuery('verify:elig:default', () => orNull(getEligibility('default')), { staleTime: 20_000 })
  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000 })
  const extra = (products.data ?? []).filter(isListed).map((product) => product.assetClassId)
  const scopes = [...new Set([...BASE_SCOPES, ...extra])]
  const scopesReady = products.data !== undefined || Boolean(products.error)
  const matrix = useQuery(scopesReady ? `verify:elig:scopes:${scopes.join(',')}` : null, async (): Promise<ApiResult<Record<string, Eligibility | null>>> => {
    const results = await Promise.all(scopes.map((scope) => orNull(getEligibility(scope))))
    const failed = results.find((result) => !result.ok)
    if (failed && !failed.ok) return failed
    return { ok: true, data: Object.fromEntries(scopes.map((scope, index) => [scope, (results[index] as { ok: true; data: Eligibility | null }).data])) }
  }, { staleTime: 20_000 })
  const [checking, setChecking] = useState<string | null>(null)
  const [runError, setRunError] = useState<ApiError | null>(null)
  const topbar = <RwaTopbar screen="eligibility" title={t.kicker} onBack={() => backOr('/profile/verification')} />

  const current = main.data
  const recordedRegion = current?.evidenceReferences.region ?? undefined
  const evaluate = async (targets: string[], tag: string) => {
    if (checking) return
    setChecking(tag)
    setRunError(null)
    for (const scope of targets) {
      const region = matrix.data?.[scope]?.evidenceReferences.region ?? recordedRegion
      const result = await evaluateEligibility(scope, region ?? undefined)
      if (!result.ok) { setRunError(result.error); break }
    }
    invalidate('verify:elig')
    setChecking(null)
  }

  if (main.error && main.data === undefined) return <MaisonPage page="eligibility" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />
    <ErrorBlock error={main.error} retry={main.refetch} />
  </MaisonPage>

  const evidence = current?.evidenceReferences
  const reasons = (current?.reasonCodes ?? []) as string[]
  const reasonCopy = c.reasons as Record<string, { title: string; body: string; fix: string }>
  const fixPath = (code: string) => code === 'kyc_not_approved' ? '/profile/verification/kyc' : code === 'region_blocked' ? '/trust/access-and-regions' : '/profile/support'
  const screening = evidence ? (c.screening as Record<string, string>)[evidence.screeningState ?? 'none'] ?? evidence.screeningState : undefined
  const kycState = evidence?.kycState as KycState | null | undefined

  return <MaisonPage page="eligibility" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />

    <Lacquer aria-live="polite">
      <i className={s.guilloche} data-foil={current?.decision === 'eligible'} aria-hidden="true" />
      {current === undefined ? <Skeleton rows={3} /> : <>
        <div className={s.credTop}>
          <span className={s.kicker}>{t.card} · {scopeLabel(c, 'default')}</span>
          {current && <span className={s.srcTag}>{current.decision}</span>}
        </div>
        <div className={s.credMain}>
          <small>{t.level}</small>
          <b>{current ? c.decisions[current.decision].title : c.notAssessed.title}</b>
          <Signal decision={current?.decision ?? null} />
        </div>
        <p className={s.plateLine}>{current ? c.decisions[current.decision].body : c.notAssessed.body}</p>
        {current && <StatStrip fit items={[
          { label: t.identity, value: kycState ? c.kyc[kycState]?.title ?? kycState : c.kyc.not_started.title, tone: kycState === 'approved' ? 'up' : undefined },
          { label: t.screening, value: screening ?? c.common.none, tone: evidence?.screeningState === 'confirmed_match' || evidence?.screeningState === 'potential_match' ? 'down' : undefined },
          { label: t.region, value: evidence?.region ?? c.common.notRecorded },
        ]} />}
        {current && <p className={s.credFoot}><span className={s.mono}>{fill(t.policy, { v: current.policyVersion })}</span><span>{fill(t.decided, { t: fmtDateTime(current.decidedAt, locale) })}</span></p>}
      </>}
    </Lacquer>

    {runError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{t.runFailed} <span className={s.mono}>{runError.status || '—'} · {runError.code}</span></span></div>}
    <div className={s.actionsRow}>
      <button type="button" className={s.ghost} onClick={() => void evaluate(['default'], 'default')} disabled={Boolean(checking) || current === undefined} aria-busy={checking === 'default'}>
        <RotateCw size={14} className={checking === 'default' ? s.spin : undefined} />{checking === 'default' ? t.running : t.run}
      </button>
    </div>

    {current && <>
      <SectionHead index="01" title={t.why} note={t.whyNote} />
      {reasons.length === 0 ? <div className={s.notice} data-tone="info" role="status"><BadgeCheck size={16} /><span>{t.noReasons}</span></div>
        : <ul className={s.list} style={{ borderTop: 0 }}>{reasons.map((code) => { const copy = reasonCopy[code]; return <li key={code}>
          <button type="button" className={s.row} onClick={() => openPath(fixPath(code))}>
            <span className={s.logo} data-tone="warn"><AlertTriangle size={15} strokeWidth={1.8} /></span>
            <span className={s.rowMain}><b>{copy?.title ?? code}</b><small className={s.clamp2}>{copy?.body ?? code}</small></span>
            <span className={s.rowEnd}><span className={s.nextGo}>{copy?.fix ?? c.common.open}<ChevronRight size={15} /></span></span>
          </button>
        </li> })}</ul>}
    </>}

    <SectionHead index={current ? '02' : '01'} title={t.products} note={t.productsNote}
      action={matrix.data && <button type="button" className={s.link} onClick={() => void evaluate(scopes, 'all')} disabled={Boolean(checking)} aria-busy={checking === 'all'}>
        <RotateCw size={13} className={checking === 'all' ? s.spin : undefined} />{checking === 'all' ? t.running : t.recheckAll}
      </button>} />
    {matrix.error && !matrix.data ? <ErrorBlock error={matrix.error} retry={matrix.refetch} />
      : !matrix.data ? <Skeleton rows={4} />
      : <ul className={s.list} style={{ borderTop: 0 }}>{scopes.map((scope) => { const row = matrix.data?.[scope] ?? null; return <li key={scope}>
        <div className={s.row} data-static="true">
          <Signal decision={row?.decision ?? null} />
          <span className={s.rowMain}><b>{scopeLabel(c, scope)}</b><small>{row ? fill(t.checked, { t: fmtDate(row.decidedAt, locale) }) : <span className={s.mono}>{scope}</span>}</small></span>
          <span className={s.rowEnd}>
            {row ? <span className={s.badge} data-tone={decisionTone[row.decision]}>{c.decisions[row.decision].title}</span>
              : <button type="button" className={s.ghost} data-size="s" onClick={() => void evaluate([scope], scope)} disabled={Boolean(checking)} aria-busy={checking === scope}>
                {checking === scope ? <RotateCw size={12} className={s.spin} /> : null}{t.check}
              </button>}
          </span>
        </div>
      </li> })}</ul>}

    <SectionHead index={current ? '03' : '02'} title={t.how} note={t.howNote}
      action={<button type="button" className={s.link} onClick={() => openPath('/trust/access-and-regions')}>{t.regionsLink}<ChevronRight size={14} /></button>} />
    <ol className={s.notes}>{t.howItems.map((item) => <li key={item}>{item}</li>)}</ol>
    <p className={s.foot}><Info size={12} /><span>{c.center.allowsNote}</span></p>
  </MaisonPage>
}

/* ───────────────────────── /profile/verification/risk-profile ───────────────────────── */

type Answers = Record<string, number>
const draftKey = (version: string) => `rwa.risk-draft.${version}`
const readDraft = (version: string): Answers | null => { try { const raw = window.sessionStorage.getItem(draftKey(version)); return raw ? JSON.parse(raw) as Answers : null } catch { return null } }
/** `?q=1..n` is a question, `?q=review` the review step; anything else is the profile view. */
const parseStep = (query: string, total: number): number | null => {
  const q = queryParam(query, 'q')
  if (q === 'review') return total
  const n = Number(q)
  return Number.isInteger(n) && n >= 1 && n <= total ? n - 1 : null
}

function RiskGauge({ score, band, c }: { score: number; band: RiskBand; c: VerifyCopy }) {
  const point = (value: number, r: number) => { const angle = Math.PI * (1 - value / 100); return [100 + r * Math.cos(angle), 100 - r * Math.sin(angle)] as const }
  const arc = (from: number, to: number) => { const [x1, y1] = point(from + .8, 82); const [x2, y2] = point(to - .8, 82); return `M${x1.toFixed(2)} ${y1.toFixed(2)} A82 82 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}` }
  return <div className={s.gauge} dir="ltr">
    <svg viewBox="0 0 200 112" role="img" aria-label={`${c.risk.score} ${score} / 100 · ${c.bands[band].title}`}>
      {BANDS.map((name, index) => <path key={name} className={s.gaugeArc} data-band={name} data-on={name === band} d={arc(BAND_EDGES[index], BAND_EDGES[index + 1])} />)}
      {Array.from({ length: 21 }, (_, index) => { const [x1, y1] = point(index * 5, 70); const [x2, y2] = point(index * 5, index % 5 ? 67 : 64); return <line key={index} className={s.gaugeTick} x1={x1} y1={y1} x2={x2} y2={y2} /> })}
      <g className={s.gaugeNeedle} style={{ ['--v' as string]: score } as CSSProperties}>
        <line x1="100" y1="100" x2="34" y2="100" />
        <circle cx="100" cy="100" r="5" />
      </g>
    </svg>
    <div className={s.gaugeRead}><b className={s.num}>{score}</b><small className={s.num}>/ 100</small></div>
  </div>
}

/** `/profile/verification/risk-profile` — score gauge and answers; the questionnaire is step-addressable (`?q=`) with a device-local draft. */
export function RiskProfileScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const c = verifyCopy[locale]
  const t = c.risk
  const form = useQuery('verify:questionnaire', getRiskQuestionnaire, { staleTime: 300_000 })
  const risk = useQuery('verify:risk', getRiskProfile, { staleTime: 30_000 })
  const questions = form.data?.questions ?? []
  const total = questions.length
  const [step, setStep] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [removeError, setRemoveError] = useState(false)
  const submitting = useRef(false)
  const topbar = <RwaTopbar screen="risk-profile" title={t.kicker} onBack={() => backOr('/profile/verification')} />

  // The URL owns the step once the questionnaire is known (refresh / deep link / back keep it).
  // Keyed on the version string, not the object, so a background refetch never pulls the step back to a stale `?q=`.
  const loadedVersion = form.data?.version
  useEffect(() => {
    if (!loadedVersion) return
    const next = parseStep(query, total)
    setStep(next)
    if (next !== null) setAnswers((current) => Object.keys(current).length ? current : readDraft(loadedVersion) ?? {})
  }, [query, loadedVersion, total])

  const go = (next: number | null) => {
    setStep(next)
    setError(null)
    const url = new URL(window.location.href)
    if (next === null) url.searchParams.delete('q')
    else url.searchParams.set('q', next >= total ? 'review' : String(next + 1))
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    window.scrollTo({ top: 0 })
  }
  const begin = (questionnaire: RiskQuestionnaire, at = 0) => {
    const draft = readDraft(questionnaire.version)
    const previous = risk.data && risk.data.questionnaireVersion === questionnaire.version ? risk.data.answers : {}
    setAnswers((current) => Object.keys(current).length ? current : draft ?? previous)
    go(at)
  }
  const pick = (key: string, value: number) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    if (form.data) window.sessionStorage.setItem(draftKey(form.data.version), JSON.stringify(next))
  }
  const complete = questions.every((question) => Number.isInteger(answers[question.key]) && answers[question.key] >= 1 && answers[question.key] <= question.options.length)

  const submit = async () => {
    if (submitting.current || !complete || !form.data) return
    submitting.current = true
    setBusy(true)
    setError(null)
    const payload = Object.fromEntries(questions.map((question) => [question.key, answers[question.key]]))
    const result = await submitRiskProfile(payload)
    submitting.current = false
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    window.sessionStorage.removeItem(draftKey(form.data.version))
    setAnswers({})
    invalidate('verify:risk')
    go(null)
  }
  const remove = async () => {
    if (busy) return
    setBusy(true)
    setRemoveError(false)
    const result = await deleteRiskProfile()
    setBusy(false)
    if (!result.ok) { setRemoveError(true); return }
    setConfirming(false)
    invalidate('verify:risk')
  }

  if ((form.error && !form.data) || (risk.error && risk.data === undefined)) return <MaisonPage page="risk-profile" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />
    <ErrorBlock error={(risk.error && risk.data === undefined ? risk.error : form.error)!} retry={() => { void form.refetch(); void risk.refetch() }} />
  </MaisonPage>
  if (!form.data || risk.data === undefined) return <MaisonPage page="risk-profile" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />
    <Skeleton rows={5} />
  </MaisonPage>

  const version = form.data.version
  const profile: RiskProfile | null = risk.data

  /* Questionnaire */
  if (step !== null) {
    const reviewing = step >= total
    const question = questions[Math.min(step, total - 1)]
    const text = question && questionText(c, version, question)
    return <MaisonPage page="risk-profile" cta topbar={topbar}>
      <div className={s.qProgress} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(step, total)} aria-label={t.kicker}>
        {questions.map((item, index) => <i key={item.key} data-state={index < step ? 'done' : index === step ? 'now' : answers[item.key] ? 'answered' : 'next'} />)}
      </div>
      {!reviewing && text ? <>
        <header className={s.hero}>
          <p className={s.kicker}>{fill(t.question, { n: step + 1, total })} · {(t.topics as Record<string, string>)[question.key] ?? question.key}</p>
          <h1 className={s.titleL} dir={text.local ? undefined : 'auto'}>{text.prompt}</h1>
          {!text.local && locale !== 'en' && <p className={s.foot}><span className={s.srcTag}>{t.serverText}</span></p>}
        </header>
        <ul className={s.pickList} role="radiogroup" aria-label={text.prompt}>
          {text.options.map((option, index) => <li key={option}>
            <button type="button" role="radio" className={s.pick} aria-checked={answers[question.key] === index + 1} onClick={() => pick(question.key, index + 1)}>
              <i aria-hidden="true" />
              <span><b dir={text.local ? undefined : 'auto'}>{option}</b></span>
              <Dots value={index + 1} of={text.options.length} />
            </button>
          </li>)}
        </ul>
        <p className={s.foot}><Lock size={11} /><span>{t.draft}</span><button type="button" className={s.link} onClick={() => go(null)}>{t.exit}</button></p>
        <div className={s.stickyCta}>
          <div className={s.ctaPair}>
            <button type="button" className={s.ghost} onClick={() => go(step === 0 ? null : step - 1)} aria-label={step === 0 ? t.exit : t.back}><ArrowLeft size={16} className={s.flipRtl} /></button>
            <button type="button" className={s.cta} disabled={!answers[question.key]} onClick={() => go(step + 1)}>
              <span>{step === total - 1 ? t.review : t.next}</span><span className={s.ctaIcon}><ChevronRight size={17} /></span>
            </button>
          </div>
        </div>
      </> : <>
        <header className={s.hero}>
          <p className={s.kicker}>{t.review}</p>
          <h1 className={s.titleL}>{t.reviewTitle}</h1>
          <p className={s.lede}>{t.reviewNote}</p>
        </header>
        <AnswerList c={c} version={version} questions={questions} answers={answers} onEdit={(index) => go(index)} />
        {!complete && <div className={s.notice} role="status"><Info size={16} /><span>{t.incomplete}</span></div>}
        {error && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{t.submitFailed} <span className={s.mono}>{error.status || '—'} · {error.code}</span></span></div>}
        <p className={s.foot}><Info size={12} /><span>{t.selfAssessment}</span></p>
        <div className={s.stickyCta}>
          <div className={s.ctaPair}>
            <button type="button" className={s.ghost} onClick={() => go(total - 1)} aria-label={t.back}><ArrowLeft size={16} className={s.flipRtl} /></button>
            <button type="button" className={s.cta} disabled={!complete || busy} aria-busy={busy} onClick={() => void submit()}>
              <span>{busy ? t.submitting : t.submit}</span><span className={s.ctaIcon}>{busy ? <RotateCw size={17} /> : <Check size={17} />}</span>
            </button>
          </div>
        </div>
      </>}
    </MaisonPage>
  }

  /* No profile yet */
  if (!profile) return <MaisonPage page="risk-profile" cta topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />
    <Lacquer>
      <i className={s.guilloche} aria-hidden="true" />
      <div className={s.gaugeGhost} aria-hidden="true"><Gauge size={30} strokeWidth={1.2} /></div>
      <span className={s.kicker}>{t.card}</span>
      <b className={s.sealTitle}>{t.introTitle}</b>
      <p className={s.plateLine}>{t.introBody}</p>
      <p className={s.credFoot}><span className={s.mono}>{fill(t.version, { v: version })}</span><span><b className={s.num}>{total}</b> · {t.covers}</span></p>
    </Lacquer>
    <SectionHead index="01" title={t.covers} note={t.coversNote} />
    <ul className={s.topicGrid}>{questions.map((question, index) => <li key={question.key}><small className={s.mono}>{String(index + 1).padStart(2, '0')}</small><b>{(t.topics as Record<string, string>)[question.key] ?? question.key}</b></li>)}</ul>
    <SectionHead index="02" title={t.bandsTitle} note={t.bandsNote} />
    <BandLegend c={c} />
    <p className={s.foot}><Info size={12} /><span>{t.selfAssessment}</span></p>
    <div className={s.stickyCta}>
      <button type="button" className={s.cta} onClick={() => begin(form.data!)}><span>{t.start}</span><span className={s.ctaIcon}><ChevronRight size={17} /></span></button>
    </div>
  </MaisonPage>

  /* Result */
  const outdated = profile.questionnaireVersion !== version
  const left = daysUntil(profile.expiresAt)
  return <MaisonPage page="risk-profile" topbar={topbar}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />
    <Lacquer aria-live="polite">
      <i className={s.guilloche} aria-hidden="true" />
      <div className={s.credTop}>
        <span className={s.kicker}>{t.card}</span>
        <span className={s.badge} data-tone={profile.stale ? 'warn' : 'live'}>{profile.stale ? c.kyc.expired.title : fill(t.version, { v: profile.questionnaireVersion })}</span>
      </div>
      <RiskGauge score={profile.score} band={profile.band} c={c} />
      <div className={s.gaugeBand}><b>{c.bands[profile.band].title}</b><small>{c.bands[profile.band].body}</small></div>
      <StatStrip fit items={[
        { label: t.validUntil, value: fmtDate(profile.expiresAt, locale), tone: profile.stale ? 'down' : undefined },
        { label: t.daysLeft, value: fill(t.days, { n: left }), tone: profile.stale ? 'down' : left > 30 ? 'up' : undefined },
      ]} />
      <p className={s.credFoot}><span>{t.completed} · {fmtDate(profile.completedAt, locale)}</span><span className={s.mono}>{t.score} {profile.score}/100</span></p>
    </Lacquer>

    {(profile.stale || outdated) && <div className={s.notice} data-tone="error" role="status">
      <AlertTriangle size={16} />
      <span><b>{profile.stale ? t.staleTitle : t.versionTitle}</b> · {profile.stale ? t.staleBody : fill(t.versionBody, { v: profile.questionnaireVersion })}</span>
    </div>}
    <div className={s.actionsRow}>
      <button type="button" className={profile.stale || outdated ? s.cta : s.ghost} style={profile.stale || outdated ? { flex: 1 } : undefined} onClick={() => begin(form.data!)}>
        {profile.stale || outdated ? <><span>{t.retake}</span><span className={s.ctaIcon}><RotateCw size={17} /></span></> : <><RotateCw size={14} />{t.retake}</>}
      </button>
    </div>

    <SectionHead index="01" title={t.answers} note={outdated ? undefined : t.answersNote} />
    <AnswerList c={c} version={outdated ? undefined : version} questions={outdated ? [] : questions} answers={profile.answers} onEdit={outdated ? undefined : (index) => begin(form.data!, index)} />

    <SectionHead index="02" title={t.bandsTitle} note={t.bandsNote} />
    <BandLegend c={c} current={profile.band} />
    <p className={s.foot}><Info size={12} /><span>{t.selfAssessment}</span></p>

    {confirming ? <section className={s.confirm} role="alertdialog" aria-labelledby="risk-remove-title" aria-describedby="risk-remove-body">
      <h2 id="risk-remove-title">{t.removeTitle}</h2>
      <p id="risk-remove-body">{t.removeBody}</p>
      {removeError && <div className={s.notice} data-tone="error" role="alert" style={{ margin: '0 0 12px' }}><AlertTriangle size={16} /><span>{t.removeFailed}</span></div>}
      <div className={s.ctaPair}>
        <button type="button" className={s.ghost} onClick={() => { setConfirming(false); setRemoveError(false) }} disabled={busy}>{t.keep}</button>
        <button type="button" className={s.ghost} data-tone="down" onClick={() => void remove()} disabled={busy} aria-busy={busy}>
          {busy ? <RotateCw size={14} className={s.spin} /> : <Trash2 size={14} />}{busy ? t.removing : t.confirmRemove}
        </button>
      </div>
    </section>
      : <div className={s.actions}><button type="button" className={s.link} style={{ justifySelf: 'center', color: 'var(--m-down)' }} onClick={() => setConfirming(true)}><Trash2 size={13} />{t.remove}</button></div>}
  </MaisonPage>
}

/** Answers as prompt → chosen option with a 5-step scale. Without a matching questionnaire the raw key/value is shown. */
function AnswerList({ c, version, questions, answers, onEdit }: { c: VerifyCopy; version: string | undefined; questions: RiskQuestion[]; answers: Answers; onEdit?: (index: number) => void }) {
  const rows = questions.length ? questions.map((question, index) => { const text = questionText(c, version, question); return { key: question.key, index, prompt: text.prompt, value: answers[question.key], label: answers[question.key] ? text.options[answers[question.key] - 1] : undefined, of: question.options.length, local: text.local } })
    : Object.entries(answers).map(([key, value], index) => ({ key, index, prompt: (c.risk.topics as Record<string, string>)[key] ?? key, value, label: String(value), of: 5, local: true }))
  return <ul className={s.list} style={{ borderTop: 0 }}>{rows.map((row) => { const body = <>
    <span className={s.logo}><small className={s.mono}>{String(row.index + 1).padStart(2, '0')}</small></span>
    <span className={s.rowMain}><small className={s.clamp2} dir={row.local ? undefined : 'auto'}>{row.prompt}</small><b dir={row.local ? undefined : 'auto'}>{row.label ?? c.risk.unanswered}</b></span>
    <span className={s.rowEnd}><Dots value={row.value} of={row.of} />{onEdit && <Pencil size={13} className={s.chev} aria-label={c.risk.edit} />}</span>
  </>; return <li key={row.key}>
    {onEdit ? <button type="button" className={s.row} data-answer onClick={() => onEdit(row.index)}>{body}</button> : <div className={s.row} data-static="true" data-answer>{body}</div>}
  </li> })}</ul>
}

function BandLegend({ c, current }: { c: VerifyCopy; current?: RiskBand }) {
  return <ul className={s.list} style={{ borderTop: 0 }}>{BANDS.map((band, index) => <li key={band}>
    <div className={s.row} data-static="true" data-current={band === current}>
      <span className={s.bandChip} data-band={band} aria-hidden="true" />
      <span className={s.rowMain}><b>{c.bands[band].title}</b><small className={s.clamp2}>{c.bands[band].body}</small></span>
      <span className={s.rowEnd}>
        {band === current && <span className={s.badge} data-tone="accent">{c.risk.yours}</span>}
        <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 11 }}>{BAND_EDGES[index]}–{index === BANDS.length - 1 ? 100 : BAND_EDGES[index + 1] - 1}</span>
      </span>
    </div>
  </li>)}</ul>
}
