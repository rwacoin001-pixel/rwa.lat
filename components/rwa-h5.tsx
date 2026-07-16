'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  AlertTriangle,
  Bell,
  Bookmark,
  Bot,
  CalendarDays,
  ChartPie,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Copy,
  Cpu,
  CreditCard,
  FileText,
  Globe2,
  House,
  Headphones,
  KeyRound,
  Landmark,
  LogOut,
  MessageCircle,
  Network,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import AssetScene, { type AssetSceneKind } from './asset-scenes'
import AnimatedBrand from './animated-brand'
import AuthExperience from './auth-experience'
import LanguageMenu from './language-menu'
import { accountCopy, detailCopy, interpolateCopy, orderCopy, screenCopy } from '@/lib/screen-copy'
import { operationText, operationsCopy } from '@/lib/operations-copy'
import { accountFlowCopy, accountFlowText, type AccountFlowKind } from '@/lib/account-flow-copy'
import { portfolioDetailCopy } from '@/lib/portfolio-detail-copy'
import { trustActionCopy, trustActionText } from '@/lib/trust-action-copy'
import { orderStatusCopy, orderStatusText } from '@/lib/order-status-copy'
import { assetExperienceCopy } from '@/lib/asset-experience-copy'
import { categoryLabel, localizeProduct } from '@/lib/catalog-localization'
import PolymarketDetailPanel from './polymarket-detail-panel'
import { pathForScreen, type RwaScreen } from '@/lib/rwa-routes'
import { getProducts, getFeaturedProducts, getProjectProfile, demoLogin, isAuthenticated, setAuthToken, type DemoCategory, type DemoProduct } from '@/lib/h5-data'
import { demoProducts as fallbackProducts, featuredProducts as fallbackFeatured, projectProfiles } from '@/lib/demo-catalog'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'

type Screen = RwaScreen
type OrderAsset = 'compute' | 'rwa' | 'stocks' | 'prediction'
type PrimaryScreen = 'home' | 'invest' | 'portfolio' | 'wallet'
type InvestCategory = 'All' | 'Compute' | 'RWA' | 'Stocks' | 'Prediction'
type RiskFilter = 'all' | 'low' | 'medium' | 'high'
type AvailabilityFilter = 'all' | 'open' | 'limited'
type MinimumFilter = 'all' | '100' | '500'
type SortMode = 'featured' | 'yield' | 'minimum' | 'risk'

const categories: InvestCategory[] = ['All', 'Compute', 'RWA', 'Stocks', 'Prediction']
const riskOrder: Record<string, number> = { 'Low Risk': 1, 'Medium Risk': 2, 'High Risk': 3 }

function minimumValue(product: DemoProduct) {
  return Number(product.minimum.replace(/[^\d.]/g, '')) || Number.POSITIVE_INFINITY
}

function isOpenProduct(product: DemoProduct) {
  return /open|daily|market open/i.test(product.availability)
}
const protectedScreens: Screen[] = ['portfolio', 'wallet', 'order-review', 'order-processing', 'order-success', 'order-partial', 'order-failed', 'order-receipt', 'deposit', 'withdraw', 'transfer', 'wallet-success', 'activity', 'asset-detail', 'position-detail', 'ai-plan', 'kyc', 'security', 'referral', 'records', 'support', 'settings', 'marketing', 'close-account']

const homeOpportunities: Array<{ category: DemoCategory; kind: AssetSceneKind }> = [
  { category: 'Compute', kind: 'compute' },
  { category: 'RWA', kind: 'solar' },
  { category: 'Stocks', kind: 'stocks' },
  { category: 'Prediction', kind: 'prediction' },
]

const opportunityArtwork: Record<AssetSceneKind, string> = {
  compute: '/asset-icons/compute.png',
  solar: '/asset-icons/rwa.png',
  stocks: '/asset-icons/stocks.png',
  prediction: '/asset-icons/prediction.png',
  wallet: '/media/opportunity-source/compute.png',
  portfolio: '/media/opportunity-source/stocks.png',
  'solar-dome': '/media/opportunity-source/rwa.png',
}

const productAsset: Record<Exclude<InvestCategory, 'All'>, OrderAsset> = {
  Compute: 'compute',
  RWA: 'rwa',
  Stocks: 'stocks',
  Prediction: 'prediction',
}

function detailRoute(asset: OrderAsset): Screen {
  if (asset === 'compute') return 'compute-detail'
  if (asset === 'stocks') return 'stock-detail'
  if (asset === 'prediction') return 'prediction-detail'
  return 'rwa-detail'
}

type TopBarContext = {
  title: string
  meta?: string
  Icon: LucideIcon
  action?: { Icon: LucideIcon; label: string; onClick: () => void; badge?: boolean }
}

function TopBar({ onProfile, onNotifications, context }: { onProfile: () => void; onNotifications: () => void; context?: TopBarContext }) {
  const { locale } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const action = context?.action ?? { Icon: Bell, label: shellCopy.notifications, onClick: onNotifications, badge: true }
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {context ? <div className="context-topbar__title"><span><context.Icon size={20} /></span><div><b>{context.title}</b>{context.meta && <small>{context.meta}</small>}</div></div> : <AnimatedBrand />}
        <div className="topbar-actions">
          <LanguageMenu />
          <button className="round-control notification-control" type="button" aria-label={action.label} onClick={action.onClick}>
            <action.Icon size={20} strokeWidth={1.7} />{action.badge && <i />}
          </button>
          <button className="profile-orb" type="button" aria-label={shellCopy.openProfile} onClick={onProfile}>
            <Bot size={25} strokeWidth={1.45} />
          </button>
        </div>
      </div>
    </header>
  )
}

