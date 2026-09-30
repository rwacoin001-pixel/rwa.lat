'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleCheck,
  CircleX,
  Clock3,
  FileCheck2,
  FileText,
  Headphones,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  CircleHelp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import { TiltedSurface } from './motion-effects'
import {
  evaluateEligibility,
  getEligibility,
  getKycStatus,
  ELIGIBILITY_LABELS,
  ELIGIBILITY_TONE,
  KYC_STATE_LABELS,
  KYC_STATE_TONE,
  REASON_CODE_LABELS,
  type EligibilityDecision,
  type EligibilityView,
  type KycCaseState,
  type KycCaseView,
} from '@/lib/compliance-data'

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function isUnauthorized(error: unknown): boolean {
  const status = errorStatus(error)
  const message = error instanceof Error ? error.message : ''
  return status === 401 || /(?:status code\s*401|unauthori[sz]ed|session.*(?:expired|invalid|required)|登录状态.*(?:失效|过期|需要))/i.test(message)
}

type ComplianceErrorKind = 'session' | 'kyc' | 'network' | 'generic'

function errorKind(error: unknown): ComplianceErrorKind {
  const status = errorStatus(error)
  const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string' ? String((error as { code: string }).code) : ''
  const message = error instanceof Error ? error.message : ''
  // Some deployments use 401 for a valid session that is not yet allowed to
  // read a compliance projection. Prefer the domain code/message over the
  // transport status so that this is not mislabeled as an expired session.
  if (/kyc[_ -]?(required|not[_ -]?approved|missing)|identity[_ -]?verification/i.test(`${code} ${message}`)) return 'kyc'
  if (isUnauthorized(error)) return 'session'
  if (status === 403 && /kyc|eligib|verif|compliance/i.test(`${code} ${message}`)) return 'kyc'
  if (status === 0) return 'network'
  return 'generic'
}

function requestError(error: unknown): string {
  const kind = errorKind(error)
  if (kind === 'session') return '登录状态已失效，请重新登录后重试。'
  if (kind === 'kyc') return '完成身份认证后才能读取这项资格状态。'
  if (kind === 'network') return '网络连接失败，请检查网络后重试。'
  return '暂时无法加载，请稍后重试。'
}

function reasonLabel(code?: string | null): string {
  if (!code) return '暂无额外原因码'
  return REASON_CODE_LABELS[code] ?? code
}

function ComplianceError({ message, kind = 'generic', onRetry, onAction, actionLabel }: { message: string; kind?: ComplianceErrorKind; onRetry: () => void; onAction?: () => void; actionLabel?: string }) {
  const title = kind === 'session' ? '登录状态已失效' : kind === 'kyc' ? '需要完成身份认证' : kind === 'network' ? '网络连接失败' : '暂时无法加载合规状态'
  return (
    <div className="compliance-empty compliance-empty--error" role="alert">
      <AlertTriangle size={24} />
      <b>{title}</b>
      <span>{message}</span>
      <div className="compliance-error-actions">
        <button type="button" className="compliance-action" onClick={onRetry}><RotateCw size={15} /> 重试</button>
        {onAction ? <button type="button" className="compliance-action compliance-action--secondary" onClick={onAction}>{actionLabel ?? '继续'} <ArrowRight size={15} /></button> : null}
      </div>
    </div>
  )
}

function ComplianceSkeleton({ kind }: { kind: 'kyc' | 'eligibility' }) {
  return (
    <div className={`compliance-skeleton compliance-skeleton--${kind}`} aria-label="正在加载">
      <div className="compliance-skel compliance-skel--bar" />
      <div className="compliance-skel compliance-skel--hero" />
      <div className="compliance-skel compliance-skel--row" />
      <div className="compliance-skel compliance-skel--row compliance-skel--short" />
    </div>
  )
}

function KycStatusBadge({ state }: { state: KycCaseState }) {
  const tone = KYC_STATE_TONE[state]
  return <span className={`compliance-badge is-${tone}`}>{KYC_STATE_LABELS[state]}</span>
}

