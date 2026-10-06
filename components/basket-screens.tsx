'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BarChart3, ChevronRight, CircleAlert, FileText, Layers3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { basketRouteCopy, type BasketCopy } from '@/lib/route-copy'
import { request } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { useI18n } from '@/lib/i18n'
import RwaTopbar from './rwa-topbar'
import NoticeBanner from './notice-banner'

export type BasketKind = 'list' | 'detail' | 'subscribe' | 'redeem' | 'disclosures' | 'recommend'
type JsonRecord = Record<string, unknown>

const record = (value: unknown): JsonRecord => value && typeof value === 'object' ? value as JsonRecord : {}
const itemsOf = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'))
  const source = record(value)
  for (const key of ['items', 'portfolios', 'disclosures', 'recommended']) {
    if (Array.isArray(source[key])) return source[key].filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'))
  }
  return []
}
const textOf = (value: unknown, fallback = '—') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const money = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="basket-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([option, title]) => <option key={option} value={option}>{title}</option>)}</select></label>
}

type RiskTier = 'steady' | 'balanced' | 'growth'
type TierCopy = { tiers: Record<RiskTier, { name: string; risk: string; line: string }>; other: string; empty: string; minimum: string; fees: string; feesPending: string; noticeTitle: string; noticeBody: string; close: string }
const tierCopy: Record<'zh-CN' | 'en', TierCopy> = {
  'zh-CN': {
    tiers: {
      steady: { name: '稳健档', risk: '低风险', line: '适合偏好低波动、重视本金稳定的投资者。' },
      balanced: { name: '均衡档', risk: '中风险', line: '在稳定与增长之间分散配置。' },
      growth: { name: '进取档', risk: '较高风险', line: '适合能够承受较大净值波动的投资者。' },
    },
    other: '其他', empty: '该档暂无可申购产品', minimum: '起投', fees: '费率', feesPending: '待公布',
    noticeTitle: '产品重组通知',
    noticeBody: '篮子产品已按风险档重组为三档（稳健 / 均衡 / 进取），各产品的目标配置也已按新权重更新。您的持有份额目前保持不变；等值转换会随调仓执行一并完成，届时会在应用内另行通知并提供转换明细。',
    close: '关闭',
  },
  en: {
    tiers: {
      steady: { name: 'Steady', risk: 'Low risk', line: 'For investors who prefer low volatility and capital stability.' },
      balanced: { name: 'Balanced', risk: 'Medium risk', line: 'Diversified between stability and growth.' },
      growth: { name: 'Growth', risk: 'Higher risk', line: 'For investors who can accept larger NAV swings.' },
    },
    other: 'Other', empty: 'No basket available in this tier yet', minimum: 'Min.', fees: 'Fees', feesPending: 'To be announced',
    noticeTitle: 'Product restructuring',
    noticeBody: 'Baskets have been reorganised into three risk tiers (Steady / Balanced / Growth), and each product\u2019s target allocation has been updated accordingly. Your units are unchanged for now; the equal-value conversion happens together with the rebalance, and we will notify you with a conversion breakdown at that time.',
    close: 'Close',
  },
}
const tierOrder: RiskTier[] = ['steady', 'balanced', 'growth']
const tierPill: Record<RiskTier, string> = { steady: 'risk risk--low', balanced: 'risk risk--medium', growth: 'risk risk--high' }
/** Maps the API's free-form `riskLevel` onto a tier; anything unrecognised stays visible under "Other". */
function riskTierOf(value: unknown): RiskTier | null {
  const level = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (/^(low|conservative|steady|stable|稳健|低)/.test(level)) return 'steady'
  if (/^(medium|moderate|balanced|mid|均衡|中)/.test(level)) return 'balanced'
  if (/^(high|growth|aggressive|进取|高)/.test(level)) return 'growth'
  return null
}
/** Fee entries from `terms` as published by the API (…Bps → %, …Pct → %); nothing is filled in client-side. */
function feesOf(terms: unknown): string | null {
  const parts = Object.entries(record(terms)).flatMap(([key, value]) => {
    if (!/fee/i.test(key) || (typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return []
    const number = Number(value)
    const label = key.replace(/(Bps|Pct|Percent|Rate)$/i, '').replace(/fee$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || key
    if (/Bps$/i.test(key) && Number.isFinite(number)) return [`${label} ${(number / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`]
    if (/(Pct|Percent)$/i.test(key) && Number.isFinite(number)) return [`${label} ${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`]
    return [`${label} ${String(value)}`]
  })
  return parts.length ? parts.join(' · ') : null
}

function BasketCard({ item, copy, tiers, onOpen }: { item: JsonRecord; copy: BasketCopy; tiers?: TierCopy; onOpen: () => void }) {
  const name = textOf(item.name, textOf(item.strategyName, copy.title))
  const status = textOf(item.status)
  const minimum = Number(item.minimumSubscriptionUsd)
  return <button type="button" className="basket-card glass" onClick={onOpen}>
    <span className="basket-card__icon"><Layers3 size={22} /></span>
    <span className="basket-card__copy"><small>{textOf(item.strategySlug, 'strategy')}</small><b>{name}</b>
      {tiers
        ? <em>{tiers.minimum} {Number.isFinite(minimum) && item.minimumSubscriptionUsd != null ? `$${money(minimum)}` : '—'} · {tiers.fees} {feesOf(item.terms) ?? tiers.feesPending}</em>
        : <em>{copy.risk}: {textOf(item.riskLevel, '—')}</em>}</span>
    <span className="basket-card__metrics"><small>{copy.nav}</small><strong>{money(item.navPerUnit)}</strong><small>{copy.status} · {status}</small></span>
    <ChevronRight size={18} />
  </button>
}

export function BasketScreen({ kind, basketId, go, openBasket }: { kind: BasketKind; basketId: string | null; go: (screen: RwaScreen) => void; openBasket: (id: string, next?: BasketKind) => void }) {
  const { locale } = useI18n()
  const copy = basketRouteCopy[locale]
  const tiers = tierCopy[locale === 'zh-CN' ? 'zh-CN' : 'en']
  const [portfolios, setPortfolios] = useState<JsonRecord[]>([])
  const [portfolio, setPortfolio] = useState<JsonRecord | null>(null)
  const [disclosures, setDisclosures] = useState<JsonRecord[]>([])
  const [recommendation, setRecommendation] = useState<JsonRecord[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('100')
  const [units, setUnits] = useState('1')
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  const [horizon, setHorizon] = useState('medium')
  const [riskAppetite, setRiskAppetite] = useState('balanced')
  const [focus, setFocus] = useState('diversified')
  const [experience, setExperience] = useState('new')
  const idempotencyKeys = useRef(new Map<string, string>())

  const title = kind === 'list' ? copy.title : kind === 'recommend' ? copy.recommendationTitle : kind === 'disclosures' ? copy.disclosures : textOf(portfolio?.name, copy.title)
  const load = async () => {
    setLoadState('loading')
    setError(null)
    const needsList = kind === 'list' || kind === 'recommend'
    const needsDetail = Boolean(basketId) && kind !== 'list' && kind !== 'recommend'
    const [listResult, detailResult, disclosureResult] = await Promise.all([
      needsList ? request<unknown>('/v1/basket/portfolios') : Promise.resolve(null),
      needsDetail ? request<unknown>(`/v1/basket/portfolios/${encodeURIComponent(basketId as string)}`) : Promise.resolve(null),
      kind === 'disclosures' || needsDetail ? request<unknown>(`/v1/basket/disclosures${portfolio?.strategyId ? `?strategyId=${encodeURIComponent(String(portfolio.strategyId))}` : ''}`) : Promise.resolve(null),
    ])
    if (listResult?.ok) setPortfolios(itemsOf(listResult.data))
    if (detailResult?.ok) setPortfolio(record(detailResult.data))
    if (disclosureResult?.ok) setDisclosures(itemsOf(disclosureResult.data))
    if (listResult && !listResult.ok || detailResult && !detailResult.ok || disclosureResult && !disclosureResult.ok) {
      setLoadState('error')
      setError(copy.unavailable)
    } else setLoadState('ready')
  }
  useEffect(() => { void load() }, [kind, basketId])

  const acknowledgeAll = async () => {
    if (!disclosures.length || pending) { setAcknowledged(true); return }
    setPending(true)
    const results = await Promise.all(disclosures.map((item) => request(`/v1/basket/disclosures/${encodeURIComponent(String(item.id))}/acknowledge`, { method: 'POST', body: JSON.stringify({}) })))
    setPending(false)
    if (results.every((result) => result.ok)) setAcknowledged(true)
    else setError(copy.actionFailed)
  }
  const submit = async (mode: 'subscribe' | 'redeem') => {
    if (!basketId || pending || (disclosures.length > 0 && !acknowledged)) return
    setPending(true)
    const path = `/v1/basket/portfolios/${encodeURIComponent(basketId)}/${mode === 'subscribe' ? 'subscriptions' : 'redemptions'}`
    const body = mode === 'subscribe' ? { amountUsd: amount.trim() } : { units: units.trim() }
    const result = await request(path, {
      method: 'POST',
      idempotencyKey: idempotencyKeyForIntent(idempotencyKeys.current, 'POST', path, body),
      body: JSON.stringify(body),
    })
    setPending(false)
    if (!result.ok) { setError(copy.actionFailed); return }
    idempotencyKeys.current.clear()
    setError(copy.actionSuccess)
  }
  const runRecommendation = async () => {
    if (pending) return
    setPending(true)
    const result = await request<unknown>('/v1/basket/recommendations', { method: 'POST', body: JSON.stringify({ horizon, riskAppetite, focus, experience }) })
    setPending(false)
    if (!result.ok) { setError(copy.actionFailed); return }
    setRecommendation(itemsOf(record(result.data).recommended ?? result.data))
  }

  const detailStats = useMemo(() => portfolio ? [
    [copy.nav, money(portfolio.navPerUnit)],
    [copy.status, textOf(portfolio.status)],
    [copy.risk, textOf(portfolio.riskLevel)],
  ] : [], [copy, portfolio])
  const tierGroups = useMemo(() => {
    const groups = new Map<RiskTier | null, JsonRecord[]>([...tierOrder.map((tier) => [tier, []] as [RiskTier, JsonRecord[]]), [null, []]])
    for (const item of portfolios) groups.get(riskTierOf(item.riskLevel))?.push(item)
    return groups
  }, [portfolios])
  const renderCards = (items: JsonRecord[]) => items.map((item, index) => <BasketCard item={item} copy={copy} tiers={tiers} key={String(item.id ?? index)} onOpen={() => openBasket(String(item.id), 'detail')} />)

  return <section className="screen basket-screen">
    <RwaTopbar screen="invest" template="T-Child" l1="back" title={title} onBack={() => go(kind === 'list' || kind === 'recommend' ? 'invest' : 'basket-list')} />
    {kind === 'list' && <>
      <div className="basket-hero"><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
      <NoticeBanner id="basket-three-tier-restructure-2026-10" title={tiers.noticeTitle} closeLabel={tiers.close}>{tiers.noticeBody}</NoticeBanner>
      {loadState === 'loading' && <div className="address-book-list">{[0, 1, 2].map((item) => <div className="address-skel" style={{ height: 82 }} key={item} />)}</div>}
      {loadState === 'error' && <div className="address-book-empty is-error"><CircleAlert size={20} /><b>{copy.unavailable}</b><button type="button" onClick={() => void load()}><RefreshCw size={14} /> {copy.retry}</button></div>}
      {loadState === 'ready' && portfolios.length === 0 && <div className="basket-empty glass"><Layers3 size={26} /><b>{copy.emptyTitle}</b><small>{copy.emptyBody}</small></div>}
      {loadState === 'ready' && portfolios.length > 0 && <div className="basket-tiers">
        {tierOrder.map((tier) => {
          const items = tierGroups.get(tier) ?? []
          return <section className="basket-tier" key={tier}>
            <header className="basket-tier__head"><div><h2>{tiers.tiers[tier].name}</h2><span className={tierPill[tier]}>{tiers.tiers[tier].risk}</span></div><p>{tiers.tiers[tier].line}</p></header>
            {items.length ? <div className="basket-stack">{renderCards(items)}</div> : <div className="basket-tier__empty glass">{tiers.empty}</div>}
          </section>
        })}
        {(tierGroups.get(null)?.length ?? 0) > 0 && <section className="basket-tier"><header className="basket-tier__head"><div><h2>{tiers.other}</h2></div></header><div className="basket-stack">{renderCards(tierGroups.get(null) ?? [])}</div></section>}
      </div>}
      <button type="button" className="basket-recommend glass" onClick={() => go('basket-recommend')}><Sparkles size={20} /><span><b>{copy.recommend}</b><small>{copy.recommendationBody}</small></span><ChevronRight size={18} /></button>
    </>}

    {(kind === 'detail' || kind === 'subscribe' || kind === 'redeem') && <>
      {loadState === 'loading' && <div className="catalog-index-loading" />}
      {loadState === 'error' && <div className="address-book-empty is-error"><CircleAlert size={20} /><b>{copy.unavailable}</b><button type="button" onClick={() => void load()}>{copy.retry}</button></div>}
      {loadState === 'ready' && !portfolio && <div className="basket-empty glass"><Layers3 size={24} /><b>{copy.portfolioUnavailable}</b><button type="button" className="quiet-action" onClick={() => go('basket-list')}>{copy.selectPortfolio}</button></div>}
      {loadState === 'ready' && portfolio && <>
        <div className="basket-detail-hero glass"><div><span>{copy.eyebrow}</span><h1>{textOf(portfolio.name, copy.title)}</h1><p>{textOf(portfolio.strategyName, textOf(portfolio.strategySlug))}</p></div><BarChart3 size={45} /></div>
        <div className="basket-metrics">{detailStats.map(([label, value]) => <span className="glass" key={label}><small>{label}</small><b>{value}</b></span>)}</div>
        {kind === 'detail' && <>
          <div className="section-title"><h2>{copy.holdings}</h2><button type="button" onClick={() => openBasket(basketId as string, 'disclosures')}>{copy.disclosures}</button></div>
          <div className="record-stack glass">{itemsOf(portfolio.holdings).length ? itemsOf(portfolio.holdings).map((holding, index) => <div key={String(holding.assetId ?? index)}><Layers3 size={18} /><span><b>{textOf(holding.name, textOf(holding.slug))}</b><small>{textOf(holding.assetClass)} · {textOf(holding.targetWeightPct, '0')}%</small></span><strong>{money(holding.marketValueUsd)}</strong></div>) : <div className="basket-empty"><FileText size={20} /><small>{copy.noHoldings}</small></div>}</div>
          <button className="flow-cta" type="button" onClick={() => openBasket(basketId as string, 'subscribe')}>{copy.subscribe}<ArrowRight size={19} /></button>
          <button className="quiet-action" type="button" onClick={() => openBasket(basketId as string, 'redeem')}>{copy.redeem}</button>
        </>}
        {(kind === 'subscribe' || kind === 'redeem') && <div className="basket-action-panel glass">
          <ShieldCheck size={22} /><h2>{kind === 'subscribe' ? copy.subscribe : copy.redeem}</h2><p>{copy.disclosureBody}</p>
          {kind === 'subscribe' ? <label className="basket-field"><span>{copy.amount}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} /></label> : <label className="basket-field"><span>{copy.units}</span><input inputMode="decimal" value={units} onChange={(event) => setUnits(event.target.value.replace(/[^0-9.]/g, ''))} /></label>}
          {disclosures.length > 0 && <button type="button" className={`basket-ack ${acknowledged ? 'is-acknowledged' : ''}`} onClick={() => void acknowledgeAll()} disabled={pending}>{acknowledged ? copy.acknowledged : copy.acknowledge}</button>}
          {error && <small className="basket-error">{error}</small>}
          <button className="flow-cta" type="button" disabled={pending || (disclosures.length > 0 && !acknowledged)} onClick={() => void submit(kind)}>{pending ? copy.submitting : copy.submit}<ArrowRight size={19} /></button>
        </div>}
      </>}
    </>}

    {kind === 'disclosures' && <>
      <div className="basket-hero"><span>{copy.eyebrow}</span><h1>{copy.disclosures}</h1><p>{copy.disclosureBody}</p></div>
      <div className="basket-disclosure-stack">{disclosures.length ? disclosures.map((item, index) => <article className="glass" key={String(item.id ?? index)}><b>{textOf(item.title, copy.disclosures)}</b><small>{textOf(item.version)}</small><p>{textOf(item.content)}</p><button type="button" onClick={() => void acknowledgeAll()}>{acknowledged ? copy.acknowledged : copy.acknowledge}<ChevronRight size={16} /></button></article>) : <div className="basket-empty glass"><FileText size={24} /><small>{copy.noHoldings}</small></div>}</div>
    </>}

    {kind === 'recommend' && <>
      <div className="basket-hero"><span>{copy.eyebrow}</span><h1>{copy.recommendationTitle}</h1><p>{copy.recommendationBody}</p></div>
      <div className="basket-form glass">
        <SelectField label={copy.horizon} value={horizon} onChange={setHorizon} options={[["short", copy.short], ["medium", copy.medium], ["long", copy.long]]} />
        <SelectField label={copy.riskAppetite} value={riskAppetite} onChange={setRiskAppetite} options={[["conservative", copy.conservative], ["balanced", copy.balanced], ["growth", copy.growth]]} />
        <SelectField label={copy.focus} value={focus} onChange={setFocus} options={[["income", copy.income], ["growth", copy.growth], ["diversified", copy.diversified]]} />
        <SelectField label={copy.experience} value={experience} onChange={setExperience} options={[["new", copy.new], ["intermediate", copy.intermediate], ["experienced", copy.experienced]]} />
        {error && <small className="basket-error">{error}</small>}
        <button className="flow-cta" type="button" disabled={pending} onClick={() => void runRecommendation()}>{pending ? copy.submitting : copy.runRecommendation}<ArrowRight size={19} /></button>
      </div>
      {recommendation.length > 0 && <div className="basket-recommendations"><div className="section-title"><h2>{copy.recommendationResult}</h2></div>{recommendation.map((item, index) => <BasketCard key={String(item.portfolioId ?? index)} item={{ ...item, id: item.portfolioId, name: item.name, strategySlug: item.slug, riskLevel: `${textOf(item.fitScore)}% fit` }} copy={copy} onOpen={() => openBasket(String(item.portfolioId), 'detail')} />)}</div>}
      {loadState === 'ready' && portfolios.length === 0 && recommendation.length === 0 && <div className="basket-empty glass"><small>{copy.noRecommendation}</small></div>}
    </>}
  </section>
}
