'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { kimengDesktopDestination } from '@/lib/brand/phone-access.mjs'

export default function KimengPhoneAccess({ phone, children }: { phone: boolean; children: ReactNode }) {
  const path = usePathname()
  const destination = phone ? null : kimengDesktopDestination(path)
  useEffect(() => {
    if (destination) window.location.replace(destination)
  }, [destination])
  return destination ? null : children
}
