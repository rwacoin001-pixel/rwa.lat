import { flushSync } from 'react-dom'

// Warm/cool switch: the new theme spreads as a circle from the tapped button (View Transitions); instant where unsupported or with reduced motion.
export function revealTheme(toggle: () => void, next: 'light' | 'dark', event?: { clientX: number; clientY: number; currentTarget: Element }) {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> } }
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { toggle(); return }
  const root = document.documentElement
  const box = event?.currentTarget.getBoundingClientRect()
  const x = box ? box.left + box.width / 2 : event?.clientX ?? innerWidth
  const y = box ? box.top + box.height / 2 : event?.clientY ?? 0
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  root.dataset.themeReveal = ''
  const transition = doc.startViewTransition(() => {
    flushSync(toggle)
    // The provider mirrors the theme onto <html> in an effect; set it now so the new snapshot is complete.
    root.dataset.theme = next
    root.style.colorScheme = next
  })
  transition.ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 680, easing: 'cubic-bezier(.22, .8, .18, 1)', fill: 'forwards', pseudoElement: '::view-transition-new(root)' })
  }).catch(() => undefined)
  // Clear the flag only once the pseudo layers are gone; clearing it earlier lets the default cross-fade replay for a frame.
  transition.finished.finally(() => { delete root.dataset.themeReveal })
}
