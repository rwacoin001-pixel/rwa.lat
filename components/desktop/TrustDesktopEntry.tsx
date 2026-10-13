'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DESKTOP_MEDIA_QUERY, DESKTOP_REDIRECT_URL } from '@/lib/desktop-redirect'

export function phonePath(raw: string | null) {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/home'
  try {
    const base = 'https://a-reit.com'
    const url = new URL(raw, base)
    if (url.origin !== base || /^\/desktop(?:\/|$)/.test(url.pathname)) return '/home'
    return url.pathname + url.search + url.hash
  } catch { return '/home' }
}

export default function TrustDesktopEntry() {
  const router = useRouter()
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const update = () => {
      if (!media.matches) {
        router.replace(phonePath(new URLSearchParams(window.location.search).get('from')))
      } else if (window.top === window.self) {
        window.location.replace(DESKTOP_REDIRECT_URL)
      }
    }
    update()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    media.addListener(update)
    return () => media.removeListener(update)
  }, [router])
  return null
}
