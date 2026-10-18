'use client'
import type { RwaScreen } from '@/lib/rwa-routes'
import { type AiPageContext } from '@/lib/ai-page-context'
import dynamic from 'next/dynamic'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, AlertTriangle, Bell, ChartNoAxesColumnIncreasing, Bookmark, CalendarDays, ChevronRight, Building2, CircleCheck, CircleDollarSign, Copy, Cpu, FileText, Globe2, Headphones, Network, ReceiptText, ShieldCheck, type LucideIcon } from 'lucide-react'
import { type AssetSceneKind } from '../asset-scenes'
import RwaTopbar from '../rwa-topbar'
import { accountCopy, detailCopy, interpolateCopy, screenCopy } from '@/lib/screen-copy'
import { portfolioDetailCopy } from '@/lib/portfolio-detail-copy'
import { trustActionCopy } from '@/lib/trust-action-copy'
import { assetExperienceCopy } from '@/lib/asset-experience-copy'
import { categoryLabel } from '@/lib/catalog-localization'
import { AiChatScreen } from '@/components/maison/AiChatScreen'
import { trustCopy as trustPageCopy, scamCopy } from '@/lib/maison-trust-copy'
import { getWallet, toUnits as walletUnits, type WalletView } from '@/lib/wallet-data'
import { getAssetHistory, type AssetHistoryPoint } from '@/lib/p0a-data'
import { rwaToProduct, type RwaAssetRow } from '@/lib/rwa-data'
import { type DemoProduct } from '@/lib/h5-data'
import { projectProfiles } from '@/lib/demo-catalog'
import { useI18n } from '@/lib/i18n'
import { assetAccountRouteCopy } from '@/lib/route-copy'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import { request } from '@/lib/api/_http'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/Empty'
import { Skeleton } from '../ui/skeleton'
import { type PricePoint } from '../charts/PriceArea'
import { TokenUSDT } from '@web3icons/react'
const PublishedOfficialChannels = dynamic(() => import('../published-platform').then((m) => ({ default: m.PublishedOfficialChannels })), { ssr: false })
const PublishedPlatform = dynamic(() => import('../published-platform').then((m) => ({ default: m.PublishedPlatform })), { ssr: false })
const PublishedProductDisclosures = dynamic(() => import('../published-product-disclosures').then((m) => ({ default: m.PublishedProductDisclosures })), { ssr: false })
const NotificationPreferences = dynamic(() => import('../maison/NotificationPreferences').then((m) => ({ default: m.NotificationPreferences })), { ssr: false })
const AssetScene = dynamic(() => import('../asset-scenes'), { ssr: false })
const PolymarketDetailPanel = dynamic(() => import('../polymarket-detail-panel'), { ssr: false })
const AssetEvidencePanel = dynamic(() => import('../p0a-screens').then((m) => ({ default: m.AssetEvidencePanel })), { ssr: false })
const PriceArea = dynamic(() => import('../charts/PriceArea').then((m) => m.PriceArea), { ssr: false })
import type { OrderAsset } from './shared'

type Screen = RwaScreen
type TrustPageKind = 'trust-center' | 'access-regions' | 'product-disclosures' | 'legal-center'
type TrustRow = { title: string; description: string; icon: LucideIcon; destination?: Screen }

function DetailProductVisual({ asset, scene }: { asset: OrderAsset; scene: AssetSceneKind }) {
  const video = asset === 'rwa' ? '/media/opportunities/rwa.mp4' : asset === 'compute' ? '/media/opportunities/compute.mp4' : null
  if (video) {
    return <video className="detail-product-video" src={video} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
  }
  return <AssetScene kind={scene} />
}

function MetricCard({ icon: Icon, main, label, accent = false }: { icon: typeof CircleDollarSign; main: string; label: string; accent?: boolean }) {
  return <div className="metric-card glass"><span><Icon size={25} strokeWidth={1.5} /></span><div><b className={accent ? 'mint' : ''}>{main}</b><small>{label}</small></div></div>
}

function publicProjectCopy(value: string) {
  return value
    .replace(/\bDemo data\b/gi, 'Reference data')
    .replace(/\bDemo PDF\b/gi, 'PDF')
    .replace(/\bDemo\b/gi, 'Reference')
    .replace(/\bIllustrative\b/gi, 'Reference')
}

