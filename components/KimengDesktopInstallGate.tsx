'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useState } from 'react'
import { readSession, SESSION_CHANGED } from '@/lib/api/_http'
import { DESKTOP_INSTALL_KEY, useKimengDesktop } from '@/lib/kimeng-desktop'

const Guide = dynamic(() => import('./KimengDesktopInstall'), { ssr: false })
const AUTH = /^\/(?:login|register|verify-email|recovery|auth)(?:\/|$)/

export default function KimengDesktopInstallGate() {
  const desktop = useKimengDesktop()
  const path = usePathname()
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!desktop) { setOpen(false); return }
    function sync(fresh = false) {
      const session = readSession()
      try {
        if (!session) {
          sessionStorage.removeItem(DESKTOP_INSTALL_KEY)
          setOpen(false)
          return
        }
        if (AUTH.test(path)) {
          setOpen(false)
          if (fresh && !sessionStorage.getItem('rwa.return-to')?.startsWith('/app-login')) {
            sessionStorage.setItem(DESKTOP_INSTALL_KEY, session.loggedInAt)
          }
          return
        }
        if (sessionStorage.getItem(DESKTOP_INSTALL_KEY) === session.loggedInAt) {
          sessionStorage.removeItem(DESKTOP_INSTALL_KEY)
          setOpen(true)
        }
      } catch { /* The optional guide never blocks successful authentication. */ }
    }
    sync()
    const onSession = () => sync(true)
    window.addEventListener(SESSION_CHANGED, onSession)
    return () => window.removeEventListener(SESSION_CHANGED, onSession)
  }, [desktop, path])

  return desktop && open && !AUTH.test(path) ? <Guide onClose={() => setOpen(false)} /> : null
}
