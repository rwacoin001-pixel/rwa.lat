'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV === 'development') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      return
    }

    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined)
  }, [])

  return null
}