function KycStepper({ state }: { state: KycCaseState }) {
  const firstActive = state === 'not_started' || state === 'in_progress' || state === 'needs_information'
  const secondActive = state === 'submitted'
  const resultActive = state === 'approved' || state === 'rejected' || state === 'expired'
  return (
    <div className="kyc-stepper" aria-label="身份认证步骤">
      <span className={firstActive ? 'is-active' : 'is-complete'}><b>1</b><small>提交资料</small></span>
      <i className={secondActive || resultActive ? 'is-complete' : ''} aria-hidden="true" />
      <span className={secondActive ? 'is-active' : resultActive || state === 'needs_information' ? 'is-complete' : ''}><b>2</b><small>审核</small></span>
      <i className={resultActive ? 'is-complete' : ''} aria-hidden="true" />
      <span className={resultActive ? 'is-active' : ''}><b>3</b><small>结果</small></span>
    </div>
  )
}

function KycStateMeta({ reason, next, eta }: { reason: string; next: string; eta: string }) {
  return (
    <div className="kyc-state-meta">
      <div><small>原因</small><b>{reason}</b></div>
      <div><small>下一步</small><b>{next}</b></div>
      <div><small>预计时间</small><b>{eta}</b></div>
    </div>
  )
}

function KycStateContent({ state, kycCase, go, locale }: { state: KycCaseState; kycCase: KycCaseView | null; go: (screen: RwaScreen) => void; locale: string }) {
  const openKyc = () => go('kyc')
  const reason = reasonLabel(kycCase?.reasonCode)
  const commonProps = { reason, next: '', eta: '' }

  if (state === 'not_started') {
    return (
      <>
        <div className="kyc-state-card is-mute">
          <span className="kyc-state-icon"><FileCheck2 size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>完成身份认证，解锁合规产品</h1>
          <p>认证用于确认身份和地区资格。准备好政府签发的有效证件即可开始。</p>
          <button type="button" className="compliance-primary" onClick={openKyc}>开始认证 <ArrowRight size={17} /></button>
        </div>
        <KycStateMeta {...commonProps} reason="尚未提交身份材料" next="准备并提交身份材料" eta="提交流程约需 5–10 分钟" />
      </>
    )
  }

  if (state === 'in_progress') {
    return (
      <>
        <div className="kyc-state-card is-info">
          <span className="kyc-state-icon"><FileCheck2 size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>认证还没有完成</h1>
          <p>你已经开始认证流程，返回后可以从上次停留的位置继续。</p>
          <div className="kyc-progress-meter is-indeterminate"><span /></div>
          <small className="kyc-progress-caption">资料提交 · 进行中</small>
          <button type="button" className="compliance-primary" onClick={openKyc}>继续认证 <ArrowRight size={17} /></button>
        </div>
        <KycStateMeta {...commonProps} reason="认证流程尚未完成" next="完成剩余资料并提交" eta="完成后立即进入审核" />
      </>
    )
  }

  if (state === 'submitted') {
    return (
      <>
        <div className="kyc-state-card is-info">
          <span className="kyc-state-icon"><Clock3 size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>审核中</h1>
          <p>资料已提交，支持团队正在进行身份与合规检查。请不要重复提交相同材料。</p>
          <div className="kyc-review-timeline" aria-label="审核进度">
            <span className="is-complete"><i /><b>资料已提交</b></span>
            <span className="is-active"><i /><b>审核中</b></span>
            <span><i /><b>结果通知</b></span>
          </div>
        </div>
        <KycStateMeta {...commonProps} reason="材料已提交，等待合规审核" next="等待审核结果" eta="预计 1–2 个工作日" />
      </>
    )
  }

  if (state === 'needs_information') {
    return (
      <>
        <div className="kyc-state-card is-warn">
          <span className="kyc-state-icon"><ShieldAlert size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>需要补充材料</h1>
          <p>审核暂时无法继续。请打开认证流程，查看缺少或需要重新拍摄的材料。</p>
          <div className="kyc-warning-note"><AlertTriangle size={17} /><span>{reason === '暂无额外原因码' ? '认证流程中会显示具体缺少的材料。' : reason}</span></div>
          <button type="button" className="compliance-primary" onClick={openKyc}>补充材料 <ArrowRight size={17} /></button>
        </div>
        <KycStateMeta {...commonProps} reason={reason} next="补充或重新上传材料" eta="补件后重新进入审核" />
      </>
    )
  }

  if (state === 'approved') {
    return (
      <>
        <div className="kyc-state-card is-ok">
          <span className="kyc-state-icon"><CircleCheck size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>身份认证已通过</h1>
          <p>你的账户已完成身份认证，可以继续查看符合资格的产品和交易流程。</p>
          <div className="kyc-approved-validity"><span>认证有效期</span><b>{kycCase?.expiresAt ? formatDateTime(kycCase.expiresAt, locale) : '以账户状态为准'}</b></div>
          <button type="button" className="compliance-primary" onClick={() => go('invest')}>查看可投资产品 <ArrowRight size={17} /></button>
        </div>
        <KycStateMeta {...commonProps} reason="身份认证已通过" next="查看符合资格的产品" eta={kycCase?.expiresAt ? `有效至 ${formatDateTime(kycCase.expiresAt, locale)}` : '当前有效'} />
      </>
    )
  }

  if (state === 'rejected') {
    return (
      <>
        <div className="kyc-state-card is-error">
          <span className="kyc-state-icon"><CircleX size={25} /></span>
          <KycStatusBadge state={state} />
          <h1>认证未通过</h1>
          <div className="kyc-reason-code"><small>审核原因</small><b>{reason}</b><code>{kycCase?.reasonCode ?? '未提供原因码'}</code></div>
          <p>如果你认为结果有误，可以提交申诉与复核，支持团队会根据记录处理。</p>
          <button type="button" className="compliance-primary" onClick={() => go('support-new')}>申诉与复核 <ArrowRight size={17} /></button>
        </div>
        <KycStateMeta {...commonProps} reason={reason} next="提交申诉与复核" eta="申诉预计 1–2 个工作日" />
      </>
    )
  }

  return (
    <>
      <div className="kyc-state-card is-warn">
        <span className="kyc-state-icon"><ShieldAlert size={25} /></span>
        <KycStatusBadge state="expired" />
        <h1>认证已过期</h1>
        <p>为了继续使用受限产品和资金功能，需要重新完成身份认证。</p>
        <div className="kyc-warning-note"><AlertTriangle size={17} /><span>{kycCase?.expiresAt ? `原认证于 ${formatDateTime(kycCase.expiresAt, locale)} 到期。` : '原认证有效期已结束。'}</span></div>
        <button type="button" className="compliance-primary" onClick={openKyc}>重新认证 <ArrowRight size={17} /></button>
      </div>
      <KycStateMeta {...commonProps} reason="认证有效期结束" next="重新提交身份材料" eta="提交后预计 1–2 个工作日" />
    </>
  )
}

