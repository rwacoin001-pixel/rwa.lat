'use client'

/**
 * Scroll reveal (2026-10-28, after apple.com): every content block of a page that starts below the first screen fades
 * in and rises into place as it scrolls into view. Blocks already on the first screen are left alone (they have their
 * own first-paint rise), pinned or fixed pieces are never touched, and nothing moves under "reduce motion".
 * Styles: styles/palette-a.css, [data-reveal]. Blocks that load later (lists, sections) are picked up as they appear.
 */
import { useEffect, type RefObject } from 'react'

const SKIP = /\b(stickyCta|fixedCta)\b/

export function useScrollReveal(root: RefObject<HTMLElement | null>, selector = ':scope > *') {
  useEffect(() => {
    const host = root.current
    if (!host || typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.dataset.reveal = 'in'
        io.unobserve(el)
      }
    // Any visible pixel reveals (2026-11-02): with a bottom inset, the last rows of a page that cannot scroll further
    // (the profile's sign-out key) never counted as visible and stayed invisible though tappable.
    }, { rootMargin: '0px', threshold: 0 })
    const seen = new WeakSet<Element>()
    const scan = () => {
      for (const el of host.querySelectorAll<HTMLElement>(selector)) {
        if (seen.has(el)) continue
        seen.add(el)
        if (SKIP.test(el.className)) continue
        const style = getComputedStyle(el)
        if (style.position === 'fixed' || style.position === 'sticky' || style.display === 'none') continue
        // Only what starts below the fold waits for the scroll; the first screen is already arriving.
        if (el.getBoundingClientRect().top < innerHeight * .92) continue
        el.dataset.reveal = 'pending'
        io.observe(el)
      }
    }
    // Belt and braces: some containers (the profile slides in as a panel) never get an intersection callback for their
    // last rows, so any scroll — in any scroller — and a late check also reveal what is on screen.
    const sweep = () => {
      for (const el of host.querySelectorAll<HTMLElement>('[data-reveal="pending"]')) {
        const box = el.getBoundingClientRect()
        if (box.top < innerHeight && box.bottom > 0 && box.width > 0) { el.dataset.reveal = 'in'; io.unobserve(el) }
      }
    }
    document.addEventListener('scroll', sweep, { capture: true, passive: true })
    window.addEventListener('resize', sweep)
    const late = window.setTimeout(sweep, 900)
    let frame = 0
    const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(scan) }
    // Let the first paint settle (data, fonts) before deciding what is below the fold.
    const start = window.setTimeout(scan, 120)
    const mo = new MutationObserver(later)
    mo.observe(host, { childList: true, subtree: true })
    return () => { window.clearTimeout(start); window.clearTimeout(late); cancelAnimationFrame(frame); mo.disconnect(); io.disconnect(); document.removeEventListener('scroll', sweep, { capture: true }); window.removeEventListener('resize', sweep) }
  }, [root, selector])
}
