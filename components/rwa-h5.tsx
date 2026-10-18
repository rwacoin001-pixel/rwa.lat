'use client'
import dynamic from 'next/dynamic'
import AppLoading from '@/components/app-loading'
import type { RwaScreen } from '@/lib/rwa-routes'
import { H5Screens } from './h5/H5Screens'
import { H5Shell } from './h5/H5Shell'
import { useH5Controller, type H5Props } from './h5/useH5Controller'

export { BottomDock } from './h5/BottomDock'

const EligibilityNotice = dynamic(() => import('./eligibility-notice').then((m) => ({ default: m.EligibilityNotice })), { ssr: false })

function RwaH5Content(props: H5Props) {
  const h = useH5Controller(props)
  return <H5Shell h={h}>{h.isProtectedWaiting ? <AppLoading /> : <H5Screens h={h} />}</H5Shell>
}

export default function RwaH5({ initialScreen = 'home', initialParams = {}, initialQuery = '', initialPath = '' }: { initialScreen?: RwaScreen; initialParams?: Record<string, string>; initialQuery?: string; initialPath?: string }) {
  return <><EligibilityNotice /><RwaH5Content initialScreen={initialScreen} initialParams={initialParams} initialQuery={initialQuery} initialPath={initialPath} /></>
}
