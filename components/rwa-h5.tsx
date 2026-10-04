'use client'
import AppLoading from '@/components/app-loading'
import { aiPageContext, type AiPageContext } from '@/lib/ai-page-context'
import { captureWalletBackdrop, WalletPageBackdrop } from './wallet-page-backdrop'
import { nextNavigationState, useNavigationViewport } from '@/lib/app-navigation'

import dynamic from 'next/dynamic'

import type { BasketKind } from './basket-screens'
const PublishedOfficialChannels = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedOfficialChannels })), { ssr: false })
const PublishedPlatform = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedPlatform })), { ssr: false })
const PublishedReserves = dynamic(() => import('./published-platform').then((m) => ({ default: m.PublishedReserves })), { ssr: false })
const PublishedProductDisclosures = dynamic(() => import('./published-product-disclosures').then((m) => ({ default: m.PublishedProductDisclosures })), { ssr: false })
const LearnScreen = dynamic(() => import('./maison/LearnScreen').then((m) => ({ default: m.LearnScreen })), { ssr: false, loading: AppLoading })
const AiPlanningScreen = dynamic(() => import('./maison/AiPlanningScreen').then((m) => ({ default: m.AiPlanningScreen })), { ssr: false, loading: AppLoading })
const NotificationPreferences = dynamic(() => import('./maison/NotificationPreferences').then((m) => ({ default: m.NotificationPreferences })), { ssr: false })
const PublicShareLanding = dynamic(() => import('./public-sharing').then((m) => ({ default: m.PublicShareLanding })), { ssr: false, loading: AppLoading })
import CountUp from '@/components/react-bits/count-up'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  AlertTriangle,
  Bell,
  ChartNoAxesColumnIncreasing,
  Bookmark,
  CalendarDays,
  ChartPie,
  CircleGauge,
  Check,
  ChevronRight,
  BadgePercent,
  Building2,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Copy,
  Cpu,
  CreditCard,
  FileText,
  Fingerprint,
  Globe2,
  House,
  Headphones,
  KeyRound,
  Landmark,
  Laptop,
  LogOut,
  MessageCircle,
  Moon,
  Network,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  UserRound,
  UserPlus,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { AssetSceneKind } from './asset-scenes'
const AssetScene = dynamic(() => import('./asset-scenes'), { ssr: false })
import LanguageMenu from './language-menu'
import RwaTopbar from './rwa-topbar'
import { useRwaTheme, type RwaThemePreference } from '@/lib/rwa-theme'
import { Segmented } from './ui/Segmented'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { accountCopy, detailCopy, interpolateCopy, orderCopy, screenCopy } from '@/lib/screen-copy'
import { operationText, operationsCopy } from '@/lib/operations-copy'
import { accountFlowCopy, accountFlowText, type AccountFlowKind } from '@/lib/account-flow-copy'
import { portfolioDetailCopy } from '@/lib/portfolio-detail-copy'
import { trustActionCopy, trustActionText } from '@/lib/trust-action-copy'
import { orderStatusCopy, orderStatusText } from '@/lib/order-status-copy'
import { assetExperienceCopy } from '@/lib/asset-experience-copy'
import { categoryLabel, localizeProduct } from '@/lib/catalog-localization'
const PolymarketDetailPanel = dynamic(() => import('./polymarket-detail-panel'), { ssr: false })
const AddressBookScreen = dynamic(() => import('./address-book-screen').then((m) => ({ default: m.AddressBookScreen })), { ssr: false, loading: AppLoading })
const StatusScreen = dynamic(() => import('./status-screen').then((m) => ({ default: m.StatusScreen })), { ssr: false, loading: AppLoading })
const DisclosuresScreen = dynamic(() => import('./disclosures-screen').then((m) => ({ default: m.DisclosuresScreen })), { ssr: false, loading: AppLoading })
const OrderDetailScreen = dynamic(() => import('./order-detail-screen').then((m) => ({ default: m.OrderDetailScreen })), { ssr: false, loading: AppLoading })
const KycStatusScreen = dynamic(() => import('./compliance-screens').then((m) => ({ default: m.KycStatusScreen })), { ssr: false, loading: AppLoading })
const EligibilityScreen = dynamic(() => import('./compliance-screens').then((m) => ({ default: m.EligibilityScreen })), { ssr: false, loading: AppLoading })
const RiskProfileScreen = dynamic(() => import('./compliance-screens').then((m) => ({ default: m.RiskProfileScreen })), { ssr: false, loading: AppLoading })
const RecordsScreen = dynamic(() => import('./records-screen').then((m) => ({ default: m.RecordsScreen })), { ssr: false, loading: AppLoading })
const SecondaryScreen = dynamic(() => import('./secondary-screen').then((m) => ({ default: m.SecondaryScreen })), { ssr: false, loading: AppLoading })
const TradeScreen = dynamic(() => import('./trade-screen').then((m) => ({ default: m.TradeScreen })), { ssr: false, loading: AppLoading })
const CommunityFeedScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityFeedScreen })), { ssr: false, loading: AppLoading })
const CommunityPostScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityPostScreen })), { ssr: false, loading: AppLoading })
const CommunityProfileScreen = dynamic(() => import('./community-screens').then((m) => ({ default: m.CommunityProfileScreen })), { ssr: false, loading: AppLoading })
import { pathForDynamicScreen, pathForScreen, screenForSegments, type RwaScreen } from '@/lib/rwa-routes'
import { resolveRoute } from '@/lib/routes-v2'
import { screenForV2Query, screenForV2Segments } from '@/lib/routes-v2-adapter'
import { PATH_EVENT, openPath, queryParam, type PathNavigation } from '@/lib/maison-nav'
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
import { formatMoneyNumber, formatUsdt, fromAtomic, toAtomic } from '@/lib/money'
import { directionClass, formatLedgerAmount, formatMoney, formatTime } from '@/lib/display/format'
import { assetCategoryLabel, ledgerDisplay, shortId } from '@/lib/display/labels'
import { getAssetHistory, type AssetHistoryPoint } from '@/lib/p0a-data'
import { createOrder } from '@/lib/orders-data'
import { fetchRwaProducts, rwaToProduct, type RwaAssetRow } from '@/lib/rwa-data'
import { getProducts, getFeaturedProducts, getProjectProfile, isAuthenticated, type DemoCategory, type DemoProduct } from '@/lib/h5-data'
import { demoProducts as fallbackProducts, featuredProducts as fallbackFeatured, projectProfiles } from '@/lib/demo-catalog'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { assetAccountRouteCopy, homeDataCopy, portfolioRouteCopy, profileRouteCopy, walletFlowRouteCopy, walletRouteCopy, securityRouteCopy } from '@/lib/route-copy'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
const ParticleLogoIcon = dynamic(() => import('./particle-logo-icon'), { ssr: false })
// Source: https://github.com/paper-design/shaders (Apache-2.0) — LiquidMetal circle orb
const LiquidMetal = dynamic(() => import('@paper-design/shaders-react').then(module => module.LiquidMetal), { ssr: false })
import { FlowProgress, LiquidSelection, Magnetic, ScreenTransition, SplitFlapText, TiltedSurface, captureSharedFlip, playSharedFlip, type RwaFlipState } from './motion-effects'
const AssetEvidencePanel = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.AssetEvidencePanel })), { ssr: false })
const OnboardingOverviewScreen = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.OnboardingOverviewScreen })), { ssr: false })
const ValuationScreen = dynamic(() => import('./p0a-screens').then((m) => ({ default: m.ValuationScreen })), { ssr: false })
import { logout } from '@/lib/api/auth'
import { request } from '@/lib/api/_http'
const EligibilityNotice = dynamic(() => import('./eligibility-notice').then((m) => ({ default: m.EligibilityNotice })), { ssr: false })
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { registerPasskey } from '@/lib/api/security'
import { BootScreen } from './screens/P01-Boot'
import { LoginScreen } from './screens/P02-Login'
import { AuthFlowScreen } from './screens/P03-AuthFlow'
import { HomeScreen } from './screens/P04-HomeMaison'
import { NotificationsScreen } from './screens/P28-Notifications'
import { ScreenRouter } from './ScreenRouter'
const BasketScreen = dynamic(() => import('./basket-screens').then((m) => ({ default: m.BasketScreen })), { ssr: false })
import { Button } from './ui/button'
import { EmptyState } from './ui/Empty'
import { Skeleton } from './ui/skeleton'
import { PriceArea, type PricePoint } from './charts/PriceArea'
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

const categories: InvestCategory[] = ['All', 'Compute', 'RWA', 'Stocks', 'Prediction']
const riskOrder: Record<string, number> = { 'Low Risk': 1, 'Medium Risk': 2, 'High Risk': 3 }
const PROFILE_SECTION_SCREENS = new Set<Screen>([
  'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket',
  'fees', 'settings', 'marketing', 'official-channels', 'scam-report', 'close-account', 'trust-center',
  'access-regions', 'product-disclosures', 'legal-center', 'status',
])

function minimumValue(product: DemoProduct) {
  return Number(product.minimum.replace(/[^\d.]/g, '')) || Number.POSITIVE_INFINITY
}

function isOpenProduct(product: DemoProduct) {
  return /open|daily|market open/i.test(product.availability)
}
const protectedScreens: Screen[] = ['portfolio', 'wallet', 'order-review', 'order-processing', 'order-success', 'order-partial', 'order-failed', 'order-receipt', 'order-detail', 'deposit', 'withdraw', 'transfer', 'receive', 'wallet-success', 'activity', 'asset-detail', 'position-detail', 'address-book', 'ai-plan', 'notifications', 'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket', 'settings', 'marketing', 'close-account', 'secondary', 'yield-calendar', 'rebalance', 'statements', 'recurring', 'basket-subscribe', 'basket-redeem']
const routeRequiresAuth = (pathname: string) => resolveRoute(pathname)?.def.auth === 'required'

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

