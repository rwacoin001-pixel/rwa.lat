'use client'

import { useEffect } from 'react'
import { BRAND, IS_BRAND_PREVIEW } from '@/lib/brand/build-brand'
import { isAndroidApp } from '@/lib/android-app'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Protected previews must not keep offline pages after the access gate is closed.
    if (IS_BRAND_PREVIEW) return

    if (process.env.NODE_ENV === 'development') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      return
    }

    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => undefined)

    if (BRAND.id !== 'kimeng' || isAndroidApp()) return
    const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    if (!installed) return
    const warm = () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return
      void navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'WARM_PACK' })).catch(() => undefined)
    }
    const timer = window.setTimeout(warm, 6000)
    window.addEventListener('online', warm)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', warm)
    }
  }, [])

  return null
}
