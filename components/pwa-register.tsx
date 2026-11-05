'use client'

import { useEffect } from 'react'
import { IS_BRAND_PREVIEW } from '@/lib/brand/build-brand'

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
  }, [])

  return null
}
