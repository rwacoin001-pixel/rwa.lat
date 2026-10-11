import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import RwaH5 from '@/components/rwa-app-entry'
import { screenForSegments } from '@/lib/rwa-routes'
import { screenForV2Query, screenForV2Segments } from '@/lib/routes-v2-adapter'
import { resolveRoute } from '@/lib/routes-v2'

type RoutePageProps = {
  params: Promise<{ rwa?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const privateLegacyScreens = new Set([
  'home', 'portfolio', 'wallet', 'order-review', 'order-processing', 'order-success',
  'order-partial', 'order-failed', 'order-receipt', 'order-detail', 'deposit', 'withdraw',
  'transfer', 'receive', 'wallet-success', 'activity', 'asset-detail', 'position-detail',
  'address-book', 'ai-plan', 'notifications', 'kyc', 'eligibility', 'risk-profile',
  'security', 'referral', 'records', 'support', 'support-new', 'support-ticket', 'settings',
  'marketing', 'close-account', 'secondary', 'yield-calendar', 'rebalance', 'statements',
  'recurring', 'my-predictions', 'basket-subscribe', 'basket-redeem',
])

export async function generateMetadata({ params }: Pick<RoutePageProps, 'params'>): Promise<Metadata> {
  const { rwa = [] } = await params
  const pathname = '/' + rwa.join('/')
  const routeRequiresSession = resolveRoute(pathname)?.def.auth === 'required'
  const legacyScreenRequiresSession = privateLegacyScreens.has(screenForSegments(rwa) ?? '')

  return routeRequiresSession || legacyScreenRequiresSession
    ? { robots: { index: false, follow: false } }
    : {}
}

export default async function RoutePage({ params, searchParams }: RoutePageProps) {
  const { rwa } = await params
  const search = await searchParams
  const pathname = '/' + (rwa ?? []).join('/')
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value) && value.length) query.set(key, value[0])
  }
  // 旧路由优先（现有行为不变）；v2 新路径（/markets /assets /asset/:slug …）走适配器。
  const baseScreen = screenForSegments(rwa) ?? screenForV2Segments(rwa)
  const screen = baseScreen ? screenForV2Query(pathname, query, baseScreen) : null

  if (!screen) notFound()

  return <RwaH5 initialScreen={screen} initialParams={resolveRoute(pathname)?.params ?? {}} initialQuery={query.toString()} initialPath={pathname} />
}
