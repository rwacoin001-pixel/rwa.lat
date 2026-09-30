export type RwaScreen =
  | 'welcome' | 'login' | 'register' | 'verify-email' | 'recovery'
  | 'home' | 'invest' | 'portfolio' | 'wallet' | 'ai' | 'profile'
  | 'basket-list' | 'basket-detail' | 'basket-subscribe' | 'basket-redeem' | 'basket-disclosures' | 'basket-recommend' | 'strategy-detail'
  | 'rwa-detail' | 'compute-detail' | 'stock-detail' | 'prediction-detail'
  | 'order-review' | 'order-processing' | 'order-success' | 'order-partial' | 'order-failed' | 'order-receipt' | 'order-detail'
  | 'deposit' | 'withdraw' | 'transfer' | 'receive' | 'wallet-success' | 'activity' | 'asset-detail' | 'position-detail' | 'address-book'
  | 'ai-plan' | 'notifications' | 'kyc' | 'eligibility' | 'risk-profile' | 'security' | 'referral' | 'records' | 'support' | 'support-new' | 'support-ticket' | 'fees' | 'settings' | 'marketing' | 'official-channels' | 'scam-report' | 'close-account'
  | 'trust-center' | 'access-regions' | 'product-disclosures' | 'legal-center' | 'status' | 'disclosures' | 'secondary' | 'trade'
  | 'community' | 'community-post' | 'community-profile' | 'learn' | 'learn-article'
  | 'share-landing'
  | 'onboarding-overview' | 'valuation' | 'issuer-profile' | 'issuers' | 'search' | 'yield-calendar' | 'rebalance' | 'statements' | 'recurring'

const screenPaths: Record<RwaScreen, string> = {
  welcome: '/welcome',
  login: '/login',
  register: '/register',
  'verify-email': '/verify-email',
  recovery: '/recovery',
  home: '/home',
  invest: '/invest',
  'basket-list': '/invest/baskets',
  'basket-detail': '/invest/basket',
  'basket-subscribe': '/invest/basket/subscribe',
  'basket-redeem': '/invest/basket/redeem',
  'basket-disclosures': '/invest/basket/disclosures',
  'basket-recommend': '/invest/basket/recommend',
  'strategy-detail': '/strategy',
  portfolio: '/assets',
  wallet: '/wallet',
  ai: '/ai',
  profile: '/profile',
  'rwa-detail': '/invest/rwa',
  'compute-detail': '/invest/compute',
  'stock-detail': '/invest/stocks',
  'prediction-detail': '/invest/prediction',
  'order-review': '/orders/review',
  'order-processing': '/orders/processing',
  'order-success': '/orders/success',
  'order-partial': '/orders/partial',
  'order-failed': '/orders/failed',
  'order-receipt': '/orders/receipt',
  'order-detail': '/orders/detail',
  deposit: '/wallet/deposit',
  withdraw: '/wallet/withdraw',
  transfer: '/wallet/transfer',
  receive: '/assets/cash/receive',
  'wallet-success': '/wallet/confirmation',
  activity: '/activity',
  'asset-detail': '/wallet/usdt',
  'position-detail': '/portfolio/positions',
  'address-book': '/wallet/address-book',
  'ai-plan': '/ai/plan',
  notifications: '/notifications',
  kyc: '/profile/kyc',
  eligibility: '/profile/eligibility',
  'risk-profile': '/profile/risk-profile',
  security: '/profile/security',
  referral: '/profile/referral',
  records: '/profile/records',
  support: '/profile/support',
  'support-new': '/profile/support/new',
  'support-ticket': '/profile/support/ticket',
  fees: '/fees-and-limits',
  settings: '/profile/settings',
  marketing: '/profile/marketing',
  'official-channels': '/security/official-channels',
  'scam-report': '/security/report-scam',
  'close-account': '/profile/close-account',
  'trust-center': '/trust',
  'access-regions': '/trust/access-and-regions',
  'product-disclosures': '/trust/product-disclosures',
  'legal-center': '/trust/legal',
  status: '/status',
  disclosures: '/invest/disclosures',
  secondary: '/secondary',
  trade: '/trade',
  community: '/community',
  learn: '/learn',
  'learn-article': '/learn/article',
  'community-post': '/community/post',
  'community-profile': '/community/member',
  'onboarding-overview': '/onboarding/overview',
  valuation: '/invest/valuation',
  'issuer-profile': '/issuers/current',
  issuers: '/issuers',
  search: '/search',
  'share-landing': '/share',
  'yield-calendar': '/portfolio/yield-calendar',
  rebalance: '/portfolio/rebalance',
  statements: '/statements',
  recurring: '/assets/recurring',
}

const pathScreens = new Map(Object.entries(screenPaths).map(([screen, path]) => [path, screen as RwaScreen]))
// Legacy alias: the assets tab moved from /portfolio to /assets; old links keep working.
pathScreens.set('/portfolio', 'portfolio')

export function pathForScreen(screen: RwaScreen) {
  return screenPaths[screen]
}

/** Build a route whose resource identifier is supplied by the existing catalog/RWA APIs. */
export function pathForDynamicScreen(screen: 'valuation' | 'issuer-profile', slug: string) {
  const encoded = encodeURIComponent(slug)
  return screen === 'valuation' ? `/invest/${encoded}/valuation` : `/issuers/${encoded}`
}

export function screenForSegments(segments: string[] = []): RwaScreen | null {
  if (segments.length === 0) return 'welcome'
  if (segments.join('/') === 'login/email/confirm' || segments.join('/') === 'auth/email/confirm' || segments.join('/') === 'auth/verify') return 'verify-email'
  if (segments.join('/') === 'auth/recover/confirm') return 'recovery'
  if (segments.length === 3 && segments[0] === 'invest' && segments[2] === 'valuation') return 'valuation'
  if (segments.length === 2 && segments[0] === 'issuers') return 'issuer-profile'
  return pathScreens.get(`/${segments.join('/')}`) ?? null
}
