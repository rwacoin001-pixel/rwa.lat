'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { marketCopy } from '@/lib/maison-market-copy'
import { maison as s } from './primitives'

/** Pull distance (px) past which releasing the grip dismisses the sheet; shorter pulls spring back. */
const DISMISS_AT = 80

/**
 * The one bottom sheet: grip, kicker + title, 44px ✕, drag-down to dismiss. The drag follows the finger with a
 * transform only; the popup's own transition takes over on release, so it either settles back or leaves.
 * Portals into the Maison page so theme tokens and fonts are inherited.
 */
export function Sheet({ open, onClose, title, kicker, description, busy = false, className, children, ...data }: {
  open: boolean; onClose: () => void; title: ReactNode; kicker?: ReactNode; description?: ReactNode; busy?: boolean; className?: string; children: ReactNode
} & { [key: `data-${string}`]: string | undefined }) {
  const { locale } = useI18n()
  const anchor = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useEffect(() => setContainer(anchor.current?.closest<HTMLElement>('[data-maison-page]') ?? null), [])

  const pull = (y: number | null) => {
    const node = popup.current
    if (!node) return
    if (y === null) { node.removeAttribute('data-dragging'); node.style.transform = ''; return }
    node.setAttribute('data-dragging', '')
    node.style.transform = `translateY(${Math.max(0, y)}px)`
  }
  const grab = (event: TouchEvent) => { if (!busy) start.current = event.touches[0].clientY }
  const drag = (event: TouchEvent) => { if (start.current !== null) pull(event.touches[0].clientY - start.current) }
  const release = (event: TouchEvent) => {
    if (start.current === null) return
    const distance = event.changedTouches[0].clientY - start.current
    start.current = null
    pull(null)
    if (distance > DISMISS_AT) onClose()
  }

  return <>
    <span ref={anchor} hidden />
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={s.sheetBackdrop} />
        <Dialog.Popup ref={popup} className={`${s.sheet}${className ? ` ${className}` : ''}`} data-sheet="" aria-busy={busy || undefined} {...data}>
          <div className={s.sheetGripArea} onTouchStart={grab} onTouchMove={drag} onTouchEnd={release} onTouchCancel={release}><i className={s.sheetGrip} aria-hidden="true" /></div>
          <Dialog.Close className={s.sheetClose} disabled={busy} aria-label={marketCopy[locale].common.close}><X size={20} aria-hidden="true" /></Dialog.Close>
          <header className={s.sheetHeader}>
            {kicker && <p className={s.kicker}>{kicker}</p>}
            <Dialog.Title className={s.sheetTitle}>{title}</Dialog.Title>
            {description && <Dialog.Description className={s.muted} style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5 }}>{description}</Dialog.Description>}
          </header>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