function ProjectIntelligence({ product, notify }: { product: DemoProduct; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const copy = detailCopy[locale]
  const profile = projectProfiles[product.id]
  if (!profile) return null
  return (
    <section className="project-intelligence" aria-label={`${product.title} project information`}>
      <div className="project-intelligence__facts glass">
        <div><small>{copy.issuer}</small><b>{profile.issuer}</b></div>
        <div><small>{copy.structure}</small><b>{profile.structure}</b></div>
        <div><small>{copy.referenceLocation}</small><b>{profile.location}</b></div>
        <div><small>{copy.targetSize}</small><b>{profile.targetSize}</b></div>
        <div><small>{copy.settlement}</small><b>{profile.settlement}</b></div>
      </div>

      <div className="project-intelligence__narrative glass">
        <small>{copy.thesis}</small><p>{publicProjectCopy(profile.thesis)}</p>
        <small>{copy.cashFlow}</small><p>{publicProjectCopy(profile.cashFlow)}</p>
      </div>

      <div className="project-intelligence__section-head"><span>{copy.milestones}</span><small>{publicProjectCopy(profile.updated)}</small></div>
      <div className="project-timeline glass">
        {profile.milestones.map((milestone) => <div key={milestone.label} className={`project-timeline__item is-${milestone.state}`}><i /><p><b>{milestone.label}</b><small>{milestone.date}</small></p><span>{milestone.state === 'complete' ? copy.complete : milestone.state === 'next' ? copy.next : copy.planned}</span></div>)}
      </div>

      <div className="project-intelligence__section-head"><span>{copy.risks}</span><small>{copy.reviewBefore}</small></div>
      <div className="project-risk-list">
        {profile.risks.map((risk) => <div key={risk}><AlertTriangle size={16} /><span>{publicProjectCopy(risk)}</span></div>)}
      </div>

      <div className="project-intelligence__section-head"><span>{copy.documents}</span><small>{copy.illustrative}</small></div>
      <div className="project-documents glass">
        {profile.documents.map((document) => <button key={document.label} type="button" onClick={() => notify(interpolateCopy(copy.documentOpened, { name: document.label }))}><FileText size={18} /><span><b>{document.label}</b><small>{publicProjectCopy(document.detail)}</small></span><ChevronRight size={17} /></button>)}
      </div>
    </section>
  )
}

export function RwaDetailScreen({ product, go, notify, openOrder, openDynamic }: { product: DemoProduct; go: (screen: Screen) => void; notify: (message: string) => void; openOrder: (asset: OrderAsset) => void; openDynamic: (screen: 'valuation' | 'issuer-profile', slug: string) => void }) {
  const { locale } = useI18n()
  const copy = detailCopy[locale]
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence'>('overview')
  const [asset, setAsset] = useState<Record<string, unknown> | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const slug = product.id.startsWith('rwa-') ? product.id.slice(4) : product.id
  useEffect(() => {
    setLoadState('loading'); setAsset(null)
    if (!slug) { setLoadState('error'); return }
    void request<Record<string, unknown>>(`/v1/rwa/assets/${encodeURIComponent(slug)}`).then((result) => {
      if (!result.ok) { setLoadState('error'); return }
      setAsset(result.data); setLoadState('ready')
    })
  }, [slug])
  const value = (field: string) => { const raw = asset?.[field]; return raw == null || typeof raw === 'object' ? '—' : String(raw) }
  const issuer = asset?.issuer && typeof asset.issuer === 'object' ? asset.issuer as Record<string, unknown> : null
  const resolvedProduct = asset?.slug === slug ? rwaToProduct(asset as RwaAssetRow) : product
  return (
    <section className="screen detail-screen has-fixed-cta">
      <RwaTopbar screen="rwa-detail" title={categoryLabel(product.category, locale)} onBack={() => go('invest')} action={{ label: copy.bookmark, onClick: () => notify(copy.saved), Icon: Bookmark }} />
      {loadState === 'loading' ? <div className="catalog-index-loading" /> : loadState === 'error' || !asset ? <EmptyState variant="card" icon={AlertTriangle} title={locale === 'zh-CN' ? '资产暂不可用' : 'Asset unavailable'} body={locale === 'zh-CN' ? '资产不存在、已下线或暂时无法加载。' : 'This asset is unavailable or could not be loaded.'} action={<button type="button" className="p0a-secondary-button" onClick={() => go('invest')}>{locale === 'zh-CN' ? '返回投资区' : 'Back to Invest'}</button>} /> : <>
      <div className="detail-hero detail-hero--generated" data-flip-target={product.id}><img src="/media/generated/design-v2/treasury-architecture-v1.png" alt="" /></div>
      <div className="detail-identity">
        <h1>{value('name')}</h1>
        <p>{value('symbol')} · {value('assetClass')}</p>
      </div>
      <div className="p0a-detail-tabs" role="tablist" aria-label="Asset detail"><button type="button" role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button type="button" role="tab" aria-selected={activeTab === 'evidence'} className={activeTab === 'evidence' ? 'is-active' : ''} onClick={() => setActiveTab('evidence')}>Evidence</button></div>
      {activeTab === 'overview' && <>
      <div className="metric-grid">
        <MetricCard icon={CircleDollarSign} main={value('priceUsd')} label="USD" />
        <MetricCard icon={CalendarDays} main={value('marketCapUsd')} label="Market cap USD" />
        <MetricCard icon={ShieldCheck} main={value('riskLevel')} label={copy.risk} accent />
        <MetricCard icon={CircleDollarSign} main={value('apy')} label="APY" />
      </div>
      <div className="detail-links glass">
        <button type="button" onClick={() => openDynamic('valuation', slug)}><span><ChartNoAxesColumnIncreasing size={22} /></span><span><b>Price &amp; valuation</b><small>Open real market history.</small></span><ChevronRight size={22} /></button>
        {typeof issuer?.slug === 'string' && <button type="button" onClick={() => openDynamic('issuer-profile', String(issuer.slug))}><span><Building2 size={22} /></span><span><b>Issuer profile</b><small>{String(issuer.name ?? issuer.slug)}</small></span><ChevronRight size={22} /></button>}
      </div>
      </>}
      {activeTab === 'evidence' && <AssetEvidencePanel product={resolvedProduct} />}
      </>}
    </section>
  )
}

export function AiScreen({ go, onClose, pageContext }: { go: (screen: Screen) => void; notify: (message: string) => void; onClose: () => void; pageContext?: AiPageContext }) {
  return <AiChatScreen onClose={onClose} onPlan={() => go('ai-plan')} pageContext={pageContext} />
}



export function DetailHeader({ screen, go, back, title, kind = 'detail' }: { screen?: Screen; go: (screen: Screen) => void; back: Screen; title?: string; kind?: 'detail' | 'flow' | 'tool' | 'trust' | 'list' }) {
  const { t } = useI18n()
  return <RwaTopbar screen={screen} kind={kind} title={title ?? t('nav.invest')} onBack={kind === 'flow' ? undefined : () => go(back)} onClose={kind === 'flow' ? () => go(back) : undefined} />
}

export function AssetDetailScreen({ asset, product, go, openOrder, notify, openDynamic }: { asset: Exclude<OrderAsset, 'rwa'>; product: DemoProduct; go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void; notify: (message: string) => void; openDynamic: (screen: 'valuation' | 'issuer-profile', slug: string) => void }) {
  const { locale } = useI18n()
  const assetCopy = assetExperienceCopy[locale]
  const labels = detailCopy[locale]
  const detail = asset === 'compute'
    ? { scene: 'compute' as AssetSceneKind, overline: assetCopy.compute.overline, title: 'H100 Compute Unit', location: 'Tier III data centers · 98% availability', yield: '18.2%', yieldLabel: screenCopy[locale].invest.projectedApy, term: 'Flexible', minimum: '100 USDT', risk: 'Medium', narrative: assetCopy.compute.narrative, bullets: assetCopy.compute.bullets }
    : asset === 'stocks'
      ? { scene: 'stocks' as AssetSceneKind, overline: assetCopy.stocks.overline, title: 'NVIDIA Exposure', location: 'US market hours · Tokenized settlement', yield: 'AI 92', yieldLabel: accountCopy[locale].score, term: 'T+1', minimum: '50 USDT', risk: 'Medium', narrative: assetCopy.stocks.narrative, bullets: assetCopy.stocks.bullets }
      : { scene: 'prediction' as AssetSceneKind, overline: assetCopy.prediction.overline, title: 'Live market desk', location: 'Public market data · execution subject to distribution access', yield: screenCopy[locale].prediction.live, yieldLabel: screenCopy[locale].prediction.discoveryApi, term: 'Variable', minimum: '10 USDT', risk: 'High', narrative: assetCopy.prediction.narrative, bullets: assetCopy.prediction.bullets }
  const selected = product.category === 'Prediction' || (asset === 'compute' && product.category === 'Compute') || (asset === 'stocks' && product.category === 'Stocks')
    ? { ...detail, title: product.title, location: product.subtitle, yield: product.returnMetric, yieldLabel: product.returnLabel, term: product.liquidity, minimum: product.minimum, risk: product.risk.replace(' Risk', '') }
    : detail
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence'>('overview')
  const [chartDays, setChartDays] = useState(30)
  const [history, setHistory] = useState<AssetHistoryPoint[]>([])
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'empty'>('loading')

  useEffect(() => {
    let cancelled = false
    setHistoryState('loading')
    setHistory([])
    getAssetHistory(product.id, chartDays).then((result) => {
      if (cancelled) return
      const points = Array.isArray(result.points) ? result.points : []
      setHistory(points)
      setHistoryState(points.length ? 'ready' : 'empty')
    }).catch(() => {
      if (!cancelled) setHistoryState('empty')
    })
    return () => { cancelled = true }
  }, [chartDays, product.id])

  const pricePoints: PricePoint[] = history
    .filter((point) => point.priceUsd !== null && point.priceUsd !== undefined && Number.isFinite(Number(point.priceUsd)))
    .map((point) => ({ date: point.date, value: point.priceUsd }))
  const chartCopy = locale === 'zh-CN'
    ? { title: `${chartDays} 日价格走势`, caption: '仅展示已记录的资产价格', loading: '正在加载价格走势', empty: '暂无价格历史', emptyBody: '资产产生至少两个价格观测点后，这里会显示曲线。' }
    : { title: `${chartDays}-day price history`, caption: 'Recorded asset prices only', loading: 'Loading price history', empty: 'No price history yet', emptyBody: 'The curve will appear after the asset has at least two recorded price observations.' }

  return (
    <section className="screen asset-detail-screen has-fixed-cta">
      <DetailHeader screen={asset === 'compute' ? 'compute-detail' : asset === 'stocks' ? 'stock-detail' : 'prediction-detail'} go={go} back="invest" />
      <div className="asset-detail-hero" data-flip-target={product.id}><DetailProductVisual asset={asset} scene={selected.scene} /></div>
      <div className="asset-detail-copy">
        <p>{selected.overline}</p><h1>{selected.title}</h1><span><Network size={15} />{selected.location}</span>
      </div>
      <div className="p0a-detail-tabs" role="tablist" aria-label="Asset detail"><button type="button" role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button type="button" role="tab" aria-selected={activeTab === 'evidence'} className={activeTab === 'evidence' ? 'is-active' : ''} onClick={() => setActiveTab('evidence')}>Evidence</button></div>
      <div className="asset-detail-quick-actions" role="group" aria-label={locale === 'zh-CN' ? '快捷操作' : 'Quick actions'}>
        <Button type="button" variant="default" className="asset-detail-quick-action" onClick={() => openOrder(asset)}><CircleDollarSign size={17} />{asset === 'prediction' ? assetCopy.previewFlow : labels.investUsdt}</Button>
        <Button type="button" variant="outline" className="asset-detail-quick-action" onClick={() => openDynamic('valuation', product.id)}><ChartNoAxesColumnIncreasing size={17} />{locale === 'zh-CN' ? '估值' : 'Valuation'}</Button>
        <Button type="button" variant="outline" className="asset-detail-quick-action" onClick={() => openDynamic('issuer-profile', product.id)}><Building2 size={17} />{locale === 'zh-CN' ? '发行方' : 'Issuer'}</Button>
      </div>
      {activeTab === 'overview' && <>
      <div className="asset-highlight-grid">
        <div className="asset-highlight glass"><small>{selected.yieldLabel}</small><b>{selected.yield}</b></div>
        <div className="asset-highlight glass"><small>{labels.minimum}</small><b>{selected.minimum}</b></div>
        <div className="asset-highlight glass"><small>{labels.liquidity} / {labels.exitWindow}</small><b>{selected.term}</b></div>
        <div className="asset-highlight glass"><small>{labels.risk}</small><b className={product.risk.startsWith('High') ? 'amber' : 'mint'}>{selected.risk}</b></div>
      </div>
      <div className="asset-narrative glass"><p>{selected.narrative}</p><ul>{selected.bullets.map((bullet) => <li key={bullet}><CircleCheck size={16} />{bullet}</li>)}</ul></div>
      <div className="asset-detail-market glass">
        <div className="asset-detail-market__head"><div><span className="p0a-eyebrow">MARKET VIEW</span><h2>{chartCopy.title}</h2></div><small>{chartCopy.caption}</small></div>
        {historyState === 'loading' ? <div className="asset-detail-chart-loading" role="status" aria-label={chartCopy.loading}><Skeleton /></div> : pricePoints.length >= 2 ? <PriceArea points={pricePoints} days={chartDays} onDaysChange={setChartDays} /> : <EmptyState variant="inline" icon={ChartNoAxesColumnIncreasing} title={chartCopy.empty} body={chartCopy.emptyBody} />}
      </div>
      {(asset === 'stocks' || asset === 'prediction') && <div className="deal-panel glass">
        <div><small>{assetCopy.actualProvider}</small><b>{asset === 'stocks' ? assetCopy.stocks.provider : assetCopy.prediction.provider}</b></div>
        <div><small>{assetCopy.legalForm}</small><b>{asset === 'stocks' ? assetCopy.stocks.legal : assetCopy.prediction.legal}</b></div>
        <div><small>{assetCopy.returnSource}</small><b>{asset === 'stocks' ? assetCopy.stocks.returns : assetCopy.prediction.returns}</b></div>
        <div><small>{assetCopy.exitRule}</small><b>{asset === 'stocks' ? assetCopy.stocks.exit : assetCopy.prediction.exit}</b></div>
      </div>}
      {asset === 'prediction' && product.id.startsWith('polymarket-')
        ? <PolymarketDetailPanel marketId={product.id.replace(/^polymarket-/, '')} marketHint={{ question: product.title, yesProbability: Number.parseInt(product.returnMetric, 10) / 100 }} regionStatus="unknown" onReviewOrder={() => openOrder('prediction')} />
        : <ProjectIntelligence product={product} notify={notify} />}
      <div className="detail-links glass p0a-asset-links"><button type="button" onClick={() => openDynamic('valuation', product.id)}><span><ChartNoAxesColumnIncreasing size={21} /></span><span><b>Price &amp; valuation</b><small>Real market history and value axes.</small></span><ChevronRight size={20} /></button><button type="button" onClick={() => openDynamic('issuer-profile', product.id)}><span><Building2 size={21} /></span><span><b>Issuer profile</b><small>Source issuer and linked assets.</small></span><ChevronRight size={20} /></button></div>
      </>}
      {activeTab === 'evidence' && <AssetEvidencePanel product={product} />}
      <div className="asset-disclosure"><AlertTriangle size={16} />{assetCopy.disclosure}</div>
      <button className="invest-cta" type="button" onClick={() => openOrder(asset)}><CircleDollarSign size={24} />{asset === 'prediction' ? assetCopy.previewFlow : labels.investUsdt}</button>
    </section>
  )
}

export function AssetAccountScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const copy = portfolioDetailCopy[locale]
  const assetCopy = assetAccountRouteCopy[locale]
  const [wallet, setWallet] = useState<WalletView | null>(null)
  useEffect(() => {
    getWallet().then((w) => setWallet(w)).catch(() => setWallet(null))
  }, [])
  const decimals = wallet?.asset.decimals ?? 6
  const available = walletUnits(wallet?.balances.availableAtomic, decimals)
  const invested = walletUnits(wallet?.balances.investedAtomic, decimals)
  const locked = walletUnits(wallet?.balances.lockedAtomic, decimals)
  const pending = walletUnits(wallet?.balances.pendingAtomic, decimals)
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <section className="screen asset-account-screen"><DetailHeader screen="asset-detail" go={go} back="wallet" title={wallet?.asset.code ?? 'USDT'} /><div className="asset-account-balance"><span className="token token--usdt"><TokenUSDT size={22} variant="branded" /></span><p><small>{copy.totalUsdt}</small><b>{fmt(available)}</b><span>{invested > 0 ? `${fmt(invested)} ${assetCopy.invested}` : '—'}</span></p></div><div className="network-balance-list glass"><button type="button"><span>{assetCopy.available}</span><b>{fmt(available)} {wallet?.asset.code ?? 'USDT'}</b><ChevronRight size={18} /></button><button type="button"><span>{assetCopy.invested}</span><b>{fmt(invested)} {wallet?.asset.code ?? 'USDT'}</b><ChevronRight size={18} /></button><button type="button"><span>{assetCopy.locked}</span><b>{fmt(locked + pending)} {wallet?.asset.code ?? 'USDT'}</b><ChevronRight size={18} /></button></div><button className="wide-glass-action glass" type="button" onClick={() => notify(copy.addressCopied)}><Copy size={20} /><span><b>{copy.copyWallet}</b><small>{copy.networkWarning}</small></span><ChevronRight size={20} /></button></section>
}