export function KycStatusScreen({ go, notify }: { go: (screen: RwaScreen) => void; notify?: (message: string) => void }) {
  const { locale } = useI18n()
  const [kycCase, setKycCase] = useState<KycCaseView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [failureKind, setFailureKind] = useState<ComplianceErrorKind>('generic')
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    setAuthRequired(false)
    setFailureKind('generic')
    setErrorMessage('')
    try {
      setKycCase(await getKycStatus())
    } catch (error) {
      setFailed(true)
      setAuthRequired(isUnauthorized(error))
      setFailureKind(errorKind(error))
      setErrorMessage(requestError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const state = kycCase?.state ?? 'not_started'
  const openSupport = () => {
    notify?.('正在打开支持中心')
    go('support')
  }

  return (
    <section className="screen compliance-kyc-screen">
      <RwaTopbar screen="kyc" title="身份认证" onBack={() => go('profile')} />
      {loading ? <ComplianceSkeleton kind="kyc" /> : failed ? <ComplianceError message={errorMessage} kind={failureKind} onRetry={() => void load()} onAction={authRequired || failureKind === 'session' ? () => go('login') : undefined} actionLabel="重新登录" /> : (
        <>
          <div className="compliance-page-intro">
            <p className="compliance-eyebrow">IDENTITY &amp; ACCESS</p>
            <h1>身份与访问资格</h1>
            <small>你的认证状态会决定哪些产品和资金功能可以使用。</small>
            <button type="button" className="compliance-secondary" onClick={() => go('onboarding-overview')}>查看开户总览 <ArrowRight size={15} /></button>
          </div>
          <KycStepper state={state} />
          <TiltedSurface className="compliance-state-motion" maxTilt={1.8}>
            <div className="kyc-status-content">
              <KycStateContent state={state} kycCase={kycCase} go={go} locale={locale} />
            </div>
          </TiltedSurface>
          <button type="button" className="compliance-support-link" onClick={openSupport}><span className="compliance-support-link__icon"><Headphones size={16} /></span> 需要帮助？联系支持</button>
        </>
      )}
    </section>
  )
}

function EligibilityBadge({ decision }: { decision: EligibilityDecision }) {
  const tone = ELIGIBILITY_TONE[decision]
  return <span className={`compliance-badge is-${tone}`}>{ELIGIBILITY_LABELS[decision]}</span>
}

function EligibilityDecisionCard({ data, go }: { data: EligibilityView; go: (screen: RwaScreen) => void }) {
  if (data.decision === 'eligible') {
    return (
      <div className="eligibility-decision-card is-ok">
        <CircleCheck size={27} />
        <EligibilityBadge decision={data.decision} />
        <h1>该产品可投资</h1>
        <p>你的当前身份、地区和风险条件满足该产品的准入要求。</p>
        <button type="button" className="compliance-primary" onClick={() => go('invest')}>去投资 <ArrowRight size={17} /></button>
      </div>
    )
  }
  if (data.decision === 'browse_only') {
    return (
      <div className="eligibility-decision-card is-warn">
        <ShieldAlert size={27} />
        <EligibilityBadge decision={data.decision} />
        <h1>当前仅可浏览</h1>
        <p>你可以查看产品资料，但完成身份认证后才能解锁投资流程。</p>
        <button type="button" className="compliance-primary" onClick={() => go('kyc')}>完成身份认证 <ArrowRight size={17} /></button>
      </div>
    )
  }
  if (data.decision === 'ineligible') {
    return (
      <div className="eligibility-decision-card is-error">
        <CircleX size={27} />
        <EligibilityBadge decision={data.decision} />
        <h1>您所在地区暂不支持</h1>
        <p>当前政策不允许从你选择的地区参与该产品。政策发生变化时，我们会通过公告通知。</p>
      </div>
    )
  }
  return (
    <div className="eligibility-decision-card is-info">
      <Clock3 size={27} />
      <EligibilityBadge decision={data.decision} />
      <h1>人工审核中</h1>
      <p>你的申请已进入人工合规审核，审核完成后会更新资格状态。</p>
      <div className="eligibility-review-note"><Clock3 size={16} />预计 1–2 个工作日</div>
    </div>
  )
}

const REGION_OPTIONS = [
  { value: 'SG', label: '新加坡（SG）' },
  { value: 'HK', label: '中国香港（HK）' },
  { value: 'TW', label: '中国台湾（TW）' },
  { value: 'JP', label: '日本（JP）' },
  { value: 'AE', label: '阿联酋（AE）' },
  { value: 'other', label: '其他' },
]

export function EligibilityScreen({ go, productScope = 'all' }: { go: (screen: RwaScreen) => void; productScope?: string }) {
  const { locale } = useI18n()
  const [data, setData] = useState<EligibilityView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [failureKind, setFailureKind] = useState<ComplianceErrorKind>('generic')
  const [errorMessage, setErrorMessage] = useState('')
  const [region, setRegion] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evaluationError, setEvaluationError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    setAuthRequired(false)
    setFailureKind('generic')
    setErrorMessage('')
    try {
      setData(await getEligibility(productScope))
    } catch (error) {
      setFailed(true)
      setAuthRequired(isUnauthorized(error))
      setFailureKind(errorKind(error))
      setErrorMessage(requestError(error))
    } finally {
      setLoading(false)
    }
  }, [productScope])

  useEffect(() => {
    void load()
  }, [load])

  const reevaluate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!region || evaluating) return
    setEvaluating(true)
    setEvaluationError('')
    try {
      setData(await evaluateEligibility({ productScope, region }))
    } catch (error) {
      setEvaluationError(requestError(error))
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <section className="screen compliance-eligibility-screen">
      <RwaTopbar screen="eligibility" title="投资资格" onBack={() => go('invest')} />
      {loading ? <ComplianceSkeleton kind="eligibility" /> : failed ? <ComplianceError message={errorMessage} kind={failureKind} onRetry={() => void load()} onAction={failureKind === 'session' ? () => go('login') : failureKind === 'kyc' ? () => go('kyc') : undefined} actionLabel={failureKind === 'kyc' ? '完成认证' : '重新登录'} /> : data ? (
        <>
          <div className="compliance-page-intro">
            <p className="compliance-eyebrow">ELIGIBILITY CHECK</p>
            <h1>确认你的投资资格</h1>
            <small>评估范围：{productScope === 'all' ? '全部产品' : productScope}</small>
          </div>
          <TiltedSurface className="compliance-state-motion" maxTilt={1.8}>
            <EligibilityDecisionCard data={data} go={go} />
          </TiltedSurface>
          <section className="eligibility-reasons glass" aria-labelledby="eligibility-reasons-title">
            <div className="compliance-section-heading"><span id="eligibility-reasons-title"><ShieldCheck size={17} /> 评估依据</span><small>{data.reasonCodes.length} 项</small></div>
            {data.reasonCodes.length > 0 ? <ul>{data.reasonCodes.map((code) => <li key={code}><CheckCircle2 size={16} /><span>{REASON_CODE_LABELS[code] ?? code}</span></li>)}</ul> : <p className="eligibility-no-reasons">你的账户对该产品没有额外限制。</p>}
          </section>
          <form className="eligibility-region-form glass" onSubmit={reevaluate}>
            <div className="compliance-section-heading"><span><FileText size={17} /> 变更地区后重新评估</span></div>
            <label htmlFor="eligibility-region">居住或注册地区</label>
            <select id="eligibility-region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">请选择地区</option>
              {REGION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {evaluationError ? <div className="compliance-form-error" role="alert"><AlertTriangle size={16} />{evaluationError}</div> : null}
            <button type="submit" className="compliance-action" disabled={!region || evaluating}>{evaluating ? '评估中…' : '重新评估'} <ArrowRight size={16} /></button>
          </form>
          <footer className="eligibility-footer"><span>政策版本 {data.policyVersion}</span><span>决定于 {formatDateTime(data.decidedAt, locale)}</span></footer>
        </>
      ) : null}
    </section>
  )
}

