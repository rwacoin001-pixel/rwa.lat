/**
 * lib/routes-v2-adapter.ts — v2 路径 → 现有 screen 适配器（S1 壳搬家过渡层）
 *
 * 作用：让批次 4 上线的**新路径**（/markets /assets /asset/:slug …）能够
 * 立即渲染现有组件，而无需等批次 6 的完整壳改造。
 *
 * 生命周期：批次 6（旧页面壳搬家）完成后，本文件退役——届时所有页面
 * 直接按 routes-v2 的路由树渲染，不再映射回旧 screen。
 */
import { resolveRoute, type RouteKey } from './routes-v2'
import type { RwaScreen } from './rwa-routes'

/** 新路由 key → 现有 screen（只列有对应关系的·未列的返回 null） */
const KEY_TO_SCREEN: Partial<Record<RouteKey, RwaScreen>> = {
  // Tab1 首页域
  home: 'home',
  search: 'search',
  notifications: 'notifications',
  community: 'community',
  communityPost: 'community-post',
  communityMember: 'community-profile',

  // Tab2 市场
  markets: 'invest',
  assetDetail: 'rwa-detail',
  basketDetail: 'basket-detail',
  strategyDetail: 'strategy-detail',
  basketOrder: 'basket-subscribe',
  trade: 'trade',
  predictionDetail: 'prediction-detail',
  issuers: 'issuers',
  issuerProfile: 'issuer-profile',
  planNew: 'ai-plan',
  compare: 'rwa-detail',

  // Tab3 AI
  ai: 'ai',
  aiPlan: 'ai-plan',

  // Tab4 资产
  assets: 'portfolio',
  positionDetail: 'position-detail',
  cashHub: 'wallet',
  cashDeposit: 'deposit',
  cashWithdraw: 'withdraw',
  cashTransfer: 'transfer',
  cashReceive: 'receive',
  addressBook: 'address-book',
  activity: 'activity',
  statements: 'statements',
  yieldCalendar: 'yield-calendar',
  rebalance: 'rebalance',
  recurring: 'recurring',
  orderReview: 'order-review',
  orderStatus: 'order-processing',
  orderDetail: 'order-detail',

  // Tab5 我的
  profile: 'profile',
  verification: 'kyc',
  kyc: 'kyc',
  eligibility: 'eligibility',
  riskProfile: 'risk-profile',
  security: 'security',
  referral: 'referral',
  documents: 'records',
  support: 'support',
  supportNew: 'support-new',
  supportTicket: 'support-ticket',
  settings: 'settings',
  closeAccount: 'close-account',
  feesAndLimits: 'fees',
  trust: 'trust-center',
  trustAccess: 'access-regions',
  trustDisclosures: 'product-disclosures',
  trustLegal: 'legal-center',
  trustStatus: 'status',
  trustChannels: 'official-channels',
  trustScam: 'scam-report',
  trustReserves: 'trust-center',

  // L0 公开
  welcome: 'welcome',
  login: 'login',
  register: 'register',
  verifyEmail: 'verify-email',
  recovery: 'recovery',
  onboarding: 'onboarding-overview',

  // 新增页（尚未实现·临时落点避免 404·批次 6 建真页）
  learn: 'learn',
  learnArticle: 'learn-article',
  aiGoals: 'ai-plan',

  // 系统
  shareLanding: 'share-landing',
  notificationLink: 'notifications',
  maintenance: 'status',
}

/**
 * 把 catch-all 的路径段按 v2 路由树解析成现有 screen。
 * 无命中（不是 v2 路径）返回 null——调用方回落到旧的 screenForSegments。
 */
export function screenForV2Segments(segments: string[] | undefined): RwaScreen | null {
  if (!segments || segments.length === 0) return null
  const pathname = '/' + segments.join('/')
  const hit = resolveRoute(pathname)
  if (!hit) return null
  return KEY_TO_SCREEN[hit.key] ?? null
}

/** 保留旧 screen 壳时，让迁移目标的 tab/section 指向实际业务屏。 */
export function screenForV2Query(pathname: string, query: URLSearchParams, baseScreen: RwaScreen): RwaScreen {
  if (pathname === '/markets') {
    if (query.get('tab') === 'baskets') return 'basket-list'
    if (query.get('tab') === 'trade' && query.get('legacy') === 'secondary') return 'secondary'
    if (query.get('tab') === 'trade') return 'trade'
  }
  if (pathname === '/assets') {
    if (query.get('tab') === 'cash') return 'wallet'
    if (query.get('tab') === 'activity') return 'activity'
  }
  if (pathname === '/profile/settings' && query.get('section') === 'marketing') return 'marketing'
  const hit = resolveRoute(pathname)
  if (hit?.key === 'basketOrder' && query.get('side') === 'redeem') return 'basket-redeem'
  if (hit?.key === 'basketDetail' && query.get('tab') === 'disclosures') return 'basket-disclosures'
  if (hit?.key === 'assetDetail' && query.get('tab') === 'valuation') return 'valuation'
  return baseScreen
}
