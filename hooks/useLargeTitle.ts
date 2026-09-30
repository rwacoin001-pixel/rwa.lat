'use client'
import { useEffect, useState } from 'react'

/**
 * iOS large-title handoff: while the page's own visible h1 is on screen the bar keeps its title quiet,
 * and the small title fades in once the h1 scrolls under the bar. Pages without a visible h1 report false.
 */
export function useLargeTitle(key: unknown) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let observer: IntersectionObserver | null = null
    let tries = 0
    let timer = 0
    const attach = () => {
      const heading = [...document.querySelectorAll<HTMLElement>('.rwa-mobile h1')].find((node) => !node.closest('.rwa-topbar') && node.offsetHeight >= 16)
      if (!heading) { if (tries++ < 8) timer = window.setTimeout(attach, 150); else setVisible(false); return }
      // The bar covers roughly the first 64px; the handoff happens as the heading slides beneath it.
      observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px' })
      observer.observe(heading)
    }
    attach()
    return () => { window.clearTimeout(timer); observer?.disconnect() }
  }, [key])
  return visible
}
