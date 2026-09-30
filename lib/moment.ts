'use client'

// Key-moment feedback (yield credited, order filled): a short haptic and one highlight sweep across the surface.
// The sweep is a transient child so it never fights the surface's own ::before / ::after layers.
const SHEEN = 'm-sheen'

export function playMoment(node: HTMLElement | null, kind: 'success' | 'credit' = 'success') {
  if (!node || typeof window === 'undefined') return
  navigator.vibrate?.(kind === 'credit' ? [10, 60, 18] : [14])
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  node.querySelector(`:scope > .${SHEEN}`)?.remove()
  const sheen = document.createElement('i')
  sheen.className = SHEEN
  sheen.setAttribute('aria-hidden', 'true')
  sheen.addEventListener('animationend', () => sheen.remove(), { once: true })
  node.appendChild(sheen)
}
