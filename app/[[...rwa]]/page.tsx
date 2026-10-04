import { notFound } from 'next/navigation'
import RwaH5 from '@/components/rwa-app-entry'
import { screenForSegments } from '@/lib/rwa-routes'
import { screenForV2Query, screenForV2Segments } from '@/lib/routes-v2-adapter'
import { resolveRoute } from '@/lib/routes-v2'

type RoutePageProps = {
  params: Promise<{ rwa?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