type RiskProfile = 'conservative' | 'stable' | 'balanced' | 'aggressive'
type RiskQuestionOption = { value: string; label: string; score: number }
type RiskQuestion = { id: string; title: string; options: RiskQuestionOption[] }
type RiskAllocation = { label: string; value: number }
type RiskResult = {
  profile: RiskProfile
  score: number
  answers: Record<string, string>
  allocation: RiskAllocation[]
  completedAt: string
}

const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  conservative: '保守型',
  stable: '稳健型',
  balanced: '平衡型',
  aggressive: '进取型',
}

const RISK_PROFILE_DESCRIPTIONS: Record<RiskProfile, string> = {
  conservative: '优先保护本金和流动性，适合较低波动的资金安排。',
  stable: '在控制回撤的同时追求稳定收益，适合中短期规划。',
  balanced: '在收益、流动性与波动之间取得平衡，适合多数长期目标。',
  aggressive: '能够承受较大波动，追求更高增长并接受更长持有周期。',
}

const RISK_QUESTIONS: RiskQuestion[] = [
  { id: 'experience', title: '你的投资经验', options: [{ value: 'none', label: '没有投资经验', score: 0 }, { value: 'one-two', label: '1–2 年', score: 1 }, { value: 'three-five', label: '3–5 年', score: 2 }, { value: 'five-plus', label: '5 年以上', score: 3 }] },
  { id: 'tolerance', title: '你的风险承受偏好', options: [{ value: 'capital-first', label: '保本优先', score: 0 }, { value: 'steady', label: '稳健', score: 1 }, { value: 'balanced', label: '平衡', score: 2 }, { value: 'growth', label: '进取', score: 3 }] },
  { id: 'horizon', title: '你的资金期限', options: [{ value: 'under-one', label: '< 1 年', score: 0 }, { value: 'one-three', label: '1–3 年', score: 1 }, { value: 'three-five', label: '3–5 年', score: 2 }, { value: 'five-plus', label: '5 年以上', score: 3 }] },
  { id: 'drawdown', title: '你可以承受的最大回撤', options: [{ value: 'five', label: '5%', score: 0 }, { value: 'ten', label: '10%', score: 1 }, { value: 'twenty', label: '20%', score: 2 }, { value: 'thirty-plus', label: '30% 以上', score: 3 }] },
  { id: 'goal', title: '你的主要目标', options: [{ value: 'preserve', label: '保值', score: 0 }, { value: 'income', label: '稳定收益', score: 1 }, { value: 'appreciation', label: '增值', score: 2 }, { value: 'high-growth', label: '高增长', score: 3 }] },
  { id: 'income-stability', title: '你的收入稳定性', options: [{ value: 'unstable', label: '不稳定', score: 0 }, { value: 'general', label: '一般', score: 1 }, { value: 'stable', label: '稳定', score: 2 }, { value: 'very-stable', label: '非常稳定', score: 3 }] },
]

