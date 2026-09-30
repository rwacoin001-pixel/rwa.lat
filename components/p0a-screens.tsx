'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Info,
  Landmark,
  LineChart,
  ListChecks,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import type { DemoProduct } from '@/lib/demo-catalog'
import type { RwaScreen } from '@/lib/rwa-routes'
import { getEligibility, getKycStatus, ELIGIBILITY_TONE, type EligibilityView, type KycCaseView } from '@/lib/compliance-data'
import { getAssetHistory, getIssuerProfile, getMarketContext, type AssetHistoryPoint, type MarketContext, type RwaIssuerProfile } from '@/lib/p0a-data'
import { getPositions, type PositionView } from '@/lib/portfolio-data'
import { getLedgerTransactions, userSideAmount, type LedgerTransaction } from '@/lib/wallet-data'
import { formatMoneyNumber, formatUsdt } from '@/lib/money'
import { directionClass, formatLedgerAmount, formatMoney, formatTime } from '@/lib/display/format'
import { ledgerDisplay, shortId } from '@/lib/display/labels'
import { DISCLOSURE_KIND_LABELS, DISCLOSURE_KIND_ORDER, listProductDisclosures, type DisclosureFileView, type DisclosureKind } from '@/lib/disclosures-data'
import { useI18n } from '@/lib/i18n'
import { backOr } from '@/lib/maison-nav'
import { onboardingCopy } from '@/lib/maison-onboarding-copy'
import RwaTopbar from './rwa-topbar'
import { EmptyState } from './ui/Empty'

type Go = (screen: RwaScreen) => void

const isZh = (locale: string) => locale === 'zh-CN' || locale === 'zh-TW'
const copy = (locale: string, en: string, zh: string) => isZh(locale) ? zh : en
const numberValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
const dateLabel = (value: string | Date | null | undefined, locale: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, options).format(date)
}
const errorStatus = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined
  const e = error as { response?: { status?: number }; status?: number; request?: unknown }
  // axios: a request with no response is a network failure.
  return e.response?.status ?? e.status ?? (e.request ? 0 : undefined)
}
const failureMessage = (error: unknown, locale: string) => {
  const status = errorStatus(error)
  if (status === 401) return copy(locale, 'Your session has expired. Sign in to load this page.', '登录状态已失效，请重新登录后加载。')
  if (status === 403) return copy(locale, 'This information is restricted for your account.', '当前账户暂时无法查看此信息。')
  return copy(locale, 'We could not load the live data. Try again.', '暂时无法读取真实数据，请重试。')
}

function P0AEmpty({ icon: Icon = Info, title, body, retry, retryLabel, action }: { icon?: typeof Info; title: string; body: string; retry?: () => void; retryLabel?: string; action?: ReactNode }) {
  const { locale } = useI18n()
  return <EmptyState variant="card" icon={Icon} title={title} body={body} action={<>{retry ? <button type="button" className="p0a-secondary-button" onClick={retry}><RefreshCw size={14} />{retryLabel ?? (locale === 'zh-CN' ? '重试' : 'Retry')}</button> : null}{action}</>} />
}

function P0AHeader({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children?: ReactNode }) {
  return <header className="p0a-header"><div><span className="p0a-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></div>{children}</header>
}

function StepRow({ number, title, body, state, icon: Icon }: { number: number; title: string; body: string; state: 'complete' | 'current' | 'waiting'; icon: typeof ShieldCheck }) {
  return <div className={`p0a-step is-${state}`}><span className="p0a-step__number">{state === 'complete' ? <Check size={15} /> : number}</span><span className="p0a-step__icon"><Icon size={18} /></span><p><b>{title}</b><small>{body}</small></p><i aria-hidden="true" /></div>
}