function BottomDock({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const items: Array<{ id: PrimaryScreen; label: string; icon: typeof House }> = [
    { id: 'home', label: t('nav.home'), icon: House },
    { id: 'invest', label: t('nav.invest'), icon: TrendingUp },
    { id: 'portfolio', label: t('nav.portfolio'), icon: ChartPie },
    { id: 'wallet', label: t('nav.wallet'), icon: WalletCards },
  ]
  return (
    <nav className="liquid-dock" aria-label={shellCopy.primaryNavigation}>
      <div className="liquid-dock__pill">
        <span className="liquid-dock__shine" />
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`dock-link ${screen === id ? 'is-active' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
            <span className="dock-link__icon"><Icon size={21} strokeWidth={1.65} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button type="button" className={`ai-orb ${screen === 'ai' ? 'is-active' : ''}`} aria-label={t('nav.ai')} onClick={() => setScreen('ai')}>
        <span className="ai-orb__ring" />
        <MessageCircle size={27} strokeWidth={1.55} />
        <i />
      </button>
    </nav>
  )
}

function OrbitBadge({ className, icon: Icon, label, value }: { className: string; icon: typeof Landmark; label: string; value: string }) {
  return <div className={`orbit-label ${className}`}><span className="orbit-label__icon"><Icon size={13} strokeWidth={2.7} /></span><span className="orbit-label__copy">{label}<b>{value}</b></span></div>
}

function OpportunityMedia({ kind }: { kind: AssetSceneKind }) {
  return <span className="opportunity-media"><img src={opportunityArtwork[kind]} alt="" /></span>
}

function DetailProductVisual({ asset, scene }: { asset: OrderAsset; scene: AssetSceneKind }) {
  const video = asset === 'rwa' ? '/media/opportunities/rwa.mp4' : asset === 'compute' ? '/media/opportunities/compute.mp4' : null
  if (video) {
    return <video className="detail-product-video" src={video} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
  }
  return <AssetScene kind={scene} />
}

function productFeeRate(product: DemoProduct) {
  if (product.id === 'tokenized-tbill-91d') return 0.002
  if (product.category === 'Stocks') return 0.0035
  if (product.category === 'Prediction') return 0.005
  return 0.008
}

function HomeScreen({ go, notify, openProduct, isGuest, products, featured }: { go: (screen: Screen) => void; notify: (message: string) => void; openProduct: (product: DemoProduct) => void; isGuest: boolean; products: DemoProduct[]; featured: DemoProduct[] }) {
  const { locale, t } = useI18n()
  const copy = screenCopy[locale].home
  const portfolioText = rwaH5Copy[locale].portfolio
  const incomeMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date('2026-07-28T00:00:00Z'))
  const settlementDate = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date('2026-07-11T00:00:00Z'))
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const toggleTask = (id: string, message: string) => {
    setCompletedTasks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    notify(message)
  }
  const todayTasks = [
    { id: 'risk', title: copy.concentrationTitle, detail: copy.concentrationBody, action: copy.openPlan },
    { id: 'kyc', title: copy.addressTitle, detail: copy.addressBody, action: copy.reviewAccess },
  ]
  return (
    <section className="screen home-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />

      <div className="portfolio-heading">
        {isGuest ? <><p>{copy.publicPreview}</p><h1>{copy.exploreGlobalAssets}</h1><strong>{copy.liveDiscovery}</strong><div>{copy.signInPortfolio}</div></> : <><p>{t('home.totalPortfolio')}</p><h1>$128,540<span>.20</span></h1><strong>+$328.40 <i>·</i> +1.2% {copy.today}</strong><div>{t('home.aiScore')} <b>87</b></div></>}
      </div>

      <div className="globe-hero">
        <video
          className="portfolio-orbit-video"
          src="/media/portfolio-orbit.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={copy.networkAnimation}
        />
        <span className="portfolio-video-sheen" aria-hidden="true" />
        <OrbitBadge className="orbit-label--estate" icon={Landmark} label={copy.realEstate} value="24%" />
        <OrbitBadge className="orbit-label--credit" icon={ShieldCheck} label={copy.privateCredit} value="21%" />
        <OrbitBadge className="orbit-label--compute" icon={Cpu} label={copy.aiCompute} value="28%" />
        <OrbitBadge className="orbit-label--treasury" icon={Landmark} label={copy.tokenizedTreasuries} value="27%" />
      </div>

      <button className="market-brief glass" type="button" onClick={() => go('ai')}>
        <span className="brief-orb"><Sparkles size={20} /></span>
        <span><b>{t('home.marketBrief')}</b><small>{t('home.marketBriefBody')}</small></span>
        <ChevronRight size={22} strokeWidth={1.5} />
      </button>

      <section className="home-market-snapshot" aria-label={copy.snapshotAria}>
        <div className="home-module-head"><span>{t('home.snapshot')}</span><button type="button" onClick={() => notify(copy.marketRefreshed)}>{t('common.refresh')}</button></div>
        <div className="snapshot-grid">
          <button type="button" onClick={() => openProduct(products[0])}><small>{copy.computeDemand}</small><b>98.1%</b><span className="mint">{copy.utilization}</span></button>
          <button type="button" onClick={() => openProduct(products[4])}><small>{copy.rwaIncome}</small><b>12.0%</b><span>Solar Income 2027</span></button>
          <button type="button" onClick={() => isGuest ? go('login') : go('wallet')}><small>{isGuest ? copy.supportedSettlement : copy.availableToDeploy}</small><b>{isGuest ? 'USDT' : '12,540'}</b><span>TRON · Ethereum · Arbitrum</span></button>
        </div>
      </section>

      {!isGuest && <section className="home-action-panel glass" aria-label={copy.tasksAria}>
        <div className="home-module-head"><span>{t('home.actions')}</span><small>{interpolateCopy(copy.reviewedCount, { count: completedTasks.length })}</small></div>
        {todayTasks.map((task) => {
          const complete = completedTasks.includes(task.id)
          return <button key={task.id} type="button" className={complete ? 'is-complete' : ''} onClick={() => toggleTask(task.id, `${task.title} · ${complete ? task.action : copy.reviewed}`)}>
            <span><ShieldCheck size={18} /></span><p><b>{task.title}</b><small>{task.detail}</small></p><em>{complete ? copy.reviewed : task.action}</em><ChevronRight size={17} />
          </button>
        })}
      </section>}

      {!isGuest && <section className="home-income-calendar" aria-label={copy.incomeAria}>
        <div className="home-module-head"><span>{t('home.income')}</span><button type="button" onClick={() => go('portfolio')}>{t('nav.portfolio')}</button></div>
        <button type="button" className="income-calendar-row glass" onClick={() => go('portfolio')}>
          <span className="income-calendar-date"><b>28</b><small>{incomeMonth}</small></span><p><b>Solar Income 2027</b><small>{copy.incomeBody}</small></p><strong>28.60<small>USDT</small></strong><ChevronRight size={18} />
        </button>
      </section>}

      <div className="section-title"><h2>{t('home.explore')}</h2><span /></div>
      <div className="opportunity-grid">
        {homeOpportunities.map((product) => (
          <button key={product.category} type="button" className="opportunity-card glass" onClick={() => {
            const selected = products.find((item) => item.category === product.category)
            if (selected) openProduct(selected)
            else go(detailRoute(productAsset[product.category]))
          }}>
            <OpportunityMedia kind={product.kind} />
            <b>{product.category === 'Compute' ? copy.aiCompute : product.category === 'Prediction' ? screenCopy[locale].invest.prediction : product.category === 'Stocks' ? screenCopy[locale].invest.stocks : 'RWA'}</b>
          </button>
        ))}
      </div>
      <section className="home-featured-projects" aria-label={copy.featuredAria}>
        <div className="home-module-head"><span>{copy.curated}</span><button type="button" onClick={() => go('invest')}>{t('common.viewAll')}</button></div>
        <div className="featured-project-stack">{featured.slice(0, 2).map((product) => { const display = localizeProduct(product, locale); return <button key={product.id} className="featured-project glass" type="button" onClick={() => openProduct(display)}><span className="featured-project__media"><OpportunityMedia kind={product.kind} /></span><span><small>{categoryLabel(product.category, locale)} · {display.risk}</small><b>{display.title}</b><em>{product.returnMetric} {display.returnLabel}</em></span><ChevronRight size={19} /></button> })}</div>
      </section>
      {!isGuest && <section className="home-activity-panel glass" aria-label={copy.activityAria}>
        <div className="home-module-head"><span>{copy.recentActivity}</span><button type="button" onClick={() => go('activity')}>{copy.viewLedger}</button></div>
        <button type="button" onClick={() => go('activity')}><span><Cpu size={18} /></span><p><b>{copy.computeRevenue}</b><small>{portfolioText.positions[0].name} · {copy.today}, 09:34</small></p><strong className="mint">+12.40</strong></button>
        <button type="button" onClick={() => go('activity')}><span><Landmark size={18} /></span><p><b>{copy.rwaSettled}</b><small>Solar Income 2027 · {settlementDate}</small></p><strong>-500.00</strong></button>
      </section>}
    </section>
  )
}

function InvestScreen({ go, notify, openProduct, openPrediction, products }: { go: (screen: Screen) => void; notify: (message: string) => void; openProduct: (product: DemoProduct) => void; openPrediction: (market: PredictionMarket) => void; products: DemoProduct[] }) {
  const { locale, t } = useI18n()
  const copy = screenCopy[locale].invest
  const [category, setCategory] = useState<InvestCategory>('All')
  const [query, setQuery] = useState('')
  const [openControl, setOpenControl] = useState<'filters' | 'sort' | null>(null)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all')
  const [minimumFilter, setMinimumFilter] = useState<MinimumFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('featured')
  useEffect(() => {
    const close = () => setOpenControl(null)
    window.addEventListener('rwa:language-overlay-open', close)
    return () => window.removeEventListener('rwa:language-overlay-open', close)
  }, [])
  const toggleControl = (control: 'filters' | 'sort') => {
    setOpenControl((current) => {
      const next = current === control ? null : control
      if (next) window.dispatchEvent(new CustomEvent('rwa:catalog-overlay-open'))
      return next
    })
  }
  const activeFilterCount = [riskFilter !== 'all', availabilityFilter !== 'all', minimumFilter !== 'all'].filter(Boolean).length
  const resetFilters = () => { setRiskFilter('all'); setAvailabilityFilter('all'); setMinimumFilter('all') }
  const filtered = useMemo(() => {
    const base = products.filter((item) => {
      const riskMatches = riskFilter === 'all' || item.risk.toLowerCase().startsWith(riskFilter)
      const availabilityMatches = availabilityFilter === 'all' || (availabilityFilter === 'open' ? isOpenProduct(item) : !isOpenProduct(item))
      const minimumMatches = minimumFilter === 'all' || minimumValue(item) <= Number(minimumFilter)
      const display = localizeProduct(item, locale)
      return (category === 'All' || item.category === category) && riskMatches && availabilityMatches && minimumMatches && `${display.title} ${display.subtitle} ${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())
    })
    const sorted = [...base]
    if (sortMode === 'yield') sorted.sort((a, b) => parseFloat(b.returnMetric) - parseFloat(a.returnMetric))
    if (sortMode === 'minimum') sorted.sort((a, b) => minimumValue(a) - minimumValue(b))
    if (sortMode === 'risk') sorted.sort((a, b) => (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9))
    return sorted
  }, [availabilityFilter, category, locale, minimumFilter, query, riskFilter, sortMode])
  const marketStats = [
    [copy.balance, '12,540.20', '+2,000 / 24h'],
    [copy.openCapacity, copy.assetCount, copy.settled],
    [copy.aiSignal, copy.positive, copy.computeLeads],
  ]
  const categoryLabels: Record<InvestCategory, string> = { All: copy.all, Compute: copy.compute, RWA: copy.rwa, Stocks: copy.stocks, Prediction: copy.prediction }
  return (
    <section className="screen invest-screen">
      <TopBar context={{ title: t('invest.title'), meta: t('invest.execution'), Icon: TrendingUp, action: { Icon: Bell, label: rwaH5Copy[locale].shell.notifications, onClick: () => go('notifications'), badge: true } }} onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <h1 className="page-title sr-only">{t('invest.title')}</h1>
      <label className="opportunity-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('invest.search')} aria-label={t('invest.search')} /><button type="button" aria-label={copy.clearSearch} onClick={() => setQuery('')}>{query ? '×' : ''}</button></label>
      <div className="catalog-controls">
        {openControl && <button className="catalog-control-scrim" type="button" aria-label={t('invest.closeOptions')} onClick={() => setOpenControl(null)} />}
        <div className={`catalog-control ${openControl === 'filters' ? 'is-open' : ''}`}>
          <button type="button" className={activeFilterCount ? 'is-active' : ''} aria-expanded={openControl === 'filters'} onClick={() => toggleControl('filters')}><SlidersHorizontal size={17} /><span>{t('invest.filters')}</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}<ChevronRight size={16} /></button>
          {openControl === 'filters' && <div className="catalog-popover catalog-popover--filters glass">
            <div className="catalog-popover__head"><span><b>{t('invest.refine')}</b><small>{t('invest.matchCount', { count: filtered.length })}</small></span><button type="button" disabled={!activeFilterCount} onClick={resetFilters}>{t('invest.reset')}</button></div>
            <div className="catalog-filter-group"><p>{t('invest.riskLevel')}</p><div>{([['all', t('invest.allRisk')], ['low', t('invest.low')], ['medium', t('invest.medium')], ['high', t('invest.high')]] as const).map(([value, label]) => <button className={riskFilter === value ? 'is-selected' : ''} type="button" key={value} onClick={() => setRiskFilter(value)}>{label}{riskFilter === value && <Check size={13} />}</button>)}</div></div>
            <div className="catalog-filter-group"><p>{t('invest.availability')}</p><div>{([['all', t('invest.anyStatus')], ['open', t('invest.openNow')], ['limited', t('invest.limited')]] as const).map(([value, label]) => <button className={availabilityFilter === value ? 'is-selected' : ''} type="button" key={value} onClick={() => setAvailabilityFilter(value)}>{label}{availabilityFilter === value && <Check size={13} />}</button>)}</div></div>
            <div className="catalog-filter-group"><p>{t('invest.minimum')}</p><div>{([['all', t('invest.anyAmount')], ['100', '≤ 100 USDT'], ['500', '≤ 500 USDT']] as const).map(([value, label]) => <button className={minimumFilter === value ? 'is-selected' : ''} type="button" key={value} onClick={() => setMinimumFilter(value)}>{label}{minimumFilter === value && <Check size={13} />}</button>)}</div></div>
            <button className="catalog-popover__apply" type="button" onClick={() => setOpenControl(null)}>{t('invest.showCount', { count: filtered.length })}</button>
          </div>}
        </div>
        <div className={`catalog-control ${openControl === 'sort' ? 'is-open' : ''}`}>
          <button type="button" className={sortMode !== 'featured' ? 'is-active' : ''} aria-expanded={openControl === 'sort'} onClick={() => toggleControl('sort')}><span>{sortMode === 'featured' ? t('invest.featured') : sortMode === 'yield' ? t('invest.yieldHigh') : sortMode === 'minimum' ? t('invest.minimumLow') : t('invest.riskLow')}</span><ChevronRight size={16} /></button>
          {openControl === 'sort' && <div className="catalog-popover catalog-popover--sort glass"><div className="catalog-popover__head"><span><b>{t('invest.sortTitle')}</b><small>{t('invest.sortBody')}</small></span></div><div className="catalog-sort-list">{([['featured', t('invest.featured'), t('invest.featuredBody')], ['yield', t('invest.yieldHigh'), t('invest.yieldBody')], ['minimum', t('invest.minimumLow'), t('invest.minimumBody')], ['risk', t('invest.riskLow'), t('invest.riskBody')]] as const).map(([value, label, description]) => <button className={sortMode === value ? 'is-selected' : ''} type="button" key={value} onClick={() => { setSortMode(value); setOpenControl(null) }}><span><b>{label}</b><small>{description}</small></span><i>{sortMode === value && <Check size={14} />}</i></button>)}</div></div>}
        </div>
      </div>

      <div className="market-strip">
        {marketStats.map(([label, value, detail]) => (
          <span key={label} className="glass"><small>{label}</small><b>{value}</b><em>{detail}</em></span>
        ))}
      </div>

      <div className="segmented" role="tablist" aria-label={copy.categoriesAria}>
        {categories.map((item) => <button key={item} role="tab" type="button" className={category === item ? 'is-active' : ''} aria-selected={category === item} onClick={() => setCategory(item)}>{categoryLabels[item]}</button>)}
      </div>

      {(category === 'All' || category === 'Compute') && (
        <button className="compute-feature glass" type="button" onClick={() => go('compute-detail')}>
          <div className="compute-feature__copy">
            <h2>{copy.computeTitle}</h2>
            <p><b>18.2%</b> {copy.projectedApy}</p>
            <span>{copy.from} <b>100 USDT</b></span>
          </div>
          <AssetScene kind="compute" />
        </button>
      )}

      <div className="product-stack">
        {filtered.map((product) => { const display = localizeProduct(product, locale); return (
          <button key={product.id} type="button" className="product-card glass" onClick={() => openProduct(display)}>
            <span className={`catalog-product-media project-visual project-visual--${product.id}`} aria-hidden="true" />
            <span className="product-card__copy"><small className="catalog-eyebrow"><i>DEMO</i>{categoryLabel(product.category, locale)} · {display.availability}</small><b>{display.title}</b><small>{display.subtitle}</small><small className={`risk risk--${product.risk.split(' ')[0].toLowerCase()}`}>{product.returnMetric} {display.returnLabel}</small></span>
            <ChevronRight size={24} strokeWidth={1.35} />
          </button>
        )})}
      </div>
      {!filtered.length && <div className="catalog-empty glass"><Search size={22} /><b>{t('invest.noResults')}</b><small>{copy.noResultsBody}</small><button type="button" onClick={() => { setQuery(''); resetFilters() }}>{copy.resetCatalogue}</button></div>}
      {(category === 'All' || category === 'Prediction') && <PredictionMarketPanel openMarket={openPrediction} notify={notify} />}
      <div className="section-title"><h2>{t('invest.execution')}</h2><span /></div>
      <div className="desk-stack glass">
        <button type="button" onClick={() => notify(copy.usdtRouting)}><WalletCards size={20} /><span><b>{copy.usdtRouting}</b><small>{copy.routingBody}</small></span><ChevronRight size={18} /></button>
        <button type="button" onClick={() => go('ai')}><Sparkles size={20} /><span><b>{copy.preTrade}</b><small>{copy.preTradeBody}</small></span><ChevronRight size={18} /></button>
      </div>

    </section>
  )
}

type PredictionMarket = {
  id: string
  question: string
  slug: string
  outcomes: string[]
  prices: number[]
  volume: number
  volume24h: number
  liquidity: number
  endDate: string | null
  category: string
  acceptingOrders: boolean
}

const demoPredictionMarkets: PredictionMarket[] = [
  { id: 'demo-fed', question: 'Will the Federal Reserve cut rates at the next meeting?', slug: 'demo-fed', outcomes: ['Yes', 'No'], prices: [.68, .32], volume: 1842000, volume24h: 248000, liquidity: 320000, endDate: '2026-08-20T00:00:00Z', category: 'Macro', acceptingOrders: false },
  { id: 'demo-ai', question: 'Will a frontier AI model be released before year-end?', slug: 'demo-ai', outcomes: ['Yes', 'No'], prices: [.57, .43], volume: 962000, volume24h: 117000, liquidity: 184000, endDate: '2026-12-31T00:00:00Z', category: 'Technology', acceptingOrders: false },
  { id: 'demo-energy', question: 'Will global oil demand exceed the current annual forecast?', slug: 'demo-energy', outcomes: ['Yes', 'No'], prices: [.41, .59], volume: 714000, volume24h: 92000, liquidity: 138000, endDate: '2026-12-31T00:00:00Z', category: 'Markets', acceptingOrders: false },
]

function compactValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}