function allocationFor(profile: RiskProfile): RiskAllocation[] {
  if (profile === 'conservative') return [{ label: '稳健资产', value: 55 }, { label: '收益资产', value: 30 }, { label: '成长资产', value: 10 }, { label: '其他资产', value: 5 }]
  if (profile === 'stable') return [{ label: '稳健资产', value: 35 }, { label: '收益资产', value: 35 }, { label: '成长资产', value: 20 }, { label: '其他资产', value: 10 }]
  if (profile === 'balanced') return [{ label: '稳健资产', value: 20 }, { label: '收益资产', value: 30 }, { label: '成长资产', value: 35 }, { label: '其他资产', value: 15 }]
  return [{ label: '稳健资产', value: 10 }, { label: '收益资产', value: 20 }, { label: '成长资产', value: 45 }, { label: '其他资产', value: 25 }]
}

function calculateRiskResult(answers: Record<string, string>): RiskResult {
  const score = RISK_QUESTIONS.reduce((total, question) => total + (question.options.find((option) => option.value === answers[question.id])?.score ?? 0), 0)
  const profile: RiskProfile = score <= 4 ? 'conservative' : score <= 9 ? 'stable' : score <= 14 ? 'balanced' : 'aggressive'
  return { profile, score, answers, allocation: allocationFor(profile), completedAt: new Date().toISOString() }
}