export function OnboardingOverviewScreen({ go }: { go: Go }) {
  const { locale } = useI18n()
  const c = onboardingCopy[locale]
  const [kyc, setKyc] = useState<KycCaseView | null>(null)
  const [sec, setSec] = useState<EligibilityView | null>(null)
  const [mas, setMas] = useState<EligibilityView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<{ status?: number; partial: boolean } | null>(null)
  const load = () => {
    setState('loading'); setError(null)
    Promise.allSettled([getKycStatus(), getEligibility('sec_reg_d'), getEligibility('mas')]).then((results) => {
      const [kycResult, secResult, masResult] = results
      setKyc(kycResult.status === 'fulfilled' ? kycResult.value : null)
      setSec(secResult.status === 'fulfilled' ? secResult.value : null)
      setMas(masResult.status === 'fulfilled' ? masResult.value : null)
      const rejected = results.filter((item): item is PromiseRejectedResult => item.status === 'rejected')
      setState(rejected.length === results.length ? 'error' : 'ready')
      setError(rejected.length ? { status: errorStatus(rejected[0].reason), partial: rejected.length < results.length } : null)
    })
  }
  useEffect(load, [])
  const errorText = (status?: number) => status === 0 ? c.network : status === 401 ? c.expired : status === 403 ? c.restricted : c.failed
  const kycApproved = kyc?.state === 'approved'
  const secResolved = !!sec && sec.decision !== 'browse_only'
  const masResolved = !!mas && mas.decision !== 'browse_only'
  const allEligible = sec?.decision === 'eligible' && mas?.decision === 'eligible'
  const badge = (decision?: EligibilityView['decision']) => decision ? <span className={`p0a-badge is-${ELIGIBILITY_TONE[decision]}`}>{c.decision[decision] ?? decision}</span> : <span className="p0a-badge is-muted">{c.noDecision}</span>
  // Reason codes are shown verbatim; without one we say so rather than implying the account is unrestricted.
  const reasons = (view: EligibilityView | null) => !view ? c.pending : view.reasonCodes?.length ? view.reasonCodes.join(' · ') : c.noReason
  const decided = (view: EligibilityView | null) => view?.decidedAt ? `${c.decided} ${dateLabel(view.decidedAt, locale)}` : c.pending
  return <section className="screen p0a-screen p0a-onboarding"><RwaTopbar screen="onboarding-overview" title={c.title} onBack={() => backOr('/home')} />
    {state === 'loading' ? <div className="p0a-skeleton-stack" aria-busy="true"><div /><div /><div /></div> : state === 'error' ? <P0AEmpty icon={ShieldAlert} title={c.unavailable} body={errorText(error?.status)} retry={load} retryLabel={c.retry} action={error?.status === 401 ? <button type="button" className="p0a-secondary-button" onClick={() => go('login')}>{c.signIn}</button> : undefined} /> : <>
      <P0AHeader eyebrow="ACCESS / COMPLIANCE" title={c.heading} body={c.body}>
        <span className="p0a-live-chip"><span />{c.live}</span>
      </P0AHeader>
      {error?.partial && <p className="p0a-disclaimer" role="status"><AlertTriangle size={16} />{c.partial} <button type="button" className="p0a-secondary-button" onClick={load}><RefreshCw size={14} />{c.retry}</button></p>}
      <div className="p0a-compliance-grid"><article className="p0a-compliance-card glass"><div className="p0a-card-top"><span className="p0a-card-icon"><ShieldCheck size={19} /></span><span>SEC Reg D</span>{badge(sec?.decision)}</div><p dir="auto">{reasons(sec)}</p><small>{decided(sec)}</small></article><article className="p0a-compliance-card glass"><div className="p0a-card-top"><span className="p0a-card-icon is-mint"><Globe2 size={19} /></span><span>MAS</span>{badge(mas?.decision)}</div><p dir="auto">{reasons(mas)}</p><small>{decided(mas)}</small></article></div>
      <div className="p0a-section-heading"><div><span className="p0a-eyebrow">CHECKLIST</span><h2>{c.steps}</h2></div><button type="button" onClick={() => go('kyc')}>{c.openKyc} <ArrowRight size={16} /></button></div>
      <div className="p0a-step-list"><StepRow number={1} title={c.identity} body={kyc ? c.kyc[kyc.state] ?? kyc.state : c.identityUnknown} state={kycApproved ? 'complete' : kyc?.state === 'in_progress' || kyc?.state === 'submitted' ? 'current' : 'waiting'} icon={ShieldCheck} /><StepRow number={2} title="SEC Reg D" body={sec ? c.decision[sec.decision] ?? sec.decision : c.awaiting} state={sec?.decision === 'eligible' ? 'complete' : secResolved ? 'current' : 'waiting'} icon={Landmark} /><StepRow number={3} title="MAS" body={mas ? c.decision[mas.decision] ?? mas.decision : c.awaiting} state={mas?.decision === 'eligible' ? 'complete' : masResolved ? 'current' : 'waiting'} icon={Globe2} /><StepRow number={4} title={c.ready} body={allEligible && kycApproved ? c.readyOn : c.readyOff} state={allEligible && kycApproved ? 'complete' : 'waiting'} icon={CheckCircle2} /></div>
      <div className="p0a-trace-note glass"><Info size={17} /><p><b>{c.traceTitle}</b><small>{c.traceBody}</small></p></div>
    </>}
  </section>
}

function resolveRouteSlug(kind: 'valuation' | 'issuer-profile') {
  if (typeof window === 'undefined') return ''
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (kind === 'valuation' && parts[0] === 'asset' && parts[1]) return decodeURIComponent(parts[1])
  const index = kind === 'valuation' ? parts.indexOf('invest') : parts.indexOf('issuers')
  if (index >= 0 && parts[index + 1]) return decodeURIComponent(parts[index + 1])
  return window.sessionStorage.getItem('rwa-p0a-slug') ?? ''
}

