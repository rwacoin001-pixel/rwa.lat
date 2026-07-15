export type RwaScreen =
  | 'welcome' | 'login' | 'register' | 'verify-email' | 'recovery'
  | 'home' | 'invest' | 'portfolio' | 'wallet' | 'ai' | 'profile'
  | 'rwa-detail' | 'compute-detail' | 'stock-detail' | 'prediction-detail'
  | 'order-review' | 'order-processing' | 'order-success' | 'order-partial' | 'order-failed' | 'order-receipt'
  | 'deposit' | 'withdraw' | 'transfer' | 'wallet-success' | 'activity' | 'asset-detail' | 'position-detail'
  | 'ai-plan' | 'notifications' | 'kyc' | 'security' | 'referral' | 'records' | 'support' | 'settings' | 'marketing' | 'official-channels' | 'scam-report' | 'close-account'
  | 'trust-center' | 'access-regions' | 'product-disclosures' | 'legal-center'

const screenPaths: Record<RwaScreen, string> = {
  welcome: '/welcome',
  login: '/login',
  register: '/register',
  'verify-email': '/verify-email',
  recovery: '/recovery',
  home: '/home',
  invest: '/invest',
  portfolio: '/portfolio',
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
  deposit: '/wallet/deposit',
  withdraw: '/wallet/withdraw',
  transfer: '/wallet/transfer',
  'wallet-success': '/wallet/confirmation',
  activity: '/activity',
  'asset-detail': '/wallet/usdt',
  'position-detail': '/portfolio/positions',
  'ai-plan': '/ai/plan',
  notifications: '/notifications',
  kyc: '/profile/kyc',
  security: '/profile/security',
  referral: '/profile/referral',
  records: '/profile/records',
  support: '/profile/support',
  settings: '/profile/settings',
  marketing: '/profile/marketing',
  'official-channels': '/security/official-channels',
  'scam-report': '/security/report-scam',
  'close-account': '/profile/close-account',
  'trust-center': '/trust',
  'access-regions': '/trust/access-and-regions',
  'product-disclosures': '/trust/product-disclosures',
  'legal-center': '/trust/legal',
}

const pathScreens = new Map(Object.entries(screenPaths).map(([screen, path]) => [path, screen as RwaScreen]))

export function pathForScreen(screen: RwaScreen) {
  return screenPaths[screen]
}

export function screenForSegments(segments: string[] = []): RwaScreen | null {
  if (segments.length === 0) return 'home'
  return pathScreens.get(`/${segments.join('/')}`) ?? null
}
