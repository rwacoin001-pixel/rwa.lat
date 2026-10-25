'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { paletteAColors, themeColors } from '@/lib/document-preferences-bootstrap'

/** A full-bleed media band (e.g. the home hero) under the top edge lends the status bar its `--chrome-color`. */
function mediaChromeColor() {
  for (const element of document.querySelectorAll<HTMLElement>('[data-chrome]')) {
    const rect = element.getBoundingClientRect()
    if (rect.top > 160 || rect.bottom < 24) continue
    const color = getComputedStyle(element).getPropertyValue('--chrome-color').trim()
    if (color) return color
  }
  return ''
}

export default function PageChrome() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    let frame = 0
    let pageColor = ''
    let statusColor = ''
    let onAuth = false
    const writeStatus = (color: string) => {
      if (color === statusColor) return
      statusColor = color
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => { meta.content = color; meta.removeAttribute('media') })
    }
    const update = () => {
      frame = 0
      const root = document.documentElement
      if (/RwaLatAndroidTrial\//.test(navigator.userAgent)) root.dataset.nativeApp = 'android'
      // A full-screen guide over the page owns the top edge: its own colour for the bar and the page behind it.
      const guide = document.querySelector<HTMLElement>('[data-guide-chrome]')?.dataset.guideChrome
      if (guide) {
        if (guide !== pageColor) { pageColor = guide; root.style.setProperty('--page-chrome-color', guide); root.style.backgroundColor = guide; document.body.style.backgroundColor = guide }
        onAuth = true
        writeStatus(guide)
        return
      }
      const auth = document.querySelector<HTMLElement>('[data-auth-theme]')
      onAuth = Boolean(auth)
      const page = auth ?? document.querySelector<HTMLElement>('[data-maison-page]:not([data-maison-page="welcome"]), .rwa-mobile .screen, main:not(.rwa-shell):not([data-app-loading])')
      let color = auth ? getComputedStyle(auth).getPropertyValue('--auth-bg').trim() : ''
      if (!color && page) {
        for (const element of [page.querySelector<HTMLElement>('header'), page]) {
          if (!element) continue
          const background = getComputedStyle(element).backgroundColor
          if (background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)' && !background.startsWith('rgba(')) { color = background; break }
        }
      }
      const fallback = root.dataset.palette === 'a' ? paletteAColors : themeColors
      color ||= root.dataset.theme === 'dark' ? fallback.dark : fallback.light
      if (color !== pageColor) {
        pageColor = color
        root.style.setProperty('--page-chrome-color', color)
        root.style.backgroundColor = color
        document.body.style.backgroundColor = color
      }
      writeStatus((!auth && mediaChromeColor()) || color)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    // Scrolling cannot change the page colour, only which media band sits under the status bar, so a scroll frame
    // re-reads just that (and nothing at all on pages without a media band) instead of re-styling the whole page.
    let scrollFrame = 0
    const scrolled = () => {
      scrollFrame = 0
      if (frame || onAuth || !pageColor) return
      writeStatus(mediaChromeColor() || pageColor)
    }
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(scrolled) }
    update()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-auth-theme', 'data-screen', 'data-theme', 'data-maison-page', 'data-guide-chrome', 'class'] })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('pageshow', schedule)
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame)
      window.removeEventListener('pageshow', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', onScroll)
    }
  }, [pathname])
  return null
}