function Sparkline({ points, metric, color }: { points: AssetHistoryPoint[]; metric: 'price' | 'marketCap'; color: string }) {
  const { locale } = useI18n()
  const values = points.map((point) => numberValue(metric === 'price' ? point.priceUsd : point.marketCapUsd)).filter((value): value is number => value !== null)
  if (!values.length) return <EmptyState variant="inline" icon={LineChart} title={copy(locale, 'No price history yet', '暂无价格历史')} body={copy(locale, 'Recorded values will appear here when available.', '有可用的已记录价格后，会显示在这里。')} />
  const width = 660; const height = 190; const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / Math.max(values.length - 1, 1)) * width} ${height - 14 - ((value - min) / range) * (height - 28)}`).join(' ')
  return <svg className="p0a-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric} history`}><defs><linearGradient id={`p0a-fill-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".2" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={`url(#p0a-fill-${metric})`} /><path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export function ValuationScreen({ go }: { go: Go }) {
  const { locale } = useI18n(); const [slug, setSlug] = useState(''); const [history, setHistory] = useState<AssetHistoryPoint[]>([]); const [context, setContext] = useState<MarketContext | null>(null); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState<string | null>(null)
  const load = () => { const routeSlug = resolveRouteSlug('valuation'); setSlug(routeSlug); if (!routeSlug) { setState('error'); setError(copy(locale, 'The asset slug is missing from this route.', '此路由缺少资产标识。')); return } setState('loading'); Promise.allSettled([getAssetHistory(routeSlug), getMarketContext()]).then(([historyResult, contextResult]) => { if (historyResult.status === 'fulfilled') setHistory(historyResult.value.points); if (contextResult.status === 'fulfilled') setContext(contextResult.value); if (historyResult.status === 'rejected' && contextResult.status === 'rejected') { setState('error'); setError(failureMessage(historyResult.reason, locale)) } else setState('ready') }) }
  useEffect(load, [locale])
  const latest = history.at(-1); const first = history[0]; const currentPrice = numberValue(latest?.priceUsd); const currentCap = numberValue(latest?.marketCapUsd); const change = currentPrice !== null && numberValue(first?.priceUsd) !== null ? currentPrice - (numberValue(first?.priceUsd) as number) : null
  return <section className="screen p0a-screen p0a-valuation"><RwaTopbar screen="valuation" title={copy(locale, 'Valuation', '估值')} onBack={() => go('invest')} />{state === 'loading' ? <div className="p0a-skeleton-stack"><div /><div /><div /></div> : state === 'error' ? <P0AEmpty icon={LineChart} title={copy(locale, 'Valuation unavailable', '估值数据暂不可用')} body={error ?? failureMessage(null, locale)} retry={load} /> : <><P0AHeader eyebrow={slug.toUpperCase()} title={copy(locale, 'Price & valuation', '价格与估值')} body={copy(locale, 'Two synchronized axes keep the traded price and reported market value separate.', '双轴同步展示交易价格与报告估值，避免混淆口径。')}><span className="p0a-live-chip"><span />{context?.degraded ? copy(locale, 'Context limited', '行情有限') : history.length ? copy(locale, 'Context live', '行情在线') : copy(locale, 'Awaiting price history', '等待价格历史')}</span></P0AHeader><div className="p0a-value-strip"><div className="glass"><small>{copy(locale, 'Latest price', '最新价格')}</small><b>{currentPrice === null ? copy(locale, 'Not available', '暂无') : `$${formatMoneyNumber(currentPrice, locale, 4)}`}</b><em className={change !== null && change >= 0 ? 'is-up' : ''}>{change === null ? copy(locale, 'No change yet', '暂无变化') : `${change >= 0 ? '+' : '−'}$${formatMoneyNumber(Math.abs(change), locale, 4)}`}</em></div><div className="glass"><small>{copy(locale, 'Reported market value', '报告市值')}</small><b>{currentCap === null ? copy(locale, 'Not available', '暂无') : `$${formatMoneyNumber(currentCap, locale, 0)}`}</b><em>{latest?.date ? dateLabel(latest.date, locale) : copy(locale, 'No valuation date', '暂无估值日期')}</em></div><div className="glass"><small>{copy(locale, 'Observations', '观测点')}</small><b>{history.length ? formatMoneyNumber(history.length, locale, 0) : '0'}</b><em>{history.length ? `${copy(locale, 'latest', '最近')} ${dateLabel(latest?.date, locale)}` : copy(locale, 'No observations yet', '暂无观测点')}</em></div></div><div className="p0a-dual-chart glass"><div className="p0a-chart-head"><div><span className="p0a-eyebrow">PRICE AXIS</span><h2>{copy(locale, 'Price history', '价格走势')}</h2></div><span className="p0a-chart-legend"><i className="is-cyan" />USD</span></div>{history.length ? <Sparkline points={history} metric="price" color="var(--accent)" /> : <P0AEmpty icon={LineChart} title={copy(locale, 'No price history yet', '暂无价格历史')} body={copy(locale, 'The first valuation will appear here when the asset has a recorded price.', '资产产生首笔估值后，这里会显示价格走势。')} />}</div><div className="p0a-dual-chart glass"><div className="p0a-chart-head"><div><span className="p0a-eyebrow">VALUATION AXIS</span><h2>{copy(locale, 'Market value history', '市值走势')}</h2></div><span className="p0a-chart-legend"><i className="is-violet" />USD</span></div>{history.length ? <Sparkline points={history} metric="marketCap" color="#8d7dff" /> : <P0AEmpty icon={CircleDollarSign} title={copy(locale, 'No valuation history yet', '暂无估值历史')} body={copy(locale, 'This chart will fill after the asset has recorded a market value.', '资产产生市值记录后，这里会显示走势。')} />}</div><div className="p0a-context-grid">{(context?.anchors ?? []).slice(0, 4).map((quote) => <div className="glass" key={quote.quoteId || quote.symbol}><span><b>{quote.name || quote.symbol}</b><small>{quote.source}</small></span><strong>{quote.value === null ? copy(locale, 'Not available', '暂无') : formatMoneyNumber(quote.value, locale, quote.unit.includes('yield') ? 2 : 2)}</strong><em className={quote.stale ? 'is-stale' : ''}>{quote.stale ? copy(locale, 'Stale', '已过期') : dateLabel(quote.asOf, locale)}</em></div>)}{!context?.anchors?.length ? <P0AEmpty icon={Globe2} title={copy(locale, 'No market context yet', '暂无市场背景行情')} body={copy(locale, 'Market context will appear when reference prices are available.', '有参考价格后，这里会显示市场背景行情。')} /> : null}</div><div className="p0a-disclaimer"><Info size={16} />{copy(locale, 'Context data is informational and never the execution quote. Product prices remain subject to the catalog quote and validity window.', '背景行情仅供参考，不作为成交报价。产品价格以目录报价及其有效期为准。')}</div></>}</section>
}

export function IssuerProfileScreen({ go }: { go: Go }) {
  const { locale } = useI18n(); const [slug, setSlug] = useState(''); const [profile, setProfile] = useState<RwaIssuerProfile | null>(null); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState<string | null>(null)
  const load = () => { const routeSlug = resolveRouteSlug('issuer-profile'); setSlug(routeSlug); if (!routeSlug) { setState('error'); setError(copy(locale, 'The issuer slug is missing from this route.', '此路由缺少发行方标识。')); return } setState('loading'); getIssuerProfile(routeSlug).then((data) => { setProfile(data); setState('ready') }).catch((reason) => { setError(failureMessage(reason, locale)); setState('error') }) }
  useEffect(load, [locale])
  return <section className="screen p0a-screen p0a-issuer"><RwaTopbar screen="issuer-profile" title={copy(locale, 'Issuer', '发行方')} onBack={() => go('invest')} />{state === 'loading' ? <div className="p0a-skeleton-stack"><div /><div /><div /></div> : state === 'error' || !profile ? <P0AEmpty icon={Building2} title={copy(locale, 'Issuer unavailable', '发行方信息暂不可用')} body={error ?? failureMessage(null, locale)} retry={load} /> : <><P0AHeader eyebrow="ISSUER PROFILE" title={profile.name} body={profile.description ?? copy(locale, 'No issuer description is available yet.', '暂无发行方介绍。')}><span className={`p0a-verified-chip ${profile.verified ? 'is-verified' : ''}`}>{profile.verified ? <CheckCircle2 size={15} /> : <Info size={15} />}{profile.verified ? copy(locale, 'Verified', '已验证') : copy(locale, 'Unverified', '未验证')}</span></P0AHeader><div className="p0a-issuer-metrics"><div className="glass"><small>{copy(locale, 'Assets managed', '管理资产')}</small><b>{profile.assetCount ?? profile.assets.length}</b><em>{copy(locale, 'linked assets', '关联资产')}</em></div><div className="glass"><small>{copy(locale, 'Total market value', '总市值')}</small><b>{profile.totalMarketCapUsd == null ? copy(locale, 'Not available', '暂无') : `$${formatMoneyNumber(numberValue(profile.totalMarketCapUsd), locale, 0)}`}</b><em>USD</em></div><div className="glass"><small>{copy(locale, 'Token count', '代币数量')}</small><b>{profile.tokenCount ?? '0'}</b><em>{copy(locale, 'reported', '已报告')}</em></div></div><div className="p0a-issuer-links glass"><div><Globe2 size={18} /><span><small>{copy(locale, 'Official website', '官方网站')}</small><b>{profile.websiteUrl ?? copy(locale, 'Not supplied', '未提供')}</b></span>{profile.websiteUrl ? <a href={profile.websiteUrl} target="_blank" rel="noreferrer" aria-label="Open issuer website"><ExternalLink size={16} /></a> : null}</div><div><Landmark size={18} /><span><small>{copy(locale, 'Issuer identifier', '发行方标识')}</small><b>{shortId(slug)}</b></span></div></div><div className="p0a-section-heading"><div><span className="p0a-eyebrow">PORTFOLIO</span><h2>{copy(locale, 'Linked assets', '关联资产')}</h2></div><span className="p0a-count-chip">{profile.assets.length}</span></div>{profile.assets.length ? <div className="p0a-issuer-assets">{profile.assets.map((asset) => <button type="button" className="glass" key={asset.slug ?? asset.symbol ?? asset.name} onClick={() => go('invest')}><span className="p0a-asset-mark"><BarChart3 size={17} /></span><span><b>{asset.name ?? asset.slug ?? copy(locale, 'Unnamed asset', '未命名资产')}</b><small>{asset.symbol ?? asset.assetClass ?? copy(locale, 'Asset', '资产')}</small></span><strong>{asset.marketCapUsd == null ? copy(locale, 'Not available', '暂无') : `$${formatMoneyNumber(numberValue(asset.marketCapUsd), locale, 0)}`}<small>{asset.change30dPct == null ? copy(locale, 'No change yet', '暂无变化') : `${numberValue(asset.change30dPct)! >= 0 ? '+' : '−'}${formatMoneyNumber(Math.abs(numberValue(asset.change30dPct)!), locale, 2)}%`}</small></strong><ArrowRight size={17} /></button>)}</div> : <P0AEmpty icon={BarChart3} title={copy(locale, 'No linked assets yet', '暂无关联资产')} body={copy(locale, 'Linked assets will appear when the issuer has published a portfolio.', '发行方发布组合后，这里会显示关联资产。')} />}</>}</section>
}

export function AssetEvidencePanel({ product }: { product: DemoProduct }) {
  const { locale } = useI18n(); const [files, setFiles] = useState<DisclosureFileView[]>([]); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { let active = true; setState('loading'); listProductDisclosures(product.id).then((data) => { if (active) { setFiles(data); setState('ready') } }).catch(() => { if (active) setState('error') }); return () => { active = false } }, [product.id])
  const fileByKind = useMemo(() => new Map(files.filter((file) => file.state === 'active').map((file) => [file.kind, file])), [files])
  if (state === 'loading') return <div className="p0a-evidence-panel"><div className="p0a-skeleton-line" /><div className="p0a-skeleton-line" /><div className="p0a-skeleton-line" /></div>
  if (state === 'error') return <P0AEmpty icon={FileText} title={copy(locale, 'Evidence unavailable', '证据资料暂不可用')} body={copy(locale, 'No disclosure files are available yet.', '暂时没有可查看的披露资料。')} />
  return <div className="p0a-evidence-panel"><div className="p0a-evidence-summary glass"><span className="p0a-card-icon"><FileCheck2 size={18} /></span><p><b>{copy(locale, 'Evidence coverage', '证据覆盖')}</b><small>{files.length ? `${files.length} ${copy(locale, 'active disclosure files available', '份有效披露文件可查看')}` : copy(locale, 'No active disclosure files are available yet.', '暂时没有可查看的有效披露文件。')}</small></p><strong>{files.length ? `${files.length}/${DISCLOSURE_KIND_ORDER.length}` : '0/4'}</strong></div><div className="p0a-evidence-grid">{DISCLOSURE_KIND_ORDER.map((kind: DisclosureKind) => { const file = fileByKind.get(kind); return <article className={`p0a-evidence-card glass ${file ? 'is-available' : 'is-missing'}`} key={kind}><span className="p0a-evidence-card__icon">{file ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div><b>{copy(locale, ({ prospectus: 'Offering memorandum', risk_disclosure: 'Risk disclosure', terms: 'Terms & conditions', regulatory: 'Regulatory document' } as Record<DisclosureKind, string>)[kind], DISCLOSURE_KIND_LABELS[kind])}</b><small>{file ? file.title : copy(locale, 'Not published for this product', '该产品尚未发布')}</small>{file ? <em>{file.locale.toUpperCase()} · {dateLabel(file.published_at, locale)}</em> : null}</div></article> })}</div><div className="p0a-evidence-basis glass"><div><Scale size={17} /><span><b>{copy(locale, 'Diligence basis', '尽调依据')}</b><small>{product.note || product.subtitle || copy(locale, 'No product summary is available.', '暂无产品摘要。')}</small></span></div><div><CircleDollarSign size={17} /><span><b>{copy(locale, 'Cash-flow basis', '现金流依据')}</b><small>{copy(locale, 'Only published product disclosures are shown here. No cash-flow assumption is inferred when details are unavailable.', '这里只展示已发布产品披露。缺少细节时不会推断现金流假设。')}</small></span></div></div></div>
}

function PositionEvents({ positions, ledger, locale }: { positions: PositionView[]; ledger: LedgerTransaction[]; locale: string }) {
  const distributions = ledger.filter((tx) => tx.transactionType === 'yield_distribution').map((tx) => { const amount = userSideAmount(tx); return { key: tx.id, title: ledgerDisplay(tx.transactionType, locale).label, date: tx.effectiveAt, amount: formatLedgerAmount(amount.amount, tx.transactionType, locale), icon: TrendingUp } })
  const snapshots = positions.filter((position) => position.valuedAt).map((position) => ({ key: `${position.productId}-${position.valuedAt}`, title: copy(locale, `${position.productName} valuation snapshot`, `${position.productName} 估值快照`), date: position.valuedAt, amount: formatUsdt(position.marketValue, locale), icon: LineChart }))
  const rows = [...distributions, ...snapshots].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return rows.length ? <div className="p0a-calendar-list glass">{rows.map(({ key, title, date, amount, icon: Icon }) => <div key={key}><span className="p0a-calendar-icon"><Icon size={16} /></span><p><b>{title}</b><small>{formatTime(date, locale, { relative: false })}</small></p><strong>{amount}</strong></div>)}</div> : <P0AEmpty icon={CalendarDays} title={copy(locale, 'No historical distributions', '暂无历史分配')} body={copy(locale, 'Recorded distributions and valuation snapshots will appear here when available.', '有已记录的收益分配或估值快照后，会显示在这里。')} />
}

export function YieldCalendarScreen({ go }: { go: Go }) {
  const { locale } = useI18n(); const [positions, setPositions] = useState<PositionView[]>([]); const [ledger, setLedger] = useState<LedgerTransaction[]>([]); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState<string | null>(null)
  const load = () => { setState('loading'); Promise.allSettled([getPositions(), getLedgerTransactions(200)]).then(([positionsResult, ledgerResult]) => { if (positionsResult.status === 'fulfilled') setPositions(positionsResult.value); if (ledgerResult.status === 'fulfilled') setLedger(ledgerResult.value); if (positionsResult.status === 'rejected' && ledgerResult.status === 'rejected') { setState('error'); setError(failureMessage(positionsResult.reason, locale)) } else setState('ready') }) }
  useEffect(load, [locale])
  return <section className="screen p0a-screen p0a-calendar"><RwaTopbar screen="yield-calendar" title={copy(locale, 'Yield calendar', '收益日历')} onBack={() => go('portfolio')} />{state === 'loading' ? <div className="p0a-skeleton-stack"><div /><div /><div /></div> : state === 'error' ? <P0AEmpty icon={CalendarDays} title={copy(locale, 'Calendar unavailable', '收益日历暂不可用')} body={error ?? failureMessage(null, locale)} retry={load} /> : <><P0AHeader eyebrow="PORTFOLIO / DISCLOSURE VIEW" title={copy(locale, 'Income, by date', '按日期查看收益')} body={copy(locale, 'Historical entries come from the ledger. Future timing appears when a product schedule is available.', '历史记录来自账本。产品有排期后，会显示未来时间。')} /><div className="p0a-calendar-summary"><div className="glass"><span className="p0a-card-icon is-mint"><TrendingUp size={18} /></span><p><small>{copy(locale, 'Recorded distributions', '已记录分配')}</small><b>{ledger.filter((tx) => tx.transactionType === 'yield_distribution').length}</b></p></div><div className="glass"><span className="p0a-card-icon"><CalendarDays size={18} /></span><p><small>{copy(locale, 'Positions observed', '已观测持仓')}</small><b>{positions.length}</b></p></div></div><div className="p0a-section-heading"><div><span className="p0a-eyebrow">HISTORY</span><h2>{copy(locale, 'Actual ledger events', '真实账本事件')}</h2></div></div><PositionEvents positions={positions} ledger={ledger} locale={locale} /><div className="p0a-section-heading"><div><span className="p0a-eyebrow">FORWARD LOOK</span><h2>{copy(locale, 'Expected distributions', '预计分配')}</h2></div></div><P0AEmpty icon={Clock3} title={copy(locale, 'No upcoming dates yet', '暂无未来日期')} body={copy(locale, 'Upcoming income dates will appear after a product schedule is published. You can review the recorded events above.', '产品发布排期后会显示未来收益日期。你可以先查看上方的已记录事件。')} /></>}</section>
}

function allocationPercent(position: PositionView, total: bigint | null) {
  if (total === null || total <= BigInt(0) || position.marketValueAtomicAmount === null || !/^\d+$/.test(position.marketValueAtomicAmount)) return null
  return Number((BigInt(position.marketValueAtomicAmount) * BigInt(10_000)) / total) / 100
}

export function RebalanceScreen({ go }: { go: Go }) {
  const { locale } = useI18n(); const [positions, setPositions] = useState<PositionView[]>([]); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState<string | null>(null); const [targets, setTargets] = useState<Record<string, string>>({}); const [validated, setValidated] = useState(false)
  const load = () => { setState('loading'); getPositions().then((data) => { setPositions(data); setTargets({}); setValidated(false); setState('ready') }).catch((reason) => { setState('error'); setError(failureMessage(reason, locale)) }) }
  useEffect(load, [locale])
  const total = positions.reduce<bigint | null>((sum, position) => {
    const atomic = position.marketValueAtomicAmount
    if (sum === null || atomic === null || !/^\d+$/.test(atomic)) return null
    return sum + BigInt(atomic)
  }, BigInt(0))
  const targetTotal = Object.values(targets).reduce((sum, value) => sum + (Number(value) || 0), 0); const hasValuation = total !== null && total > BigInt(0); const targetValid = targetTotal > 0 && Math.abs(targetTotal - 100) < 0.01
  return <section className="screen p0a-screen p0a-rebalance"><RwaTopbar screen="rebalance" title={copy(locale, 'Rebalance', '再平衡')} onBack={() => go('portfolio')} />{state === 'loading' ? <div className="p0a-skeleton-stack"><div /><div /><div /></div> : state === 'error' ? <P0AEmpty icon={ArrowLeftRight} title={copy(locale, 'Rebalance unavailable', '再平衡暂不可用')} body={error ?? failureMessage(null, locale)} retry={load} /> : <><P0AHeader eyebrow="PORTFOLIO WORKBENCH" title={copy(locale, 'Current → target', '当前 → 目标')} body={copy(locale, 'Current weights use live position valuation. Set your own target before reviewing actions.', '当前权重使用真实持仓估值。请先填写自己的目标，再查看调整动作。')}><span className="p0a-live-chip"><span />{hasValuation ? copy(locale, 'Valuation ready', '估值已就绪') : copy(locale, 'Valuation missing', '估值缺失')}</span></P0AHeader>{!positions.length ? <P0AEmpty icon={WalletCards} title={copy(locale, 'No positions to rebalance', '暂无可再平衡持仓')} body={copy(locale, 'Your open positions will appear here when available.', '有可用持仓后，会显示在这里。')} /> : <><div className="p0a-rebalance-head glass"><span>{copy(locale, 'Holding', '持仓')}</span><span>{copy(locale, 'Current', '当前')}</span><span>{copy(locale, 'Target', '目标')}</span><span>{copy(locale, 'Action', '动作')}</span></div><div className="p0a-rebalance-list">{positions.map((position) => { const current = allocationPercent(position, total); const target = Number(targets[position.productId]); const delta = Number.isFinite(target) && current !== null ? target - current : null; return <div className="p0a-rebalance-row glass" key={position.productId}><div><b>{position.productName}</b><small>{formatUsdt(position.marketValue, locale)}</small></div><strong>{current === null ? copy(locale, 'Not available', '暂无') : `${formatMoneyNumber(current, locale, 1)}%`}</strong><label><input type="number" min="0" max="100" step="0.1" inputMode="decimal" placeholder="0" value={targets[position.productId] ?? ''} onChange={(event) => setTargets((old) => ({ ...old, [position.productId]: event.target.value }))} aria-label={`${position.productName} target allocation`} /><span>%</span></label><span className={`p0a-action ${delta === null ? 'is-muted' : delta > .1 ? 'is-up' : delta < -.1 ? 'is-down' : 'is-flat'}`}>{delta === null ? copy(locale, 'Enter a target', '请输入目标') : Math.abs(delta) <= .1 ? copy(locale, 'Hold', '保持') : delta > 0 ? `${copy(locale, 'Add', '增加')} ${formatMoneyNumber(delta, locale, 1)}%` : `${copy(locale, 'Trim', '减少')} ${formatMoneyNumber(Math.abs(delta), locale, 1)}%`}</span></div>})}</div><div className="p0a-rebalance-footer glass"><div><span>{copy(locale, 'Target total', '目标合计')}</span><b className={targetValid ? 'is-valid' : ''}>{formatMoneyNumber(targetTotal, locale, 1)}%</b></div><small>{targetValid ? copy(locale, 'Target weights are internally consistent. This is a local draft; execution remains disabled until the rebalance action is available.', '目标权重已通过内部校验。这是本地草稿，相关动作开放前不会执行。') : copy(locale, 'Enter targets that add up to 100% to review the draft.', '输入合计 100% 的目标后再查看草稿。')}</small><button type="button" className="p0a-primary-button" disabled={!targetValid} onClick={() => setValidated(true)}><Target size={16} />{validated ? copy(locale, 'Draft validated', '草稿已校验') : copy(locale, 'Validate draft', '校验草稿')}</button></div></>}</>}</section>
}

function statementRows(transactions: LedgerTransaction[], locale: string) {
  return transactions.map((transaction) => { const entry = transaction.entries[0]; const change = userSideAmount(transaction); const display = ledgerDisplay(transaction.transactionType, locale); return { id: transaction.id, date: transaction.effectiveAt, month: dateLabel(transaction.effectiveAt, locale, { month: 'long', year: 'numeric' }), type: display.label, rawType: transaction.transactionType, amount: change.amount, direction: display.direction, asset: entry?.assetCode ?? 'USDT' } })
}

export function StatementsScreen({ go }: { go: Go }) {
  const { locale } = useI18n(); const [transactions, setTransactions] = useState<LedgerTransaction[]>([]); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState<string | null>(null)
  const load = () => { setState('loading'); getLedgerTransactions(200).then((data) => { setTransactions(data); setState('ready') }).catch((reason) => { setState('error'); setError(failureMessage(reason, locale)) }) }
  useEffect(load, [locale])
  const rows = useMemo(() => statementRows(transactions, locale), [transactions, locale]); const months = useMemo(() => { const groups = new Map<string, typeof rows>(); rows.forEach((row) => groups.set(row.month, [...(groups.get(row.month) ?? []), row])); return [...groups.entries()] }, [rows])
  const statementTotals = useMemo(() => rows.reduce((result, row) => { if (row.direction === 'in') result.inflow += row.amount; else if (row.direction === 'out') result.outflow += row.amount; else if (row.direction === 'hold') result.hold += row.amount; return result }, { inflow: 0, outflow: 0, hold: 0 }), [rows])
  const statementSummaryValue = (amount: number, sign: 'in' | 'out' | 'hold') => `${amount ? formatMoney(amount, locale, { sign }) : formatMoney(0, locale)} USDT`
  const exportCsv = () => { if (!rows.length || typeof window === 'undefined') return; const header = ['id', 'effective_at', 'type', 'asset', 'direction', 'amount']; const body = rows.map((row) => [row.id, row.date, row.type, row.asset, row.direction, row.amount.toString()]); const csv = [header, ...body].map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `rwa-lat-statements-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url) }
  return <section className="screen p0a-screen p0a-statements"><RwaTopbar screen="statements" title={copy(locale, 'Statements', '账单')} onBack={() => go('records')} />{state === 'loading' ? <div className="p0a-skeleton-stack"><div /><div /><div /></div> : state === 'error' ? <P0AEmpty icon={FileText} title={copy(locale, 'Statements unavailable', '账单暂不可用')} body={error ?? failureMessage(null, locale)} retry={load} /> : <><P0AHeader eyebrow="LEDGER / EXPORT" title={copy(locale, 'Your statement trail', '你的账本轨迹')} body={copy(locale, 'Every row is read from the ledger. Export the records currently shown here.', '每一行都来自账本。导出当前页面显示的记录。')}><button type="button" className="p0a-primary-button" onClick={exportCsv} disabled={!rows.length}><Download size={16} />{copy(locale, 'Export CSV', '导出 CSV')}</button></P0AHeader><div className="p0a-statement-summary"><div className="glass"><small>{copy(locale, 'Transactions', '交易笔数')}</small><b>{rows.length}</b><em>{copy(locale, 'ledger rows', '账本记录')}</em></div><div className="glass"><small>{copy(locale, 'Covered months', '覆盖月份')}</small><b>{months.length}</b><em>{copy(locale, 'active period', '覆盖时段')}</em></div></div>{months.length ? <div className="p0a-statement-groups">{months.map(([month, items]) => <section key={month}><div className="p0a-section-heading"><div><span className="p0a-eyebrow">STATEMENT</span><h2>{month}</h2></div><span className="p0a-count-chip">{items.length}</span></div><div className="p0a-statement-list glass">{items.map((row) => <div key={row.id}><span className={`p0a-ledger-icon ${directionClass(row.direction)}`}><ArrowDownRight size={16} /></span><p><b>{row.type}</b><small>{formatTime(row.date, locale, { relative: false })} · {shortId(row.id)}</small></p><strong className={`money-sm ${directionClass(row.direction)}`}>{formatLedgerAmount(row.amount, row.rawType, locale)}<small>{row.asset}</small></strong></div>)}</div></section>)}</div> : <P0AEmpty icon={FileText} title={copy(locale, 'No ledger transactions', '暂无账本交易')} body={copy(locale, 'A statement will appear after the ledger records a wallet, order, or distribution event.', '账本记录充值、订单或收益事件后会显示账单。')} />}<div className="statement-summary-bar glass"><span><small>{copy(locale, 'Inflow', '流入')}</small><b className="money-sm direction-in">{statementSummaryValue(statementTotals.inflow, 'in')}</b></span><span><small>{copy(locale, 'Outflow', '流出')}</small><b className="money-sm direction-out">{statementSummaryValue(statementTotals.outflow, 'out')}</b></span><span><small>{copy(locale, 'Pending', '处理中')}</small><b className="money-sm direction-hold">{statementSummaryValue(statementTotals.hold, 'hold')}</b></span></div></>}</section>
}
