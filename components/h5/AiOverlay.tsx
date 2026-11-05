'use client'

import { brandText } from '@/lib/brand/build-brand'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { AiChatScreen } from '@/components/maison/AiChatScreen'
import { closeAi, dismissAi, syncAiWithHistory, useAiOverlay } from '@/lib/ai-overlay'
import { onBuddySignal } from '@/lib/buddy-signals'
import styles from './ai-overlay.module.css'

/**
 * The assistant as a layer over the current page (2026-10-28, docs/design-system.md §5.5). The page stays where it was,
 * blurred and dimmed behind; a soft light runs along the screen edges — calm while idle, brighter and quicker while the
 * assistant listens, thinks or answers, so the light means something. Back, Escape or the close key return to the page.
 */
export function AiOverlay() {
  const { open, context } = useAiOverlay()
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onPop = () => syncAiWithHistory()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // While open: the page underneath does not scroll; Escape closes; focus returns to where it was.
  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    root.dataset.aiOpen = 'true'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeAi() }
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = previous
      delete root.dataset.aiOpen
      window.removeEventListener('keydown', onKey)
      restoreFocus.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  // The edge light follows the assistant: listening, thinking or replying make it bright.
  useEffect(() => onBuddySignal((signal) => setActive(signal.mood === 'listening' || signal.mood === 'thinking' || signal.mood === 'replying')), [])
  useEffect(() => { if (!open) setActive(false) }, [open])

  // Following a link in an answer leaves the assistant (2026-11-01): the layer closes as the page changes.
  const followed = (event: ReactMouseEvent) => {
    const link = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
    if (!link || link.target === '_blank' || link.origin !== window.location.origin) return
    dismissAi()
  }

  if (!open) return null
  return <div className={styles.layer} role="dialog" aria-modal="true" aria-label={brandText("A-REIT AI")} data-active={active || undefined} onClick={followed}>
    <div className={styles.backdrop} data-ai-backdrop="" onClick={closeAi} aria-hidden="true" />
    <div ref={setScroller} className={styles.scroller}>
      <AiChatScreen overlay scroller={scroller} onClose={closeAi} onPlan={() => undefined} pageContext={context} />
    </div>
    <div className={styles.edge} aria-hidden="true"><i className={styles.dots} /><i className={styles.glow} /></div>
  </div>
}
