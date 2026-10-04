'use client'

import { useEffect, useState } from 'react'
import { predictionEndAt, type PredictionLifecycle } from './prediction-lifecycle'

/** Wake at the next real deadline; a resumed PWA immediately drops expired cached cards. */
export function usePredictionExpiryClock(items: readonly PredictionLifecycle[]) {
  const [now, setNow] = useState(() => Date.now())
  const deadlines = items.map(predictionEndAt).filter((value): value is string => value !== null).join('|')
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const next = deadlines.split('|').map(Date.parse).filter(time => time > now).reduce((minimum, time) => Math.min(minimum, time), Infinity)
    const timer = Number.isFinite(next) ? setTimeout(refresh, Math.min(2_147_000_000, Math.max(1, next - Date.now() + 1))) : undefined
    window.addEventListener('focus', refresh)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [deadlines, now])
  return now
}