export function PositionDetailScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  const { locale } = useI18n()
  const copy = portfolioDetailCopy[locale]
  return <section className="screen position-screen"><DetailHeader screen="position-detail" go={go} back="portfolio" title={copy.computePosition} /><div className="position-hero glass"><AssetScene kind="compute" /><div><p>{copy.computeUnit}</p><h1>2,430.00 <span>USDT</span></h1><b>{copy.todayGain}</b></div></div><div className="position-stats"><span><small>{copy.dailyRevenue}</small><b>12.40 USDT</b></span><span><small>{copy.utilization}</small><b>98.1%</b></span><span><small>{copy.revenueEarned}</small><b>430.20 USDT</b></span></div><div className="yield-chart glass"><div className="yield-chart__head"><span>{copy.revenueHistory}</span><b>{copy.last30}</b></div><div className="yield-chart__bars">{[36,48,42,61,57,69,76,73,84,80,93,88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><button className="wide-glass-action glass" type="button" onClick={() => openOrder('compute')}><Cpu size={20} /><span><b>{copy.addCapacity}</b><small>{copy.capacityBody}</small></span><ChevronRight size={20} /></button></section>
}

export function MarketingPreferencesScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  return <section className="screen account-flow-screen"><DetailHeader screen="marketing" go={go} back="profile" title={t('marketing.title')} /><div className="account-flow-hero"><span><Bell size={30} /></span><p>{copy.communicationControl}</p><h1>{t('marketing.heading')}</h1><small>{t('marketing.body')}</small></div><div className="consent-stack glass" style={{ padding: 20 }}><NotificationPreferences /></div></section>
}