function isRiskProfile(value: unknown): value is RiskResult {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const answers = record.answers
  const allocation = record.allocation
  const answersValid = typeof answers === 'object' && answers !== null && Object.values(answers).every((answer) => typeof answer === 'string')
  const allocationValid = Array.isArray(allocation) && allocation.every((item) => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Record<string, unknown>
    return typeof entry.label === 'string' && typeof entry.value === 'number'
  })
  return typeof record.profile === 'string' && ['conservative', 'stable', 'balanced', 'aggressive'].includes(record.profile)
    && typeof record.score === 'number' && typeof record.completedAt === 'string' && answersValid && allocationValid
}

function RiskSkeleton() {
  return <div className="risk-skeleton" aria-label="正在读取本机风险画像"><div /><div /><div /></div>
}

function RiskResultCard({ result, onReset }: { result: RiskResult; onReset: () => void }) {
  return (
    <>
      <div className={`risk-result-card is-${result.profile}`}>
        <span className="risk-result-card__icon"><ShieldCheck size={26} /></span>
        <p className="compliance-eyebrow">YOUR RISK PROFILE</p>
        <h1>{RISK_PROFILE_LABELS[result.profile]}</h1>
        <p>{RISK_PROFILE_DESCRIPTIONS[result.profile]}</p>
        <small>风险分数 {result.score} / 18 · 仅用于规划参考</small>
      </div>
      <section className="risk-allocation glass" aria-labelledby="risk-allocation-title">
        <div className="compliance-section-heading"><span id="risk-allocation-title"><FileText size={17} /> 建议资产配置</span><small>示意比例</small></div>
        <div className="risk-allocation-list">
          {result.allocation.map((item) => (
            <div className="risk-allocation-row" key={item.label}>
              <span><b>{item.label}</b><small>{item.value}%</small></span>
              <i className="risk-allocation-track"><em style={{ width: `${item.value}%` }} /></i>
            </div>
          ))}
        </div>
      </section>
      <div className="risk-local-note"><ShieldAlert size={16} /><span>结果先保存在本机，账户连接后会自动同步。当前画像不会直接替你下单。</span></div>
      <button type="button" className="compliance-action risk-reset" onClick={onReset}>重新评估 <RotateCw size={15} /></button>
    </>
  )
}

