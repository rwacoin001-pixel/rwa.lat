'use client'

import { BRAND } from './brand/build-brand'

/**
 * Warm the screens people open next (2026-11-04, user: page changes felt like a website). Every screen is a lazy chunk,
 * so the first visit to Markets or a product waited for a download and showed a blank or loader mid-transition. After
 * the first screen settles, while the phone is idle, these chunks load one by one; next/dynamic then finds them cached.
 * Skipped on Save-Data and 2G.
 */
const NEXT = [
  () => import('@/components/maison/MarketsScreen'),
  () => import('@/components/community-screens'),
  () => import('@/components/maison/PortfolioScreen'),
  () => import('@/components/maison/QuantScreen'),
  () => import('@/components/maison/PredictionScreen'),
  () => import('@/components/maison/BasketScreen'),
  () => import('@/components/maison/HengxuScreen'),
  () => import('@/components/maison/AssetDetailScreen'),
  () => import('@/components/maison/CashScreen'),
  () => import('@/components/maison/AccountScreen'),
]

let started = false
export function prefetchScreens() {
  if (started || typeof window === 'undefined') return
  started = true
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return
  const idle = (work: () => void) => { if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(work, { timeout: 4000 }); else setTimeout(work, 600) }
  let index = 0
  const step = () => {
    const load = NEXT[index++]
    if (!load) return
    void load().catch(() => { /* a failed warm-up is retried by the real navigation */ }).finally(() => idle(step))
  }
  window.setTimeout(() => idle(step), 1500)
  // The iPhone Home Screen app keeps the build's pack on the phone (public/sw.js WARM_PACK); the Android client
  // already ships it in the APK, and a browser tab is not worth 25 MB.
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches
  if (BRAND.id === 'areit' && standalone && !navigator.userAgent.includes('RwaLatAndroidTrial/') && 'serviceWorker' in navigator) {
    window.setTimeout(() => idle(() => { void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: 'WARM_PACK' })).catch(() => {}) }), 6000)
  }
}