export function OfficialChannelsScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader screen="official-channels" go={go} back="profile" title={t('official.title')} /><div className="account-flow-hero"><span><ShieldCheck size={30} /></span><p>{copy.trustCenter}</p><h1>{t('official.heading')}</h1><small>{t('official.body')}</small></div><PublishedOfficialChannels /><div className="anti-scam-callout"><AlertTriangle size={20} /><p><b>{copy.neverShare}</b><small>{copy.depositOnly}</small></p></div><button className="flow-cta" type="button" onClick={() => go('scam-report')}>{t('official.report')}<ArrowRight size={20} /></button></section>
}

export function ScamReportScreen({ go, isGuest, onCreated }: { go: (screen: Screen) => void; isGuest: boolean; onCreated: (id: string) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  const sc = scamCopy[locale]
  const [source, setSource] = useState('')
  const [details, setDetails] = useState('')
  const [ticket, setTicket] = useState<{ id: string; reference: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!source.trim() || !details.trim() || pending || isGuest) return
    // Same text keeps the same key, so a retry after a lost response cannot open a second ticket.
    const key = intentKey ?? crypto.randomUUID()
    setIntentKey(key)
    setPending(true); setError('')
    const result = await request<{ id?: string; reference?: string }>('/v1/user-ops/tickets', { method: 'POST', body: JSON.stringify({ subject: `Scam report: ${source.trim().slice(0, 80)}`, body: `Target: ${source.trim()}
Details: ${details.trim()}`, category: 'scam_report', priority: 'normal' }), idempotencyKey: key })
    setPending(false)
    if (!result.ok) { setError(result.error.status === 0 ? sc.network : result.error.status === 429 ? sc.rateLimited : result.error.status === 401 ? sc.signIn : sc.failed); return }
    const id = typeof result.data.id === 'string' ? result.data.id : ''
    setTicket({ id, reference: typeof result.data.reference === 'string' ? result.data.reference : id })
  }
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader screen="scam-report" go={go} back="official-channels" title={t('scam.title')} /><div className="account-flow-hero"><span><AlertTriangle size={30} /></span><p>{copy.securityReport}</p><h1>{t('scam.heading')}</h1><small>{t('scam.body')}</small></div>
    {isGuest ? <div className="report-success glass"><ShieldCheck size={30} /><p>{sc.signIn}</p><button type="button" onClick={() => go('login')}>{t('guest.signin')}</button></div>
    : ticket ? <div className="report-success glass" role="status"><CircleCheck size={32} /><h2>{copy.reportRecorded}</h2><small>{sc.reference}</small><b dir="ltr">{ticket.reference}</b><p>{sc.followUp}</p>{ticket.id ? <button type="button" onClick={() => onCreated(ticket.id)}>{sc.view}<ChevronRight size={16} /></button> : <button type="button" onClick={() => go('support')}>{sc.view}<ChevronRight size={16} /></button>}</div>
    : <form className="security-report-form glass" aria-busy={pending} onSubmit={(event) => void submit(event)}><label>{t('scam.source')}<input value={source} maxLength={200} dir="auto" disabled={pending} onChange={(event) => { setSource(event.target.value); setIntentKey(null) }} placeholder={copy.sourcePlaceholder} /></label><label>{t('scam.details')}<textarea value={details} maxLength={4700} dir="auto" disabled={pending} onChange={(event) => { setDetails(event.target.value); setIntentKey(null) }} placeholder={copy.detailsPlaceholder} rows={5} /><small className="community-counter" aria-hidden="true">{sc.counter.replace('{n}', String(details.length)).replace('{max}', '4700')}</small></label>{error && <p className="community-feedback" data-tone="error" role="alert">{error}</p>}<button className="flow-cta" disabled={!source.trim() || !details.trim() || pending} type="submit">{pending ? sc.submitting : t('scam.submit')}<ArrowRight size={20} /></button></form>}</section>
}





