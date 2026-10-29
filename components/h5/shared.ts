import type { RwaScreen as Screen } from '@/lib/rwa-routes'
import { resolveRoute } from '@/lib/routes-v2'
import { isOrderableId } from '@/lib/api/markets'
import type { DemoProduct } from '@/lib/h5-data'

export type OrderAsset = 'compute' | 'rwa' | 'stocks' | 'prediction'
export type PrimaryScreen = 'home' | 'invest' | 'quant' | 'portfolio' | 'wallet' | 'community'

export const PROFILE_SECTION_SCREENS = new Set<Screen>([
  'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket',
  'fees', 'settings', 'marketing', 'official-channels', 'scam-report', 'close-account', 'trust-center',
  'access-regions', 'product-disclosures', 'legal-center', 'status',
])

export const protectedScreens: Screen[] = ['home', 'portfolio', 'wallet', 'order-review', 'order-processing', 'order-success', 'order-partial', 'order-failed', 'order-receipt', 'order-detail', 'deposit', 'withdraw', 'transfer', 'receive', 'wallet-success', 'activity', 'asset-detail', 'position-detail', 'address-book', 'ai-plan', 'notifications', 'kyc', 'eligibility', 'risk-profile', 'security', 'referral', 'records', 'support', 'support-new', 'support-ticket', 'settings', 'marketing', 'close-account', 'secondary', 'yield-calendar', 'rebalance', 'statements', 'recurring', 'my-predictions', 'community-messages', 'community-thread', 'basket-subscribe', 'basket-redeem']
export const routeRequiresAuth = (pathname: string) => resolveRoute(pathname)?.def.auth === 'required'

/** Slug for the Maison asset page: RWA directory rows carry `rwa-<slug>`, catalog listings a UUID. */
export function maisonSlug(product: DemoProduct) {
  if (product.id.startsWith('rwa-')) return product.id.slice(4)
  return isOrderableId(product.id) ? product.id : null
}
