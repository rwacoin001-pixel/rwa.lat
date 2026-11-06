'use client'

import { useSyncExternalStore } from 'react'
import { BRAND } from './brand/build-brand'

const DESKTOP = '(min-width: 761px) and (pointer: fine) and (display-mode: browser)'
export const DESKTOP_INSTALL_KEY = 'kimeng.desktop-install'

function desktopSnapshot() {
  return BRAND.id === 'kimeng' && window.matchMedia(DESKTOP).matches &&
    !/Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent) &&
    !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
}

function subscribe(listener: () => void) {
  if (BRAND.id !== 'kimeng') return () => {}
  const media = window.matchMedia(DESKTOP)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export function useKimengDesktop() {
  return useSyncExternalStore(subscribe, desktopSnapshot, () => false)
}