function PredictionMarketPanel({ openMarket, notify }: { openMarket: (market: PredictionMarket) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = screenCopy[locale].prediction
  const [markets, setMarkets] = useState<PredictionMarket[]>(demoPredictionMarkets)
  const [source, setSource] = useState<'loading' | 'polymarket-gamma' | 'demo-fallback'>('loading')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const refreshMarkets = async () => {
    setSource('loading')
    try {
      const response = await fetch('/api/polymarket/markets', { cache: 'no-store' })
      const data = await response.json() as { source: 'polymarket-gamma' | 'demo-fallback'; fetchedAt: string; markets: PredictionMarket[] }
      setMarkets(data.markets.length ? data.markets : demoPredictionMarkets)
      setSource(data.source)
      setUpdatedAt(data.fetchedAt)
      if (data.source === 'demo-fallback') notify(copy.unavailable)
    } catch {
      setSource('demo-fallback')
      notify(copy.unavailable)
    }
  }
  useEffect(() => { void refreshMarkets() }, [])
  return (
    <section className="prediction-desk" aria-label={copy.aria}>
      <div className="section-title"><h2>{copy.desk}</h2><button type="button" onClick={() => void refreshMarkets()}>{source === 'loading' ? copy.refreshing : t('common.refresh')}</button></div>
      <div className="prediction-source glass"><span><i className={source === 'polymarket-gamma' ? 'is-live' : ''} />{source === 'polymarket-gamma' ? copy.live : source === 'loading' ? copy.loading : copy.fallback}</span><small>{updatedAt ? interpolateCopy(copy.updated, { time: new Date(updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : copy.discoveryApi}</small></div>
      <div className="prediction-market-list">
        {markets.slice(0, 4).map((market) => {
          const yesIndex = Math.max(0, market.outcomes.findIndex((outcome) => outcome.toLowerCase() === 'yes'))
          const yesLabel = market.outcomes[yesIndex]?.toLowerCase() === 'yes' ? copy.yes : market.outcomes[yesIndex] ?? market.outcomes[0] ?? copy.yes
          const yesPrice = market.prices[yesIndex] ?? market.prices[0] ?? .5
          return <button className="prediction-market-card glass" type="button" key={market.id} onClick={() => openMarket(market)}>
            <span className="prediction-market-card__meta"><small>{market.category}</small><small>{market.endDate ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(market.endDate)) : copy.openMarket}</small></span>
            <b>{market.question}</b>
            <div><span>{yesLabel} <strong>{Math.round(yesPrice * 100)}¢</strong></span><span>24h {compactValue(market.volume24h)}</span><ChevronRight size={18} /></div>
          </button>
        })}
      </div>
      <p className="prediction-disclosure"><AlertTriangle size={14} />{copy.disclosure}</p>
    </section>
  )
}

const catalogArtwork: Record<DemoCategory, string> = {
  Compute: '/media/generated/compute-catalog-concept-v1.png',
  RWA: '/media/generated/rwa-catalog-concept-v1.png',
  Stocks: '/asset-icons/stocks.png',
  Prediction: '/asset-icons/prediction.png',
}

function MetricCard({ icon: Icon, main, label, accent = false }: { icon: typeof CircleDollarSign; main: string; label: string; accent?: boolean }) {
  return <div className="metric-card glass"><span><Icon size={25} strokeWidth={1.5} /></span><div><b className={accent ? 'mint' : ''}>{main}</b><small>{label}</small></div></div>
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
        <small>{copy.thesis}</small><p>{profile.thesis}</p>
        <small>{copy.cashFlow}</small><p>{profile.cashFlow}</p>
      </div>

      <div className="project-intelligence__section-head"><span>{copy.milestones}</span><small>{profile.updated}</small></div>
      <div className="project-timeline glass">
        {profile.milestones.map((milestone) => <div key={milestone.label} className={`project-timeline__item is-${milestone.state}`}><i /><p><b>{milestone.label}</b><small>{milestone.date}</small></p><span>{milestone.state === 'complete' ? copy.complete : milestone.state === 'next' ? copy.next : copy.planned}</span></div>)}
      </div>

      <div className="project-intelligence__section-head"><span>{copy.risks}</span><small>{copy.reviewBefore}</small></div>
      <div className="project-risk-list">
        {profile.risks.map((risk) => <div key={risk}><AlertTriangle size={16} /><span>{risk}</span></div>)}
      </div>

      <div className="project-intelligence__section-head"><span>{copy.documents}</span><small>{copy.illustrative}</small></div>
      <div className="project-documents glass">
        {profile.documents.map((document) => <button key={document.label} type="button" onClick={() => notify(interpolateCopy(copy.documentOpened, { name: document.label }))}><FileText size={18} /><span><b>{document.label}</b><small>{document.detail}</small></span><ChevronRight size={17} /></button>)}
      </div>
    </section>
  )
}

function RwaDetailScreen({ product, go, notify, openOrder }: { product: DemoProduct; go: (screen: Screen) => void; notify: (message: string) => void; openOrder: (asset: OrderAsset) => void }) {
  const { locale } = useI18n()
  const copy = detailCopy[locale]
  return (
    <section className="screen detail-screen has-fixed-cta">
      <div className="detail-topbar">
        <button className="round-control" type="button" aria-label={copy.back} onClick={() => go('invest')}><ArrowLeft size={23} /></button>
        <span className="detail-topbar__title">{categoryLabel(product.category, locale)}</span>
        <button className="round-control" type="button" aria-label={copy.bookmark} onClick={() => notify(copy.saved)}><Bookmark size={21} strokeWidth={1.5} /></button>
      </div>
      <div className="detail-hero"><DetailProductVisual asset="rwa" scene="solar-dome" /></div>
      <div className="detail-identity">
        <h1>{product.title}</h1>
        <p><span className="country-flag" role="img" aria-label={copy.country} /> {copy.country}</p>
      </div>
      <div className="metric-grid">
        <MetricCard icon={CircleDollarSign} main={product.returnMetric} label={product.returnLabel} />
        <MetricCard icon={CalendarDays} main={product.liquidity} label={copy.liquidity} />
        <MetricCard icon={ShieldCheck} main={product.risk.replace(' Risk', '')} label={copy.risk} accent />
        <MetricCard icon={CircleDollarSign} main={product.minimum} label={copy.minimum} />
      </div>
      <div className="detail-links glass">
        <button type="button" onClick={() => notify(copy.overviewOpened)}><span><Landmark size={22} /></span><span><b>{copy.overview}</b><small>{product.subtitle}</small></span><ChevronRight size={22} /></button>
        <button type="button" onClick={() => notify(copy.memorandumOpened)}><span><FileText size={22} /></span><span><b>{copy.memorandum}</b><small>{copy.memorandumBody}</small></span><ChevronRight size={22} /></button>
      </div>
      <div className="deal-panel glass">
        <div><small>{copy.fee}</small><b>{(productFeeRate(product) * 100).toFixed(2)}%</b></div>
        <div><small>{copy.revenueCycle}</small><b>{copy.monthly}</b></div>
        <div><small>{copy.exitWindow}</small><b>{product.liquidity}</b></div>
      </div>
      <div className="terms-list">
        <span><CircleCheck size={16} />{copy.kycRequired}</span>
        <span><CircleCheck size={16} />{copy.mpcSettlement}</span>
        <span><AlertTriangle size={16} />{copy.yieldWarning}</span>
      </div>
      <ProjectIntelligence product={product} notify={notify} />
      <button className="invest-cta" type="button" onClick={() => openOrder('rwa')}><CircleDollarSign size={25} />{copy.investUsdt}</button>
    </section>
  )
}

function PortfolioScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const portfolioCopy = rwaH5Copy[locale].portfolio
  const [view, setView] = useState<'overview' | 'positions' | 'income' | 'history'>('overview')
  const allocations = [
    [portfolioDetailCopy[locale].compute, '38%', '4,850.00 USDT'],
    ['RWA', '31%', '3,930.00 USDT'],
    [copy.globalStocks, '21%', '2,670.00 USDT'],
    [copy.availableUsdt, '10%', '1,270.20 USDT'],
  ]
  const positionMeta: Array<{ value: string; Icon: LucideIcon }> = [
    { value: '2,430.00 USDT', Icon: Cpu },
    { value: '1,500.00 USDT', Icon: Landmark },
    { value: '1,170.00 USDT', Icon: TrendingUp },
  ]
  const positionRows: Array<{ name: string; detail: string; value: string; change: string; Icon: LucideIcon }> = portfolioCopy.positions.map((position, index) => ({ ...position, ...positionMeta[index] }))
  const incomeAmounts = ['+12.40 USDT', '+124.20 USDT', '+38.60 USDT', '+6.10 USDT']
  return (
    <section className="screen portfolio-screen">
      <TopBar context={{ title: t('portfolio.title'), meta: copy.overview, Icon: ChartPie, action: { Icon: CalendarDays, label: copy.income, onClick: () => go('activity') } }} onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <h1 className="page-title sr-only">{t('portfolio.title')}</h1>
      <div className="portfolio-hero glass">
        <div><p>{t('portfolio.total')}</p><h2>12,720.20 <span>USDT</span></h2><strong>+$284.60 {copy.thisMonth}</strong></div>
        <AssetScene kind="portfolio" />
      </div>
      <div className="portfolio-score"><span><small>{copy.score}</small><b>87</b></span><div><i style={{ width: '87%' }} /></div><p>{copy.scoreBody}</p></div>
      <div className="portfolio-metrics">
        <span className="glass"><small>{copy.today}</small><b>+328.40</b><em>USDT</em></span>
        <span className="glass"><small>{copy.days30}</small><b>+1,284.60</b><em>USDT</em></span>
        <span className="glass"><small>{copy.cash}</small><b>10%</b><em>{copy.reserve}</em></span>
      </div>
      <div className="portfolio-tabs" role="tablist" aria-label={t('portfolio.title')}>{([['overview', copy.overview], ['positions', copy.positions], ['income', copy.income], ['history', copy.history]] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
      {view === 'overview' && <>
        <div className="section-title"><h2>{t('portfolio.allocation')}</h2><button type="button" onClick={() => go('ai')}>{t('portfolio.askAi')}</button></div>
        <div className="allocation-list glass">{allocations.map(([name, percent, value], index) => <button type="button" key={name} onClick={() => go('position-detail')}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{value}</small></span><strong>{percent}</strong><ChevronRight size={18} /></button>)}</div>
        <button className="rebalance-row glass" type="button" onClick={() => go('ai-plan')}><Sparkles size={21} /><span><b>{copy.aiRebalance}</b><small>{copy.rebalanceBody}</small></span><ChevronRight size={21} /></button>
        <div className="risk-monitor glass"><span><ShieldCheck size={20} /><b>{copy.riskEngine}</b></span><p>{copy.riskBody}</p><div><i style={{ width: '68%' }} /></div></div>
      </>}
      {view === 'positions' && <div className="portfolio-detail-list glass">
        {positionRows.map(({ name, detail, value, change, Icon }) => <button key={name} type="button" onClick={() => go('position-detail')}><span><Icon size={19} /></span><p><b>{name}</b><small>{detail}</small></p><strong>{value}<small className="mint">{change}</small></strong><ChevronRight size={17} /></button>)}
      </div>}
      {view === 'income' && <div className="income-view"><div className="income-hero glass"><small>{copy.nextDistribution}</small><b>28.60 USDT</b><span>{portfolioCopy.nextIncome}</span><i /></div><div className="income-ledger glass">{portfolioCopy.incomeRows.map(({ date, label }, index) => <span key={label}><small>{date}</small><b>{label}</b><strong>{incomeAmounts[index]}</strong></span>)}</div></div>}
      {view === 'history' && <div className="history-view"><div className="history-summary glass"><span><small>{portfolioCopy.netContributions}</small><b>10,000.00</b></span><span><small>{portfolioCopy.marketMovement}</small><b className="mint">+1,284.60</b></span><span><small>{portfolioCopy.incomeSettled}</small><b className="mint">+430.20</b></span></div><div className="history-chart glass"><div>{[30, 45, 37, 54, 50, 68, 64, 73, 81, 78, 94, 89].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><span>{portfolioCopy.months.map((month) => <small key={month}>{month}</small>)}</span></div><button className="wide-glass-action glass" type="button" onClick={() => notify(portfolioCopy.exportReady)}><ReceiptText size={20} /><span><b>{portfolioCopy.exportTitle}</b><small>{portfolioCopy.exportBody}</small></span><ChevronRight size={20} /></button></div>}
    </section>
  )
}

function WalletAction({ icon: Icon, label, disabled, onClick }: { icon: typeof ArrowDownToLine; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="wallet-action glass" disabled={disabled} onClick={onClick}><span><Icon size={24} strokeWidth={1.45} /></span><b>{label}</b></button>
}

function WalletScreen({ go, notify, openWalletFlow }: { go: (screen: Screen) => void; notify: (message: string) => void; openWalletFlow: (mode: 'deposit' | 'withdraw' | 'transfer') => void }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <section className="screen wallet-screen">
      <TopBar context={{ title: t('wallet.title'), meta: copy.networks, Icon: WalletCards, action: { Icon: ReceiptText, label: t('wallet.activity'), onClick: () => go('activity') } }} onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <div className="wallet-hero">
        <div className="wallet-copy"><p>{copy.availableBalance}</p><h1>12,540.20 <span>USDT</span></h1><small>≈ $12,538.90 USD</small></div>
        <AssetScene kind="wallet" />
      </div>
      <div className="wallet-action-grid">
        <WalletAction icon={ArrowDownToLine} label={t('wallet.deposit')} onClick={() => openWalletFlow('deposit')} />
        <WalletAction icon={ArrowUpFromLine} label={t('wallet.withdraw')} onClick={() => openWalletFlow('withdraw')} />
        <WalletAction icon={ArrowRightLeft} label={t('wallet.transfer')} onClick={() => openWalletFlow('transfer')} />
        <WalletAction icon={CreditCard} label={t('wallet.fiat')} disabled onClick={() => undefined} />
      </div>
      <div className="wallet-network-row"><Network size={16} />{copy.networks} <span>TRON · Ethereum · Arbitrum</span></div>
      <div className="section-title"><h2>{t('wallet.assets')}</h2></div>
      <div className="wallet-assets glass">
        <button type="button" onClick={() => go('asset-detail')}><span className="token token--usdt">T</span><span><b>USDT</b><small>{copy.availableBalance}</small></span><strong>12,540.20<small>≈ $12,538.90</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('portfolio')}><span className="token"><Cpu size={20} /></span><span><b>{copy.computePositions}</b><small>{copy.activeUnits}</small></span><strong>4,850.00<small>{copy.usdtValue}</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('rwa-detail')}><span className="token"><Landmark size={20} /></span><span><b>{copy.rwaPositions}</b><small>Solar Income</small></span><strong>3,930.00<small>{copy.usdtValue}</small></strong><ChevronRight size={19} /></button>
      </div>
      <div className="section-title"><h2>{t('wallet.activity')}</h2><button type="button" onClick={() => go('activity')}>{t('common.viewAll')}</button></div>
      <div className="activity-list glass">
        <div><span><ArrowDownToLine size={19} /></span><p><b>{copy.deposit}</b><small>TQx7...8vZp</small></p><strong className="mint">+2,000.00 USDT<small>{copy.today}, 09:34</small></strong></div>
        <div><span><TrendingUp size={19} /></span><p><b>{copy.investment}</b><small>Solar Income 2027</small></p><strong>-500.00 USDT<small>{dateFormatter.format(new Date('2026-05-12T14:18:00'))}</small></strong></div>
        <div><span><Sparkles size={19} /></span><p><b>{copy.reward}</b><small>{copy.computeRevenue}</small></p><strong className="mint">+124.20 USDT<small>{dateFormatter.format(new Date('2026-05-10T08:45:00'))}</small></strong></div>
      </div>
    </section>
  )
}

function AiScreen({ go, notify, onClose }: { go: (screen: Screen) => void; notify: (message: string) => void; onClose: () => void }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const planCopy = portfolioDetailCopy[locale]
  const [input, setInput] = useState('')
  return (
    <section className="assistant-sheet">
      <header className="sheet-header sheet-header--ai"><div><span><Sparkles size={15} /> {t('nav.ai')}</span><h2>{copy.aiAdvisor}</h2></div><button className="sheet-close" type="button" aria-label={t('common.back')} onClick={onClose}><X size={21} /></button></header>
      <div className="ai-hero"><span><Bot size={34} /></span><p>{copy.aiAdvisor}</p><h1>{copy.aiHeading}</h1></div>
      <div className="chat-stack">
        <div className="chat chat--user">{copy.userPrompt}</div>
        <div className="chat chat--ai"><b>{copy.balanced}</b><p>40% {planCopy.compute} · 30% {planCopy.rwaIncome} · 20% {planCopy.globalStocks} · 10% USDT</p><button type="button" onClick={() => go('ai-plan')}>{copy.reviewPlan} <ChevronRight size={17} /></button></div>
      </div>
      <form className="chat-input glass" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { notify(copy.analysisGenerated); setInput('') } }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={copy.askPlaceholder} /><button type="submit"><Sparkles size={20} /></button></form>
    </section>
  )
}

function ProfileScreen({ go, notify, sessionMode, onClose, onOpenSection }: { go: (screen: Screen) => void; notify: (message: string) => void; sessionMode: 'guest' | 'authenticated'; onClose: () => void; onOpenSection: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const rows = [
    [t('profile.identity'), copy.verified, ShieldCheck, 'kyc'],
    [t('profile.security'), copy.passkeyEnabled, UserRound, 'security'],
    [t('profile.referral'), copy.inviteEarn, Sparkles, 'referral'],
    [t('profile.records'), copy.ordersSettlements, ReceiptText, 'records'],
    [t('profile.support'), copy.realIssue, Headphones, 'support'],
    [t('profile.marketing'), copy.emailPush, Bell, 'marketing'],
    [t('profile.official'), copy.verifyLinks, ShieldCheck, 'official-channels'],
    [t('profile.trust'), t('trust.body'), FileText, 'trust-center'],
    [t('profile.settings'), copy.languageNotifications, Settings, 'settings'],
  ] as const
  return (
    <section className="profile-sheet">
      <header className="sheet-header sheet-header--profile"><div><span>{t('profile.title')}</span><h2>{sessionMode === 'guest' ? t('guest.badge') : '0x82...92A'}</h2></div><button className="sheet-close" type="button" aria-label={t('common.back')} onClick={onClose}><X size={21} /></button></header>
      <div className="profile-head"><div className="profile-orb profile-orb--large"><Bot size={38} /></div><h1>{sessionMode === 'guest' ? t('guest.badge') : '0x82...92A'}</h1><p><ShieldCheck size={15} /> {sessionMode === 'guest' ? copy.publicSession : t('profile.verified')}</p></div>
      <div className="profile-menu glass">{rows.map(([title, subtitle, Icon, screen]) => <button type="button" key={title} onClick={() => onOpenSection(screen)}><span><Icon size={21} /></span><p><b>{title}</b><small>{subtitle}</small></p><ChevronRight size={19} /></button>)}</div>
      <button className="sign-out-button" type="button" onClick={() => { window.sessionStorage.removeItem('rwa-selected-product'); window.sessionStorage.removeItem('rwa-wallet-flow-mode'); notify(copy.signedOut); go('welcome') }}><LogOut size={19} />{t('profile.signout')}</button>
      <button className="close-account-link" type="button" onClick={() => onOpenSection('close-account')}>{copy.closeAccount}</button>
    </section>
  )
}

function CloseAccountScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const copy = trustActionCopy[locale]
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const canRequest = acknowledged && confirmation.trim().toUpperCase() === 'CLOSE'
  const reasonLabels: Record<string, string> = { privacy: copy.privacyReason, fees: copy.feesReason, support: copy.supportReason, other: copy.otherReason }
  return <section className="screen close-account-screen has-fixed-cta"><DetailHeader go={go} back="profile" title={copy.closeTitle} /><div className="close-account-hero"><span><AlertTriangle size={27} /></span><p>{copy.lifecycle}</p><h1>{copy.closeHeading}</h1><small>{copy.closeBody}</small></div><div className="close-account-balance glass"><span><small>{copy.walletBalance}</small><b>12,540.20 USDT</b></span><span><small>{copy.openPositions}</small><b>{copy.activeAllocations}</b></span><small>{copy.holdingsBlock}</small></div><label className="close-account-reason">{copy.leaving}<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">{copy.selectReason}</option><option value="privacy">{copy.privacyReason}</option><option value="fees">{copy.feesReason}</option><option value="support">{copy.supportReason}</option><option value="other">{copy.otherReason}</option></select></label><label className="close-account-confirm">{copy.typeClose}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="CLOSE" autoCapitalize="characters" /></label><button className={`whitelist-check close-account-check ${acknowledged ? 'is-checked' : ''}`} type="button" onClick={() => setAcknowledged((value) => !value)}><span>{acknowledged && <Check size={14} />}</span><p><b>{copy.closureAck}</b><small>{copy.closureIrreversible}</small></p></button><button className="flow-cta close-account-cta" disabled={!canRequest} type="button" onClick={() => { notify(trustActionText(copy.closureRecorded, { reason: reason ? `: ${reasonLabels[reason]}` : '' })); go('profile') }}>{copy.recordRequest} <ArrowRight size={20} /></button></section>
}

function DetailHeader({ go, back, title }: { go: (screen: Screen) => void; back: Screen; title?: string }) {
  const { locale, t } = useI18n()
  return (
    <div className="detail-topbar">
      <div className="detail-topbar__inner">
        <button className="round-control" type="button" aria-label={detailCopy[locale].back} onClick={() => go(back)}><ArrowLeft size={23} /></button>
        <span className="detail-topbar__title">{title ?? t('nav.invest')}</span>
        <LanguageMenu />
      </div>
    </div>
  )
}

function AssetDetailScreen({ asset, product, go, openOrder, notify }: { asset: Exclude<OrderAsset, 'rwa'>; product: DemoProduct; go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const assetCopy = assetExperienceCopy[locale]
  const labels = detailCopy[locale]
  const detail = asset === 'compute'
    ? { scene: 'compute' as AssetSceneKind, overline: assetCopy.compute.overline, title: 'H100 Compute Unit', location: 'Tier III data centers · 98% availability', yield: '18.2%', yieldLabel: screenCopy[locale].invest.projectedApy, term: 'Flexible', minimum: '100 USDT', risk: 'Medium', narrative: assetCopy.compute.narrative, bullets: assetCopy.compute.bullets }
    : asset === 'stocks'
      ? { scene: 'stocks' as AssetSceneKind, overline: assetCopy.stocks.overline, title: 'NVIDIA Exposure', location: 'US market hours · Tokenized settlement', yield: 'AI 92', yieldLabel: accountCopy[locale].score, term: 'T+1', minimum: '50 USDT', risk: 'Medium', narrative: assetCopy.stocks.narrative, bullets: assetCopy.stocks.bullets }
      : { scene: 'prediction' as AssetSceneKind, overline: assetCopy.prediction.overline, title: 'Live market desk', location: 'Public Gamma market data · execution subject to distribution access', yield: screenCopy[locale].prediction.live, yieldLabel: screenCopy[locale].prediction.discoveryApi, term: 'Variable', minimum: '10 USDT', risk: 'High', narrative: assetCopy.prediction.narrative, bullets: assetCopy.prediction.bullets }
  const selected = product.category === 'Prediction' || (asset === 'compute' && product.category === 'Compute') || (asset === 'stocks' && product.category === 'Stocks')
    ? { ...detail, title: product.title, location: product.subtitle, yield: product.returnMetric, yieldLabel: product.returnLabel, term: product.liquidity, minimum: product.minimum, risk: product.risk.replace(' Risk', '') }
    : detail

  return (
    <section className="screen asset-detail-screen has-fixed-cta">
      <DetailHeader go={go} back="invest" />
      <div className="asset-detail-hero"><DetailProductVisual asset={asset} scene={selected.scene} /></div>
      <div className="asset-detail-copy">
        <p>{selected.overline}</p><h1>{selected.title}</h1><span><Network size={15} />{selected.location}</span>
      </div>
      <div className="asset-highlight-grid">
        <div className="asset-highlight glass"><small>{selected.yieldLabel}</small><b>{selected.yield}</b></div>
        <div className="asset-highlight glass"><small>{labels.minimum}</small><b>{selected.minimum}</b></div>
        <div className="asset-highlight glass"><small>{labels.liquidity} / {labels.exitWindow}</small><b>{selected.term}</b></div>
        <div className="asset-highlight glass"><small>{labels.risk}</small><b className={product.risk.startsWith('High') ? 'amber' : 'mint'}>{selected.risk}</b></div>
      </div>
      <div className="asset-narrative glass"><p>{selected.narrative}</p><ul>{selected.bullets.map((bullet) => <li key={bullet}><CircleCheck size={16} />{bullet}</li>)}</ul></div>
      {(asset === 'stocks' || asset === 'prediction') && <div className="deal-panel glass">
        <div><small>{assetCopy.actualProvider}</small><b>{asset === 'stocks' ? assetCopy.stocks.provider : assetCopy.prediction.provider}</b></div>
        <div><small>{assetCopy.legalForm}</small><b>{asset === 'stocks' ? assetCopy.stocks.legal : assetCopy.prediction.legal}</b></div>
        <div><small>{assetCopy.returnSource}</small><b>{asset === 'stocks' ? assetCopy.stocks.returns : assetCopy.prediction.returns}</b></div>
        <div><small>{assetCopy.exitRule}</small><b>{asset === 'stocks' ? assetCopy.stocks.exit : assetCopy.prediction.exit}</b></div>
      </div>}
      {asset === 'prediction' && product.id.startsWith('polymarket-')
        ? <PolymarketDetailPanel marketId={product.id.replace(/^polymarket-/, '')} marketHint={{ question: product.title, yesProbability: Number.parseInt(product.returnMetric, 10) / 100 }} regionStatus="unknown" onReviewOrder={() => openOrder('prediction')} />
        : <ProjectIntelligence product={product} notify={notify} />}
      <div className="asset-disclosure"><AlertTriangle size={16} />{assetCopy.disclosure}</div>
      <button className="invest-cta" type="button" onClick={() => openOrder(asset)}><CircleDollarSign size={24} />{asset === 'prediction' ? assetCopy.previewFlow : labels.investUsdt}</button>
    </section>
  )
}

function OrderReviewScreen({ asset, product: selectedProduct, go, amount, setAmount }: { asset: OrderAsset; product: DemoProduct; go: (screen: Screen) => void; amount: number; setAmount: (value: number) => void }) {
  const { locale } = useI18n()
  const copy = orderCopy[locale]
  const product = selectedProduct.title
  const expected = `${selectedProduct.returnMetric} ${selectedProduct.returnLabel}`
  const fee = Math.max(1.5, amount * productFeeRate(selectedProduct))
  const [quoteSeconds, setQuoteSeconds] = useState(45)
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  useEffect(() => {
    if (quoteSeconds <= 0) return
    const timer = window.setTimeout(() => setQuoteSeconds((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [quoteSeconds])
  const amountError = amount <= 0 ? copy.enterAmount : amount + fee > 12_540.2 ? copy.balanceExceeded : null
  const quoteExpired = quoteSeconds === 0
  const canSubmit = !amountError && !quoteExpired && riskConfirmed && !isSubmitting
  const submit = () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    window.setTimeout(() => go('order-processing'), 850)
  }
  return (
    <section className="screen order-review-screen has-fixed-cta">
      <DetailHeader go={go} back={detailRoute(asset)} title={copy.review} />
      <div className="order-asset glass"><span className="order-asset__icon">{asset === 'compute' ? <Cpu size={23} /> : asset === 'rwa' ? <Landmark size={23} /> : asset === 'stocks' ? <TrendingUp size={23} /> : <Sparkles size={23} />}</span><div><b>{product}</b><small>{expected}</small></div><ChevronRight size={20} /></div>
      <div className="amount-panel glass"><span>{copy.amount}</span><div><input aria-label={copy.amount} inputMode="decimal" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} /><b>USDT</b></div><small>{copy.available}: 12,540.20 USDT</small><div className="amount-presets">{[100, 500, 1000, 5000].map((value) => <button key={value} type="button" onClick={() => setAmount(value)}>{value.toLocaleString(locale)}</button>)}</div></div>
      <div className="review-breakdown"><span><small>{copy.allocation}</small><b>{amount.toLocaleString(locale, { minimumFractionDigits: 2 })} USDT</b></span><span><small>{copy.fee}</small><b>{fee.toFixed(2)} USDT</b></span><span><small>{copy.total}</small><b>{(amount + fee).toFixed(2)} USDT</b></span></div>
      <div className={`quote-status ${quoteExpired ? 'is-expired' : ''}`}><Clock3 size={16} /><span><b>{quoteExpired ? copy.quoteExpired : interpolateCopy(copy.quoteHeld, { seconds: quoteSeconds })}</b><small>{quoteExpired ? copy.expiredBody : copy.heldBody}</small></span>{quoteExpired && <button type="button" onClick={() => setQuoteSeconds(45)}>{copy.refresh}</button>}</div>
      {amountError && <div className="order-inline-error" role="alert"><AlertTriangle size={16} />{amountError}</div>}
      <button className={`risk-ack glass ${riskConfirmed ? 'is-confirmed' : ''}`} type="button" onClick={() => setRiskConfirmed((current) => !current)}><ShieldCheck size={21} /><p><b>{copy.confirmation}</b><small>{copy.confirmationBody}</small></p><span>{riskConfirmed && <Check size={15} />}</span></button>
      {!riskConfirmed && <div className="order-inline-error order-inline-error--quiet"><AlertTriangle size={16} />{copy.confirmFirst}</div>}
      <button className="flow-cta" type="button" disabled={!canSubmit} onClick={submit}>{isSubmitting ? copy.recording : quoteExpired ? copy.refreshToContinue : asset === 'prediction' ? copy.recordRequest : copy.recordAllocation}<LockKeyholeIcon /></button>
    </section>
  )
}

function LockKeyholeIcon() { return <KeyRound size={21} /> }

function OrderSuccessScreen({ asset, product, go }: { asset: OrderAsset; product: DemoProduct; go: (screen: Screen) => void }) {
  const { locale } = useI18n()
  const copy = orderCopy[locale]
  return (
    <section className="screen success-screen has-fixed-cta">
      <div className="success-orb"><CircleCheck size={38} /></div>
      <p>{copy.successEyebrow}</p><h1>{copy.noExternal}</h1><span>{interpolateCopy(asset === 'prediction' ? copy.predictionSuccess : copy.allocationSuccess, { name: product.title })}</span>
      <div className="success-receipt glass"><span><small>{copy.orderReference}</small><b>RWA-DEMO-240713</b></span><span><small>{copy.executionState}</small><b>{copy.demoOnly}</b></span><span><small>{copy.nextGate}</small><b>{asset === 'prediction' ? copy.partnerIntegration : copy.eligibilitySettlement}</b></span></div>
      <button className="flow-cta" type="button" onClick={() => go('order-receipt')}>{copy.viewReceipt} <ArrowRight size={20} /></button>
      <button className="quiet-action" type="button" onClick={() => go('portfolio')}>{copy.viewPortfolio}</button>
    </section>
  )
}

function OrderStatusScreen({ kind, asset, product, amount, go }: { kind: 'processing' | 'partial' | 'failed' | 'receipt'; asset: OrderAsset; product: DemoProduct; amount: number; go: (screen: Screen) => void }) {
  const { locale } = useI18n()
  const copy = orderStatusCopy[locale]
  const isPrediction = asset === 'prediction'
  const fee = Math.max(1.5, amount * productFeeRate(product))
  const filled = Number((amount * .6).toFixed(2))
  const config = {
    processing: { ...copy.processing, icon: Clock3, tone: 'mint' },
    partial: { ...copy.partial, body: orderStatusText(copy.partial.body, { filled: filled.toLocaleString(locale) }), icon: ChartPie, tone: 'amber' },
    failed: { ...copy.failed, icon: AlertTriangle, tone: 'negative' },
    receipt: { ...copy.receipt, icon: ReceiptText, tone: 'mint' },
  }[kind]
  const Icon = config.icon
  const primary = kind === 'processing' ? { label: copy.continueFlow, next: 'order-success' as Screen } : kind === 'failed' ? { label: copy.returnReview, next: 'order-review' as Screen } : { label: copy.viewPortfolio, next: 'portfolio' as Screen }
  const descriptor = isPrediction ? copy.predictionDescriptor : orderStatusText(copy.allocationDescriptor, { category: categoryLabel(product.category, locale) })
  return <section className={`screen order-status-screen order-status-screen--${config.tone} has-fixed-cta`}><DetailHeader go={go} back={kind === 'receipt' ? 'order-success' : 'order-review'} title={kind === 'receipt' ? copy.orderReceipt : copy.orderStatus} /><div className="order-status-hero"><span><Icon size={31} /></span><p>{config.eyebrow}</p><h1>{config.title}</h1><small>{config.body}</small></div><div className="order-status-product glass"><span>{asset === 'compute' ? <Cpu size={22} /> : asset === 'rwa' ? <Landmark size={22} /> : asset === 'stocks' ? <TrendingUp size={22} /> : <Sparkles size={22} />}</span><p><b>{product.title}</b><small>{descriptor}</small></p><strong>{amount.toLocaleString(locale, { minimumFractionDigits: 2 })}<small>USDT</small></strong></div>{kind === 'processing' && <div className="order-state-timeline glass"><span className="is-complete"><i><Check size={13} /></i><p><b>{copy.requestValidated}</b><small>{copy.requestValidatedBody}</small></p><em>{copy.done}</em></span><span className="is-active"><i><Clock3 size={13} /></i><p><b>{copy.eligibilityQuote}</b><small>{copy.eligibilityQuoteBody}</small></p><em>{copy.checking}</em></span><span><i><ShieldCheck size={13} /></i><p><b>{copy.externalExecution}</b><small>{copy.externalExecutionBody}</small></p><em>{copy.locked}</em></span></div>}{kind === 'partial' && <div className="partial-fill-card glass"><div><span style={{ width: '60%' }} /></div><p><span><small>{copy.filled}</small><b>{filled.toLocaleString(locale)} USDT</b></span><span><small>{copy.released}</small><b>{(amount - filled).toLocaleString(locale)} USDT</b></span></p><small>{copy.noMovement}</small></div>}{kind === 'failed' && <div className="failure-reasons glass"><p><AlertTriangle size={18} /><span><b>{copy.possibleReason}</b><small>{copy.reasonBody}</small></span></p><p><ShieldCheck size={18} /><span><b>{copy.fundsProtected}</b><small>{copy.fundsProtectedBody}</small></span></p></div>}{kind === 'receipt' && <><div className="receipt-breakdown glass"><span><small>{copy.demoReference}</small><b>RWA-DEMO-240713</b></span><span><small>{copy.requestedAllocation}</small><b>{amount.toFixed(2)} USDT</b></span><span><small>{copy.displayedFee}</small><b>{fee.toFixed(2)} USDT</b></span><span><small>{copy.venueId}</small><b>{copy.notCreated}</b></span><span><small>{copy.ledgerEntry}</small><b>{copy.notCreated}</b></span><span><small>{copy.executionStatus}</small><b>{copy.demoOnly}</b></span></div><div className="receipt-actions"><button type="button" onClick={() => go('order-partial')}>{copy.previewPartial}</button><button type="button" onClick={() => go('support')}>{copy.openSupport}</button></div></>}<button className="flow-cta" type="button" onClick={() => go(primary.next)}>{primary.label}<ArrowRight size={20} /></button>{kind === 'processing' && <button className="quiet-action" type="button" onClick={() => go('order-failed')}>{copy.previewFailed}</button>}</section>
}

function WalletFlowScreen({ mode, go, notify, completeFlow }: { mode: 'deposit' | 'withdraw' | 'transfer'; go: (screen: Screen) => void; notify: (message: string) => void; completeFlow: (mode: 'deposit' | 'withdraw' | 'transfer') => void }) {
  const { locale } = useI18n()
  const text = operationsCopy[locale]
  const [network, setNetwork] = useState('TRON')
  const [recipient, setRecipient] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [whitelistConfirmed, setWhitelistConfirmed] = useState(false)
  const available = 12_540.2
  const feeByNetwork: Record<string, number> = { TRON: 0.8, Ethereum: 8.5, Arbitrum: 1.6 }
  const amount = Number(amountInput)
  const fee = mode === 'withdraw' ? feeByNetwork[network] : 0
  const isWalletAddress = network === 'TRON' ? /^T[A-Za-z0-9]{24,40}$/.test(recipient.trim()) : /^0x[a-fA-F0-9]{40}$/.test(recipient.trim())
  const recipientIsValid = mode === 'withdraw' ? isWalletAddress : recipient.trim().length >= 3
  const amountIsValid = Number.isFinite(amount) && amount > 0 && amount + fee <= available
  const canContinue = mode === 'deposit' || (recipientIsValid && amountIsValid && (mode !== 'withdraw' || whitelistConfirmed))
  const validationMessage = !recipient
    ? mode === 'withdraw' ? operationText(locale, 'validDestination', { network }) : text.recipientRequired
    : !recipientIsValid
      ? mode === 'withdraw' ? operationText(locale, 'invalidAddress', { network }) : text.shortRecipient
      : !amountInput || !amountIsValid
        ? amount > available - fee ? operationText(locale, 'balanceExceeded', { fee: fee.toFixed(2) }) : text.positiveAmount
        : mode === 'withdraw' && !whitelistConfirmed ? text.confirmWhitelist : ''
  const copy = mode === 'deposit'
    ? { title: text.depositTitle, subtitle: text.depositSubtitle, action: text.depositAction }
    : mode === 'withdraw'
      ? { title: text.withdrawTitle, subtitle: text.withdrawSubtitle, action: text.withdrawAction }
      : { title: text.transferTitle, subtitle: text.transferSubtitle, action: text.transferAction }
  return (
    <section className="screen wallet-flow-screen has-fixed-cta">
      <DetailHeader go={go} back="wallet" title={copy.title} />
      <div className="network-selector">{[['TRON', text.lowCost], ['Ethereum', 'ERC-20'], ['Arbitrum', text.fastSettlement]].map(([name, note]) => <button key={name} className={network === name ? 'is-selected' : ''} type="button" onClick={() => setNetwork(name)}><b>{name}</b><small>{note}</small>{network === name && <Check size={18} />}</button>)}</div>
      {mode === 'deposit' ? <div className="qr-card glass"><div className="qr-grid" /><p>{operationText(locale, 'depositAddress', { network })}</p><b>{network === 'TRON' ? 'TQx7d6k4...r1vZp' : network === 'Ethereum' ? '0x8F12...04D2' : '0x91C8...AA27'}</b><button type="button" onClick={() => notify(operationText(locale, 'copied', { network }))}><Copy size={18} />{text.copyAddress}</button></div> : <div className="wallet-form glass"><label>{mode === 'withdraw' ? text.destinationWallet : text.recipient}<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={mode === 'withdraw' ? network === 'TRON' ? 'T…' : '0x…' : text.recipientPlaceholder} autoCapitalize="none" autoCorrect="off" /></label>{mode === 'withdraw' && <button className="oauth-row" type="button" onClick={() => { setRecipient(network === 'TRON' ? 'TQx7d6k4r1vZpA9v8s6c4k2m7n5b3d' : '0x8F1248A90C8239D0E4F1A62C7090D7B74E5C04D2'); notify(text.demoAddressSelected) }}>{text.useWhitelisted} <ChevronRight size={18} /></button>}<label>{text.amount}<input value={amountInput} onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" /><span>USDT</span></label><div className="form-balance">{text.available} <b>{available.toLocaleString(locale, { minimumFractionDigits: 2 })} USDT</b></div>{mode === 'withdraw' && <button className={`whitelist-check ${whitelistConfirmed ? 'is-checked' : ''}`} type="button" onClick={() => setWhitelistConfirmed((value) => !value)}><span>{whitelistConfirmed && <Check size={14} />}</span><p><b>{text.whitelistTitle}</b><small>{text.whitelistBody}</small></p></button>}<div className={`wallet-preflight ${canContinue ? 'is-ready' : ''}`}><span><small>{mode === 'withdraw' ? text.networkFee : text.processingFee}</small><b>{fee.toFixed(2)} USDT</b></span><span><small>{text.receiveSend}</small><b>{amountIsValid ? Math.max(0, amount - fee).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} USDT</b></span><small className="wallet-preflight__state">{canContinue ? text.preflightPassed : validationMessage}</small></div></div>}
      <div className="flow-note"><ShieldCheck size={18} /><span>{copy.subtitle}</span></div>
      <button className="flow-cta" disabled={!canContinue} type="button" onClick={() => completeFlow(mode)}>{copy.action}<ArrowRight size={20} /></button>
    </section>
  )
}

function WalletSuccessScreen({ mode, go }: { mode: 'deposit' | 'withdraw' | 'transfer'; go: (screen: Screen) => void }) {
  const { locale } = useI18n()
  const text = operationsCopy[locale]
  const copy = mode === 'deposit'
    ? { eyebrow: text.depositEyebrow, title: text.depositSuccessTitle, body: text.depositSuccessBody, state: text.depositState }
    : mode === 'withdraw'
      ? { eyebrow: text.withdrawEyebrow, title: text.withdrawSuccessTitle, body: text.withdrawSuccessBody, state: text.withdrawState }
      : { eyebrow: text.transferEyebrow, title: text.transferSuccessTitle, body: text.transferSuccessBody, state: text.transferState }
  return <section className="screen success-screen has-fixed-cta"><div className="success-orb"><CircleCheck size={38} /></div><p>{copy.eyebrow}</p><h1>{copy.title}</h1><span>{copy.body}</span><div className="success-receipt glass"><span><small>{text.requestReference}</small><b>WLT-240713-1298</b></span><span><small>{text.networkRail}</small><b>{mode === 'deposit' ? 'USDT · TRON' : 'Platform USDT'}</b></span><span><small>{text.currentState}</small><b>{copy.state}</b></span></div><button className="flow-cta" type="button" onClick={() => go('wallet')}>{text.backWallet} <ArrowRight size={20} /></button><button className="quiet-action" type="button" onClick={() => go('activity')}>{text.viewActivity}</button></section>
}

function ActivityScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const text = operationsCopy[locale]
  const [active, setActive] = useState<'All' | 'Wallet' | 'Investments' | 'Rewards'>('All')
  const filters = ['All', 'Wallet', 'Investments', 'Rewards'] as const
  const filterLabels = { All: text.all, Wallet: text.wallet, Investments: text.investments, Rewards: text.rewards }
  const entries: Array<{ name: string; detail: string; value: string; time: string; group: Exclude<typeof active, 'All'>; icon: LucideIcon }> = [
    { name: text.deposit, detail: 'TRON USDT · 18', value: '+2,000.00 USDT', time: text.today, group: 'Wallet', icon: ArrowDownToLine },
    { name: text.investment, detail: `Solar Income 2027 · ${t('common.demo')}`, value: '-500.00 USDT', time: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-05-12T14:18:00')), group: 'Investments', icon: TrendingUp },
    { name: text.computeRevenue, detail: `H100 #23892 · ${t('common.demo')}`, value: '+124.20 USDT', time: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-05-10T08:45:00')), group: 'Rewards', icon: Sparkles },
    { name: text.transfer, detail: `Niko Alvarez · ${t('common.demo')}`, value: '-220.00 USDT', time: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-05-08T16:22:00')), group: 'Wallet', icon: ArrowRightLeft },
    { name: text.settlement, detail: `RWA · ${t('common.demo')}`, value: '+82.40 USDT', time: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-05-01T00:04:00')), group: 'Rewards', icon: CircleCheck },
  ]
  const visibleEntries = active === 'All' ? entries : entries.filter((entry) => entry.group === active)
  return <section className="screen activity-screen"><DetailHeader go={go} back="wallet" title={text.activity} /><div className="activity-filter">{filters.map((filter) => <button className={active === filter ? 'is-active' : ''} type="button" key={filter} onClick={() => setActive(filter)}>{filterLabels[filter]}</button>)}</div><div className="activity-timeline">{visibleEntries.length ? visibleEntries.map(({ name, detail, value, time, icon: Icon }) => <div key={`${name}-${time}`} className="activity-timeline__row glass"><span><Icon size={20} /></span><p><b>{name}</b><small>{detail}</small></p><strong className={value.startsWith('+') ? 'mint' : ''}>{value}<small>{time}</small></strong></div>) : <div className="catalog-empty glass"><ReceiptText size={22} /><b>{operationText(locale, 'noActivity', { group: filterLabels[active].toLocaleLowerCase(locale) })}</b><small>{text.noActivityBody}</small></div>}</div></section>
}

function AssetAccountScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const copy = portfolioDetailCopy[locale]
  return <section className="screen asset-account-screen"><DetailHeader go={go} back="wallet" title="USDT" /><div className="asset-account-balance"><span className="token token--usdt">T</span><p><small>{copy.totalUsdt}</small><b>12,540.20</b><span>≈ $12,538.90 USD</span></p></div><div className="network-balance-list glass"><button type="button"><span>TRON</span><b>8,420.20 USDT</b><ChevronRight size={18} /></button><button type="button"><span>Ethereum</span><b>2,610.00 USDT</b><ChevronRight size={18} /></button><button type="button"><span>Arbitrum</span><b>1,510.00 USDT</b><ChevronRight size={18} /></button></div><button className="wide-glass-action glass" type="button" onClick={() => notify(copy.addressCopied)}><Copy size={20} /><span><b>{copy.copyWallet}</b><small>{copy.networkWarning}</small></span><ChevronRight size={20} /></button></section>
}

function PositionDetailScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  const { locale } = useI18n()
  const copy = portfolioDetailCopy[locale]
  return <section className="screen position-screen"><DetailHeader go={go} back="portfolio" title={copy.computePosition} /><div className="position-hero glass"><AssetScene kind="compute" /><div><p>{copy.computeUnit}</p><h1>2,430.00 <span>USDT</span></h1><b>{copy.todayGain}</b></div></div><div className="position-stats"><span><small>{copy.dailyRevenue}</small><b>12.40 USDT</b></span><span><small>{copy.utilization}</small><b>98.1%</b></span><span><small>{copy.revenueEarned}</small><b>430.20 USDT</b></span></div><div className="yield-chart glass"><div className="yield-chart__head"><span>{copy.revenueHistory}</span><b>{copy.last30}</b></div><div className="yield-chart__bars">{[36,48,42,61,57,69,76,73,84,80,93,88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><button className="wide-glass-action glass" type="button" onClick={() => openOrder('compute')}><Cpu size={20} /><span><b>{copy.addCapacity}</b><small>{copy.capacityBody}</small></span><ChevronRight size={20} /></button></section>
}

function AiPlanScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  const { locale, t } = useI18n()
  const copy = portfolioDetailCopy[locale]
  const [acknowledged, setAcknowledged] = useState(false)
  const rows = [[copy.compute, '40%', copy.gpu], [copy.rwaIncome, '30%', copy.cashFlow], [copy.globalStocks, '20%', copy.growth], [copy.reserve, '10%', copy.liquidity]] as const
  const continueToOrder = () => {
    if (!acknowledged) return
    const existing = JSON.parse(window.localStorage.getItem('rwa-ai-acknowledgements') || '[]') as unknown[]
    window.localStorage.setItem('rwa-ai-acknowledgements', JSON.stringify([...existing, { id: crypto.randomUUID(), version: 'ai-disclosure-1.0-demo', recommendation: 'balanced-10000-usdt', confirmedAt: new Date().toISOString() }].slice(-20)))
    openOrder('compute')
  }
  return <section className="screen ai-plan-screen has-fixed-cta"><DetailHeader go={go} back="ai" title={copy.aiPlan} /><div className="plan-intro"><span><Sparkles size={24} /></span><p>{copy.planLabel}</p><h1>{copy.planTitle}</h1><small>{copy.planBody}</small></div><div className="plan-allocation glass">{rows.map(([name, percent, description], index) => <div key={name}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{description}</small></span><strong>{percent}</strong></div>)}</div><div className="ai-evidence glass"><p><b>{copy.whyMix}</b><small>{copy.whyBody}</small></p><TrendingUp size={22} /></div><button className={`risk-ack glass ${acknowledged ? 'is-confirmed' : ''}`} type="button" onClick={() => setAcknowledged((value) => !value)}><ShieldCheck size={21} /><p><b>{t('risk.aiTitle')}</b><small>{t('risk.aiBody')}</small></p><span>{acknowledged && <Check size={15} />}</span></button><button className="flow-cta" disabled={!acknowledged} type="button" onClick={continueToOrder}>{copy.reviewAllocation} <ArrowRight size={20} /></button></section>
}

function MarketingPreferencesScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  const [preferences, setPreferences] = useState({ email: false, push: false, community: false })
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('rwa-marketing-consent') || 'null') as { channels?: typeof preferences } | null
      if (stored?.channels) setPreferences(stored.channels)
    } catch {
      window.localStorage.removeItem('rwa-marketing-consent')
    }
  }, [])
  const toggle = (key: keyof typeof preferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }))
  const save = (next = preferences) => {
    window.localStorage.setItem('rwa-marketing-consent', JSON.stringify({ version: 'marketing-consent-1.0-demo', channels: next, updatedAt: new Date().toISOString() }))
    notify(t('marketing.saved'))
  }
  const channels: Array<[keyof typeof preferences, string, string]> = [
    ['email', t('marketing.email'), copy.emailDetail],
    ['push', t('marketing.push'), copy.pushDetail],
    ['community', t('marketing.community'), copy.communityDetail],
  ]
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader go={go} back="profile" title={t('marketing.title')} /><div className="account-flow-hero"><span><Bell size={30} /></span><p>{copy.communicationControl}</p><h1>{t('marketing.heading')}</h1><small>{t('marketing.body')}</small></div><div className="consent-stack glass">{channels.map(([key, label, detail]) => <button type="button" key={key} onClick={() => toggle(key)}><span><b>{label}</b><small>{detail}</small></span><i className={preferences[key] ? 'is-on' : ''}><em /></i></button>)}</div><div className="service-message-note glass"><ShieldCheck size={19} /><p><b>{copy.essentialTitle}</b><small>{copy.essentialBody}</small></p></div><button className="quiet-action" type="button" onClick={() => { const next = { email: false, push: false, community: false }; setPreferences(next); save(next) }}>{t('marketing.unsubscribe')}</button><button className="flow-cta" type="button" onClick={() => save()}>{t('common.save')}<ArrowRight size={20} /></button></section>
}

function OfficialChannelsScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  const channels = [
    [copy.website, copy.officialDomainPending, copy.destinationUnverified],
    ['X', copy.officialAccountPending, copy.accountUnverified],
    [copy.telegram, copy.officialGroupPending, copy.adminsNeverDm],
    [copy.support, copy.supportEmailPending, copy.noPersonalData],
  ]
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader go={go} back="profile" title={t('official.title')} /><div className="account-flow-hero"><span><ShieldCheck size={30} /></span><p>{copy.trustCenter}</p><h1>{t('official.heading')}</h1><small>{t('official.body')}</small></div><div className="official-channel-list glass">{channels.map(([name, value, note]) => <button type="button" key={name} onClick={() => notify(trustActionText(copy.channelPending, { name }))}><span><small>{name}</small><b>{value}</b><em>{note}</em></span><AlertTriangle size={18} /></button>)}</div><div className="anti-scam-callout"><AlertTriangle size={20} /><p><b>{copy.neverShare}</b><small>{copy.depositOnly}</small></p></div><button className="flow-cta" type="button" onClick={() => go('scam-report')}>{t('official.report')}<ArrowRight size={20} /></button></section>
}

function ScamReportScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  const [source, setSource] = useState('')
  const [details, setDetails] = useState('')
  const [reference, setReference] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!source.trim() || !details.trim()) return
    const next = `SCAM-DEMO-${new Date().getUTCFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    setReference(next)
    window.localStorage.setItem('rwa-last-scam-report', JSON.stringify({ reference: next, source, details, createdAt: new Date().toISOString(), demo: true }))
    notify(trustActionText(copy.reportNotice, { reference: next }))
  }
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader go={go} back="official-channels" title={t('scam.title')} /><div className="account-flow-hero"><span><AlertTriangle size={30} /></span><p>{copy.securityReport}</p><h1>{t('scam.heading')}</h1><small>{t('scam.body')}</small></div>{reference ? <div className="report-success glass"><CircleCheck size={32} /><h2>{copy.reportRecorded}</h2><b>{reference}</b><p>{copy.reportBody}</p></div> : <form className="security-report-form glass" onSubmit={submit}><label>{t('scam.source')}<input value={source} onChange={(event) => setSource(event.target.value)} placeholder={copy.sourcePlaceholder} /></label><label>{t('scam.details')}<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={copy.detailsPlaceholder} rows={5} /></label><div><ShieldCheck size={17} />{copy.secureUpload}</div><button className="flow-cta" disabled={!source.trim() || !details.trim()} type="submit">{t('scam.submit')}<ArrowRight size={20} /></button></form>}</section>
}

function NotificationsScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale } = useI18n()
  const text = operationsCopy[locale]
  const [activeFilter, setActiveFilter] = useState<'All' | 'Unread'>('All')
  const [items, setItems] = useState<Array<{ id: string; title: string; detail: string; time: string; icon: LucideIcon; destination: Screen; unread: boolean }>>([
    { id: 'compute', title: text.computeAlert, detail: text.computeAlertBody, time: text.now, icon: Cpu, destination: 'position-detail', unread: true },
    { id: 'coupon', title: text.solarAlert, detail: text.solarAlertBody, time: '2h', icon: Landmark, destination: 'rwa-detail', unread: true },
    { id: 'ai-risk', title: text.aiAlert, detail: text.aiAlertBody, time: text.yesterday, icon: AlertTriangle, destination: 'ai', unread: false },
  ])
  useEffect(() => {
    setItems((current) => current.map((item) => item.id === 'compute'
      ? { ...item, title: text.computeAlert, detail: text.computeAlertBody, time: text.now }
      : item.id === 'coupon'
        ? { ...item, title: text.solarAlert, detail: text.solarAlertBody }
        : { ...item, title: text.aiAlert, detail: text.aiAlertBody, time: text.yesterday }))
  }, [text])
  const visibleItems = activeFilter === 'All' ? items : items.filter((item) => item.unread)
  const unreadCount = items.filter((item) => item.unread).length
  const openItem = (item: typeof items[number]) => {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))
    go(item.destination)
  }
  return <section className="screen notifications-screen"><DetailHeader go={go} back="home" title={text.notifications} /><div className="notification-tools"><div>{(['All', 'Unread'] as const).map((filter) => <button className={activeFilter === filter ? 'is-active' : ''} type="button" key={filter} onClick={() => setActiveFilter(filter)}>{filter === 'All' ? text.all : text.unread}{filter === 'Unread' && unreadCount ? <b>{unreadCount}</b> : null}</button>)}</div><button type="button" disabled={!unreadCount} onClick={() => { setItems((current) => current.map((item) => ({ ...item, unread: false }))); notify(text.allMarked) }}>{text.markAll}</button></div><div className="notification-list">{visibleItems.length ? visibleItems.map((item) => { const Icon = item.icon; return <button className={`notification-row glass ${item.unread ? 'is-unread' : ''}`} type="button" key={item.id} onClick={() => openItem(item)}><span><Icon size={20} /></span><p><b>{item.title}</b><small>{item.detail}</small></p><time>{item.time}</time></button> }) : <div className="catalog-empty glass"><Bell size={22} /><b>{text.caughtUp}</b><small>{text.caughtUpBody}</small></div>}</div></section>
}

function AccountFlowScreen({ kind, go, notify }: { kind: AccountFlowKind; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const flow = accountFlowCopy[locale]
  const [passkeyEnabled, setPasskeyEnabled] = useState(true)
  const [biometricRequired, setBiometricRequired] = useState(true)
  const [otherSessions, setOtherSessions] = useState(2)
  const [supportCategory, setSupportCategory] = useState('order-dispute')
  const [supportDetails, setSupportDetails] = useState('')
  const [supportReference, setSupportReference] = useState('')
  const config = { ...flow.config[kind], icon: kind === 'security' ? KeyRound : kind === 'referral' ? Sparkles : kind === 'records' ? ReceiptText : kind === 'support' ? Headphones : Settings }
  const Icon = config.icon
  return (
    <section className="screen account-flow-screen has-fixed-cta">
      <DetailHeader go={go} back="profile" title={config.title} />
      <div className="account-flow-hero">
        <span><Icon size={30} /></span>
        <p>{config.overline}</p>
        <h1>{config.heading}</h1>
        <small>{config.body}</small>
      </div>

      {kind === 'security' && (
        <><div className="setting-stack glass">
          <button type="button" onClick={() => { setPasskeyEnabled((value) => !value); notify(accountFlowText(locale, flow.passkeyNotice, { state: passkeyEnabled ? flow.notEnabled : flow.enabledDevice })) }}><KeyRound size={20} /><span><b>{flow.passkey}</b><small>{passkeyEnabled ? flow.enabledDevice : flow.notEnabled}</small></span>{passkeyEnabled ? <CircleCheck size={19} /> : <ChevronRight size={19} />}</button>
          <button type="button" onClick={() => { setBiometricRequired((value) => !value); notify(accountFlowText(locale, flow.biometricNotice, { state: biometricRequired ? flow.biometricOptional : flow.biometricRequired })) }}><Bot size={20} /><span><b>{flow.biometric}</b><small>{biometricRequired ? flow.biometricRequired : flow.biometricOptional}</small></span>{biometricRequired ? <CircleCheck size={19} /> : <ChevronRight size={19} />}</button>
        </div><div className="device-session-head"><span>{flow.activeSessions}</span><small>{accountFlowText(locale, flow.devices, { count: otherSessions + 1 })}</small></div><div className="device-session-list glass"><div><span className="device-session__icon"><Bot size={18} /></span><p><b>{flow.thisDevice}</b><small>Windows · {flow.currentSession} · {flow.protected}</small></p><strong>{flow.current}</strong></div>{otherSessions > 0 ? <button type="button" onClick={() => { setOtherSessions(0); notify(flow.sessionsClosed) }}><span className="device-session__icon"><Globe2 size={18} /></span><p><b>{accountFlowText(locale, flow.otherSessions, { count: otherSessions })}</b><small>{flow.lastActive} · {flow.deviceApi}</small></p><strong>{flow.signOut}</strong></button> : <div className="device-session__empty"><CircleCheck size={18} />{flow.sessionsClosed}</div>}</div></>
      )}

      {kind === 'referral' && (
        <>
          <div className="referral-code glass"><small>{flow.invitationCode}</small><b>RWA-KEPLER-92</b><span>{flow.rewardEarned}: <strong>84.20 USDT</strong></span></div>
          <div className="reward-grid">
            <span><small>{flow.invited}</small><b>12</b></span>
            <span><small>{flow.verified}</small><b>7</b></span>
            <span><small>{flow.pending}</small><b>3</b></span>
          </div>
        </>
      )}

      {kind === 'records' && (
        <div className="record-stack glass">
          <button type="button" onClick={() => notify(accountFlowText(locale, flow.receiptOpened, { name: flow.rwaSubscription }))}><ReceiptText size={20} /><span><b>{flow.rwaSubscription}</b><small>{flow.solarAllocation}</small></span><strong>{flow.settled}</strong></button>
          <button type="button" onClick={() => notify(accountFlowText(locale, flow.receiptOpened, { name: flow.computeRevenue }))}><Cpu size={20} /><span><b>{flow.computeRevenue}</b><small>{flow.dailySettlement}</small></span><strong className="mint">+12.40</strong></button>
          <button type="button" onClick={() => notify(accountFlowText(locale, flow.receiptOpened, { name: flow.walletDeposit }))}><CircleDollarSign size={20} /><span><b>{flow.walletDeposit}</b><small>TRON USDT · TQx7...8vZp</small></span><strong className="mint">+2,000</strong></button>
        </div>
      )}

      {kind === 'support' && (
        <div className="support-stack">
          <button className="support-card glass" type="button" onClick={() => go('ai')}><MessageCircle size={22} /><span><b>{flow.aiSupport}</b><small>{flow.aiSupportBody}</small></span><ChevronRight size={19} /></button>
          <button className="support-card glass" type="button" onClick={() => notify(flow.humanRecorded)}><Headphones size={22} /><span><b>{flow.humanReview}</b><small>{flow.humanReviewBody}</small></span><ChevronRight size={19} /></button>
          <button className="support-card glass" type="button" onClick={() => go('scam-report')}><ShieldCheck size={22} /><span><b>{t('scam.title')}</b><small>{flow.scamBody}</small></span><ChevronRight size={19} /></button>
          {supportReference ? <div className="report-success glass"><CircleCheck size={30} /><h2>{flow.caseCreated}</h2><b>{supportReference}</b><p>{flow.caseStatus}</p></div> : <form className="security-report-form glass" onSubmit={(event) => { event.preventDefault(); if (!supportDetails.trim()) return; const reference = `SUP-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; setSupportReference(reference); window.localStorage.setItem('rwa-last-support-ticket', JSON.stringify({ reference, category: supportCategory, details: supportDetails, status: 'submitted', createdAt: new Date().toISOString(), demo: true })); notify(accountFlowText(locale, flow.caseRecorded, { reference })) }}><label>{flow.issueType}<select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)}><option value="order-dispute">{flow.dispute}</option><option value="deposit-withdrawal">{flow.depositWithdrawal}</option><option value="yield-settlement">{flow.yieldSettlement}</option><option value="kyc-appeal">{flow.kycAppeal}</option><option value="other">{flow.other}</option></select></label><label>{flow.transactionDetails}<textarea rows={4} value={supportDetails} onChange={(event) => setSupportDetails(event.target.value)} placeholder={flow.detailsPlaceholder} /></label><button className="auth-primary" type="submit" disabled={!supportDetails.trim()}>{flow.createCase} <ArrowRight size={18} /></button></form>}
        </div>
      )}

      {kind === 'settings' && (
        <div className="setting-stack setting-stack--preferences glass">
          <div className="settings-language-row"><Network size={20} /><LanguageMenu variant="settings" onChange={(label) => notify(accountFlowText(locale, flow.languageSaved, { label }))} /></div>
          <button type="button" onClick={() => go('marketing')}><Bell size={20} /><span><b>{t('settings.marketing')}</b><small>{flow.marketingDetail}</small></span><ChevronRight size={19} /></button>
          <button type="button" onClick={() => notify(flow.notificationSaved)}><Bell size={20} /><span><b>{t('settings.notifications')}</b><small>{flow.notificationDetail}</small></span><Check size={19} /></button>
          <button type="button" onClick={() => notify(flow.fiatUnavailable)}><Upload size={20} /><span><b>{t('settings.fiat')}</b><small>{flow.fiatDetail}</small></span><ChevronRight size={19} /></button>
        </div>
      )}

      {kind !== 'support' && <button className="flow-cta" type="button" onClick={() => { if (kind === 'security' && otherSessions > 0) { setOtherSessions(0); notify(flow.sessionsClosed) } else if (kind === 'referral') { navigator.clipboard?.writeText('https://rwa.lat/invite/RWA-KEPLER-92'); notify(flow.inviteCopied) } else { notify(accountFlowText(locale, flow.saved, { title: config.title })) } }}>{kind === 'security' && otherSessions > 0 ? flow.signOutOthers : config.action}<ArrowRight size={20} /></button>}
    </section>
  )
}