// Theme moved out of the topbar; Settings is its single home.



export function TrustCenterScreen({ kind, go, notify }: { kind: TrustPageKind; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const localizedCopy = rwaH5Copy[locale]
  const trustCopy = localizedCopy.trust
  const content = kind === 'trust-center'
    ? { eyebrow: t('trust.eyebrow'), title: t('trust.heading'), body: t('trust.body') }
    : kind === 'access-regions' ? trustCopy.access : kind === 'product-disclosures' ? trustCopy.products : trustCopy.legal
  // Sub-pages render only published data; the static access/product/legal rows were unpublished sample claims.
  const rows: TrustRow[] = [
    { title: t('trust.access'), description: t('trust.accessBody'), icon: Globe2, destination: 'access-regions' },
    { title: t('trust.products'), description: t('trust.productsBody'), icon: ReceiptText, destination: 'product-disclosures' },
    { title: t('trust.legal'), description: t('trust.legalBody'), icon: FileText, destination: 'legal-center' },
    { title: t('profile.official'), description: t('official.body'), icon: ShieldCheck, destination: 'official-channels' },
    { title: t('profile.support'), description: t('trust.supportBody'), icon: Headphones, destination: 'support' },
  ]

  return (
    <section className="screen trust-screen">
      <DetailHeader screen={kind} go={go} back={kind === 'trust-center' ? 'profile' : 'trust-center'} title={kind === 'trust-center' ? t('trust.title') : kind === 'access-regions' ? t('trust.access') : kind === 'product-disclosures' ? t('trust.products') : t('trust.legal')} />
      <div className="trust-hero"><p>{content.eyebrow}</p><h1>{content.title}</h1><span>{content.body}</span></div>
      {kind === 'access-regions' && <PublishedPlatform regions />}
      {kind === 'legal-center' && <PublishedPlatform />}
      {kind === 'product-disclosures' && <PublishedProductDisclosures />}
      {kind === 'trust-center' && <div className="trust-list glass">{rows.map(({ title, description, icon: RowIcon, destination }) => (
        <button type="button" key={title} onClick={() => destination ? go(destination) : notify(`${title} · ${localizedCopy.shell.disclosureOpened}`)}>
          <span><RowIcon size={21} /></span><p><b>{title}</b><small>{description}</small></p>{destination ? <ChevronRight size={19} /> : <FileText size={17} />}
        </button>
      ))}</div>}
      <div className="trust-note"><AlertTriangle size={16} />{trustPageCopy[locale].publishedNote}</div>
    </section>
  )
}
