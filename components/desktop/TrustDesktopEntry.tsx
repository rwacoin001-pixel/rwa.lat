'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// No imagery or scene bundle is requested until this device passes the desktop gate.
const TrustDesktop = dynamic(() => import('./TrustDesktop'), { ssr: false })

export function phonePath(raw: string | null) {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/home'
  try {
    const base = 'https://rwa.lat'
    const url = new URL(raw, base)
    if (url.origin !== base || /^\/desktop(?:\/|$)/.test(url.pathname)) return '/home'
    return url.pathname + url.search + url.hash
  } catch { return '/home' }
}

export default function TrustDesktopEntry() {
  const router = useRouter()
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
    const mobileDevice = /iPad|Android|Mobi/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    const update = () => {
      if (!media.matches || mobileDevice) {
        setDesktop(false)
        router.replace(phonePath(new URLSearchParams(window.location.search).get('from')))
      } else setDesktop(true)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [router])
  return desktop ? <TrustDesktop /> : null
}
