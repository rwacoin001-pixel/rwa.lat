'use client'
import AppLoading from '@/components/app-loading'
import { aiPageContext, type AiPageContext } from '@/lib/ai-page-context'
import { captureWalletBackdrop } from './wallet-page-backdrop'
import { markTabNavigation, nextNavigationState, useNavigationViewport } from '@/lib/app-navigation'

import dynamic from 'next/dynamic'

type BasketKind = 'detail' | 'subscribe' | 'redeem' | 'disclosures'
const PublishedOfficialChannels = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedOfficialChannels })), { ssr: false })
const PublishedPlatform = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedPlatform })), { ssr: false })
const PublishedReserves = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedReserves })), { ssr: false })
const PublishedProductDisclosures = dynamic(() => import('./published-product-disclosures').then((m) => ({ default: m.PublishedProductDisclosures })), { ssr: false })
const LearnScreen = dynamic(() => import('./maison/LearnScreen').then((m) => ({ default: m.LearnScreen })), { ssr: false, loading: AppLoading })
const AiPlanningScreen = dynamic(() => import('./maison/AiPlanningScreen').then((m) => ({ default: m.AiPlanningScreen })), { ssr: false, loading: AppLoading })
const NotificationPreferences = dynamic(() => import('./maison/NotificationPreferences').then((m) => ({ default: m.NotificationPreferences })), { ssr: false })
const PublicShareLanding = dynamic(() => import('./public-sharing').then((m) => ({ default: m.PublicShareLanding })), { ssr: false, loading: AppLoading })
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowRight, ArrowRightLeft, ArrowUpFromLine, AlertTriangle, Bell, ChartNoAxesColumnIncreasing, Bookmark, CalendarDays, ChartPie, Check, ChevronRight, Building2, CircleCheck, CircleDollarSign, Clock3, Copy, Cpu, FileText, Globe2, House, Headphones, KeyRound, Landmark, Network, Plus, QrCode, ReceiptText, Settings, ShieldCheck, Sparkles, TrendingUp, WalletCards, type LucideIcon } from 'lucide-react'
import type { ToastTone } from '@/lib/toast-tone'
import { showToast } from '@/lib/toast-store'
import { ToastHost } from '@/components/ui/ToastHost'
import { Notice } from '@/components/ui/Notice'
import type { AssetSceneKind } from './asset-scenes'
const AssetScene = dynamic(() => import('./asset-scenes'), { ssr: false })
import RwaTopbar from './rwa-topbar'
import { useRwaTheme } from '@/lib/rwa-theme'
import { Segmented } from './ui/Segmented'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { accountCopy, detailCopy, interpolateCopy, orderCopy, screenCopy } from '@/lib/screen-copy'
import { portfolioDetailCopy } from '@/lib/portfolio-detail-copy'
import { trustActionCopy } from '@/lib/trust-action-copy'
import { assetExperienceCopy } from '@/lib/asset-experience-copy'
import { categoryLabel, localizeProduct } from '@/lib/catalog-localization'
const PolymarketDetailPanel = dynamic(() => import('./polymarket-detail-panel'), { ssr: false })
const StatusScreen = dynamic(() => import('./status-screen').then((m) => ({ default: m.StatusScreen })), { ssr: false, loading: AppLoading })
const SecondaryTransferScreen = dynamic(() => import('./maison/SecondaryTransferScreen').then((m) => ({ default: m.SecondaryTransferScreen })), { ssr: false, loading: AppLoading })
const TradeScreen = dynamic(() => import('./trade-screen').then((m) => ({ default: m.TradeScreen })), { ssr: false, loading: AppLoading })
const CommunityFeedScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityFeedScreen })), { ssr: false, loading: AppLoading })
const CommunityPostScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityPostScreen })), { ssr: false, loading: AppLoading })
const CommunityProfileScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityProfileScreen })), { ssr: false, loading: AppLoading })
import { pathForDynamicScreen, pathForScreen, screenForSegments, type RwaScreen } from '@/lib/rwa-routes'
import { resolveRoute } from '@/lib/routes-v2'
import { screenForV2Query, screenForV2Segments } from '@/lib/routes-v2-adapter'
import { PATH_EVENT, openPath, queryParam, type PathNavigation } from '@/lib/maison-nav'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { AiChatScreen } from '@/components/maison/AiChatScreen'
import { MaisonBridge } from '@/components/maison/MaisonBridge'
import { trustCopy as trustPageCopy, scamCopy } from '@/lib/maison-trust-copy'
import { isOrderableId } from '@/lib/api/markets'
const MaisonMarketsScreen = dynamic(() => import('./maison/MarketsScreen').then((m) => ({ default: m.MarketsScreen })), { ssr: false, loading: AppLoading })
const MaisonAssetDetailScreen = dynamic(() => import('./maison/AssetDetailScreen').then((m) => ({ default: m.AssetDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonOrderReviewScreen = dynamic(() => import('./maison/OrderReviewScreen').then((m) => ({ default: m.OrderReviewScreen })), { ssr: false, loading: AppLoading })
const MaisonOrderStatusScreen = dynamic(() => import('./maison/OrderStatusScreen').then((m) => ({ default: m.OrderStatusScreen })), { ssr: false, loading: AppLoading })
const MaisonIssuerProfileScreen = dynamic(() => import('./maison/IssuersScreen').then((m) => ({ default: m.IssuerProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonIssuersScreen = dynamic(() => import('./maison/IssuersScreen').then((m) => ({ default: m.IssuersScreen })), { ssr: false, loading: AppLoading })
const MaisonCompareScreen = dynamic(() => import('./maison/CompareScreen').then((m) => ({ default: m.CompareScreen })), { ssr: false, loading: AppLoading })
const MaisonSearchScreen = dynamic(() => import('./maison/SearchScreen').then((m) => ({ default: m.SearchScreen })), { ssr: false, loading: AppLoading })
const MaisonHengxuDetailScreen = dynamic(() => import('./maison/HengxuScreen').then((m) => ({ default: m.HengxuDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonBasketDetailScreen = dynamic(() => import('./maison/BasketScreen').then((m) => ({ default: m.BasketDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonBasketOrderScreen = dynamic(() => import('./maison/BasketScreen').then((m) => ({ default: m.BasketOrderScreen })), { ssr: false, loading: AppLoading })
const MaisonTradeScreen = dynamic(() => import('./maison/TradeScreen').then((m) => ({ default: m.TradeScreen })), { ssr: false, loading: AppLoading })
const MaisonPredictionScreen = dynamic(() => import('./maison/PredictionScreen').then((m) => ({ default: m.PredictionScreen })), { ssr: false, loading: AppLoading })
const MaisonPortfolioScreen = dynamic(() => import('./maison/PortfolioScreen').then((m) => ({ default: m.PortfolioScreen })), { ssr: false, loading: AppLoading })
const MaisonPositionDetailScreen = dynamic(() => import('./maison/PortfolioScreen').then((m) => ({ default: m.PositionDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonRebalanceScreen = dynamic(() => import('./maison/AssetToolsScreen').then((m) => ({ default: m.RebalanceScreen })), { ssr: false, loading: AppLoading })
const MaisonRecurringScreen = dynamic(() => import('./maison/AssetToolsScreen').then((m) => ({ default: m.RecurringScreen })), { ssr: false, loading: AppLoading })
const MaisonMyPredictionsScreen = dynamic(() => import('./maison/MyPredictionsScreen').then((m) => ({ default: m.MyPredictionsScreen })), { ssr: false, loading: AppLoading })
const MaisonStatementsScreen = dynamic(() => import('./maison/AssetToolsScreen').then((m) => ({ default: m.StatementsScreen })), { ssr: false, loading: AppLoading })
const MaisonYieldCalendarScreen = dynamic(() => import('./maison/AssetToolsScreen').then((m) => ({ default: m.YieldCalendarScreen })), { ssr: false, loading: AppLoading })
const MaisonActivityScreen = dynamic(() => import('./maison/CashScreen').then((m) => ({ default: m.ActivityScreen })), { ssr: false, loading: AppLoading })
const MaisonCashScreen = dynamic(() => import('./maison/CashScreen').then((m) => ({ default: m.CashScreen })), { ssr: false, loading: AppLoading })
const MaisonDepositScreen = dynamic(() => import('./maison/CashScreen').then((m) => ({ default: m.DepositScreen })), { ssr: false, loading: AppLoading })
const MaisonAddressBookScreen = dynamic(() => import('./maison/FundsScreen').then((m) => ({ default: m.AddressBookScreen })), { ssr: false, loading: AppLoading })
const MaisonTransferScreen = dynamic(() => import('./maison/FundsScreen').then((m) => ({ default: m.TransferScreen })), { ssr: false, loading: AppLoading })
const MaisonReceiveScreen = dynamic(() => import('./maison/FundsScreen').then((m) => ({ default: m.ReceiveScreen })), { ssr: false, loading: AppLoading })
const MaisonWithdrawScreen = dynamic(() => import('./maison/FundsScreen').then((m) => ({ default: m.WithdrawScreen })), { ssr: false, loading: AppLoading })
const MaisonFeesScreen = dynamic(() => import('./maison/AccountScreen').then((m) => ({ default: m.FeesScreen })), { ssr: false, loading: AppLoading })
const MaisonProfileScreen = dynamic(() => import('./maison/AccountScreen').then((m) => ({ default: m.ProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonSettingsScreen = dynamic(() => import('./maison/AccountScreen').then((m) => ({ default: m.SettingsScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportCenterScreen = dynamic(() => import('./maison/SupportScreen').then((m) => ({ default: m.SupportCenterScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportNewScreen = dynamic(() => import('./maison/SupportScreen').then((m) => ({ default: m.SupportNewScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportTicketScreen = dynamic(() => import('./maison/SupportScreen').then((m) => ({ default: m.SupportTicketScreen })), { ssr: false, loading: AppLoading })
const MaisonEligibilityScreen = dynamic(() => import('./maison/VerifyScreen').then((m) => ({ default: m.EligibilityScreen })), { ssr: false, loading: AppLoading })
const MaisonKycScreen = dynamic(() => import('./maison/VerifyScreen').then((m) => ({ default: m.KycScreen })), { ssr: false, loading: AppLoading })
const MaisonRiskProfileScreen = dynamic(() => import('./maison/VerifyScreen').then((m) => ({ default: m.RiskProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonVerificationCenterScreen = dynamic(() => import('./maison/VerifyScreen').then((m) => ({ default: m.VerificationCenterScreen })), { ssr: false, loading: AppLoading })
const MaisonDocumentsScreen = dynamic(() => import('./maison/DocumentsScreen').then((m) => ({ default: m.DocumentsScreen })), { ssr: false, loading: AppLoading })
const MaisonCloseAccountScreen = dynamic(() => import('./maison/AccountClosureRequestScreen').then((m) => ({ default: m.AccountClosureRequestScreen })), { ssr: false, loading: AppLoading })
const MaisonSecurityScreen = dynamic(() => import('./maison/SecurityScreen').then((m) => ({ default: m.SecurityScreen })), { ssr: false, loading: AppLoading })
const MaisonReferralScreen = dynamic(() => import('./maison/ReferralScreen').then((m) => ({ default: m.ReferralScreen })), { ssr: false, loading: AppLoading })
import { acceptPendingInvite } from '@/lib/invite-acceptance'
import { getPortfolioHistory, getPositions, type PortfolioHistoryPoint, type PositionView } from '@/lib/portfolio-data'
import { getWallet, getLedgerTransactions, toUnits as walletUnits, type LedgerTransaction, type WalletView } from '@/lib/wallet-data'
import { formatMoneyNumber, formatUsdt } from '@/lib/money'
import { formatLedgerAmount, formatMoney, formatTime } from '@/lib/display/format'
import { assetCategoryLabel, ledgerDisplay } from '@/lib/display/labels'
import { getAssetHistory, type AssetHistoryPoint } from '@/lib/p0a-data'
import { createOrder } from '@/lib/orders-data'
import { fetchRwaProducts, rwaToProduct, type RwaAssetRow } from '@/lib/rwa-data'
import { getProducts, getFeaturedProducts, isAuthenticated, type DemoProduct } from '@/lib/h5-data'
import { demoProducts as fallbackProducts, projectProfiles } from '@/lib/demo-catalog'
import { useI18n } from '@/lib/i18n'
import { assetAccountRouteCopy, portfolioRouteCopy } from '@/lib/route-copy'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
const AiPearl = dynamic(() => import('./maison/AiPearl'), { ssr: false })
import { FlowProgress, LiquidSelection, ScreenTransition, SplitFlapText, captureSharedFlip, playSharedFlip, type RwaFlipState } from './motion-effects'
const AssetEvidencePanel = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.AssetEvidencePanel })), { ssr: false })
const OnboardingOverviewScreen = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.OnboardingOverviewScreen })), { ssr: false })
const ValuationScreen = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.ValuationScreen })), { ssr: false })
import { request } from '@/lib/api/_http'
const EligibilityNotice = dynamic(() => import('./eligibility-notice').then((m) => ({ default: m.EligibilityNotice })), { ssr: false })
import { BootScreen } from './screens/P01-Boot'
import { LoginScreen } from './screens/P02-Login'
import { AuthFlowScreen } from './screens/P03-AuthFlow'
import { HomeScreen } from './screens/P04-HomeMaison'
import { NotificationsScreen } from './screens/P28-Notifications'
import { ScreenRouter } from './ScreenRouter'
const MaisonBasketDisclosuresScreen = dynamic(() => import('./maison/BasketInfoScreens').then((m) => ({ default: m.BasketDisclosuresScreen })), { ssr: false, loading: AppLoading })
import { Button } from './ui/button'
import { EmptyState } from './ui/Empty'
import { Skeleton } from './ui/skeleton'
import type { PricePoint } from './charts/PriceArea'
// Charts load with the asset detail that draws them, not with the app shell.
const PriceArea = dynamic(() => import('./charts/PriceArea').then((m) => m.PriceArea), { ssr: false })
import Stepper, { Step } from './Stepper'

import { NAV_EVENT, pathForTarget, type NavTarget } from '@/lib/routes'

type Screen = RwaScreen
type OrderAsset = 'compute' | 'rwa' | 'stocks' | 'prediction'
type PrimaryScreen = 'home' | 'invest' | 'portfolio' | 'wallet' | 'community'
type InvestCategory = 'All' | 'Compute' | 'RWA' | 'Stocks' | 'Prediction'
type RiskFilter = 'all' | 'low' | 'medium' | 'high'
type AvailabilityFilter = 'all' | 'open' | 'limited'
type MinimumFilter = 'all' | '100' | '500'
type SortMode = 'featured' | 'yield' | 'minimum' | 'risk' | 'table'

const PROFILE_SECTION_SCREENS = new Set<Screen>([
  'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket',
  'fees', 'settings', 'marketing', 'official-channels', 'scam-report', 'close-account', 'trust-center',
  'access-regions', 'product-disclosures', 'legal-center', 'status',
])


const protectedScreens: Screen[] = ['home', 'portfolio', 'wallet', 'order-review', 'order-processing', 'order-success', 'order-partial', 'order-failed', 'order-receipt', 'order-detail', 'deposit', 'withdraw', 'transfer', 'receive', 'wallet-success', 'activity', 'asset-detail', 'position-detail', 'address-book', 'ai-plan', 'notifications', 'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket', 'settings', 'marketing', 'close-account', 'secondary', 'yield-calendar', 'rebalance', 'statements', 'recurring', 'my-predictions', 'basket-subscribe', 'basket-redeem']
const routeRequiresAuth = (pathname: string) => resolveRoute(pathname)?.def.auth === 'required'



const productAsset: Record<Exclude<InvestCategory, 'All'>, OrderAsset> = {
  Compute: 'compute',
  RWA: 'rwa',
  Stocks: 'stocks',
  Prediction: 'prediction',
}

/** Slug for the Maison asset page: RWA directory rows carry `rwa-<slug>`, catalog listings a UUID. */
function maisonSlug(product: DemoProduct) {
  if (product.id.startsWith('rwa-')) return product.id.slice(4)
  return isOrderableId(product.id) ? product.id : null
}

function detailRoute(asset: OrderAsset): Screen {
  if (asset === 'compute') return 'compute-detail'
  if (asset === 'stocks') return 'stock-detail'
  if (asset === 'prediction') return 'prediction-detail'
  return 'rwa-detail'
}

export function BottomDock({ screen, setScreen, activeScreen, showQuickActions = false }: { screen: Screen; setScreen: (screen: Screen) => void; activeScreen?: PrimaryScreen; showQuickActions?: boolean }) {
  const { locale, t } = useI18n()
  const { theme } = useRwaTheme()
  const shellCopy = rwaH5Copy[locale].shell
  const isCompact = useScrollChrome()
  const [quickOpen, setQuickOpen] = useState(false)
  const dockRef = useRef<HTMLElement>(null)
  const quickActions: Array<{ label: string; path: string; icon: LucideIcon }> = [
    { label: t('wallet.deposit'), path: '/assets/cash/deposit', icon: ArrowDownToLine },
    { label: t('wallet.withdraw'), path: '/assets/cash/withdraw', icon: ArrowUpFromLine },
    { label: t('wallet.transfer'), path: '/assets/cash/transfer', icon: ArrowRightLeft },
    { label: fundsCopy[locale].receive.action, path: '/assets/cash/receive', icon: QrCode },
  ]
  const items: Array<{ id: PrimaryScreen; label: string; icon: typeof House }> = [
    { id: 'home', label: t('nav.home'), icon: House },
    { id: 'invest', label: t('nav.markets'), icon: ChartNoAxesColumnIncreasing },
    { id: 'portfolio', label: t('nav.assets'), icon: ChartPie },
  ]
  useEffect(() => { expandChrome() }, [screen])
  useEffect(() => { setQuickOpen(false) }, [screen])
  useEffect(() => {
    if (!quickOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dockRef.current?.contains(event.target)) setQuickOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setQuickOpen(false) }
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutside); window.removeEventListener('keydown', closeOnEscape) }
  }, [quickOpen])
  useEffect(() => { if (isCompact) setQuickOpen(false) }, [isCompact])
  const active = items.find((item) => item.id === (activeScreen ?? screen)) ?? items[0]
  const ActiveIcon = active.icon
  // Same rule on every tab (iOS tab bar): minimise on scroll down, restore on scroll up; tapping the current tab returns to top.
  const select = (id: PrimaryScreen) => {
    if (id === screen) { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return }
    navigator.vibrate?.(6)
    markTabNavigation()
    setScreen(id)
  }
  return (
    <nav ref={dockRef} className={`liquid-dock ios-dock ${isCompact ? 'is-compact' : ''}`} aria-label={shellCopy.primaryNavigation}>
      <div className="liquid-dock__pill" aria-hidden={isCompact}>
        <span className="liquid-dock__shine" />
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-label={label} tabIndex={isCompact ? -1 : 0} className={`dock-link ${screen === id ? 'is-active' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => select(id)}>
            <span className="dock-link__icon"><Icon size={21} strokeWidth={screen === id ? 2 : 1.7} /></span>
            <span className="dock-link__label" aria-hidden="true"><span>{label}</span></span>
          </button>
        ))}
      </div>
      <button type="button" className="liquid-dock__compact-button" aria-hidden={!isCompact} tabIndex={isCompact ? 0 : -1} aria-label={active.label} aria-expanded={false} onClick={expandChrome}><ActiveIcon size={19} strokeWidth={1.8} /></button>
      {showQuickActions && <>
        <div id="dock-quick-menu" className="liquid-dock__quick-menu" data-open={quickOpen ? 'true' : 'false'} role="group" aria-label={quickActions.map((action) => action.label).join(', ')} aria-hidden={!quickOpen}>
          {quickActions.map(({ label, path, icon: Icon }) => <button key={path} type="button" tabIndex={quickOpen ? 0 : -1} onClick={() => { setQuickOpen(false); openPath(path) }}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span><ChevronRight size={14} aria-hidden="true" />
          </button>)}
        </div>
        <button type="button" className="liquid-dock__quick-trigger" aria-label={quickActions.map((action) => action.label).join(', ')} aria-controls="dock-quick-menu" aria-expanded={quickOpen} onClick={() => setQuickOpen((value) => !value)}>
          <Plus size={17} strokeWidth={1.9} />
        </button>
      </>}
      <button type="button" className={`ai-orb ${screen === 'ai' ? 'is-active' : ''}`} aria-label={t('nav.ai')} title={t('nav.ai')} onClick={() => { if (screen !== 'ai') markTabNavigation(); setScreen('ai') }}>
        <AiPearl size={46} inset={.48} state="idle" className="ai-orb__orb" />
      </button>
    </nav>
  )
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

function compactValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
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

function RwaDetailScreen({ product, go, notify, openOrder, openDynamic }: { product: DemoProduct; go: (screen: Screen) => void; notify: (message: string) => void; openOrder: (asset: OrderAsset) => void; openDynamic: (screen: 'valuation' | 'issuer-profile', slug: string) => void }) {
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

function PortfolioScreen({ go, notify, initialView = 'overview' }: { go: (screen: Screen) => void; notify: (message: string) => void; initialView?: 'overview' | 'positions' }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const portfolioCopy = rwaH5Copy[locale].portfolio
  const liveCopy = portfolioRouteCopy[locale]
  const [view, setView] = useState<'overview' | 'positions' | 'income' | 'history'>(initialView)
  useEffect(() => { setView(initialView) }, [initialView])
  const [positions, setPositions] = useState<PositionView[]>([])
  const [wallet, setWallet] = useState<WalletView | null>(null)
  const [ledger, setLedger] = useState<LedgerTransaction[]>([])
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([])
  const [portfolioState, setPortfolioState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let cancelled = false
    setPortfolioState('loading')
    Promise.allSettled([getPositions(), getWallet(), getLedgerTransactions(50), getPortfolioHistory()]).then(([positionsResult, walletResult, ledgerResult, historyResult]) => {
      if (cancelled) return
      if (positionsResult.status === 'fulfilled') setPositions(positionsResult.value)
      else setPositions([])
      if (walletResult.status === 'fulfilled') setWallet(walletResult.value)
      else setWallet(null)
      if (ledgerResult.status === 'fulfilled') setLedger(ledgerResult.value)
      else setLedger([])
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value)
      else setHistory([])
      setPortfolioState(positionsResult.status === 'fulfilled' || walletResult.status === 'fulfilled' ? 'ready' : 'error')
    })
    return () => { cancelled = true }
  }, [])
  const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const totalCost = positions.reduce((sum, p) => sum + p.cost, 0)
  const totalYield = positions.reduce((sum, p) => sum + p.yield, 0)
  const classTotals = new Map<string, number>()
  for (const p of positions) classTotals.set(p.productClass, (classTotals.get(p.productClass) ?? 0) + p.marketValue)
  const allocations: Array<[string, string, string]> = [...classTotals.entries()].map(([cls, val]) => [assetCategoryLabel(cls, locale), totalMarketValue > 0 ? `${Math.round((val / totalMarketValue) * 100)}%` : '0%', formatUsdt(val, locale)])
  const positionRows: Array<{ name: string; detail: string; value: string; change: string; Icon: LucideIcon }> = positions.map((p, index) => ({
    name: p.productName,
    detail: `${formatMoney(p.quantity, locale)} units · ${assetCategoryLabel(p.productClass, locale)}`,
    value: formatUsdt(p.marketValue, locale),
    change: formatMoney(p.yield, locale, { sign: 'always' }),
    Icon: [Cpu, Landmark, TrendingUp][index % 3],
  }))
  const incomeRows = ledger.filter((tx) => tx.transactionType === 'yield_distribution').map((tx) => {
    const entry = tx.entries.find((item) => item.purpose === 'available' || item.purpose === 'invested_cost') ?? tx.entries[0]
    const amount = entry ? walletUnits(entry.atomicAmount, entry.assetDecimals ?? 6) : null
    const date = new Date(tx.effectiveAt)
    return {
      date: formatTime(tx.effectiveAt, locale, { relative: false }),
      label: ledgerDisplay(tx.transactionType, locale).label,
      amount: amount === null ? '—' : formatLedgerAmount(amount, tx.transactionType, locale),
    }
  })
  const available = wallet ? walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals) : null
  const totalValue = portfolioState === 'loading' ? '…' : formatMoneyNumber(totalMarketValue, locale)
  const totalYieldLabel = portfolioState === 'loading' ? '…' : totalYield === 0 ? '—' : formatMoney(totalYield, locale, { sign: 'always' })
  const positionsCount = positions.length > 0 ? String(positions.length) : portfolioState === 'loading' ? '…' : '—'
  return (
    <section className="screen portfolio-screen">
      <RwaTopbar screen="portfolio" title={t('portfolio.title')} onProfile={() => go('profile')} />
      <h1 className="page-title sr-only">{t('portfolio.title')}</h1>
      <div className="portfolio-hero glass">
        <div><p>{t('portfolio.total')}</p><h2 className="money-hero"><SplitFlapText value={totalValue} /> <span>USDT</span></h2><strong>{totalYieldLabel} {copy.thisMonth}</strong></div>
        <AssetScene kind="portfolio" />
      </div>
      <div className="portfolio-score"><span><small>{copy.score}</small><b>{positionsCount}</b></span><div><i style={{ width: positions.length ? '100%' : '0%' }} /></div><p>{positions.length ? `${positions.length} ${copy.positions}` : portfolioState === 'loading' ? liveCopy.loadingPositions : liveCopy.noPositions}</p></div>
      <div className="portfolio-metrics">
        <span className="glass"><small>{copy.today}</small><b className="money-md">{totalYield > 0 ? formatMoney(totalYield, locale, { sign: 'in' }) : '—'}</b><em>USDT</em></span>
        <span className="glass"><small>{copy.days30}</small><b className="money-md">—</b><em>{copy.income}</em></span>
        <span className="glass"><small>{copy.cash}</small><b className="money-md">{available === null ? '—' : formatMoneyNumber(available, locale)}</b><em>{copy.reserve}</em></span>
      </div>
      <div className="portfolio-tabs" role="tablist" aria-label={t('portfolio.title')}>{([['overview', copy.overview], ['positions', copy.positions], ['income', copy.income], ['history', copy.history]] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}><LiquidSelection id="rwa-portfolio-selection" active={view === id} /><span>{label}</span></button>)}</div>
      {view === 'overview' && <>
        <div className="section-title"><h2>{t('portfolio.allocation')}</h2><button type="button" onClick={() => go('ai')}>{t('portfolio.askAi')}</button></div>
        <div className="allocation-list glass">{allocations.map(([name, percent, value], index) => <button type="button" key={name} onClick={() => go('position-detail')}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{value}</small></span><strong>{percent}</strong><ChevronRight size={18} /></button>)}</div>
        <button className="rebalance-row glass" type="button" onClick={() => go('rebalance')}><Sparkles size={21} /><span><b>{copy.aiRebalance}</b><small>{copy.rebalanceBody}</small></span><ChevronRight size={21} /></button>
        <div className="p0a-portfolio-tools"><button className="wide-glass-action glass" type="button" onClick={() => go('yield-calendar')}><CalendarDays size={19} /><span><b>{liveCopy.yieldCalendar}</b><small>{liveCopy.yieldCalendarBody}</small></span><ChevronRight size={18} /></button><button className="wide-glass-action glass" type="button" onClick={() => go('rebalance')}><ArrowRightLeft size={19} /><span><b>{liveCopy.rebalance}</b><small>{liveCopy.rebalanceBody}</small></span><ChevronRight size={18} /></button><button className="wide-glass-action glass" type="button" onClick={() => go('wallet')}><WalletCards size={19} /><span><b>{t('wallet.entryTitle')}</b><small>{t('wallet.entryBody')}</small></span><ChevronRight size={18} /></button></div>
        <div className="risk-monitor glass"><span><ShieldCheck size={20} /><b>{copy.riskEngine}</b></span><p>{copy.riskBody}</p><div><i style={{ width: '68%' }} /></div></div>
      </>}
      {view === 'positions' && <div className="portfolio-detail-list glass">
        {positionRows.map(({ name, detail, value, change, Icon }) => <button key={name} type="button" onClick={() => go('position-detail')}><span><Icon size={19} /></span><p><b>{name}</b><small>{detail}</small></p><strong>{value}<small className="mint">{change}</small></strong><ChevronRight size={17} /></button>)}
      </div>}
      {view === 'income' && <div className="income-view"><div className="income-hero glass"><small>{copy.nextDistribution}</small><b className="money-lg">—</b><span>{liveCopy.incomeNext}</span><i /></div><div className="income-ledger glass">{incomeRows.length ? incomeRows.map(({ date, label, amount }, index) => <span key={`${date}-${label}-${index}`}><small>{date}</small><b>{label}</b><strong className="money-sm">{amount}</strong></span>) : <EmptyState variant="inline" icon={ReceiptText} title={liveCopy.noIncome} body={liveCopy.incomeBody} />}</div></div>}
      {view === 'history' && <div className="history-view"><div className="history-summary glass"><span><small>{portfolioCopy.netContributions}</small><b className="money-sm">{formatUsdt(totalCost, locale)}</b></span><span><small>{portfolioCopy.marketMovement}</small><b className={`money-sm ${totalMarketValue >= totalCost ? 'mint' : ''}`}>{totalMarketValue === totalCost ? '—' : `${totalMarketValue > totalCost ? '+' : '−'}${formatUsdt(Math.abs(totalMarketValue - totalCost), locale)}`}</b></span><span><small>{portfolioCopy.incomeSettled}</small><b className={`money-sm ${totalYield >= 0 ? 'mint' : ''}`}>{totalYield === 0 ? '—' : `${totalYield > 0 ? '+' : '−'}${formatUsdt(Math.abs(totalYield), locale)}`}</b></span></div>{history.length ? <div className="history-chart glass"><div>{history.map((point, index) => { const values = history.map((item) => item.value); const min = Math.min(...values); const max = Math.max(...values); const height = max === min ? 55 : 20 + ((point.value - min) / (max - min)) * 75; return <i key={`${point.date}-${index}`} style={{ height: `${height}%` }} /> })}</div><span>{history.map((point, index) => <small key={`${point.date}-${index}`}>{point.date.slice(5, 10)}</small>)}</span></div> : <div className="history-chart glass"><EmptyState variant="inline" icon={ReceiptText} title={liveCopy.noHistory} body={liveCopy.historyBody} /></div>}<button className="wide-glass-action glass" type="button" onClick={() => notify(portfolioCopy.exportReady)}><ReceiptText size={20} /><span><b>{portfolioCopy.exportTitle}</b><small>{history.length ? portfolioCopy.exportBody : liveCopy.noExport}</small></span><ChevronRight size={20} /></button></div>}
    </section>
  )
}




function AiScreen({ go, onClose, pageContext }: { go: (screen: Screen) => void; notify: (message: string) => void; onClose: () => void; pageContext?: AiPageContext }) {
  return <AiChatScreen onClose={onClose} onPlan={() => go('ai-plan')} pageContext={pageContext} />
}



function DetailHeader({ screen, go, back, title, kind = 'detail' }: { screen?: Screen; go: (screen: Screen) => void; back: Screen; title?: string; kind?: 'detail' | 'flow' | 'tool' | 'trust' | 'list' }) {
  const { t } = useI18n()
  return <RwaTopbar screen={screen} kind={kind} title={title ?? t('nav.invest')} onBack={kind === 'flow' ? undefined : () => go(back)} onClose={kind === 'flow' ? () => go(back) : undefined} />
}

function AssetDetailScreen({ asset, product, go, openOrder, notify, openDynamic }: { asset: Exclude<OrderAsset, 'rwa'>; product: DemoProduct; go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void; notify: (message: string) => void; openDynamic: (screen: 'valuation' | 'issuer-profile', slug: string) => void }) {
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

function OrderReviewScreen({ asset, product: selectedProduct, go, amount, setAmount, onOrderCreated }: { asset: OrderAsset; product: DemoProduct; go: (screen: Screen) => void; amount: number; setAmount: (value: number) => void; onOrderCreated: (orderId: string) => void }) {
  const { locale } = useI18n()
  const copy = orderCopy[locale]
  const product = selectedProduct.title
  const expected = `${selectedProduct.returnMetric} ${selectedProduct.returnLabel}`
  const fee = Math.max(1.5, amount * productFeeRate(selectedProduct))
  const [quoteSeconds, setQuoteSeconds] = useState(45)
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletView | null>(null)
  useEffect(() => {
    getWallet().then((w) => setWallet(w)).catch(() => setWallet(null))
  }, [])
  const decimals = wallet?.asset.decimals ?? 6
  const available = walletUnits(wallet?.balances.availableAtomic, decimals)
  const fmtAvailable = formatMoneyNumber(available, locale)
  useEffect(() => {
    if (quoteSeconds <= 0) return
    const timer = window.setTimeout(() => setQuoteSeconds((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [quoteSeconds])
  const amountError = amount <= 0 ? copy.enterAmount : amount + fee > available ? copy.balanceExceeded : null
  const quoteExpired = quoteSeconds === 0
  const canSubmit = !amountError && !quoteExpired && riskConfirmed && !isSubmitting
  const submit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const order = await createOrder({
        productId: selectedProduct.id,
        amountAtomic: String(Math.round(amount * 10 ** decimals)),
        outcomeKey: 'long',
      })
      onOrderCreated(order.id)
      go('order-success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSubmitError(message.includes('409') || message.toLowerCase().includes('conflict') ? (locale === 'zh-CN' ? '该请求已记录，请到交易记录查看' : 'Request recorded. Check Orders & receipts.') : message.slice(0, 120))
      setIsSubmitting(false)
    }
  }
  return (
    <section className="screen order-review-screen has-fixed-cta">
      <DetailHeader screen="order-review" go={go} back={detailRoute(asset)} title={copy.review} kind="flow" />
      <FlowProgress current={1} total={3} label={copy.review} />
      <div className="order-asset glass"><span className="order-asset__icon">{asset === 'compute' ? <Cpu size={23} /> : asset === 'rwa' ? <Landmark size={23} /> : asset === 'stocks' ? <TrendingUp size={23} /> : <Sparkles size={23} />}</span><div><b>{product}</b><small>{expected}</small></div><ChevronRight size={20} /></div>
      <div className="amount-panel glass"><span>{copy.amount}</span><div><input aria-label={copy.amount} inputMode="decimal" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} /><b>USDT</b></div><small>{copy.available}: {fmtAvailable} USDT</small><div className="amount-presets">{[100, 500, 1000, 5000].map((value) => <button key={value} type="button" onClick={() => setAmount(value)}>{formatMoney(value, locale)}</button>)}</div></div>
      <div className="review-breakdown"><span><small>{copy.allocation}</small><b>{formatMoney(amount, locale)} USDT</b></span><span><small>{copy.fee}</small><b>{formatMoney(fee, locale)} USDT</b></span><span><small>{copy.total}</small><b>{formatMoney(amount + fee, locale)} USDT</b></span></div>
      <div className={`quote-status ${quoteExpired ? 'is-expired' : ''}`}><Clock3 size={16} /><span><b>{quoteExpired ? copy.quoteExpired : interpolateCopy(copy.quoteHeld, { seconds: quoteSeconds })}</b><small>{quoteExpired ? copy.expiredBody : copy.heldBody}</small></span>{quoteExpired && <button type="button" onClick={() => setQuoteSeconds(45)}>{copy.refresh}</button>}</div>
      {amountError && <Notice tone="error" className="order-notice">{amountError}</Notice>}
      {submitError && <Notice tone="error" className="order-notice">{submitError}</Notice>}
      <button className={`risk-ack glass ${riskConfirmed ? 'is-confirmed' : ''}`} type="button" onClick={() => setRiskConfirmed((current) => !current)}><ShieldCheck size={21} /><p><b>{copy.confirmation}</b><small>{copy.confirmationBody}</small></p><span>{riskConfirmed && <Check size={15} />}</span></button>
      {!riskConfirmed && <Notice tone="error" quiet className="order-notice">{copy.confirmFirst}</Notice>}
      <button className="flow-cta" type="button" disabled={!canSubmit} onClick={submit}>{isSubmitting ? copy.recording : quoteExpired ? copy.refreshToContinue : asset === 'prediction' ? copy.recordRequest : copy.recordAllocation}<LockKeyholeIcon /></button>
    </section>
  )
}

function LockKeyholeIcon() { return <KeyRound size={21} /> }


type DepositAddressView = {
  address: string
  memo?: string | null
  requiredConfirmations?: number
  minimumDepositAtomic?: string
  estimatedArrivalMinutes?: [number, number]
  warning?: string
}

type WithdrawalQuoteView = {
  feeAtomicAmount?: string
  totalDebitAtomic?: string
  sufficientBalance?: boolean
}




function AssetAccountScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
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

function PositionDetailScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  const { locale } = useI18n()
  const copy = portfolioDetailCopy[locale]
  return <section className="screen position-screen"><DetailHeader screen="position-detail" go={go} back="portfolio" title={copy.computePosition} /><div className="position-hero glass"><AssetScene kind="compute" /><div><p>{copy.computeUnit}</p><h1>2,430.00 <span>USDT</span></h1><b>{copy.todayGain}</b></div></div><div className="position-stats"><span><small>{copy.dailyRevenue}</small><b>12.40 USDT</b></span><span><small>{copy.utilization}</small><b>98.1%</b></span><span><small>{copy.revenueEarned}</small><b>430.20 USDT</b></span></div><div className="yield-chart glass"><div className="yield-chart__head"><span>{copy.revenueHistory}</span><b>{copy.last30}</b></div><div className="yield-chart__bars">{[36,48,42,61,57,69,76,73,84,80,93,88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><button className="wide-glass-action glass" type="button" onClick={() => openOrder('compute')}><Cpu size={20} /><span><b>{copy.addCapacity}</b><small>{copy.capacityBody}</small></span><ChevronRight size={20} /></button></section>
}

function MarketingPreferencesScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  return <section className="screen account-flow-screen"><DetailHeader screen="marketing" go={go} back="profile" title={t('marketing.title')} /><div className="account-flow-hero"><span><Bell size={30} /></span><p>{copy.communicationControl}</p><h1>{t('marketing.heading')}</h1><small>{t('marketing.body')}</small></div><div className="consent-stack glass" style={{ padding: 20 }}><NotificationPreferences /></div></section>
}

function OfficialChannelsScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const copy = trustActionCopy[locale]
  return <section className="screen account-flow-screen has-fixed-cta"><DetailHeader screen="official-channels" go={go} back="profile" title={t('official.title')} /><div className="account-flow-hero"><span><ShieldCheck size={30} /></span><p>{copy.trustCenter}</p><h1>{t('official.heading')}</h1><small>{t('official.body')}</small></div><PublishedOfficialChannels /><div className="anti-scam-callout"><AlertTriangle size={20} /><p><b>{copy.neverShare}</b><small>{copy.depositOnly}</small></p></div><button className="flow-cta" type="button" onClick={() => go('scam-report')}>{t('official.report')}<ArrowRight size={20} /></button></section>
}

function ScamReportScreen({ go, isGuest, onCreated }: { go: (screen: Screen) => void; isGuest: boolean; onCreated: (id: string) => void }) {
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


type TrustPageKind = 'trust-center' | 'access-regions' | 'product-disclosures' | 'legal-center'
type TrustRow = { title: string; description: string; icon: LucideIcon; destination?: Screen }

function TrustCenterScreen({ kind, go, notify }: { kind: TrustPageKind; go: (screen: Screen) => void; notify: (message: string) => void }) {
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

function RwaH5Content({ initialScreen = 'home', initialParams = {}, initialQuery = '', initialPath = '' }: { initialScreen?: Screen; initialParams?: Record<string, string>; initialQuery?: string; initialPath?: string }) {
  const { locale, t } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [aiContext, setAiContext] = useState<AiPageContext | undefined>()
  const [routeQuery, setRouteQuery] = useState(initialQuery)
  const [routeParams, setRouteParams] = useState<Record<string, string>>(initialParams)
  // Pathname of the last URL-driven navigation; '' after a legacy go(). Separates routes that share a screen (/compare → rwa-detail).
  const [routePath, setRoutePath] = useState(initialPath)
  const navigationMotion = useNavigationViewport(`${screen}:${routePath}:${routeQuery}`)
  const [profileBaseScreen, setProfileBaseScreen] = useState<Screen | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [sessionMode, setSessionMode] = useState<'guest' | 'authenticated'>('guest')
  const [sessionReady, setSessionReady] = useState(false)
  const [products, setProducts] = useState<DemoProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct>(() => {
    if (initialScreen === 'rwa-detail' && initialParams.slug) {
      return { ...fallbackProducts[0], id: `rwa-${initialParams.slug}`, title: initialParams.slug, category: 'RWA', isDemo: false }
    }
    if (initialScreen === 'prediction-detail' && initialParams.id) {
      return { ...fallbackProducts[0], id: `polymarket-${initialParams.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }
    }
    return fallbackProducts[0]
  })
  const [featured, setFeatured] = useState<DemoProduct[]>([])
  const [communityPostId, setCommunityPostId] = useState<string | null>(initialScreen === 'community-post' ? initialParams.id ?? null : null)
  const [supportTicketId, setSupportTicketId] = useState<string | null>(initialScreen === 'support-ticket' ? initialParams.id ?? null : null)
  const [orderDetailId, setOrderDetailId] = useState<string | null>(initialScreen === 'order-detail' ? initialParams.id ?? null : null)
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(initialScreen.startsWith('basket-') ? initialParams.id ?? null : null)
  const [routeSymbol, setRouteSymbol] = useState<string | undefined>(initialParams.symbol)
  const { theme, mode } = useRwaTheme()
  const [communityHandle, setCommunityHandle] = useState<string | null>(initialScreen === 'community-profile' ? initialParams.handle ?? null : null)
  const pendingFlipRef = useRef<{ state: RwaFlipState; productId: string } | null>(null)
  useEffect(() => {
    setSessionMode(isAuthenticated() ? 'authenticated' : 'guest')
    try {
      const stored = window.sessionStorage.getItem('rwa-selected-product')
      if (stored && !initialParams.slug && !(initialScreen === 'prediction-detail' && initialParams.id)) setSelectedProduct(JSON.parse(stored) as DemoProduct)
    } catch {
      window.sessionStorage.removeItem('rwa-selected-product')
    }
    const storedCommunityPost = window.sessionStorage.getItem('rwa-community-post')
    if (storedCommunityPost && !initialParams.id) setCommunityPostId(storedCommunityPost)
    const storedCommunityHandle = window.sessionStorage.getItem('rwa-community-handle')
    if (storedCommunityHandle && !initialParams.handle) setCommunityHandle(storedCommunityHandle)
    const storedBasket = window.sessionStorage.getItem('rwa-selected-basket')
    if (storedBasket && !initialParams.id) setSelectedBasketId(storedBasket)
    const communityParams = new URLSearchParams(window.location.search)
    if (initialScreen === 'community-post' && !initialParams.id && communityParams.get('id')) setCommunityPostId(communityParams.get('id'))
    if (initialScreen === 'community-profile' && !initialParams.handle && communityParams.get('handle')) setCommunityHandle(communityParams.get('handle'))
    if (initialScreen === 'valuation' && initialParams.slug) window.sessionStorage.setItem('rwa-p0a-slug', initialParams.slug)
    setSessionReady(true)
  }, [])
  // ── API-first product loading (catalog + real RWA assets from DefiLlama sync) ──
  useEffect(() => {
    let cancelled = false
    Promise.all([getProducts(), fetchRwaProducts(40)])
      .then(([p, rwaProducts]) => {
        if (!cancelled) {
          setProducts([...rwaProducts, ...p])
          setFeatured(getFeaturedProducts())
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  // /asset/:slug wins; legacy /invest/<kind> falls back to the product chosen earlier in this tab.
  const detailSlug = routeParams.slug ?? maisonSlug(selectedProduct)
  const predictionId = routeParams.id ?? (selectedProduct.id.startsWith('polymarket-') && selectedProduct.id !== 'polymarket-live' ? selectedProduct.id.slice('polymarket-'.length) : null)
  const localizedSelectedProduct = useMemo(() => localizeProduct(selectedProduct, locale), [locale, selectedProduct])
  useEffect(() => {
    const pending = pendingFlipRef.current
    if (!pending || !['rwa-detail', 'compute-detail', 'stock-detail', 'prediction-detail'].includes(screen)) return
    pendingFlipRef.current = null
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-flip-target="${pending.productId}"]`)
      playSharedFlip(pending.state, target)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen])
  useEffect(() => {
    const profileReturn = new URLSearchParams(window.location.search).get('profileReturn') as Screen | null
    if (profileReturn && ['home', 'invest', 'portfolio', 'wallet'].includes(profileReturn)) {
      setProfileBaseScreen(profileReturn)
      window.sessionStorage.setItem('rwa-profile-base', profileReturn)
    }
    setScreen(initialScreen)
    setRouteQuery(initialQuery)
    setRouteParams(initialParams)
    if (initialParams.id) {
      if (initialScreen.startsWith('basket-')) setSelectedBasketId(initialParams.id)
      if (initialScreen === 'order-detail') setOrderDetailId(initialParams.id)
      if (initialScreen === 'support-ticket') setSupportTicketId(initialParams.id)
      if (initialScreen === 'community-post') setCommunityPostId(initialParams.id)
      if (initialScreen === 'prediction-detail') setSelectedProduct((current) => ({ ...current, id: `polymarket-${initialParams.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }))
    }
    if (initialScreen === 'community-profile' && initialParams.handle) setCommunityHandle(initialParams.handle)
    if (initialScreen === 'rwa-detail' && initialParams.slug) setSelectedProduct((current) => ({ ...current, id: `rwa-${initialParams.slug}`, title: initialParams.slug, category: 'RWA', isDemo: false }))
    if (initialScreen === 'trade') setRouteSymbol(initialParams.symbol)
    if (initialScreen === 'valuation' && initialParams.slug) window.sessionStorage.setItem('rwa-p0a-slug', initialParams.slug)
  }, [initialScreen, initialQuery, initialParams.id, initialParams.handle, initialParams.slug, initialParams.symbol])
  useEffect(() => {
    // A signed-in visitor opening /login or /register goes to the app instead of a second sign-in.
    if (!sessionReady || !isAuthenticated() || (initialScreen !== 'login' && initialScreen !== 'register')) return
    setScreen('home')
    router.replace(pathForScreen('home'))
    // Only the first ready check decides; a sign-in on this screen navigates by itself.
  }, [sessionReady])
  useEffect(() => {
    // Signing out (or in) in another tab reloads this one so it never acts on a stale session.
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'rwa.session' && event.key !== 'rwa-session-token') return
      if (isAuthenticated() !== (sessionMode === 'authenticated')) window.location.reload()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [sessionMode])
  useEffect(() => {
    if (!sessionReady || sessionMode !== 'guest' || (!protectedScreens.includes(initialScreen) && !routeRequiresAuth(window.location.pathname))) return
    // Keep ids and query (e.g. /orders/review?product=…) so login returns to the exact deep link.
    window.sessionStorage.setItem('rwa.return-to', `${window.location.pathname}${window.location.search}`)
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
    if (sessionReady && sessionMode === 'authenticated') void acceptPendingInvite()
  }, [sessionMode, sessionReady])
  useEffect(() => {
    const updateConnection = () => setIsOnline(window.navigator.onLine)
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])
  // 丝滑切换：URL 同步用 pushState（不触发 Next 路由重挂载）
  const syncUrl = (path: string) => {
    if (`${window.location.pathname}${window.location.search}` !== path) window.history.pushState(nextNavigationState(), '', path)
  }
  const applyLocation = () => {
      const segs = window.location.pathname.split('/').filter(Boolean)
      const pathname = window.location.pathname
      const baseScreen = screenForSegments(segs) ?? screenForV2Segments(segs)
      if (!baseScreen) return
      const query = new URLSearchParams(window.location.search)
      const s = screenForV2Query(pathname, query, baseScreen)
      if (sessionReady && sessionMode === 'guest' && (protectedScreens.includes(s) || routeRequiresAuth(pathname))) {
        window.sessionStorage.setItem('rwa.return-to', `${pathname}${window.location.search}`)
        setScreen('login')
        if (pathname !== pathForScreen('login')) router.replace(pathForScreen('login'))
        return
      }
      const params = resolveRoute(pathname)?.params
      if (params?.id) {
        if (s.startsWith('basket-')) setSelectedBasketId(params.id)
        if (s === 'order-detail') setOrderDetailId(params.id)
        if (s === 'support-ticket') setSupportTicketId(params.id)
        if (s === 'community-post') setCommunityPostId(params.id)
        if (s === 'prediction-detail') setSelectedProduct((current) => ({ ...current, id: `polymarket-${params.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }))
      }
      if (params?.handle && s === 'community-profile') setCommunityHandle(params.handle)
      if (params?.slug && s === 'rwa-detail') setSelectedProduct((current) => ({ ...current, id: `rwa-${params.slug}`, title: params.slug, category: 'RWA', isDemo: false }))
      if (s === 'trade') setRouteSymbol(params?.symbol)
      setRouteParams(params ?? {})
      setRoutePath(pathname)
      setRouteQuery(query.toString())
      setScreen(s)
  }
  useEffect(() => {
    const onPop = () => applyLocation()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [router, sessionMode, sessionReady])
  useEffect(() => {
    const receive = (event: Event) => {
      const target = (event as CustomEvent<NavTarget & { screen: Screen }>).detail
      go(target.screen)
      if (target.params) {
        const path = pathForTarget(target)
        if (path) history.replaceState({ ...history.state, rwaNavigation: true }, '', path)
      }
    }
    window.addEventListener(NAV_EVENT, receive)
    return () => window.removeEventListener(NAV_EVENT, receive)
  })
  // Maison screens navigate by URL so ids and query survive refresh, deep links and login return.
  useEffect(() => {
    const receive = (event: Event) => {
      const { path, replace } = (event as CustomEvent<PathNavigation>).detail
      const url = new URL(path, window.location.origin)
      if (url.origin !== window.location.origin) return
      const segs = url.pathname.split('/').filter(Boolean)
      const base = screenForSegments(segs) ?? screenForV2Segments(segs)
      if (!base) { window.location.assign(url.pathname + url.search); return }
      const next = screenForV2Query(url.pathname, url.searchParams, base)
      if (next === 'ai' && screen !== 'ai') setAiContext(aiPageContext(window.location.pathname, window.location.search))
      if (sessionMode === 'guest' && (protectedScreens.includes(next) || routeRequiresAuth(url.pathname))) {
        window.sessionStorage.setItem('rwa.return-to', url.pathname + url.search)
        go('login')
        return
      }
      ;(document.activeElement as HTMLElement | null)?.blur()
      // Fresh state object: Next only syncs its router for history writes that lack its own `__NA` marker.
      if (/^\/(?:wallet|assets\/cash)\/(deposit|withdraw|transfer|receive)(?:\/|$)/.test(url.pathname)) captureWalletBackdrop()
      const state = nextNavigationState(Boolean(replace))
      if (replace) window.history.replaceState(state, '', url.pathname + url.search)
      else window.history.pushState(state, '', url.pathname + url.search)
      setProfileBaseScreen(null)
      applyLocation()
    }
    window.addEventListener(PATH_EVENT, receive)
    return () => window.removeEventListener(PATH_EVENT, receive)
  })
  const go = (next: Screen) => {
    if (next === 'ai' && screen !== 'ai') setAiContext(aiPageContext(window.location.pathname, window.location.search))
    if (sessionMode === 'guest' && protectedScreens.includes(next)) {
      window.sessionStorage.setItem('rwa.return-to', pathForScreen(next))
      notify(t('guest.protected'), 'info')
      next = 'login'
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    const returningToProfile = next === 'profile' && (
      PROFILE_SECTION_SCREENS.has(screen) || resolveRoute(window.location.pathname)?.def.domain === 'profile'
    )
    if (next === 'ai' || (next === 'profile' && !returningToProfile)) {
      window.sessionStorage.setItem('rwa-overlay-base', screen)
    }
    setProfileBaseScreen(null)
    if (next === 'deposit' || next === 'withdraw' || next === 'transfer' || next === 'receive') captureWalletBackdrop()
    setScreen(next)
    setRouteQuery('')
    setRouteParams({})
    setRoutePath('')
    if (next !== 'trade') setRouteSymbol(undefined)
    const nextPath = pathForScreen(next)
    syncUrl(nextPath)
    // These are two modes of the same form; keep its viewport and video stable.
    if ((screen === 'login' || screen === 'register') && (next === 'login' || next === 'register')) return
    // The screen effect owns scroll reset; do not interrupt later user gestures.
  }
  const closeOverlay = () => {
    const storedBase = window.sessionStorage.getItem('rwa-overlay-base') as Screen | null
    const storedProfileBase = window.sessionStorage.getItem('rwa-profile-base') as Screen | null
    const canCloseTo = (candidate: Screen | null) => Boolean(candidate && candidate !== 'profile' && candidate !== 'ai' && (
      screen !== 'profile' || !PROFILE_SECTION_SCREENS.has(candidate)
    ))
    const base = canCloseTo(profileBaseScreen) ? profileBaseScreen!
      : canCloseTo(storedProfileBase) ? storedProfileBase!
      : canCloseTo(storedBase) ? storedBase!
      : 'home'
    setProfileBaseScreen(null)
    window.sessionStorage.removeItem('rwa-profile-base')
    window.sessionStorage.removeItem('rwa-overlay-base')
    if (window.history.state?.rwaNavigation) { window.history.back(); return }
    setScreen(base)
    const nextPath = pathForScreen(base)
    syncUrl(nextPath)
  }
  const openProfileSection = (next: Screen) => {
    setProfileBaseScreen(screen)
    window.sessionStorage.setItem('rwa-profile-base', screen)
    setScreen(next)
    const nextPath = `${pathForScreen(next)}?profileReturn=${encodeURIComponent(screen)}`
    syncUrl(nextPath)
  }
  const notify = (message: string, tone?: ToastTone) => showToast(message, tone)
  const openOrder = (asset: OrderAsset) => {
    if (isOrderableId(selectedProduct.id)) { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/orders/review?product=${encodeURIComponent(selectedProduct.id)}` } })); return }
    go('order-review')
  }
  const openProduct = (product: DemoProduct) => {
    const source = document.querySelector(`[data-flip-id="${product.id}"]`)
    const state = captureSharedFlip(source)
    if (state) pendingFlipRef.current = { state, productId: product.id }
    setSelectedProduct(product)
    window.sessionStorage.setItem('rwa-selected-product', JSON.stringify(product))
    const slug = maisonSlug(product)
    if (slug && product.category !== 'Prediction') { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/asset/${encodeURIComponent(slug)}` } })); return }
    go(detailRoute(productAsset[product.category]))
  }
  const openDynamicScreen = (next: 'valuation' | 'issuer-profile', slug: string) => {
    if (next === 'issuer-profile') { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/issuers/${encodeURIComponent(slug)}` } })); return }
    window.sessionStorage.setItem('rwa-p0a-slug', slug)
    go(next)
    window.setTimeout(() => syncUrl(pathForDynamicScreen(next, slug)), 0)
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
      note: 'Live public Polymarket data; execution access is required',
      isDemo: false,
    }
    setSelectedProduct(product)
    window.sessionStorage.setItem('rwa-selected-product', JSON.stringify(product))
    go('prediction-detail')
  }
  const openSupportTicket = (id: string) => {
    setSupportTicketId(id)
    window.sessionStorage.setItem('rwa-support-ticket', id)
    openPath(`/profile/support/ticket/${encodeURIComponent(id)}`)
  }
  const openOrderDetail = (id: string) => {
    setOrderDetailId(id)
    go('order-detail')
  }
  const openCommunityPost = (id: string) => {
    setCommunityPostId(id)
    window.sessionStorage.setItem('rwa-community-post', id)
    openPath(`/community/post/${encodeURIComponent(id)}`)
  }
  const openCommunityProfile = (handle: string) => {
    setCommunityHandle(handle)
    window.sessionStorage.setItem('rwa-community-handle', handle)
    openPath(`/community/member/${encodeURIComponent(handle)}`)
  }
  const openBasket = (id: string, next: BasketKind = 'detail') => {
    setSelectedBasketId(id)
    window.sessionStorage.setItem('rwa-selected-basket', id)
    const destination: Screen = next === 'detail' ? 'basket-detail' : next === 'subscribe' ? 'basket-subscribe' : next === 'redeem' ? 'basket-redeem' : 'basket-disclosures'
    go(destination)
  }
  const openWalletFlow = (mode: 'deposit' | 'withdraw' | 'transfer') => {
    window.sessionStorage.setItem('rwa-wallet-flow-mode', mode)
    go(mode)
  }
  const setAuthenticated = () => { setSessionMode('authenticated'); window.localStorage.setItem('rwa-session-mode', 'authenticated') }
  const setSignedOut = () => setSessionMode('guest')
  // The order sheet keeps the Dock behind it; funds routes occupy the full screen.
  const isFloatingSheet = screen === 'order-review'
  const showDock = ['home', 'invest', 'portfolio'].includes(screen) || isFloatingSheet
  const dockActiveScreen: PrimaryScreen | undefined = screen === 'order-review' ? 'invest' : undefined
  const isProtectedWaiting = (protectedScreens.includes(screen) || routeRequiresAuth(routePath || initialPath)) && !sessionReady
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      {!isOnline && <div className="connection-banner" role="status"><AlertTriangle size={16} /><span><b>{shellCopy.offlineTitle}</b><small>{shellCopy.offlineBody}</small></span></div>}
      <div className="rwa-mobile" data-theme={theme} data-mode={mode} data-screen={screen} data-dock={showDock ? 'true' : 'false'} data-sheet={isFloatingSheet ? 'true' : 'false'}>
        <ScreenTransition screenKey={screen === 'login' || screen === 'register' ? 'auth-entry' : screen} motion={navigationMotion}>
        {isProtectedWaiting ? <AppLoading /> : <ScreenRouter screen={screen} routes={{
          welcome: <MaisonBridge page="welcome"><BootScreen go={go} /></MaisonBridge>,
          login: <LoginScreen mode="login" go={go} notify={notify} onAuthenticated={setAuthenticated} />,
          register: <LoginScreen mode="register" go={go} notify={notify} onAuthenticated={setAuthenticated} />,
          'verify-email': <AuthFlowScreen step="verify" go={go} notify={notify} onAuthenticated={setAuthenticated} />,
          recovery: <AuthFlowScreen step="recover" go={go} notify={notify} onAuthenticated={setAuthenticated} />,
          home: <HomeScreen go={go} />,
          ai: <AiScreen go={go} notify={notify} onClose={closeOverlay} pageContext={aiContext} />,
          profile: <MaisonProfileScreen guest={sessionMode === 'guest'} onClose={closeOverlay} onSignedOut={setSignedOut} />,
          notifications: <MaisonBridge page="notifications"><NotificationsScreen go={go} notify={notify} enabled={sessionReady && sessionMode === 'authenticated'} guest={sessionReady && sessionMode === 'guest'} focusId={routeParams.id} /></MaisonBridge>,
        }}>
        {screen === 'invest' && <MaisonMarketsScreen query={routeQuery} />}
        {screen === 'basket-list' && <MaisonMarketsScreen query={new URLSearchParams(routeQuery).get('tab') ? routeQuery : 'tab=baskets'} />}
        {screen === 'strategy-detail' && <MaisonHengxuDetailScreen key={routeParams.id ?? ''} id={routeParams.id ?? null} />}
        {screen === 'basket-detail' && <MaisonBasketDetailScreen key={routeParams.id ?? selectedBasketId ?? ''} id={routeParams.id ?? selectedBasketId} />}
        {screen === 'basket-subscribe' && <MaisonBasketOrderScreen key={`s:${routeParams.id ?? selectedBasketId ?? ''}`} side="subscribe" id={routeParams.id ?? selectedBasketId} />}
        {screen === 'basket-redeem' && <MaisonBasketOrderScreen key={`r:${routeParams.id ?? selectedBasketId ?? ''}`} side="redeem" id={routeParams.id ?? selectedBasketId} />}
        {screen === 'basket-disclosures' && <MaisonBasketDisclosuresScreen />}
        {screen === 'basket-recommend' && <AiPlanningScreen key="goals" id={undefined} />}
        {screen === 'portfolio' && <MaisonPortfolioScreen key={routeQuery} query={routeQuery} />}
        {screen === 'wallet' && <MaisonCashScreen />}
        {screen === 'community' && <CommunityFeedScreen go={go} openPost={openCommunityPost} openProfile={openCommunityProfile} isGuest={sessionMode === 'guest'} />}
        {(screen === 'learn' || screen === 'learn-article') && <LearnScreen key={`${locale}:${routeParams.slug ?? ''}`} slug={screen === 'learn-article' ? routeParams.slug : undefined} />}
        {screen === 'community-post' && <CommunityPostScreen key={communityPostId} postId={communityPostId} go={go} openProfile={openCommunityProfile} isGuest={sessionMode === 'guest'} />}
        {screen === 'community-profile' && <CommunityProfileScreen key={communityHandle} handle={communityHandle} go={go} openPost={openCommunityPost} isGuest={sessionMode === 'guest'} />}
        {screen === 'share-landing' && <PublicShareLanding key={routeParams.token} token={routeParams.token??null} />}
        {screen === 'rwa-detail' && routePath === '/compare' && <MaisonCompareScreen query={routeQuery} />}
        {screen === 'rwa-detail' && routePath !== '/compare' && (detailSlug ? <MaisonAssetDetailScreen slug={detailSlug} /> : <RwaDetailScreen product={selectedProduct.category === 'RWA' ? localizedSelectedProduct : localizeProduct(products.find((product) => product.category === 'RWA') ?? selectedProduct, locale)} go={go} notify={notify} openOrder={openOrder} openDynamic={openDynamicScreen} />)}
        {screen === 'compute-detail' && (detailSlug ? <MaisonAssetDetailScreen slug={detailSlug} /> : <AssetDetailScreen product={selectedProduct.category === 'Compute' ? localizedSelectedProduct : localizeProduct(products.find((product) => product.category === 'Compute') ?? selectedProduct, locale)} asset="compute" go={go} openOrder={openOrder} notify={notify} openDynamic={openDynamicScreen} />)}
        {screen === 'stock-detail' && (detailSlug ? <MaisonAssetDetailScreen slug={detailSlug} /> : <AssetDetailScreen product={selectedProduct.category === 'Stocks' ? localizedSelectedProduct : localizeProduct(products.find((product) => product.category === 'Stocks') ?? selectedProduct, locale)} asset="stocks" go={go} openOrder={openOrder} notify={notify} openDynamic={openDynamicScreen} />)}
        {screen === 'prediction-detail' && predictionId && <MaisonPredictionScreen key={predictionId} id={predictionId} />}
        {screen === 'prediction-detail' && !predictionId && <AssetDetailScreen asset="prediction" product={selectedProduct.category === 'Prediction' ? localizedSelectedProduct : { id: 'polymarket-live', title: 'Polymarket market discovery', subtitle: 'Public market data · execution eligibility required', category: 'Prediction', risk: 'High Risk', kind: 'prediction', returnMetric: 'Live', returnLabel: 'market data', minimum: '10 USDT', liquidity: 'Variable', availability: 'Public discovery', note: 'Live public data; execution access is required', isDemo: true }} go={go} openOrder={openOrder} notify={notify} openDynamic={openDynamicScreen} />}
        {screen === 'onboarding-overview' && <MaisonBridge page="onboarding-overview"><OnboardingOverviewScreen go={go} /></MaisonBridge>}
        {screen === 'valuation' && <MaisonBridge page="valuation"><ValuationScreen go={go} /></MaisonBridge>}
        {screen === 'issuer-profile' && <MaisonIssuerProfileScreen key={routeParams.slug ?? ''} slug={routeParams.slug ?? null} />}
        {screen === 'issuers' && <MaisonIssuersScreen />}
        {screen === 'search' && <MaisonSearchScreen query={routeQuery} />}
        {screen === 'yield-calendar' && <MaisonYieldCalendarScreen query={routeQuery} />}
        {screen === 'rebalance' && <MaisonRebalanceScreen />}
        {screen === 'statements' && <MaisonStatementsScreen query={routeQuery} />}
        {screen === 'recurring' && <MaisonRecurringScreen />}
        {screen === 'my-predictions' && <MaisonMyPredictionsScreen />}
        {screen === 'order-review' && <MaisonOrderReviewScreen query={queryParam(routeQuery, 'product') || !isOrderableId(selectedProduct.id) ? routeQuery : `product=${selectedProduct.id}`} />}
        {screen === 'order-processing' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-success' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-partial' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-failed' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-receipt' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'deposit' && <MaisonDepositScreen query={routeQuery} />}
        {screen === 'withdraw' && <MaisonWithdrawScreen query={routeQuery} />}
        {screen === 'transfer' && <MaisonTransferScreen query={routeQuery} />}
        {screen === 'receive' && <MaisonReceiveScreen />}
        {screen === 'wallet-success' && <MaisonActivityScreen query={routeQuery} />}
        {screen === 'activity' && <MaisonActivityScreen query={routeQuery} />}
        {screen === 'asset-detail' && <AssetAccountScreen go={go} notify={notify} />}
        {screen === 'position-detail' && (routeParams.id ? <MaisonPositionDetailScreen key={routeParams.id} id={routeParams.id} /> : <PositionDetailScreen go={go} openOrder={openOrder} />)}
        {screen === 'ai-plan' && <AiPlanningScreen key={routeParams.id ?? 'goals'} id={routeParams.id} />}
        {screen === 'kyc' && (routePath === '/profile/verification' ? <MaisonVerificationCenterScreen /> : <MaisonKycScreen />)}
        {screen === 'eligibility' && <MaisonEligibilityScreen />}
        {screen === 'risk-profile' && <MaisonRiskProfileScreen query={routeQuery} />}
        {screen === 'security' && <MaisonSecurityScreen query={routeQuery} onSignedOut={setSignedOut} />}
        {screen === 'referral' && <MaisonReferralScreen query={routeQuery} />}
        {screen === 'records' && <MaisonDocumentsScreen />}
        {screen === 'support' && <MaisonSupportCenterScreen query={routeQuery} />}
        {screen === 'support-new' && <MaisonSupportNewScreen key={routeQuery} query={routeQuery} />}
        {screen === 'support-ticket' && <MaisonSupportTicketScreen key={routeParams.id ?? supportTicketId ?? 'none'} id={routeParams.id ?? supportTicketId} />}
        {screen === 'fees' && <MaisonFeesScreen />}
        {screen === 'address-book' && <MaisonAddressBookScreen />}
        {screen === 'status' && <MaisonBridge page="status"><StatusScreen go={go} /></MaisonBridge>}
        {screen === 'disclosures' && <MaisonBridge page="trust"><TrustCenterScreen kind="product-disclosures" go={go} notify={notify} /></MaisonBridge>}
        {screen === 'order-detail' && <MaisonOrderStatusScreen variant="detail" orderId={routeParams.id ?? queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'secondary' && <SecondaryTransferScreen />}
        {screen === 'trade' && (routePath === '/markets' ? <MaisonMarketsScreen query={routeQuery} /> : <MaisonTradeScreen symbol={routeParams.symbol ?? routeSymbol ?? null} />)}
        {screen === 'settings' && <MaisonSettingsScreen />}
        {screen === 'marketing' && <MaisonBridge page="marketing"><MarketingPreferencesScreen go={go} /></MaisonBridge>}
        {screen === 'official-channels' && <MaisonBridge page="official-channels"><OfficialChannelsScreen go={go} /></MaisonBridge>}
        {screen === 'scam-report' && <MaisonBridge page="scam-report"><ScamReportScreen go={go} isGuest={sessionMode === 'guest'} onCreated={openSupportTicket} /></MaisonBridge>}
        {screen === 'close-account' && <MaisonCloseAccountScreen />}
        {screen === 'trust-center' && <MaisonBridge page="trust">{routePath === '/trust/proof-of-reserves' ? <section className="screen trust-screen"><DetailHeader screen="trust-center" go={go} back="trust-center" title={trustPageCopy[locale].reservesTitle} /><PublishedReserves /></section> : <TrustCenterScreen kind="trust-center" go={go} notify={notify} />}</MaisonBridge>}
        {screen === 'access-regions' && <MaisonBridge page="trust"><TrustCenterScreen kind="access-regions" go={go} notify={notify} /></MaisonBridge>}
        {screen === 'product-disclosures' && <MaisonBridge page="trust"><TrustCenterScreen kind="product-disclosures" go={go} notify={notify} /></MaisonBridge>}
        {screen === 'legal-center' && <MaisonBridge page="trust"><TrustCenterScreen kind="legal-center" go={go} notify={notify} /></MaisonBridge>}
        </ScreenRouter>}
        </ScreenTransition>
        {showDock && <BottomDock screen={screen} activeScreen={dockActiveScreen} setScreen={go} showQuickActions={!isFloatingSheet && screen !== 'home' && screen !== 'invest'} />}
      </div>
      <ToastHost />
      </main>
    </>
  )
}

export default function RwaH5({ initialScreen = 'home', initialParams = {}, initialQuery = '', initialPath = '' }: { initialScreen?: Screen; initialParams?: Record<string, string>; initialQuery?: string; initialPath?: string }) {
  return <><EligibilityNotice /><RwaH5Content initialScreen={initialScreen} initialParams={initialParams} initialQuery={initialQuery} initialPath={initialPath} /></>
}
import { TokenUSDT } from '@web3icons/react'
import { RankingTable } from './invest/RankingTable'