type TrustPageKind = 'trust-center' | 'access-regions' | 'product-disclosures' | 'legal-center'
type TrustRow = { title: string; description: string; icon: LucideIcon; destination?: Screen }

function TrustCenterScreen({ kind, go, notify }: { kind: TrustPageKind; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const localizedCopy = rwaH5Copy[locale]
  const trustCopy = localizedCopy.trust
  const content = kind === 'trust-center'
    ? { eyebrow: t('trust.eyebrow'), title: t('trust.heading'), body: t('trust.body') }
    : kind === 'access-regions' ? trustCopy.access : kind === 'product-disclosures' ? trustCopy.products : trustCopy.legal
  const accessIcons: LucideIcon[] = [CircleCheck, ShieldCheck, Globe2, SlidersHorizontal]
  const productIcons: LucideIcon[] = [Cpu, Landmark, TrendingUp, Sparkles, WalletCards]
  const legalIcons: LucideIcon[] = [FileText, ShieldCheck, AlertTriangle, Landmark, ReceiptText]
  const rows: TrustRow[] = kind === 'trust-center' ? [
    { title: t('trust.access'), description: t('trust.accessBody'), icon: Globe2, destination: 'access-regions' },
    { title: t('trust.products'), description: t('trust.productsBody'), icon: ReceiptText, destination: 'product-disclosures' },
    { title: t('trust.legal'), description: t('trust.legalBody'), icon: FileText, destination: 'legal-center' },
    { title: t('profile.official'), description: t('official.body'), icon: ShieldCheck, destination: 'official-channels' },
    { title: t('profile.support'), description: t('trust.supportBody'), icon: Headphones, destination: 'support' },
  ] : kind === 'access-regions'
    ? trustCopy.accessRows.map((row, index) => ({ ...row, icon: accessIcons[index] ?? FileText }))
    : kind === 'product-disclosures'
      ? trustCopy.productRows.map((row, index) => ({ ...row, icon: productIcons[index] ?? FileText }))
      : trustCopy.legalRows.map((row, index) => ({ ...row, icon: legalIcons[index] ?? FileText }))

  return (
    <section className="screen trust-screen">
      <DetailHeader go={go} back={kind === 'trust-center' ? 'profile' : 'trust-center'} title={kind === 'trust-center' ? t('trust.title') : undefined} />
      <div className="trust-hero"><p>{content.eyebrow}</p><h1>{content.title}</h1><span>{content.body}</span></div>
      {kind === 'access-regions' && <div className="eligibility-demo glass"><span><Globe2 size={22} /></span><p><small>{trustCopy.resultLabel}</small><b>{trustCopy.resultValue}</b></p><em>{trustCopy.notEvaluated}</em></div>}
      {kind === 'legal-center' && <div className="operator-card glass"><span><Landmark size={22} /></span><p><small>{trustCopy.entityMapping}</small><b>WAVEMAKER PACIFIC PARTNERS PTE. LTD.</b><em>UEN 201402949K · 182 Cecil Street, #17-01, Singapore 069547</em><em>{trustCopy.masStatus}</em></p><a href="https://eservices.mas.gov.sg/fid/institution/detail/4036-WAVEMAKER-PACIFIC-PARTNERS-PTE-LTD" target="_blank" rel="noreferrer" aria-label={localizedCopy.shell.openMasRecord}><ChevronRight size={19} /></a></div>}
      <div className="trust-list glass">{rows.map(({ title, description, icon: RowIcon, destination }) => (
        <button type="button" key={title} onClick={() => destination ? go(destination) : notify(`${title} · ${localizedCopy.shell.disclosureOpened}`)}>
          <span><RowIcon size={21} /></span><p><b>{title}</b><small>{description}</small></p>{destination ? <ChevronRight size={19} /> : <FileText size={17} />}
        </button>
      ))}</div>
      <div className="trust-note"><AlertTriangle size={16} />{t('trust.demoNote')}</div>
    </section>
  )
}

function RwaH5Content({ initialScreen = 'home' }: { initialScreen?: Screen }) {
  const { locale, t } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const router = useRouter()
  const initialOverlay = initialScreen === 'ai' || initialScreen === 'profile' ? initialScreen : null
  const [screen, setScreen] = useState<Screen>(initialOverlay ? 'home' : initialScreen)
  const [overlay, setOverlay] = useState<'ai' | 'profile' | null>(initialOverlay)
  const [profileBaseScreen, setProfileBaseScreen] = useState<Screen | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [sessionMode, setSessionMode] = useState<'guest' | 'authenticated'>('guest')
  const [sessionReady, setSessionReady] = useState(false)
  const [orderAsset, setOrderAsset] = useState<OrderAsset>('compute')
  const [orderAmount, setOrderAmount] = useState(1000)
  const [walletFlowMode, setWalletFlowMode] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit')
  const [products, setProducts] = useState<DemoProduct[]>(fallbackProducts)
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct>(fallbackProducts[0])
  const [featured, setFeatured] = useState<DemoProduct[]>(fallbackFeatured)
  useEffect(() => {
    setSessionMode(window.localStorage.getItem('rwa-session-mode') === 'authenticated' ? 'authenticated' : 'guest')
    const storedFlow = window.sessionStorage.getItem('rwa-wallet-flow-mode')
    if (storedFlow === 'withdraw' || storedFlow === 'transfer' || storedFlow === 'deposit') setWalletFlowMode(storedFlow)
    try {
      const stored = window.sessionStorage.getItem('rwa-selected-product')
      if (stored) setSelectedProduct(JSON.parse(stored) as DemoProduct)
    } catch {
      window.sessionStorage.removeItem('rwa-selected-product')
    }
    setSessionReady(true)
  }, [])
  // ── API-first product loading ──
  useEffect(() => {
    let cancelled = false
    getProducts().then((p) => { if (!cancelled) { setProducts(p); setFeatured(getFeaturedProducts()) } }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const localizedSelectedProduct = useMemo(() => localizeProduct(selectedProduct, locale), [locale, selectedProduct])
  useEffect(() => {
    const profileReturn = new URLSearchParams(window.location.search).get('profileReturn') as Screen | null
    if (profileReturn && ['home', 'invest', 'portfolio', 'wallet'].includes(profileReturn)) {
      setProfileBaseScreen(profileReturn)
      window.sessionStorage.setItem('rwa-profile-base', profileReturn)
    }
    if (initialScreen === 'ai' || initialScreen === 'profile') {
      const savedBase = window.sessionStorage.getItem('rwa-overlay-base') as Screen | null
      if (savedBase && savedBase !== 'ai' && savedBase !== 'profile') setScreen(savedBase)
      setOverlay(initialScreen)
      return
    }
    setOverlay(null)
    setScreen(initialScreen)
  }, [initialScreen])
  useEffect(() => {
    if (!sessionReady || sessionMode !== 'guest' || !protectedScreens.includes(initialScreen)) return
    setScreen('login')
    if (window.location.pathname !== pathForScreen('login')) router.replace(pathForScreen('login'))
  }, [initialScreen, router, sessionMode, sessionReady])
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const attribution = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'invite_code'].reduce<Record<string, string>>((result, key) => {
      const value = query.get(key)
      if (value) result[key] = value.slice(0, 160)
      return result
    }, {})
    if (!Object.keys(attribution).length) return
    if (!window.localStorage.getItem('rwa-first-attribution')) window.localStorage.setItem('rwa-first-attribution', JSON.stringify({ ...attribution, capturedAt: new Date().toISOString() }))
    window.localStorage.setItem('rwa-last-attribution', JSON.stringify({ ...attribution, capturedAt: new Date().toISOString() }))
  }, [])
  useEffect(() => {
    const updateConnection = () => setIsOnline(window.navigator.onLine)
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])
  useEffect(() => {
    const reset = () => {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      window.scrollTo(0, 0)
    }
    reset()
    const frame = window.requestAnimationFrame(reset)
    const timer = window.setTimeout(reset, 140)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [screen])
  const go = (next: Screen) => {
    if (sessionMode === 'guest' && protectedScreens.includes(next)) {
      setToast(t('guest.protected'))
      window.setTimeout(() => setToast(null), 2600)
      next = 'login'
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    const storedProfileBase = window.sessionStorage.getItem('rwa-profile-base') as Screen | null
    const profileReturn = new URLSearchParams(window.location.search).get('profileReturn') as Screen | null
    const resolvedProfileBase = profileBaseScreen ?? storedProfileBase ?? profileReturn
    if (next === 'profile' && resolvedProfileBase && resolvedProfileBase !== 'profile' && resolvedProfileBase !== 'ai') {
      window.sessionStorage.setItem('rwa-overlay-base', resolvedProfileBase)
      window.sessionStorage.setItem('rwa-profile-base', resolvedProfileBase)
      setScreen(resolvedProfileBase)
      setOverlay('profile')
      const nextPath = pathForScreen('profile')
      if (window.location.pathname !== nextPath) router.push(nextPath)
      return
    }
    if (next === 'ai' || next === 'profile') {
      if (next === 'profile') window.sessionStorage.removeItem('rwa-profile-base')
      window.sessionStorage.setItem('rwa-overlay-base', screen)
      setOverlay(next)
      const nextPath = pathForScreen(next)
      if (window.location.pathname !== nextPath) router.push(nextPath)
      return
    }
    setOverlay(null)
    setProfileBaseScreen(null)
    setScreen(next)
    const nextPath = pathForScreen(next)
    if (window.location.pathname !== nextPath) router.push(nextPath)
    const reset = () => window.scrollTo(0, 0)
    window.setTimeout(reset, 0)
    window.setTimeout(reset, 160)
    window.setTimeout(reset, 320)
  }
  const closeOverlay = () => {
    const storedBase = window.sessionStorage.getItem('rwa-overlay-base') as Screen | null
    const storedProfileBase = window.sessionStorage.getItem('rwa-profile-base') as Screen | null
    const base = overlay === 'profile' && profileBaseScreen && profileBaseScreen !== 'profile' && profileBaseScreen !== 'ai'
      ? profileBaseScreen
      : overlay === 'profile' && storedProfileBase && storedProfileBase !== 'profile' && storedProfileBase !== 'ai'
      ? storedProfileBase
      : overlay === 'profile' && storedBase && storedBase !== 'profile' && storedBase !== 'ai'
      ? storedBase
      : overlay === 'profile' ? 'home' : screen
    setOverlay(null)
    setProfileBaseScreen(null)
    window.sessionStorage.removeItem('rwa-profile-base')
    setScreen(base)
    const nextPath = pathForScreen(base)
    if (window.location.pathname !== nextPath) router.push(nextPath)
  }
  const openProfileSection = (next: Screen) => {
    setProfileBaseScreen(screen)
    window.sessionStorage.setItem('rwa-profile-base', screen)
    setOverlay(null)
    setScreen(next)
    const nextPath = `${pathForScreen(next)}?profileReturn=${encodeURIComponent(screen)}`
    if (window.location.pathname !== nextPath) router.push(nextPath)
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }
  const openOrder = (asset: OrderAsset) => {
    setOrderAsset(asset)
    setOrderAmount(asset === 'prediction' ? 250 : asset === 'stocks' ? 500 : asset === 'rwa' ? 500 : 1000)
    go('order-review')
  }
  const openProduct = (product: DemoProduct) => {
    setSelectedProduct(product)
    window.sessionStorage.setItem('rwa-selected-product', JSON.stringify(product))
    go(detailRoute(productAsset[product.category]))
  }
  const openPrediction = (market: PredictionMarket) => {
    const yesIndex = Math.max(0, market.outcomes.findIndex((outcome) => outcome.toLowerCase() === 'yes'))
    const yesPrice = market.prices[yesIndex] ?? market.prices[0] ?? .5
    const product: DemoProduct = {
      id: `polymarket-${market.id}`,
      title: market.question,
      subtitle: `Polymarket public market data · ${market.category} · ${compactValue(market.volume24h)} 24h volume`,
      category: 'Prediction',
      risk: 'High Risk',
      kind: 'prediction',
      returnMetric: `${Math.round(yesPrice * 100)}¢`,
      returnLabel: `${market.outcomes[yesIndex] ?? 'Yes'} probability`,
      minimum: '10 USDT',
      liquidity: market.endDate ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(market.endDate)) : screenCopy[locale].prediction.openMarket,
      availability: market.acceptingOrders ? 'Public discovery' : 'Market unavailable',
      note: 'Live public Polymarket data; RWA.LAT execution remains Demo',
      isDemo: false,
    }
    setSelectedProduct(product)
    window.sessionStorage.setItem('rwa-selected-product', JSON.stringify(product))
    go('prediction-detail')
  }
  const openWalletFlow = (mode: 'deposit' | 'withdraw' | 'transfer') => {
    setWalletFlowMode(mode)
    window.sessionStorage.setItem('rwa-wallet-flow-mode', mode)
    go(mode)
  }
  const completeWalletFlow = (mode: 'deposit' | 'withdraw' | 'transfer') => {
    setWalletFlowMode(mode)
    window.sessionStorage.setItem('rwa-wallet-flow-mode', mode)
    go('wallet-success')
  }
  const setGuest = () => { setSessionMode('guest'); window.localStorage.setItem('rwa-session-mode', 'guest') }
  const setAuthenticated = () => { setSessionMode('authenticated'); window.localStorage.setItem('rwa-session-mode', 'authenticated') }
  const handleDemoLogin = async () => {
    try {
      const result = await demoLogin()
      if (result?.token) { setAuthToken(result.token); notify('Demo login successful') }
    } catch {
      // API not available — authenticate locally anyway for demo
    }
    setAuthenticated()
  }
  const showDock = !['welcome', 'login', 'register', 'verify-email', 'recovery', 'profile', 'rwa-detail', 'compute-detail', 'stock-detail', 'prediction-detail', 'order-review', 'order-processing', 'order-success', 'order-partial', 'order-failed', 'order-receipt', 'deposit', 'withdraw', 'transfer', 'wallet-success', 'activity', 'asset-detail', 'position-detail', 'ai-plan', 'notifications', 'kyc', 'security', 'referral', 'records', 'support', 'settings', 'marketing', 'official-channels', 'scam-report', 'close-account'].includes(screen)
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      {!isOnline && <div className="connection-banner" role="status"><AlertTriangle size={16} /><span><b>{shellCopy.offlineTitle}</b><small>{shellCopy.offlineBody}</small></span></div>}
      <div className={`rwa-mobile ${showDock ? '' : 'rwa-mobile--detail'}`} data-screen={screen} data-overlay={overlay ?? undefined}>
        {screen === 'welcome' && <AuthExperience mode="welcome" go={go} notify={notify} onGuest={setGuest} onAuthenticated={setAuthenticated} />}
        {screen === 'login' && <AuthExperience mode="login" go={go} notify={notify} onAuthenticated={setAuthenticated} />}
        {screen === 'register' && <AuthExperience mode="register" go={go} notify={notify} onAuthenticated={setAuthenticated} />}
        {screen === 'verify-email' && <AuthExperience mode="verify-email" go={go} notify={notify} />}
        {screen === 'recovery' && <AuthExperience mode="recovery" go={go} notify={notify} />}
        {screen === 'home' && <HomeScreen go={go} notify={notify} openProduct={openProduct} isGuest={sessionMode === 'guest'} products={products} featured={featured} />}
        {screen === 'invest' && <InvestScreen go={go} notify={notify} openProduct={openProduct} openPrediction={openPrediction} products={products} />}
        {screen === 'portfolio' && <PortfolioScreen go={go} notify={notify} />}
        {screen === 'wallet' && <WalletScreen go={go} notify={notify} openWalletFlow={openWalletFlow} />}
        {screen === 'rwa-detail' && <RwaDetailScreen product={selectedProduct.category === 'RWA' ? localizedSelectedProduct : localizeProduct(products.find((product) => product.category === 'RWA')!, locale)} go={go} notify={notify} openOrder={openOrder} />}
        {screen === 'compute-detail' && <AssetDetailScreen product={selectedProduct.category === 'Compute' ? localizedSelectedProduct : localizeProduct(products[0], locale)} asset="compute" go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'stock-detail' && <AssetDetailScreen product={selectedProduct.category === 'Stocks' ? localizedSelectedProduct : localizeProduct(products.find((product) => product.category === 'Stocks')!, locale)} asset="stocks" go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'prediction-detail' && <AssetDetailScreen asset="prediction" product={selectedProduct.category === 'Prediction' ? localizedSelectedProduct : { id: 'polymarket-live', title: 'Polymarket market discovery', subtitle: 'Public Gamma data · execution eligibility required', category: 'Prediction', risk: 'High Risk', kind: 'prediction', returnMetric: 'Live', returnLabel: 'market data', minimum: '10 USDT', liquidity: 'Variable', availability: 'Public discovery', note: 'Live public data; execution remains Demo', isDemo: true }} go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'order-review' && <OrderReviewScreen product={localizedSelectedProduct} asset={orderAsset} go={go} amount={orderAmount} setAmount={setOrderAmount} />}
        {screen === 'order-processing' && <OrderStatusScreen kind="processing" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'order-success' && <OrderSuccessScreen product={localizedSelectedProduct} asset={orderAsset} go={go} />}
        {screen === 'order-partial' && <OrderStatusScreen kind="partial" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'order-failed' && <OrderStatusScreen kind="failed" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'order-receipt' && <OrderStatusScreen kind="receipt" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'deposit' && <WalletFlowScreen mode="deposit" go={go} notify={notify} completeFlow={completeWalletFlow} />}
        {screen === 'withdraw' && <WalletFlowScreen mode="withdraw" go={go} notify={notify} completeFlow={completeWalletFlow} />}
        {screen === 'transfer' && <WalletFlowScreen mode="transfer" go={go} notify={notify} completeFlow={completeWalletFlow} />}
        {screen === 'wallet-success' && <WalletSuccessScreen mode={walletFlowMode} go={go} />}
        {screen === 'activity' && <ActivityScreen go={go} />}
        {screen === 'asset-detail' && <AssetAccountScreen go={go} notify={notify} />}
        {screen === 'position-detail' && <PositionDetailScreen go={go} openOrder={openOrder} />}
        {screen === 'ai-plan' && <AiPlanScreen go={go} openOrder={openOrder} />}
        {screen === 'notifications' && <NotificationsScreen go={go} notify={notify} />}
        {screen === 'kyc' && <AuthExperience mode="kyc" go={go} notify={notify} />}
        {screen === 'security' && <AccountFlowScreen kind="security" go={go} notify={notify} />}
        {screen === 'referral' && <AccountFlowScreen kind="referral" go={go} notify={notify} />}
        {screen === 'records' && <AccountFlowScreen kind="records" go={go} notify={notify} />}
        {screen === 'support' && <AccountFlowScreen kind="support" go={go} notify={notify} />}
        {screen === 'settings' && <AccountFlowScreen kind="settings" go={go} notify={notify} />}
        {screen === 'marketing' && <MarketingPreferencesScreen go={go} notify={notify} />}
        {screen === 'official-channels' && <OfficialChannelsScreen go={go} notify={notify} />}
        {screen === 'scam-report' && <ScamReportScreen go={go} notify={notify} />}
        {screen === 'close-account' && <CloseAccountScreen go={go} notify={notify} />}
        {screen === 'trust-center' && <TrustCenterScreen kind="trust-center" go={go} notify={notify} />}
        {screen === 'access-regions' && <TrustCenterScreen kind="access-regions" go={go} notify={notify} />}
        {screen === 'product-disclosures' && <TrustCenterScreen kind="product-disclosures" go={go} notify={notify} />}
        {screen === 'legal-center' && <TrustCenterScreen kind="legal-center" go={go} notify={notify} />}
        {showDock && <BottomDock screen={screen} setScreen={go} />}
        {overlay && <div className="app-overlay" role="presentation"><button className="app-overlay__scrim" type="button" aria-label={t('common.back')} onClick={closeOverlay} /><div className={`app-overlay__sheet app-overlay__sheet--${overlay}`} role="dialog" aria-modal="true" aria-label={overlay === 'ai' ? accountCopy[locale].aiAdvisor : t('profile.title')}>
          {overlay === 'ai' ? <AiScreen go={go} notify={notify} onClose={closeOverlay} /> : <ProfileScreen go={go} notify={notify} sessionMode={sessionMode} onClose={closeOverlay} onOpenSection={openProfileSection} />}
        </div></div>}
      </div>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
      {sessionMode === 'guest' && <div className="demo-login-bar"><button type="button" onClick={handleDemoLogin} className="demo-login-btn">🚀 Demo Login</button></div>}
      </main>
    </>
  )
}

export default function RwaH5({ initialScreen = 'home' }: { initialScreen?: Screen }) {
  return <I18nProvider><RwaH5Content initialScreen={initialScreen} /></I18nProvider>
}
