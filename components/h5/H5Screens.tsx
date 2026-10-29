'use client'
import AppLoading from '@/components/app-loading'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { localizeProduct } from '@/lib/catalog-localization'
import { queryParam } from '@/lib/maison-nav'
import { MaisonBridge } from '@/components/maison/MaisonBridge'
import { trustCopy as trustPageCopy } from '@/lib/maison-trust-copy'
import { isOrderableId } from '@/lib/api/markets'
import { useI18n } from '@/lib/i18n'
import { BootScreen } from '../screens/P01-Boot'
import { LoginScreen } from '../screens/P02-Login'
import { AuthFlowScreen } from '../screens/P03-AuthFlow'
import { HomeScreen } from '../screens/P04-HomeMaison'
import { NotificationsScreen } from '../screens/P28-Notifications'
import { ScreenRouter } from '../ScreenRouter'
const PublishedReserves = dynamic(() => import('../published-platform').then((m) => ({ default: m.PublishedReserves })), { ssr: false })
const LearnScreen = dynamic(() => import('../maison/LearnScreen').then((m) => ({ default: m.LearnScreen })), { ssr: false, loading: AppLoading })
const AiPlanningScreen = dynamic(() => import('../maison/AiPlanningScreen').then((m) => ({ default: m.AiPlanningScreen })), { ssr: false, loading: AppLoading })
const PublicShareLanding = dynamic(() => import('../public-sharing').then((m) => ({ default: m.PublicShareLanding })), { ssr: false, loading: AppLoading })
const StatusScreen = dynamic(() => import('../status-screen').then((m) => ({ default: m.StatusScreen })), { ssr: false, loading: AppLoading })
const SecondaryTransferScreen = dynamic(() => import('../maison/SecondaryTransferScreen').then((m) => ({ default: m.SecondaryTransferScreen })), { ssr: false, loading: AppLoading })
const InviteLanding = dynamic(() => import('../maison/InviteLanding').then((m) => ({ default: m.InviteLanding })), { ssr: false, loading: AppLoading })
const CommunityFeedScreen = dynamic(() => import('../community-screens').then((m) => ({ default: m.CommunityFeedScreen })), { ssr: false, loading: AppLoading })
const DmInboxScreen = dynamic(() => import('../community/DmScreens').then((m) => ({ default: m.DmInboxScreen })), { ssr: false, loading: AppLoading })
const DmThreadScreen = dynamic(() => import('../community/DmScreens').then((m) => ({ default: m.DmThreadScreen })), { ssr: false, loading: AppLoading })
const CommunityPostScreen = dynamic(() => import('../community-screens').then((m) => ({ default: m.CommunityPostScreen })), { ssr: false, loading: AppLoading })
const CommunityProfileScreen = dynamic(() => import('../community-screens').then((m) => ({ default: m.CommunityProfileScreen })), { ssr: false, loading: AppLoading })

