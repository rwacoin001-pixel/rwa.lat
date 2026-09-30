import type { ReactNode } from 'react'
import type { RwaScreen } from '@/lib/rwa-routes'

type Props = {
  screen: RwaScreen
  routes: Partial<Record<RwaScreen, ReactNode>>
  children?: ReactNode
}

/** Progressive adapter for screens extracted from the unified H5 state machine. */
export function ScreenRouter({ screen, routes, children }: Props) {
  return routes[screen] ?? children ?? null
}