export function RiskProfileScreen({ go, notify }: { go: (screen: RwaScreen) => void; notify?: (message: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<RiskResult | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('rwa-risk-profile')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isRiskProfile(parsed)) {
          setResult(parsed)
          setAnswers(parsed.answers)
        }
      }
    } catch {
      setStorageError('无法读取本机保存的风险画像，本次可以重新完成问卷。')
    } finally {
      setStorageReady(true)
    }
  }, [])

  const answered = RISK_QUESTIONS.filter((question) => Boolean(answers[question.id])).length
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (answered !== RISK_QUESTIONS.length) return
    const next = calculateRiskResult(answers)
    try {
      window.localStorage.setItem('rwa-risk-profile', JSON.stringify(next))
      setStorageError('')
      notify?.('风险画像已保存在本机')
    } catch {
      setStorageError('本机存储不可用，结果仅保留在当前页面，离开后不会保留。')
    }
    setResult(next)
  }

  const reset = () => {
    setResult(null)
    setAnswers({})
    setStorageError('')
  }

  return (
    <section className="screen compliance-risk-screen">
      <RwaTopbar screen="risk-profile" title="风险评估" onBack={() => go('profile')} />
      {!storageReady ? <RiskSkeleton /> : result ? (
        <>
          <div className="compliance-page-intro"><p className="compliance-eyebrow">RISK PROFILE</p><h1>你的投资画像</h1><small>根据你刚刚的回答生成，可随时重新评估。</small></div>
          <RiskResultCard result={result} onReset={reset} />
          {storageError ? <div className="compliance-form-error" role="alert"><AlertTriangle size={16} />{storageError}</div> : null}
          <button type="button" className="compliance-support-link" onClick={() => go('support')}><span className="compliance-support-link__icon"><CircleHelp size={16} strokeWidth={1.8} /></span> 对结果有疑问？联系支持</button>
        </>
      ) : (
        <>
          <div className="compliance-page-intro"><p className="compliance-eyebrow">RISK PROFILE</p><h1>了解你的投资偏好</h1><small>回答 6 个问题，我们会给出一个可解释的风险画像和配置参考。</small></div>
          <div className="risk-progress"><span>{answered} / {RISK_QUESTIONS.length} 已完成</span><i><em style={{ width: `${(answered / RISK_QUESTIONS.length) * 100}%` }} /></i></div>
          <form className="risk-form" onSubmit={submit}>
            {RISK_QUESTIONS.map((question, index) => (
              <fieldset className="risk-question glass" key={question.id}>
                <legend><span>{String(index + 1).padStart(2, '0')}</span><b>{question.title}</b></legend>
                <div className="risk-options">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.value
              return <label className={`risk-option ${selected ? 'is-selected' : ''}`} key={option.value}><input type="radio" name={question.id} value={option.value} checked={selected} onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option.value }))} /><span>{option.label}</span></label>
                  })}
                </div>
              </fieldset>
            ))}
            {storageError ? <div className="compliance-form-error" role="alert"><AlertTriangle size={16} />{storageError}</div> : null}
            <button type="submit" className="compliance-primary risk-submit" disabled={answered !== RISK_QUESTIONS.length}>查看我的画像 <ArrowRight size={17} /></button>
          </form>
          <div className="risk-local-note"><ShieldAlert size={16} /><span>结果先保存在本机，账户连接后会自动同步。当前问卷不会上传到服务器。</span></div>
          <button type="button" className="compliance-support-link" onClick={() => go('support')}><span className="compliance-support-link__icon"><CircleHelp size={16} strokeWidth={1.8} /></span> 需要帮助？联系支持</button>
        </>
      )}
    </section>
  )
}