function BottomDock({ screen, setScreen, activeScreen, showQuickActions = false }: { screen: Screen; setScreen: (screen: Screen) => void; activeScreen?: PrimaryScreen; showQuickActions?: boolean }) {
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
      <button type="button" className={`ai-orb ${screen === 'ai' ? 'is-active' : ''}`} aria-label={t('nav.ai')} title={t('nav.ai')} onClick={() => setScreen('ai')}>
        <LiquidMetal
          shape="circle"
          colorBack="#00000000"
          colorTint={theme === 'light' ? '#D8B89B' : '#B9D5DE'}
          repetition={2.4}
          shiftRed={0.28}
          shiftBlue={0.28}
          contour={0.45}
          softness={0.65}
          distortion={0.9}
          angle={60}
          speed={0.65}
          className="ai-orb__orb"
        />
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

function InvestScreen({ go, notify, openProduct, openPrediction, products, initialCategory = 'All' }: { go: (screen: Screen) => void; notify: (message: string) => void; openProduct: (product: DemoProduct) => void; openPrediction: (market: PredictionMarket) => void; products: DemoProduct[]; initialCategory?: InvestCategory }) {
  const { locale, t } = useI18n()
  const copy = screenCopy[locale].invest
  const [category, setCategory] = useState<InvestCategory>(initialCategory)
  useEffect(() => { setCategory(initialCategory) }, [initialCategory])
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
  }, [availabilityFilter, category, locale, minimumFilter, products, query, riskFilter, sortMode])
  const categoryLabels: Record<InvestCategory, string> = { All: copy.all, Compute: copy.compute, RWA: copy.rwa, Stocks: copy.stocks, Prediction: copy.prediction }
  const referenceLabels = {
    en: { assets: 'Assets', baskets: 'Baskets', predictions: 'Predictions', trade: 'Trade', subtitle: 'Explore real-world opportunities', search: 'Search', issuers: 'Issuers' },
    'zh-CN': { assets: '资产', baskets: '篮子', predictions: '预测', trade: '交易', subtitle: '探索真实世界机会', search: '搜索', issuers: '发行方' },
    hi: { assets: 'परिसंपत्तियाँ', baskets: 'बास्केट', predictions: 'पूर्वानुमान', trade: 'ट्रेड', subtitle: 'वास्तविक अवसर खोजें', search: 'खोज', issuers: 'जारीकर्ता' },
    es: { assets: 'Activos', baskets: 'Cestas', predictions: 'Predicciones', trade: 'Operar', subtitle: 'Explora oportunidades reales', search: 'Buscar', issuers: 'Emisores' },
    ar: { assets: 'الأصول', baskets: 'السلال', predictions: 'التوقعات', trade: 'تداول', subtitle: 'استكشف فرصاً حقيقية', search: 'بحث', issuers: 'المُصدرون' },
    fr: { assets: 'Actifs', baskets: 'Paniers', predictions: 'Prévisions', trade: 'Trader', subtitle: 'Explorez les opportunités réelles', search: 'Recherche', issuers: 'Émetteurs' },
    pt: { assets: 'Ativos', baskets: 'Cestas', predictions: 'Previsões', trade: 'Negociar', subtitle: 'Explore oportunidades reais', search: 'Buscar', issuers: 'Emissores' },
  }[locale]
  return (
    <section className="screen invest-screen">
      <RwaTopbar screen="invest" />
      <div className="invest-reference-intro" />
      <div className="invest-nav-cards invest-reference-grid"><button type="button" className="invest-nav-card is-active" onClick={() => { setCategory('All'); setQuery('') }}><span className="invest-nav-card__icon"><Building2 size={28} /></span><b>{referenceLabels.assets}</b><ChevronRight size={17} /></button><button type="button" className="invest-nav-card" onClick={() => go('basket-list')}><span className="invest-nav-card__icon invest-nav-card__icon--basket"><ChartPie size={28} /></span><b>{referenceLabels.baskets}</b><ChevronRight size={17} /></button><button type="button" className="invest-nav-card" onClick={() => setCategory('Prediction')}><span className="invest-nav-card__icon invest-nav-card__icon--prediction"><CircleGauge size={28} /></span><b>{referenceLabels.predictions}</b><ChevronRight size={17} /></button><button type="button" className="invest-nav-card" onClick={() => go('trade')}><span className="invest-nav-card__icon invest-nav-card__icon--trade"><TrendingUp size={28} /></span><b>{referenceLabels.trade}</b><ChevronRight size={17} /></button></div>
      <div className="invest-tool-row"><button type="button" onClick={() => go('search')}><Search size={16} />{referenceLabels.search}</button><button type="button" onClick={() => go('issuers')}><Building2 size={16} />{referenceLabels.issuers}</button></div>
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
          <button type="button" className={sortMode !== 'featured' ? 'is-active' : ''} aria-expanded={openControl === 'sort'} onClick={() => toggleControl('sort')}><span>{sortMode === 'featured' ? t('invest.featured') : sortMode === 'yield' ? t('invest.yieldHigh') : sortMode === 'minimum' ? t('invest.minimumLow') : sortMode === 'risk' ? t('invest.riskLow') : (locale === 'zh-CN' ? '表格视图' : 'Table view')}</span><ChevronRight size={16} /></button>
          {openControl === 'sort' && <div className="catalog-popover catalog-popover--sort glass"><div className="catalog-popover__head"><span><b>{t('invest.sortTitle')}</b><small>{t('invest.sortBody')}</small></span></div><div className="catalog-sort-list">{([['featured', t('invest.featured'), t('invest.featuredBody')], ['yield', t('invest.yieldHigh'), t('invest.yieldBody')], ['minimum', t('invest.minimumLow'), t('invest.minimumBody')], ['risk', t('invest.riskLow'), t('invest.riskBody')], ['table', locale === 'zh-CN' ? '表格视图' : 'Table view', locale === 'zh-CN' ? 'TradingView 风格排序列表' : 'TradingView-style sortable list']] as const).map(([value, label, description]) => <button className={sortMode === value ? 'is-selected' : ''} type="button" key={value} onClick={() => { setSortMode(value); setOpenControl(null) }}><span><b>{label}</b><small>{description}</small></span><i>{sortMode === value && <Check size={14} />}</i></button>)}</div></div>}
        </div>
      </div>

      <div className="segmented" role="tablist" aria-label={copy.categoriesAria}>
        {categories.map((item) => <button key={item} role="tab" type="button" className={category === item ? 'is-active' : ''} aria-selected={category === item} onClick={() => setCategory(item)}><LiquidSelection id="rwa-category-selection" active={category === item} /><span>{categoryLabels[item]}</span></button>)}
      </div>

      {(category === 'All' || category === 'Compute') && products.some((product) => product.category === 'Compute') && (
        <Magnetic className="compute-feature-magnetic">
          <button className="compute-feature glass" type="button" onClick={() => { const first = products.find((product) => product.category === 'Compute'); if (first) openProduct(first) }}>
            <div className="compute-feature__copy">
              <h2>{copy.computeTitle}</h2>
              <p>{products.find((product) => product.category === 'Compute')?.subtitle}</p>
            </div>
            <AssetScene kind="compute" />
          </button>
        </Magnetic>
      )}

      {sortMode === 'table' ? (
        <RankingTable onOpen={(slug) => { const match = products.find((p) => (p as { slug?: string }).slug === slug); void match; go('rwa-detail') }} />
      ) : (
      <div className="product-stack">
        {filtered.map((product) => { const display = localizeProduct(product, locale); return (
          <TiltedSurface key={product.id} className="product-card-motion" maxTilt={4}>
            <button type="button" className="product-card glass" data-flip-id={product.id} onClick={() => openProduct(display)}>
              {product.logoUrl
                ? <span className="catalog-product-media"><img src={product.logoUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
                : <span className={`catalog-product-media project-visual project-visual--${product.id}`} aria-hidden="true" />}
              <span className="product-card__copy"><small className="catalog-eyebrow">{categoryLabel(product.category, locale)} · {display.availability}</small><b>{display.title}</b><small>{display.subtitle}</small><small className={`risk risk--${product.risk.split(' ')[0].toLowerCase()}`}>{product.returnMetric} {display.returnLabel}</small></span>
              <ChevronRight size={24} strokeWidth={1.35} />
            </button>
          </TiltedSurface>
        )})}
      </div>
      )}
      {sortMode !== 'table' && !filtered.length && <EmptyState variant="card" icon={Search} title={t('invest.noResults')} body={copy.noResultsBody} action={<button type="button" className="p0a-secondary-button" onClick={() => { setQuery(''); resetFilters() }}>{copy.resetCatalogue}</button>} />}
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

function compactValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}

function PredictionMarketPanel({ openMarket, notify }: { openMarket: (market: PredictionMarket) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const copy = screenCopy[locale].prediction
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [source, setSource] = useState<'loading' | 'live' | 'unavailable'>('loading')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const refreshMarkets = async () => {
    setSource('loading')
    const result = await request<unknown>('/v1/polymarket/markets?state=active&limit=4')
    if (!result.ok) { setMarkets([]); setSource('unavailable'); notify(locale === 'zh-CN' ? '市场数据暂时不可用。' : 'Market data is temporarily unavailable.'); return }
    const data = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {}
    const items = Array.isArray(result.data) ? result.data : Array.isArray(data.items) ? data.items : Array.isArray(data.markets) ? data.markets : []
    setMarkets(items.map((item: unknown) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return { id: String(row.id ?? ''), slug: String(row.slug ?? row.id ?? ''), question: String(row.question ?? ''), outcomes: Array.isArray(row.outcomes) ? row.outcomes.map(String) : [], prices: Array.isArray(row.prices) ? row.prices.map(Number) : [], volume: Number(row.volume ?? 0), volume24h: Number(row.volume24h ?? 0), liquidity: Number(row.liquidity ?? 0), endDate: typeof row.endDate === 'string' ? row.endDate : null, category: String(row.category ?? ''), acceptingOrders: row.acceptingOrders === true }
    }).filter((item: PredictionMarket) => item.id && item.question))
    setSource('live')
    setUpdatedAt(new Date().toISOString())
  }
  useEffect(() => { void refreshMarkets() }, [])
  return (
    <section className="prediction-desk" aria-label={copy.aria}>
      <div className="section-title"><h2>{copy.desk}</h2><button type="button" onClick={() => void refreshMarkets()}>{source === 'loading' ? copy.refreshing : t('common.refresh')}</button></div>
      <div className="prediction-source glass"><span><i className={source === 'live' ? 'is-live' : ''} />{source === 'live' ? copy.live : source === 'loading' ? copy.loading : copy.unavailable}</span><small>{updatedAt ? interpolateCopy(copy.updated, { time: new Date(updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : copy.discoveryApi}</small></div>
      <div className="prediction-market-list">
        {markets.slice(0, 4).map((market) => {
          const yesIndex = Math.max(0, market.outcomes.findIndex((outcome) => outcome.toLowerCase() === 'yes'))
          const yesLabel = market.outcomes[yesIndex]?.toLowerCase() === 'yes' ? copy.yes : market.outcomes[yesIndex] ?? market.outcomes[0] ?? copy.yes
          const yesPrice = market.prices[yesIndex] ?? market.prices[0]
          return <button className="prediction-market-card glass" type="button" key={market.id} onClick={() => openMarket(market)}>
            <span className="prediction-market-card__meta"><small>{market.category}</small><small>{market.endDate ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(market.endDate)) : copy.openMarket}</small></span>
            <b>{market.question}</b>
            <div><span>{yesLabel} <strong>{Number.isFinite(yesPrice) ? `${Math.round(yesPrice * 100)}¢` : '—'}</strong></span><span>24h {compactValue(market.volume24h)}</span><ChevronRight size={18} /></div>
          </button>
        })}
      </div>
      {source === 'live' && markets.length === 0 && <EmptyState variant="card" icon={TrendingUp} title={locale === 'zh-CN' ? '暂无开放的预测市场' : 'No active prediction markets'} body={locale === 'zh-CN' ? '有开放市场后，预测项目会显示在这里。' : 'Prediction markets will appear here when they are available.'} />}
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

function WalletAction({ icon: Icon, label, disabled, onClick }: { icon: typeof ArrowDownToLine; label: string; disabled?: boolean; onClick: () => void }) {
  return <Magnetic className="wallet-action-magnetic" disabled={disabled}><button type="button" className="wallet-action glass" disabled={disabled} onClick={onClick}><span><Icon size={24} strokeWidth={1.45} /></span><b>{label}</b></button></Magnetic>
}

function isSessionError(error: unknown): boolean {
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : ''
  return status === 401 || /(?:status code\s*401|unauthori[sz]ed|session.*(?:expired|invalid|required)|登录状态.*(?:失效|过期|需要))/i.test(message)
}

function WalletScreen({ go, notify, openWalletFlow }: { go: (screen: Screen) => void; notify: (message: string) => void; openWalletFlow: (mode: 'deposit' | 'withdraw' | 'transfer') => void }) {
  const { locale, t } = useI18n()
  const copy = accountCopy[locale]
  const walletCopy = walletRouteCopy[locale]
  const [wallet, setWallet] = useState<WalletView | null>(null)
  const [activity, setActivity] = useState<LedgerTransaction[]>([])
  const [walletState, setWalletState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [walletError, setWalletError] = useState<string | null>(null)
  const loadWallet = useCallback(async () => {
    setWalletState('loading')
    setWalletError(null)
    const [walletResult, activityResult] = await Promise.allSettled([getWallet(), getLedgerTransactions(5)])
    if (walletResult.status === 'fulfilled') {
      setWallet(walletResult.value)
      setWalletState('ready')
    } else {
      setWallet(null)
      setWalletState('error')
      setWalletError(isSessionError(walletResult.reason) ? walletCopy.sessionExpired : walletCopy.balanceUnavailable)
    }
    if (activityResult.status === 'fulfilled') setActivity(activityResult.value)
    else setActivity([])
  }, [])
  useEffect(() => {
    void loadWallet()
  }, [loadWallet])
  const decimals = wallet?.asset.decimals ?? 6
  const available = walletUnits(wallet?.balances.availableAtomic, decimals)
  const invested = walletUnits(wallet?.balances.investedAtomic, decimals)
  const fmt = (n: number) => formatMoneyNumber(n, locale)
  const displayAmount = (value: number) => walletState === 'loading' ? '…' : wallet ? fmt(value) : '—'
  const displayInvested = walletState === 'loading' ? '…' : wallet && invested > 0 ? `${fmt(invested)} ${walletCopy.invested}` : '—'
  return (
    <section className="screen wallet-screen">
      <RwaTopbar screen="wallet" title={t('wallet.title')} onProfile={() => go('profile')} />
      <div className="wallet-hero">
        <div className="wallet-copy"><p>{copy.availableBalance}</p><h1 className="money-hero"><SplitFlapText value={displayAmount(available)} /> <span>{wallet?.asset.code ?? 'USDT'}</span></h1><small>{wallet && invested > 0 ? `${fmt(invested)} ${walletCopy.invested}` : walletState === 'loading' ? walletCopy.loading : '≈ —'}</small></div>
        <AssetScene kind="wallet" />
      </div>
      {walletError ? <div className="wallet-data-state" role="alert"><span>{walletError}</span><div><button type="button" onClick={() => void loadWallet()}>{walletCopy.retry}</button>{isSessionError(walletError) ? <button type="button" onClick={() => go('login')}>{walletCopy.signInAgain}</button> : null}</div></div> : null}
      <div className="wallet-action-grid">
        <WalletAction icon={ArrowDownToLine} label={t('wallet.deposit')} onClick={() => openWalletFlow('deposit')} />
        <WalletAction icon={ArrowUpFromLine} label={t('wallet.withdraw')} onClick={() => openWalletFlow('withdraw')} />
        <WalletAction icon={ArrowRightLeft} label={t('wallet.transfer')} onClick={() => openWalletFlow('transfer')} />
        <WalletAction icon={CreditCard} label={t('wallet.fiat')} disabled onClick={() => undefined} />
      </div>
      <div className="wallet-network-row"><Network size={16} />{copy.networks} <span>TRON · Ethereum · Arbitrum</span></div>
      <div className="section-title"><h2>{t('wallet.assets')}</h2></div>
      <div className="wallet-assets glass">
        <button type="button" onClick={() => go('asset-detail')}><span className="token token--usdt"><TokenUSDT size={22} variant="branded" /></span><span><b>{wallet?.asset.code ?? 'USDT'}</b><small>{copy.availableBalance}</small></span><strong>{displayAmount(available)}<small>{displayInvested}</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('portfolio')}><span className="token"><Cpu size={20} /></span><span><b>{copy.computePositions}</b><small>{copy.activeUnits}</small></span><strong>{displayAmount(invested)}<small>{copy.usdtValue}</small></strong><ChevronRight size={19} /></button>
      </div>
      <div className="section-title"><h2>{t('wallet.activity')}</h2><button type="button" onClick={() => go('activity')}>{t('common.viewAll')}</button></div>
      <div className="activity-list glass">
        {activity.length === 0 && <div><span><ReceiptText size={19} /></span><p><b>{walletCopy.noActivity}</b><small>{walletCopy.noActivityBody}</small></p><strong /></div>}
        {activity.map((tx) => {
          const display = ledgerDisplay(tx.transactionType, locale)
          const Icon = display.icon
          const entry = tx.entries[0]
          const amount = walletUnits(entry?.atomicAmount, entry?.assetDecimals ?? decimals)
          const reference = tx.referenceType ? ledgerDisplay(tx.referenceType, locale).label : shortId(tx.referenceId ?? tx.id)
          return (
            <div key={tx.id}><span className={directionClass(display.direction)}><Icon size={19} /></span><p><b>{display.label}</b><small>{reference}</small></p><strong className={directionClass(display.direction)}>{formatLedgerAmount(amount, tx.transactionType, locale)} {entry?.assetCode ?? 'USDT'}<small>{formatTime(tx.effectiveAt, locale)}</small></strong></div>
          )
        })}
      </div>
    </section>
  )
}

function AiScreen({ go, onClose, pageContext }: { go: (screen: Screen) => void; notify: (message: string) => void; onClose: () => void; pageContext?: AiPageContext }) {
  return <AiChatScreen onClose={onClose} onPlan={() => go('ai-plan')} pageContext={pageContext} />
}

function ProfileScreen({ go, notify, sessionMode, onClose, onOpenSection, onSignedOut }: { go: (screen: Screen) => void; notify: (message: string) => void; sessionMode: 'guest' | 'authenticated'; onClose: () => void; onOpenSection: (screen: Screen) => void; onSignedOut: () => void }) {
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
    [profileRouteCopy[locale].feesTitle, profileRouteCopy[locale].feesSubtitle, BadgePercent, 'fees'],
    [t('profile.settings'), copy.languageNotifications, Settings, 'settings'],
  ] as const
  return (
    <section className="profile-sheet">
      <RwaTopbar screen="profile" title={t('profile.title')} onBack={onClose} />
      <div className="profile-head"><div className="profile-orb profile-orb--large"><ParticleLogoIcon className="profile-orb__particle-logo" label="RWA AI" /></div><h1>{sessionMode === 'guest' ? t('guest.badge') : '0x82...92A'}</h1><p><ShieldCheck size={15} /> {sessionMode === 'guest' ? copy.publicSession : t('profile.verified')}</p></div>
      <div className="profile-menu glass">{rows.map(([title, subtitle, Icon, screen]) => <button type="button" key={title} onClick={() => onOpenSection(screen)}><span><Icon size={21} /></span><p><b>{title}</b><small>{subtitle}</small></p><ChevronRight size={19} /></button>)}</div>
      <button className="sign-out-button" type="button" onClick={() => void (async () => { await logout(); window.sessionStorage.removeItem('rwa-selected-product'); window.sessionStorage.removeItem('rwa-wallet-flow-mode'); onSignedOut(); notify(copy.signedOut); go('login') })()}><LogOut size={19} />{t('profile.signout')}</button>
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
  const [wallet, setWallet] = useState<WalletView | null>(null)
  useEffect(() => { getWallet().then(setWallet).catch(() => setWallet(null)) }, [])
  const available = wallet ? walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals) : null
  const canRequest = acknowledged && confirmation.trim().toUpperCase() === 'CLOSE'
  const reasonLabels: Record<string, string> = { privacy: copy.privacyReason, fees: copy.feesReason, support: copy.supportReason, other: copy.otherReason }
  return <section className="screen close-account-screen has-fixed-cta"><DetailHeader screen="close-account" go={go} back="profile" title={copy.closeTitle} kind="flow" /><div className="close-account-hero"><span><AlertTriangle size={27} /></span><p>{copy.lifecycle}</p><h1>{copy.closeHeading}</h1><small>{copy.closeBody}</small></div><div className="close-account-balance glass"><span><small>{copy.walletBalance}</small><b>{available === null ? '—' : `${formatUsdt(available, locale)}`}</b></span><span><small>{copy.openPositions}</small><b>{copy.activeAllocations}</b></span><small>{copy.holdingsBlock}</small></div><label className="close-account-reason">{copy.leaving}<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">{copy.selectReason}</option><option value="privacy">{copy.privacyReason}</option><option value="fees">{copy.feesReason}</option><option value="support">{copy.supportReason}</option><option value="other">{copy.otherReason}</option></select></label><label className="close-account-confirm">{copy.typeClose}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="CLOSE" autoCapitalize="characters" /></label><button className={`whitelist-check close-account-check ${acknowledged ? 'is-checked' : ''}`} type="button" onClick={() => setAcknowledged((value) => !value)}><span>{acknowledged && <Check size={14} />}</span><p><b>{copy.closureAck}</b><small>{copy.closureIrreversible}</small></p></button><button className="flow-cta close-account-cta" disabled={!canRequest} type="button" onClick={() => { notify(trustActionText(copy.closureRecorded, { reason: reason ? `: ${reasonLabels[reason]}` : '' })); go('profile') }}>{copy.recordRequest} <ArrowRight size={20} /></button></section>
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
      {amountError && <div className="order-inline-error" role="alert"><AlertTriangle size={16} />{amountError}</div>}
      {submitError && <div className="order-inline-error" role="alert"><AlertTriangle size={16} />{submitError}</div>}
      <button className={`risk-ack glass ${riskConfirmed ? 'is-confirmed' : ''}`} type="button" onClick={() => setRiskConfirmed((current) => !current)}><ShieldCheck size={21} /><p><b>{copy.confirmation}</b><small>{copy.confirmationBody}</small></p><span>{riskConfirmed && <Check size={15} />}</span></button>
      {!riskConfirmed && <div className="order-inline-error order-inline-error--quiet"><AlertTriangle size={16} />{copy.confirmFirst}</div>}
      <button className="flow-cta" type="button" disabled={!canSubmit} onClick={submit}>{isSubmitting ? copy.recording : quoteExpired ? copy.refreshToContinue : asset === 'prediction' ? copy.recordRequest : copy.recordAllocation}<LockKeyholeIcon /></button>
    </section>
  )
}

function LockKeyholeIcon() { return <KeyRound size={21} /> }

function OrderSuccessScreen({ asset, product, go, orderId }: { asset: OrderAsset; product: DemoProduct; go: (screen: Screen) => void; orderId: string | null }) {
  const { locale } = useI18n()
  const copy = orderCopy[locale]
  return (
    <section className="screen success-screen has-fixed-cta">
      <DetailHeader screen="order-success" go={go} back="order-review" title={copy.successEyebrow} kind="flow" />
      <FlowProgress current={3} total={3} label={copy.successEyebrow} />
      <div className="success-orb"><CircleCheck size={38} /></div>
      <p>{copy.successEyebrow}</p><h1>{copy.noExternal}</h1><span>{interpolateCopy(asset === 'prediction' ? copy.predictionSuccess : copy.allocationSuccess, { name: product.title })}</span>
      <div className="success-receipt glass"><span><small>{copy.orderReference}</small><b>{orderId ? shortId(orderId).toUpperCase() : '—'}</b></span><span><small>{copy.executionState}</small><b>{copy.demoOnly}</b></span><span><small>{copy.nextGate}</small><b>{asset === 'prediction' ? copy.partnerIntegration : copy.eligibilitySettlement}</b></span></div>
      <button className="flow-cta" type="button" onClick={() => orderId ? go('order-detail') : go('order-receipt')}>{copy.viewReceipt} <ArrowRight size={20} /></button>
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
    partial: { ...copy.partial, body: orderStatusText(copy.partial.body, { filled: formatMoney(filled, locale) }), icon: ChartPie, tone: 'amber' },
    failed: { ...copy.failed, icon: AlertTriangle, tone: 'negative' },
    receipt: { ...copy.receipt, icon: ReceiptText, tone: 'mint' },
  }[kind]
  const Icon = config.icon
  const primary = kind === 'processing' ? { label: copy.continueFlow, next: 'order-success' as Screen } : kind === 'failed' ? { label: copy.returnReview, next: 'order-review' as Screen } : { label: copy.viewPortfolio, next: 'portfolio' as Screen }
  const descriptor = isPrediction ? copy.predictionDescriptor : orderStatusText(copy.allocationDescriptor, { category: categoryLabel(product.category, locale) })
  return <section className={`screen order-status-screen order-status-screen--${config.tone} has-fixed-cta`}><DetailHeader screen={kind === 'processing' ? 'order-processing' : kind === 'partial' ? 'order-partial' : kind === 'failed' ? 'order-failed' : 'order-receipt'} go={go} back={kind === 'receipt' ? 'order-success' : 'order-review'} title={kind === 'receipt' ? copy.orderReceipt : copy.orderStatus} kind="flow" /><FlowProgress current={kind === 'processing' ? 2 : kind === 'receipt' ? 3 : 2} total={3} label={copy.orderStatus} /><div className="order-status-hero"><span><Icon size={31} /></span><p>{config.eyebrow}</p><h1>{config.title}</h1><small>{config.body}</small></div><div className="order-status-product glass"><span>{asset === 'compute' ? <Cpu size={22} /> : asset === 'rwa' ? <Landmark size={22} /> : asset === 'stocks' ? <TrendingUp size={22} /> : <Sparkles size={22} />}</span><p><b>{product.title}</b><small>{descriptor}</small></p><strong>{formatMoney(amount, locale)}<small>USDT</small></strong></div>{kind === 'processing' && <div className="order-state-timeline glass"><span className="is-complete"><i><Check size={13} /></i><p><b>{copy.requestValidated}</b><small>{copy.requestValidatedBody}</small></p><em>{copy.done}</em></span><span className="is-active"><i><Clock3 size={13} /></i><p><b>{copy.eligibilityQuote}</b><small>{copy.eligibilityQuoteBody}</small></p><em>{copy.checking}</em></span><span><i><ShieldCheck size={13} /></i><p><b>{copy.externalExecution}</b><small>{copy.externalExecutionBody}</small></p><em>{copy.locked}</em></span></div>}{kind === 'partial' && <div className="partial-fill-card glass"><div><span style={{ width: '60%' }} /></div><p><span><small>{copy.filled}</small><b>{formatMoney(filled, locale)} USDT</b></span><span><small>{copy.released}</small><b>{formatMoney(amount - filled, locale)} USDT</b></span></p><small>{copy.noMovement}</small></div>}{kind === 'failed' && <div className="failure-reasons glass"><p><AlertTriangle size={18} /><span><b>{copy.possibleReason}</b><small>{copy.reasonBody}</small></span></p><p><ShieldCheck size={18} /><span><b>{copy.fundsProtected}</b><small>{copy.fundsProtectedBody}</small></span></p></div>}{kind === 'receipt' && <><div className="receipt-breakdown glass"><span><small>{copy.demoReference}</small><b>{copy.notCreated}</b></span><span><small>{copy.requestedAllocation}</small><b>{formatMoney(amount, locale)} USDT</b></span><span><small>{copy.displayedFee}</small><b>{formatMoney(fee, locale)} USDT</b></span><span><small>{copy.venueId}</small><b>{copy.notCreated}</b></span><span><small>{copy.ledgerEntry}</small><b>{copy.notCreated}</b></span><span><small>{copy.executionStatus}</small><b>{copy.demoOnly}</b></span></div><div className="receipt-actions"><button type="button" onClick={() => go('order-partial')}>{copy.previewPartial}</button><button type="button" onClick={() => go('support')}>{copy.openSupport}</button></div></>}<button className="flow-cta" type="button" onClick={() => go(primary.next)}>{primary.label}<ArrowRight size={20} /></button>{kind === 'processing' && <button className="quiet-action" type="button" onClick={() => go('order-failed')}>{copy.previewFailed}</button>}</section>
}

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

const walletNetworkKey: Record<string, 'tron' | 'ethereum' | 'arbitrum'> = {
  TRON: 'tron',
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
}

function parseAtomicInteger(value: string | null | undefined): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  return BigInt(value)
}

function WalletFlowScreen({ mode, go, notify, completeFlow }: { mode: 'deposit' | 'withdraw' | 'transfer'; go: (screen: Screen) => void; notify: (message: string) => void; completeFlow: (mode: 'deposit' | 'withdraw' | 'transfer') => void }) {
  const { locale } = useI18n()
  const text = operationsCopy[locale]
  const flowCopy = walletFlowRouteCopy[locale]
  const [network, setNetwork] = useState('TRON')
  const [recipient, setRecipient] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [whitelistConfirmed, setWhitelistConfirmed] = useState(false)
  const [wallet, setWallet] = useState<WalletView | null>(null)
  const [balanceState, setBalanceState] = useState<'loading' | 'ready' | 'error'>(mode === 'deposit' ? 'ready' : 'loading')
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [depositAddress, setDepositAddress] = useState<DepositAddressView | null>(null)
  const [depositState, setDepositState] = useState<'loading' | 'ready' | 'error'>(mode === 'deposit' ? 'loading' : 'ready')
  const [quote, setQuote] = useState<{ key: string; value: WithdrawalQuoteView } | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idempotencyKeys = useRef(new Map<string, string>())
  const networkKey = walletNetworkKey[network] ?? 'tron'
  const decimals = wallet?.asset.decimals ?? 6
  const atomicAmount = toAtomic(amountInput, decimals)
  const quoteKey = `${networkKey}:${atomicAmount ?? ''}`
  const currentQuote = quote?.key === quoteKey ? quote.value : null

  useEffect(() => {
    if (mode !== 'deposit') return
    let cancelled = false
    setDepositState('loading')
    setDepositAddress(null)
    void request<DepositAddressView>(`/v1/wallet/deposit-addresses/${networkKey}`, { method: 'POST', body: '{}' }).then((result) => {
      if (cancelled) return
      if (!result.ok) { setDepositState('error'); setOperationError(result.error.message); return }
      setDepositAddress(result.data)
      setDepositState('ready')
    })
    return () => { cancelled = true }
  }, [mode, networkKey])

  useEffect(() => {
    if (mode !== 'withdraw') return
    if (!atomicAmount || BigInt(atomicAmount) <= BigInt(0)) {
      setQuote(null)
      setQuoteError(null)
      return
    }
    const requestKey = `${networkKey}:${atomicAmount}`
    let cancelled = false
    setQuoteError(null)
    const timer = window.setTimeout(() => {
      void request<WithdrawalQuoteView>('/v1/wallet/withdrawals/quote', { method: 'POST', body: JSON.stringify({ network: networkKey, atomicAmount }) }).then((result) => {
        if (cancelled) return
        if (!result.ok) { setQuoteError(result.error.message); return }
        setQuote({ key: requestKey, value: result.data })
      })
    }, 260)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [atomicAmount, mode, networkKey])

  useEffect(() => {
    if (mode === 'deposit') return
    let cancelled = false
    setBalanceState('loading')
    setBalanceError(null)
    getWallet().then((next) => {
      if (cancelled) return
      setWallet(next)
      setBalanceState('ready')
    }).catch((error: unknown) => {
      if (cancelled) return
      setWallet(null)
      setBalanceState('error')
      setBalanceError(isSessionError(error) ? flowCopy.sessionExpired : flowCopy.balanceUnavailable)
    })
    return () => { cancelled = true }
  }, [mode])
  const available = wallet ? walletUnits(wallet.balances.availableAtomic, decimals) : 0
  const feeByNetwork: Record<string, string> = { TRON: '0.8', Ethereum: '8.5', Arbitrum: '1.6' }
  const feeAtomic = mode === 'withdraw' ? currentQuote?.feeAtomicAmount ?? toAtomic(feeByNetwork[network] ?? '0', decimals) : '0'
  const amountValue = parseAtomicInteger(atomicAmount)
  const feeValue = parseAtomicInteger(feeAtomic)
  const availableValue = parseAtomicInteger(wallet?.balances.availableAtomic)
  const quoteTotalDebit = currentQuote?.totalDebitAtomic
  const totalDebitValue = mode === 'withdraw' && quoteTotalDebit != null
    ? parseAtomicInteger(quoteTotalDebit)
    : amountValue !== null && feeValue !== null ? amountValue + feeValue : null
  const balanceExceeded = availableValue !== null && totalDebitValue !== null && totalDebitValue > availableValue
  const balanceCovered = availableValue !== null && totalDebitValue !== null && totalDebitValue <= availableValue
  const feeValueForDisplay = feeAtomic !== null && feeValue !== null ? Number(fromAtomic(feeAtomic, decimals)) : null
  const feeLabel = feeValueForDisplay !== null && Number.isFinite(feeValueForDisplay) ? feeValueForDisplay.toFixed(2) : '—'
  const netAtomic = amountValue !== null && feeValue !== null
    ? (amountValue > feeValue ? amountValue - feeValue : BigInt(0)).toString()
    : null
  const netValueForDisplay = netAtomic === null ? null : Number(fromAtomic(netAtomic, decimals))
  const isWalletAddress = network === 'TRON' ? /^T[A-Za-z0-9]{24,40}$/.test(recipient.trim()) : /^0x[a-fA-F0-9]{40}$/.test(recipient.trim())
  const recipientIsValid = mode === 'withdraw' ? isWalletAddress : mode === 'transfer' ? /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipient.trim()) : true
  const amountIsValid = balanceState === 'ready' && amountValue !== null && amountValue > BigInt(0) && balanceCovered && (mode !== 'withdraw' || currentQuote?.sufficientBalance === true)
  const canContinue = mode === 'deposit' ? depositState === 'ready' && Boolean(depositAddress?.address) : recipientIsValid && amountIsValid && (mode !== 'withdraw' || whitelistConfirmed)
  const validationMessage = !recipient
     ? mode === 'withdraw' ? operationText(locale, 'validDestination', { network }) : mode === 'transfer' ? flowCopy.recipientPlaceholder : ''
    : !recipientIsValid
       ? mode === 'withdraw' ? operationText(locale, 'invalidAddress', { network }) : flowCopy.recipientPlaceholder
      : balanceState === 'loading'
         ? flowCopy.loadingBalance
        : balanceState === 'error'
           ? (balanceError ?? flowCopy.balanceUnavailable)
          : mode === 'withdraw' && quoteError
            ? quoteError
           : mode === 'withdraw' && !currentQuote
                ? flowCopy.calculatingFee
               : mode === 'withdraw' && currentQuote?.sufficientBalance === false
                  ? flowCopy.insufficientBalance
           : !amountInput || !amountIsValid
         ? balanceExceeded ? operationText(locale, 'balanceExceeded', { fee: feeLabel }) : text.positiveAmount
        : mode === 'withdraw' && !whitelistConfirmed ? text.confirmWhitelist : ''
  const copy = mode === 'deposit'
    ? { title: text.depositTitle, subtitle: text.depositSubtitle, action: text.depositAction }
    : mode === 'withdraw'
      ? { title: text.withdrawTitle, subtitle: text.withdrawSubtitle, action: text.withdrawAction }
      : { title: text.transferTitle, subtitle: text.transferSubtitle, action: text.transferAction }
  return (
    <section className="screen wallet-flow-screen has-fixed-cta">
      <DetailHeader screen={mode} go={go} back="wallet" title={copy.title} kind="flow" />
      <FlowProgress current={1} total={3} label={copy.title} />
      <div className="network-selector">{[['TRON', text.lowCost], ['Ethereum', 'ERC-20'], ['Arbitrum', text.fastSettlement]].map(([name, note]) => <button key={name} className={network === name ? 'is-selected' : ''} type="button" onClick={() => setNetwork(name)}>{name === 'TRON' ? <NetworkTron size={22} variant="branded" /> : name === 'Ethereum' ? <NetworkEthereum size={22} variant="branded" /> : <NetworkArbitrumOne size={22} variant="branded" />}<b>{name}</b><small>{note}</small>{network === name && <Check size={18} />}</button>)}</div>
      {mode === 'deposit' ? <div className="qr-card glass">{depositAddress?.address ? <QRCodeSVG value={depositAddress.address} size={148} bgColor="transparent" fgColor="#0E1116" level="M" /> : <div className="qr-grid" />}<p>{depositState === 'loading' ? flowCopy.generatingAddress : operationText(locale, 'depositAddress', { network })}</p><b dir="ltr">{depositState === 'error' ? '—' : depositAddress?.address ?? '—'}</b>{depositAddress?.memo ? <small dir="ltr">Memo: {depositAddress.memo}</small> : null}{depositAddress?.warning ? <small className="wallet-warning">{depositAddress.warning}</small> : null}<button type="button" disabled={!depositAddress?.address} onClick={() => { if (depositAddress?.address) void navigator.clipboard?.writeText(depositAddress.address); notify(operationText(locale, 'copied', { network })) }}><Copy size={18} />{text.copyAddress}</button></div> : <div className="wallet-form glass"><label>{mode === 'withdraw' ? text.destinationWallet : text.recipient}<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={mode === 'withdraw' ? network === 'TRON' ? 'T…' : '0x…' : flowCopy.recipientPlaceholder} autoCapitalize="none" autoCorrect="off" /></label>{mode === 'withdraw' && <button className="oauth-row" type="button" onClick={() => { setRecipient(network === 'TRON' ? 'TQx7d6k4r1vZpA9v8s6c4k2m7n5b3d' : '0x8F1248A90C8239D0E4F1A62C7090D7B74E5C04D2'); notify(text.demoAddressSelected) }}>{text.useWhitelisted} <ChevronRight size={18} /></button>}{mode === 'withdraw' && <button className="quiet-action" type="button" style={{ marginTop: 6 }} onClick={() => go('address-book')}>{text.manageAddressBook}</button>}{balanceError && isSessionError(balanceError) && <button className="quiet-action" type="button" style={{ marginTop: 6 }} onClick={() => go('login')}>{flowCopy.signInAgain}</button>}<label>{text.amount}<input value={amountInput} onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" /><span>USDT</span></label><div className="form-balance">{text.available} <b>{balanceState === 'loading' ? '…' : balanceState === 'error' ? '—' : formatMoneyNumber(available, locale)} USDT</b></div>{balanceError ? <div className="order-inline-error" role="alert"><AlertTriangle size={15} />{balanceError}</div> : null}{operationError ? <div className="order-inline-error" role="alert"><AlertTriangle size={15} />{operationError}</div> : null}{mode === 'withdraw' && <button className={`whitelist-check ${whitelistConfirmed ? 'is-checked' : ''}`} type="button" onClick={() => setWhitelistConfirmed((value) => !value)}><span>{whitelistConfirmed && <Check size={14} />}</span><p><b>{text.whitelistTitle}</b><small>{text.whitelistBody}</small></p></button>}<div className={`wallet-preflight ${canContinue ? 'is-ready' : ''}`}><span><small>{mode === 'withdraw' ? text.networkFee : text.processingFee}</small><b>{feeLabel} USDT</b></span><span><small>{text.receiveSend}</small><b>{amountIsValid ? formatMoneyNumber(netValueForDisplay ?? 0, locale) : '—'} USDT</b></span><small className="wallet-preflight__state">{canContinue ? text.preflightPassed : validationMessage}</small></div></div>}
      <div className="flow-note"><ShieldCheck size={18} /><span>{copy.subtitle}</span></div>
      <button className="flow-cta" disabled={!canContinue || submitting} type="button" onClick={() => void (async () => {
        if (mode === 'deposit') { completeFlow(mode); return }
        setSubmitting(true); setOperationError(null)
        if (!atomicAmount || !amountIsValid) { setSubmitting(false); return }
        const path = mode === 'withdraw' ? '/v1/wallet/withdrawals' : '/v1/wallet/transfers'
        const body = mode === 'withdraw'
          ? { network: networkKey, atomicAmount, destination: recipient.trim() }
          : { recipientUserId: recipient.trim(), atomicAmount }
        const result = await request<Record<string, unknown>>(path, {
          method: 'POST',
          idempotencyKey: idempotencyKeyForIntent(idempotencyKeys.current, 'POST', path, body),
          body: JSON.stringify(body),
        })
        setSubmitting(false)
        if (!result.ok) { setOperationError(result.error.message); notify(result.error.message); return }
        idempotencyKeys.current.clear()
        completeFlow(mode)
      })()}>{submitting ? '…' : copy.action}<ArrowRight size={20} /></button>
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
  return <section className="screen success-screen has-fixed-cta"><DetailHeader screen="wallet-success" go={go} back="wallet" title={copy.eyebrow} kind="flow" /><FlowProgress current={3} total={3} label={copy.eyebrow} /><div className="success-orb"><CircleCheck size={38} /></div><p>{copy.eyebrow}</p><h1>{copy.title}</h1><span>{copy.body}</span><div className="success-receipt glass"><span><small>{text.requestReference}</small><b>WLT-240713-1298</b></span><span><small>{text.networkRail}</small><b>{mode === 'deposit' ? 'USDT · TRON' : 'Platform USDT'}</b></span><span><small>{text.currentState}</small><b>{copy.state}</b></span></div><button className="flow-cta" type="button" onClick={() => go('wallet')}>{text.backWallet} <ArrowRight size={20} /></button><button className="quiet-action" type="button" onClick={() => go('activity')}>{text.viewActivity}</button></section>
}

function ActivityScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n()
  const text = operationsCopy[locale]
  const [active, setActive] = useState<'All' | 'Wallet' | 'Investments' | 'Rewards'>('All')
  const [ledgerTxs, setLedgerTxs] = useState<LedgerTransaction[]>([])
  useEffect(() => {
    getLedgerTransactions(30).then((list) => setLedgerTxs(list)).catch(() => setLedgerTxs([]))
  }, [])
  const filters = ['All', 'Wallet', 'Investments', 'Rewards'] as const
  const filterLabels = { All: text.all, Wallet: text.wallet, Investments: text.investments, Rewards: text.rewards }
  const groupOf = (type: string): 'Wallet' | 'Investments' | 'Rewards' =>
    type.startsWith('withdrawal') || type === 'internal_transfer' ? 'Wallet'
      : type === 'yield_distribution' || type === 'adjustment' ? 'Rewards'
        : type === 'deposit' ? 'Wallet' : 'Investments'
  const entries: Array<{ name: string; detail: string; value: string; amount: number; direction: 'in' | 'out' | 'hold' | 'context'; time: string; group: Exclude<typeof active, 'All'>; icon: LucideIcon }> = ledgerTxs.map((tx) => {
    const entry = tx.entries[0]
    const amount = walletUnits(entry?.atomicAmount, entry?.assetDecimals ?? 6)
    const display = ledgerDisplay(tx.transactionType, locale)
    const reference = tx.referenceType ? ledgerDisplay(tx.referenceType, locale).label : shortId(tx.referenceId ?? tx.id)
    return {
      name: display.label,
      detail: reference,
      value: `${formatLedgerAmount(amount, tx.transactionType, locale)} ${entry?.assetCode ?? 'USDT'}`,
      amount,
      direction: display.direction,
      time: formatTime(tx.effectiveAt, locale),
      group: groupOf(tx.transactionType),
      icon: display.icon,
    }
  })
  const visibleEntries = active === 'All' ? entries : entries.filter((entry) => entry.group === active)
  const summary = visibleEntries.reduce((result, entry) => {
    if (entry.direction === 'in') result.inflow += entry.amount
    else if (entry.direction === 'out') result.outflow += entry.amount
    else if (entry.direction === 'hold') result.hold += entry.amount
    return result
  }, { inflow: 0, outflow: 0, hold: 0 })
  const summaryLabels = locale === 'zh-CN' ? { inflow: '流入', outflow: '流出', hold: '处理中' } : { inflow: 'In', outflow: 'Out', hold: 'Pending' }
  const summaryValue = (amount: number, sign: 'in' | 'out' | 'hold') => `${amount ? formatMoney(amount, locale, { sign }) : formatMoney(0, locale)} USDT`
  return <section className="screen activity-screen"><DetailHeader screen="activity" go={go} back="wallet" title={text.activity} /><div className="activity-filter">{filters.map((filter) => <button className={active === filter ? 'is-active' : ''} type="button" key={filter} onClick={() => setActive(filter)}>{filterLabels[filter]}</button>)}</div><div className="activity-timeline">{visibleEntries.length ? visibleEntries.map(({ name, detail, value, direction, time, icon: Icon }) => <div key={`${name}-${time}`} className="activity-timeline__row glass"><span><Icon size={20} /></span><p><b>{name}</b><small>{detail}</small></p><strong className={`money-sm ${directionClass(direction)}`}>{value}<small>{time}</small></strong></div>) : <EmptyState variant="card" icon={ReceiptText} title={operationText(locale, 'noActivity', { group: filterLabels[active].toLocaleLowerCase(locale) })} body={text.noActivityBody} />}</div><div className="activity-summary-bar glass"><span><small>{summaryLabels.inflow}</small><b className="money-sm direction-in">{summaryValue(summary.inflow, 'in')}</b></span><span><small>{summaryLabels.outflow}</small><b className="money-sm direction-out">{summaryValue(summary.outflow, 'out')}</b></span><span><small>{summaryLabels.hold}</small><b className="money-sm direction-hold">{summaryValue(summary.hold, 'hold')}</b></span></div></section>
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

function factorCountText(count: number | null, kind: 'passkey' | 'factor', locale: string) {
  if (count === null) return '—'
  if (locale === 'zh-CN') return `${count} 个${kind === 'passkey' ? '通行密钥' : '安全因子'}`
  const label = kind === 'passkey' ? 'passkey' : 'factor'
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function sessionDisplay(item: Record<string, unknown>, index: number, locale: string) {
  const device = item.device && typeof item.device === 'object' ? item.device as Record<string, unknown> : {}
  const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const isCurrent = item.isCurrent === true || item.current === true
  const deviceName = textValue(device.name, item.deviceName, item.name) ?? (isCurrent ? (locale === 'zh-CN' ? '当前设备' : 'This device') : (locale === 'zh-CN' ? `其他设备 ${index + 1}` : `Other device ${index + 1}`))
  const rawTime = item.lastSeenAt ?? item.createdAt
  const dateValue = typeof rawTime === 'string' || typeof rawTime === 'number' ? new Date(rawTime) : null
  const time = dateValue && !Number.isNaN(dateValue.getTime())
    ? (() => {
        const seconds = Math.round((dateValue.getTime() - Date.now()) / 1000)
        const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
        if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
        const minutes = Math.round(seconds / 60)
        if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
        const hours = Math.round(minutes / 60)
        if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
        return formatter.format(Math.round(hours / 24), 'day')
      })()
    : (locale === 'zh-CN' ? '时间未知' : 'Time unavailable')
  const city = textValue(item.city, device.city, item.location)
  return { deviceName, isCurrent, meta: [city, time].filter(Boolean).join(' · ') }
}

const referralStepCopies: Record<string, Array<[string, string]>> = {
  en: [['Share your link', 'Invite a friend to explore RWA.LAT.'], ['Friend verifies', 'Their account completes the required checks.'], ['Earn fee credit', 'The reward is recorded after the first allocation.']],
  'zh-CN': [['分享链接', '邀请好友了解 RWA.LAT。'], ['好友认证', '好友完成账户所需的认证。'], ['获得奖励', '首次投资完成后记录手续费抵扣。']],
  hi: [['लिंक साझा करें', 'किसी मित्र को RWA.LAT देखने के लिए आमंत्रित करें।'], ['मित्र सत्यापित हो', 'मित्र आवश्यक खाते की जाँच पूरी करे।'], ['शुल्क क्रेडिट पाएँ', 'पहले निवेश के बाद पुरस्कार दर्ज होगा।']],
  es: [['Comparte el enlace', 'Invita a un amigo a explorar RWA.LAT.'], ['Tu amigo verifica', 'Completa las comprobaciones necesarias.'], ['Gana crédito', 'La recompensa se registra tras la primera inversión.']],
  ar: [['شارك الرابط', 'ادعُ صديقًا لاستكشاف RWA.LAT.'], ['يتحقق الصديق', 'يكمل فحوصات الحساب المطلوبة.'], ['اكسب رصيد رسوم', 'يسجل المكافأة بعد أول تخصيص.']],
  fr: [['Partager le lien', 'Invitez un ami à découvrir RWA.LAT.'], ['Vérification', 'Votre ami termine les contrôles requis.'], ['Crédit de frais', 'La récompense est enregistrée après le premier investissement.']],
  pt: [['Compartilhe o link', 'Convide um amigo para conhecer a RWA.LAT.'], ['Amigo verifica', 'A conta conclui as verificações necessárias.'], ['Ganhe crédito', 'A recompensa é registrada após o primeiro investimento.']],
}

function sessionToggleLabel(locale: string, expanded: boolean, count: number) {
  if (locale === 'zh-CN') return expanded ? '收起列表' : `最近 5 台 · 查看全部（${count}）`
  if (locale === 'hi') return expanded ? 'सूची संक्षिप्त करें' : `हाल के 5 · सभी देखें (${count})`
  if (locale === 'es') return expanded ? 'Mostrar menos' : `Últimos 5 · Ver todos (${count})`
  if (locale === 'fr') return expanded ? 'Réduire la liste' : `5 récents · Tout voir (${count})`
  if (locale === 'pt') return expanded ? 'Mostrar menos' : `5 recentes · Ver tudo (${count})`
  if (locale === 'ar') return expanded ? 'عرض أقل' : `آخر 5 · عرض الكل (${count})`
  return expanded ? 'Show fewer' : `Recent 5 · View all (${count})`
}

// Theme moved out of the topbar; Settings is its single home.
const themeOrder: RwaThemePreference[] = ['system', 'light', 'dark']
const themeCopy: Record<AppLocale, { title: string; options: string[] }> = {
  en: { title: 'Appearance', options: ['System', 'Light', 'Dark'] },
  'zh-CN': { title: '外观', options: ['跟随系统', '浅色', '深色'] },
  hi: { title: 'रूप', options: ['सिस्टम', 'हल्का', 'गहरा'] },
  es: { title: 'Apariencia', options: ['Sistema', 'Claro', 'Oscuro'] },
  ar: { title: 'المظهر', options: ['النظام', 'فاتح', 'داكن'] },
  fr: { title: 'Apparence', options: ['Système', 'Clair', 'Sombre'] },
  pt: { title: 'Aparência', options: ['Sistema', 'Claro', 'Escuro'] },
}

function AccountFlowScreen({ kind, go, notify }: { kind: AccountFlowKind; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const { locale, t } = useI18n()
  const { preference, setTheme } = useRwaTheme()
  const flow = accountFlowCopy[locale]
  const [factors, setFactors] = useState<Record<string, unknown> | null>(null)
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([])
  const [invitations, setInvitations] = useState<Array<Record<string, unknown>>>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [flowLoading, setFlowLoading] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [securityEnrollment, setSecurityEnrollment] = useState<Record<string, unknown> | null>(null)
  const [securityCode, setSecurityCode] = useState('')
  const [reauthentication, setReauthentication] = useState('')
  const [showAllSessions, setShowAllSessions] = useState(false)
  useEffect(() => {
    if (kind === 'security') {
      void Promise.all([request<Record<string, unknown>>('/v1/security/factors'), request<unknown>('/v1/security/sessions')]).then(([factorResult, sessionResult]) => {
        if (factorResult.ok) setFactors(factorResult.data)
        if (sessionResult.ok) setSessions(Array.isArray(sessionResult.data) ? sessionResult.data as Array<Record<string, unknown>> : Array.isArray((sessionResult.data as Record<string, unknown>)?.items) ? (sessionResult.data as { items: Array<Record<string, unknown>> }).items : [])
      })
    }
    if (kind === 'referral') void request<unknown>('/v1/user-ops/invitations').then((result) => { if (result.ok) setInvitations(Array.isArray(result.data) ? result.data as Array<Record<string, unknown>> : Array.isArray((result.data as Record<string, unknown>)?.items) ? (result.data as { items: Array<Record<string, unknown>> }).items : []) })
  }, [kind])
  const refreshSecurity = async () => {
    const [factorResult, sessionResult] = await Promise.all([request<Record<string, unknown>>('/v1/security/factors'), request<unknown>('/v1/security/sessions')])
    if (factorResult.ok) setFactors(factorResult.data)
    if (sessionResult.ok) setSessions(Array.isArray(sessionResult.data) ? sessionResult.data as Array<Record<string, unknown>> : Array.isArray((sessionResult.data as Record<string, unknown>)?.items) ? (sessionResult.data as { items: Array<Record<string, unknown>> }).items : [])
  }
  const createPasskey = async () => {
    const copy = securityRouteCopy[locale]
    setPasskeyBusy(true)
    try {
      const result = await registerPasskey()
      if (!result.ok) {
        const message = result.error.code === 'PASSKEY_REGISTRATION_CANCELLED' ? copy.passkeyCancelled
          : result.error.code === 'PASSKEY_UNSUPPORTED' ? copy.passkeyUnsupported
            : result.error.code === 'PASSKEY_ALREADY_REGISTERED' ? copy.passkeyAlreadyRegistered
              : copy.passkeyFailed
        notify(message)
        return
      }
      await refreshSecurity()
      notify(copy.passkeyAdded)
    } catch {
      notify(copy.passkeyFailed)
    } finally {
      setPasskeyBusy(false)
    }
  }
  const startTotpEnrollment = async () => {
    setFlowLoading(true)
    const result = await request<Record<string, unknown>>('/v1/security/totp/enrollment', { method: 'POST', body: JSON.stringify({}) })
    setFlowLoading(false)
    if (!result.ok) { notify(result.error.message); return }
    setSecurityEnrollment(result.data)
    notify(securityRouteCopy[locale].setupStarted)
  }
  const confirmTotpEnrollment = async () => {
    const factorId = securityEnrollment?.factorId
    if (typeof factorId !== 'string' || !/^\d{6}$/.test(securityCode)) return
    setFlowLoading(true)
    const result = await request('/v1/security/totp/enrollment/confirm', { method: 'POST', body: JSON.stringify({ factorId, code: securityCode }) })
    setFlowLoading(false)
    if (!result.ok) { notify(result.error.message); return }
    setSecurityEnrollment(null)
    setSecurityCode('')
    await refreshSecurity()
    notify(securityRouteCopy[locale].factorAdded)
  }
  const revokeTotp = async (factorId: string) => {
    if (!reauthentication.trim()) return
    setFlowLoading(true)
    const result = await request(`/v1/security/factors/totp/${encodeURIComponent(factorId)}`, { method: 'DELETE', body: JSON.stringify({ reauthentication: reauthentication.trim() }) })
    setFlowLoading(false)
    if (!result.ok) { notify(result.error.message); return }
    setReauthentication('')
    await refreshSecurity()
    notify(securityRouteCopy[locale].factorRemoved)
  }
  const revokeSession = async (sessionId: string) => {
    setFlowLoading(true)
    const result = await request(`/v1/security/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', body: JSON.stringify({}) })
    setFlowLoading(false)
    if (!result.ok) { notify(result.error.message); return }
    await refreshSecurity()
    notify(securityRouteCopy[locale].sessionRemoved)
  }
  const revokeOthers = async () => {
    setFlowLoading(true)
    const result = await request('/v1/security/sessions/revoke-others', { method: 'POST', body: JSON.stringify({}) })
    setFlowLoading(false)
    if (!result.ok) { notify(result.error.message); return }
    await refreshSecurity()
    notify(securityRouteCopy[locale].sessionRemoved)
  }
  const [supportCategory, setSupportCategory] = useState('order-dispute')
  const [supportDetails, setSupportDetails] = useState('')
  const [supportReference, setSupportReference] = useState('')
  const config = { ...flow.config[kind], icon: kind === 'security' ? KeyRound : kind === 'referral' ? Sparkles : kind === 'records' ? ReceiptText : kind === 'support' ? Headphones : Settings }
  const Icon = config.icon
  const passkeyCount = factors && Array.isArray(factors.passkeys) ? factors.passkeys.length : null
  const totpCount = factors && Array.isArray(factors.totp) ? factors.totp.length : null
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, 5)
  const referralSteps = referralStepCopies[locale] ?? referralStepCopies.en
  return (
    <section className="screen account-flow-screen has-fixed-cta">
      <DetailHeader screen={kind === 'security' ? 'security' : kind === 'referral' ? 'referral' : kind === 'records' ? 'records' : kind === 'support' ? 'support' : 'settings'} go={go} back="profile" title={config.title} />
      <div className="account-flow-hero">
        <span><Icon size={30} /></span>
        <p>{config.overline}</p>
        <h1>{config.heading}</h1>
        <small>{config.body}</small>
      </div>

      {kind === 'security' && (
        <><div className="security-factor-stats">
          <div className="security-factor-stat glass"><KeyRound size={20} /><span><b>{flow.passkey}</b><small>{factorCountText(passkeyCount, 'passkey', locale)}</small></span></div>
          <div className="security-factor-stat glass"><Fingerprint size={20} /><span><b>TOTP</b><small>{factorCountText(totpCount, 'factor', locale)}</small></span></div>
        </div><div className="security-factor-panel glass"><div><b>{securityRouteCopy[locale].passkeyTitle}</b><small>{securityRouteCopy[locale].passkeyBody}</small></div><Button type="button" variant="outline" className="w-full justify-between" aria-busy={passkeyBusy} disabled={passkeyBusy || flowLoading} onClick={() => void createPasskey()}>{passkeyBusy ? securityRouteCopy[locale].addingPasskey : securityRouteCopy[locale].addPasskey}<ArrowRight size={16} /></Button></div><div className="security-factor-panel glass"><div><b>{securityRouteCopy[locale].enroll}</b><small>{securityRouteCopy[locale].enrollBody}</small></div>{securityEnrollment ? <><code>{String(securityEnrollment.otpauthUri ?? 'otpauth://…')}</code><small>{securityRouteCopy[locale].recoveryCodes}</small><pre>{Array.isArray(securityEnrollment.recoveryCodes) ? securityEnrollment.recoveryCodes.join('  ') : '—'}</pre><label className="basket-field"><span>{securityRouteCopy[locale].code}</span><input inputMode="numeric" maxLength={6} value={securityCode} onChange={(event) => setSecurityCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button type="button" className="flow-cta" disabled={flowLoading || !/^\d{6}$/.test(securityCode)} onClick={() => void confirmTotpEnrollment()}>{securityRouteCopy[locale].confirm}<ArrowRight size={18} /></button></> : <button type="button" className="quiet-action" disabled={flowLoading} onClick={() => void startTotpEnrollment()}>{securityRouteCopy[locale].begin}<ArrowRight size={16} /></button>}</div>
        <div className="security-reauth glass"><label className="basket-field"><span>{securityRouteCopy[locale].reauth}</span><input value={reauthentication} onChange={(event) => setReauthentication(event.target.value)} autoComplete="off" /></label>{Array.isArray(factors?.totp) && factors.totp.map((item, index) => { const factor = item && typeof item === 'object' ? item as Record<string, unknown> : {}; const factorId = typeof factor.id === 'string' ? factor.id : null; return <button key={factorId ?? index} type="button" className="quiet-action" disabled={flowLoading || !factorId || !reauthentication.trim()} onClick={() => factorId && void revokeTotp(factorId)}>{securityRouteCopy[locale].revoke}</button> })}</div><div className="device-session-head"><span>{flow.activeSessions}</span><div className="device-session-head__meta"><small>{accountFlowText(locale, flow.devices, { count: sessions.length })}</small>{sessions.length > 5 && <Button type="button" variant="link" size="sm" className="device-session-toggle" onClick={() => setShowAllSessions((value) => !value)}>{sessionToggleLabel(locale, showAllSessions, sessions.length)}</Button>}</div></div><div className="device-session-list glass">{sessions.length ? visibleSessions.map((item, index) => { const display = sessionDisplay(item, index, locale); return <div key={String(item.id ?? index)}><span className="device-session__icon"><Laptop size={18} /></span><p><b>{display.deviceName}</b><small>{display.meta}</small></p><strong>{display.isCurrent ? flow.current : <button type="button" onClick={() => typeof item.id === 'string' && void revokeSession(item.id)}>{securityRouteCopy[locale].revokeSession}</button>}</strong></div> }) : <EmptyState variant="inline" icon={Laptop} title={securityRouteCopy[locale].noFactors} body={locale === 'zh-CN' ? '最近登录的设备会显示在这里。' : 'Recent sign-ins will appear here.'} />}</div><button type="button" className="quiet-action" disabled={flowLoading} onClick={() => void revokeOthers()}>{securityRouteCopy[locale].revokeOthers}</button></>
      )}

      {kind === 'referral' && (
        <>
          {inviteLink && <div className="referral-code glass"><small>{flow.invitationCode}</small><b>{inviteLink}</b><button type="button" onClick={() => void navigator.clipboard?.writeText(inviteLink)}>{locale === 'zh-CN' ? '复制链接' : 'Copy link'}</button></div>}
          <Stepper
            className="referral-stepper"
            stepCircleContainerClassName="referral-stepper__container"
            stepContainerClassName="referral-stepper__indicators"
            contentClassName="referral-stepper__content"
            footerClassName="referral-stepper__footer"
            initialStep={1}
            nextButtonText={locale === 'zh-CN' ? '下一步' : 'Next step'}
            completeButtonText={locale === 'zh-CN' ? '完成' : 'Complete'}
            backButtonText={locale === 'zh-CN' ? '上一步' : 'Back'}
            renderStepIndicator={({ step, currentStep, onStepClick }) => {
              const StepIcon = [UserPlus, ShieldCheck, CircleDollarSign][step - 1]
              return <button type="button" className={`referral-step-indicator ${currentStep === step ? 'is-active' : currentStep > step ? 'is-complete' : ''}`} aria-label={`${step}. ${referralSteps[step - 1]?.[0] ?? ''}`} aria-current={currentStep === step ? 'step' : undefined} onClick={() => onStepClick(step)}><span className="referral-step-indicator__icon"><StepIcon size={16} /></span><span className="referral-step-indicator__label">{referralSteps[step - 1]?.[0]}</span></button>
            }}
          >
            {referralSteps.map(([title, body], index) => { const StepIcon = [UserPlus, ShieldCheck, CircleDollarSign][index]; return <Step key={title}><div className="referral-step glass"><span className="referral-step__index">{index + 1}</span><span className="referral-step__icon"><StepIcon size={18} /></span><p><b>{title}</b><small>{body}</small></p></div></Step> })}
          </Stepper>
          <div className="record-stack glass">{invitations.length ? invitations.map((item, index) => <div key={String(item.id ?? index)}><ReceiptText size={19} /><span><b>{String(item.code ?? item.id ?? '—')}</b><small>{String(item.status ?? item.state ?? '—')}</small></span></div>) : <EmptyState variant="inline" icon={Users} title={locale === 'zh-CN' ? '暂无邀请记录' : 'No invitations yet'} body={locale === 'zh-CN' ? '分享邀请链接后，已发送的邀请会显示在这里。' : 'Invitations will appear here after you share your link.'} />}</div>
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
          {supportReference ? <div className="report-success glass"><CircleCheck size={30} /><h2>{flow.caseCreated}</h2><b>{supportReference}</b><p>{flow.caseStatus}</p></div> : <form className="security-report-form glass" onSubmit={(event) => { event.preventDefault(); if (!supportDetails.trim()) return; const reference = `SUP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; setSupportReference(reference); window.localStorage.setItem('rwa-last-support-ticket', JSON.stringify({ reference, category: supportCategory, details: supportDetails, status: 'submitted', createdAt: new Date().toISOString(), demo: true })); notify(accountFlowText(locale, flow.caseRecorded, { reference })) }}><label>{flow.issueType}<select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)}><option value="order-dispute">{flow.dispute}</option><option value="deposit-withdrawal">{flow.depositWithdrawal}</option><option value="yield-settlement">{flow.yieldSettlement}</option><option value="kyc-appeal">{flow.kycAppeal}</option><option value="other">{flow.other}</option></select></label><label>{flow.transactionDetails}<textarea rows={4} value={supportDetails} onChange={(event) => setSupportDetails(event.target.value)} placeholder={flow.detailsPlaceholder} /></label><button className="auth-primary" type="submit" disabled={!supportDetails.trim()}>{flow.createCase} <ArrowRight size={18} /></button></form>}
        </div>
      )}

      {kind === 'settings' && (
        <div className="setting-stack setting-stack--preferences glass">
          <div className="settings-language-row"><Network size={20} /><LanguageMenu variant="settings" onChange={(label) => notify(accountFlowText(locale, flow.languageSaved, { label }))} /></div>
          <div className="settings-theme-row"><Moon size={20} /><span><b>{themeCopy[locale].title}</b></span><Segmented label={themeCopy[locale].title} items={themeCopy[locale].options} value={themeOrder.indexOf(preference)} onChange={(index) => setTheme(themeOrder[index])} /></div>
          <button type="button" onClick={() => go('marketing')}><Bell size={20} /><span><b>{t('settings.marketing')}</b><small>{flow.marketingDetail}</small></span><ChevronRight size={19} /></button>
          <button type="button" onClick={() => notify(flow.notificationSaved)}><Bell size={20} /><span><b>{t('settings.notifications')}</b><small>{flow.notificationDetail}</small></span><Check size={19} /></button>
          <button type="button" onClick={() => notify(flow.fiatUnavailable)}><Upload size={20} /><span><b>{t('settings.fiat')}</b><small>{flow.fiatDetail}</small></span><ChevronRight size={19} /></button>
        </div>
      )}

      {kind === 'referral' && <button className="flow-cta" type="button" disabled={flowLoading} onClick={() => { setFlowLoading(true); void request<Record<string, unknown>>('/v1/user-ops/invitations', { method: 'POST', body: JSON.stringify({ role: 'member' }) }).then((result) => { setFlowLoading(false); if (!result.ok) { notify(result.error.message); return } const token = result.data.token; if (typeof token === 'string') setInviteLink(`${location.origin}/?invite=${encodeURIComponent(token)}`); const view = result.data.view; if (view && typeof view === 'object') setInvitations((items) => [view as Record<string, unknown>, ...items]) }) }}>{config.action}<ArrowRight size={20} /></button>}
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
  const [toast, setToast] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [sessionMode, setSessionMode] = useState<'guest' | 'authenticated'>('guest')
  const [sessionReady, setSessionReady] = useState(false)
  const [orderAsset, setOrderAsset] = useState<OrderAsset>('compute')
  const [orderAmount, setOrderAmount] = useState(1000)
  const [walletFlowMode, setWalletFlowMode] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit')
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
    const storedFlow = window.sessionStorage.getItem('rwa-wallet-flow-mode')
    if (storedFlow === 'withdraw' || storedFlow === 'transfer' || storedFlow === 'deposit') setWalletFlowMode(storedFlow)
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
      if (/^\/(?:wallet|assets\/cash)\/(deposit|withdraw|transfer)(?:\/|$)/.test(url.pathname)) captureWalletBackdrop()
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
      setToast(t('guest.protected'))
      window.setTimeout(() => setToast(null), 2600)
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
    if (next === 'deposit' || next === 'withdraw' || next === 'transfer') captureWalletBackdrop()
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
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }
  const openOrder = (asset: OrderAsset) => {
    if (isOrderableId(selectedProduct.id)) { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/orders/review?product=${encodeURIComponent(selectedProduct.id)}` } })); return }
    setOrderAsset(asset)
    setOrderAmount(asset === 'prediction' ? 250 : asset === 'stocks' ? 500 : asset === 'rwa' ? 500 : 1000)
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
    setWalletFlowMode(mode)
    window.sessionStorage.setItem('rwa-wallet-flow-mode', mode)
    go(mode)
  }
  const completeWalletFlow = (mode: 'deposit' | 'withdraw' | 'transfer') => {
    setWalletFlowMode(mode)
    window.sessionStorage.setItem('rwa-wallet-flow-mode', mode)
    go('wallet-success')
  }
  const setAuthenticated = () => { setSessionMode('authenticated'); window.localStorage.setItem('rwa-session-mode', 'authenticated') }
  const setSignedOut = () => setSessionMode('guest')
  // The Dock stays behind the D3.4 order and wallet sheets so those actions visibly rise from it.
  const isWalletAction = screen === 'deposit' || screen === 'withdraw' || screen === 'transfer'
  const isFloatingSheet = screen === 'order-review' || isWalletAction
  const showDock = ['home', 'invest', 'portfolio'].includes(screen) || isFloatingSheet
  const dockActiveScreen: PrimaryScreen | undefined = screen === 'order-review' ? 'invest' : isWalletAction ? 'portfolio' : undefined
  const isProtectedWaiting = (protectedScreens.includes(screen) || routeRequiresAuth(routePath || initialPath)) && !sessionReady
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      {!isOnline && <div className="connection-banner" role="status"><AlertTriangle size={16} /><span><b>{shellCopy.offlineTitle}</b><small>{shellCopy.offlineBody}</small></span></div>}
      <div className="rwa-mobile" data-theme={theme} data-mode={mode} data-screen={screen} data-dock={showDock ? 'true' : 'false'} data-sheet={isFloatingSheet ? 'true' : 'false'}>
        {isWalletAction && <WalletPageBackdrop />}
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
        {screen === 'basket-disclosures' && <BasketScreen kind="disclosures" basketId={selectedBasketId} go={go} openBasket={openBasket} />}
        {screen === 'basket-recommend' && <BasketScreen kind="recommend" basketId={selectedBasketId} go={go} openBasket={openBasket} />}
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
        {screen === 'valuation' && <ValuationScreen go={go} />}
        {screen === 'issuer-profile' && <MaisonIssuerProfileScreen key={routeParams.slug ?? ''} slug={routeParams.slug ?? null} />}
        {screen === 'issuers' && <MaisonIssuersScreen />}
        {screen === 'search' && <MaisonSearchScreen query={routeQuery} />}
        {screen === 'yield-calendar' && <MaisonYieldCalendarScreen query={routeQuery} />}
        {screen === 'rebalance' && <MaisonRebalanceScreen />}
        {screen === 'statements' && <MaisonStatementsScreen query={routeQuery} />}
        {screen === 'recurring' && <MaisonRecurringScreen />}
        {screen === 'order-review' && <MaisonOrderReviewScreen query={queryParam(routeQuery, 'product') || !isOrderableId(selectedProduct.id) ? routeQuery : `product=${selectedProduct.id}`} />}
        {screen === 'order-processing' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-success' && <MaisonOrderStatusScreen variant="status" orderId={queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'order-partial' && <OrderStatusScreen kind="partial" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'order-failed' && <OrderStatusScreen kind="failed" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'order-receipt' && <OrderStatusScreen kind="receipt" product={localizedSelectedProduct} asset={orderAsset} amount={orderAmount} go={go} />}
        {screen === 'deposit' && <MaisonDepositScreen query={routeQuery} />}
        {screen === 'withdraw' && <MaisonWithdrawScreen query={routeQuery} />}
        {screen === 'transfer' && <MaisonTransferScreen query={routeQuery} />}
        {screen === 'receive' && <MaisonReceiveScreen />}
        {screen === 'wallet-success' && <WalletSuccessScreen mode={walletFlowMode} go={go} />}
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
        {screen === 'disclosures' && <DisclosuresScreen productId={selectedProduct?.id ?? null} go={go} />}
        {screen === 'order-detail' && <MaisonOrderStatusScreen variant="detail" orderId={routeParams.id ?? queryParam(routeQuery, 'id') ?? orderDetailId} />}
        {screen === 'secondary' && <SecondaryScreen go={go} />}
        {screen === 'trade' && (routePath === '/markets' ? <MaisonMarketsScreen query={routeQuery} /> : <MaisonTradeScreen symbol={routeParams.symbol ?? routeSymbol ?? null} />)}
        {screen === 'settings' && <MaisonSettingsScreen />}
        {screen === 'marketing' && <MarketingPreferencesScreen go={go} />}
        {screen === 'official-channels' && <MaisonBridge page="official-channels"><OfficialChannelsScreen go={go} /></MaisonBridge>}
        {screen === 'scam-report' && <MaisonBridge page="scam-report"><ScamReportScreen go={go} isGuest={sessionMode === 'guest'} onCreated={openSupportTicket} /></MaisonBridge>}
        {screen === 'close-account' && <MaisonCloseAccountScreen />}
        {screen === 'trust-center' && <MaisonBridge page="trust">{routePath === '/trust/proof-of-reserves' ? <section className="screen trust-screen"><DetailHeader screen="trust-center" go={go} back="trust-center" title={trustPageCopy[locale].reservesTitle} /><PublishedReserves /></section> : <TrustCenterScreen kind="trust-center" go={go} notify={notify} />}</MaisonBridge>}
        {screen === 'access-regions' && <MaisonBridge page="trust"><TrustCenterScreen kind="access-regions" go={go} notify={notify} /></MaisonBridge>}
        {screen === 'product-disclosures' && <MaisonBridge page="trust"><TrustCenterScreen kind="product-disclosures" go={go} notify={notify} /></MaisonBridge>}
        {screen === 'legal-center' && <MaisonBridge page="trust"><TrustCenterScreen kind="legal-center" go={go} notify={notify} /></MaisonBridge>}
        </ScreenRouter>}
        </ScreenTransition>
        {showDock && <BottomDock screen={screen} activeScreen={dockActiveScreen} setScreen={go} showQuickActions={!isFloatingSheet} />}
      </div>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
      </main>
    </>
  )
}

export default function RwaH5({ initialScreen = 'home', initialParams = {}, initialQuery = '', initialPath = '' }: { initialScreen?: Screen; initialParams?: Record<string, string>; initialQuery?: string; initialPath?: string }) {
  return <><EligibilityNotice /><RwaH5Content initialScreen={initialScreen} initialParams={initialParams} initialQuery={initialQuery} initialPath={initialPath} /></>
}
import { TokenUSDT, NetworkTron, NetworkEthereum, NetworkArbitrumOne } from '@web3icons/react'
import { QRCodeSVG } from 'qrcode.react'
import { RankingTable } from './invest/RankingTable'