const MaisonQuantScreen = dynamic(() => import('../maison/QuantScreen').then((m) => ({ default: m.QuantScreen })), { ssr: false, loading: AppLoading })
const MaisonMarketsScreen = dynamic(() => import('../maison/MarketsScreen').then((m) => ({ default: m.MarketsScreen })), { ssr: false, loading: AppLoading })
const MaisonAssetDetailScreen = dynamic(() => import('../maison/AssetDetailScreen').then((m) => ({ default: m.AssetDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonOrderReviewScreen = dynamic(() => import('../maison/OrderReviewScreen').then((m) => ({ default: m.OrderReviewScreen })), { ssr: false, loading: AppLoading })
const MaisonOrderStatusScreen = dynamic(() => import('../maison/OrderStatusScreen').then((m) => ({ default: m.OrderStatusScreen })), { ssr: false, loading: AppLoading })
const MaisonIssuerProfileScreen = dynamic(() => import('../maison/IssuersScreen').then((m) => ({ default: m.IssuerProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonIssuersScreen = dynamic(() => import('../maison/IssuersScreen').then((m) => ({ default: m.IssuersScreen })), { ssr: false, loading: AppLoading })
const MaisonCompareScreen = dynamic(() => import('../maison/CompareScreen').then((m) => ({ default: m.CompareScreen })), { ssr: false, loading: AppLoading })
const MaisonSearchScreen = dynamic(() => import('../maison/SearchScreen').then((m) => ({ default: m.SearchScreen })), { ssr: false, loading: AppLoading })
const MaisonHengxuDetailScreen = dynamic(() => import('../maison/HengxuScreen').then((m) => ({ default: m.HengxuDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonBasketDetailScreen = dynamic(() => import('../maison/BasketScreen').then((m) => ({ default: m.BasketDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonBasketOrderScreen = dynamic(() => import('../maison/BasketScreen').then((m) => ({ default: m.BasketOrderScreen })), { ssr: false, loading: AppLoading })
const MaisonTradeScreen = dynamic(() => import('../maison/TradeScreen').then((m) => ({ default: m.TradeScreen })), { ssr: false, loading: AppLoading })
const MaisonPredictionScreen = dynamic(() => import('../maison/PredictionScreen').then((m) => ({ default: m.PredictionScreen })), { ssr: false, loading: AppLoading })
const MaisonPortfolioScreen = dynamic(() => import('../maison/PortfolioScreen').then((m) => ({ default: m.PortfolioScreen })), { ssr: false, loading: AppLoading })
const MaisonPositionDetailScreen = dynamic(() => import('../maison/PortfolioScreen').then((m) => ({ default: m.PositionDetailScreen })), { ssr: false, loading: AppLoading })
const MaisonRebalanceScreen = dynamic(() => import('../maison/AssetToolsScreen').then((m) => ({ default: m.RebalanceScreen })), { ssr: false, loading: AppLoading })
const MaisonRecurringScreen = dynamic(() => import('../maison/AssetToolsScreen').then((m) => ({ default: m.RecurringScreen })), { ssr: false, loading: AppLoading })
const MaisonMyPredictionsScreen = dynamic(() => import('../maison/MyPredictionsScreen').then((m) => ({ default: m.MyPredictionsScreen })), { ssr: false, loading: AppLoading })
const MaisonStatementsScreen = dynamic(() => import('../maison/AssetToolsScreen').then((m) => ({ default: m.StatementsScreen })), { ssr: false, loading: AppLoading })
const MaisonYieldCalendarScreen = dynamic(() => import('../maison/AssetToolsScreen').then((m) => ({ default: m.YieldCalendarScreen })), { ssr: false, loading: AppLoading })
const MaisonActivityScreen = dynamic(() => import('../maison/CashScreen').then((m) => ({ default: m.ActivityScreen })), { ssr: false, loading: AppLoading })
const MaisonCashScreen = dynamic(() => import('../maison/CashScreen').then((m) => ({ default: m.CashScreen })), { ssr: false, loading: AppLoading })
const MaisonDepositScreen = dynamic(() => import('../maison/CashScreen').then((m) => ({ default: m.DepositScreen })), { ssr: false, loading: AppLoading })
const MaisonAddressBookScreen = dynamic(() => import('../maison/FundsScreen').then((m) => ({ default: m.AddressBookScreen })), { ssr: false, loading: AppLoading })
const MaisonTransferScreen = dynamic(() => import('../maison/FundsScreen').then((m) => ({ default: m.TransferScreen })), { ssr: false, loading: AppLoading })
const MaisonReceiveScreen = dynamic(() => import('../maison/FundsScreen').then((m) => ({ default: m.ReceiveScreen })), { ssr: false, loading: AppLoading })
const MaisonWithdrawScreen = dynamic(() => import('../maison/FundsScreen').then((m) => ({ default: m.WithdrawScreen })), { ssr: false, loading: AppLoading })
const MaisonFeesScreen = dynamic(() => import('../maison/AccountScreen').then((m) => ({ default: m.FeesScreen })), { ssr: false, loading: AppLoading })
const MaisonProfileScreen = dynamic(() => import('../maison/AccountScreen').then((m) => ({ default: m.ProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonSettingsScreen = dynamic(() => import('../maison/AccountScreen').then((m) => ({ default: m.SettingsScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportCenterScreen = dynamic(() => import('../maison/SupportScreen').then((m) => ({ default: m.SupportCenterScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportNewScreen = dynamic(() => import('../maison/SupportScreen').then((m) => ({ default: m.SupportNewScreen })), { ssr: false, loading: AppLoading })
const MaisonSupportTicketScreen = dynamic(() => import('../maison/SupportScreen').then((m) => ({ default: m.SupportTicketScreen })), { ssr: false, loading: AppLoading })
const MaisonEligibilityScreen = dynamic(() => import('../maison/VerifyScreen').then((m) => ({ default: m.EligibilityScreen })), { ssr: false, loading: AppLoading })
const MaisonKycScreen = dynamic(() => import('../maison/VerifyScreen').then((m) => ({ default: m.KycScreen })), { ssr: false, loading: AppLoading })
const MaisonRiskProfileScreen = dynamic(() => import('../maison/VerifyScreen').then((m) => ({ default: m.RiskProfileScreen })), { ssr: false, loading: AppLoading })
const MaisonVerificationCenterScreen = dynamic(() => import('../maison/VerifyScreen').then((m) => ({ default: m.VerificationCenterScreen })), { ssr: false, loading: AppLoading })
const MaisonDocumentsScreen = dynamic(() => import('../maison/DocumentsScreen').then((m) => ({ default: m.DocumentsScreen })), { ssr: false, loading: AppLoading })
const MaisonCloseAccountScreen = dynamic(() => import('../maison/AccountClosureRequestScreen').then((m) => ({ default: m.AccountClosureRequestScreen })), { ssr: false, loading: AppLoading })
const MaisonSecurityScreen = dynamic(() => import('../maison/SecurityScreen').then((m) => ({ default: m.SecurityScreen })), { ssr: false, loading: AppLoading })
const MaisonReferralScreen = dynamic(() => import('../maison/ReferralScreen').then((m) => ({ default: m.ReferralScreen })), { ssr: false, loading: AppLoading })
const OnboardingOverviewScreen = dynamic(() => import('../p0a-screens').then((m) => ({ default: m.OnboardingOverviewScreen })), { ssr: false })
const ValuationScreen = dynamic(() => import('../p0a-screens').then((m) => ({ default: m.ValuationScreen })), { ssr: false })
const MaisonBasketDisclosuresScreen = dynamic(() => import('../maison/BasketInfoScreens').then((m) => ({ default: m.BasketDisclosuresScreen })), { ssr: false, loading: AppLoading })
import type { H5Controller } from './useH5Controller'
import { AiScreen, AssetAccountScreen, AssetDetailScreen, DetailHeader, MarketingPreferencesScreen, OfficialChannelsScreen, PositionDetailScreen, RwaDetailScreen, ScamReportScreen, TrustCenterScreen } from './LegacyScreens'

export function H5Screens({ h }: { h: H5Controller }) {
  const { locale } = useI18n()
  const { screen, go, notify, closeOverlay, setAuthenticated, setSignedOut, aiContext, sessionMode, sessionReady, routeQuery, routeParams, routePath, selectedProduct, products, localizedSelectedProduct, detailSlug, predictionId, selectedBasketId, communityPostId, communityHandle, supportTicketId, orderDetailId, routeSymbol, openOrder, openDynamicScreen, openCommunityPost, openCommunityProfile, openSupportTicket } = h
  return (
        <ScreenRouter screen={screen} routes={{
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
        {screen === 'quant' && <MaisonQuantScreen key={routeQuery} />}
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
        {screen === 'community-messages' && <DmInboxScreen />}
        {screen === 'community-thread' && <DmThreadScreen key={routeParams.id} id={routeParams.id ?? null} />}
        {screen === 'community-profile' && <CommunityProfileScreen key={communityHandle} handle={communityHandle} go={go} openPost={openCommunityPost} isGuest={sessionMode === 'guest'} />}
        {screen === 'invite-landing' && <InviteLanding go={go} />}
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
        </ScreenRouter>
  )
}
