'use client'
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import x from './referral.module.css'

export type SheetTheme = 'light' | 'dark'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'

export function useHostTheme(ref: RefObject<HTMLElement | null>): SheetTheme {
  const [theme, setTheme] = useState<SheetTheme>('light')
  useEffect(() => {
    const host = ref.current?.closest('.rwa-mobile') ?? document.documentElement
    const read = () => setTheme(host.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(host, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [ref])
  return theme
}

export function ReferralSheet({ title, closeLabel, theme, inertRef, tall = false, onClose, children }: {
  title: string
  closeLabel: string
  theme: SheetTheme
  inertRef: RefObject<HTMLElement | null>
  tall?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId(), dialogRef = useRef<HTMLElement>(null), closeRef = useRef(onClose), pressedScrim = useRef(false)
  closeRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const background = inertRef.current
    const wasInert = !!background?.hasAttribute('inert')
    if (background && !wasInert) background.setAttribute('inert', '')
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.matches('summary') || !el.closest('details:not([open])'))
    ;(dialog.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0] ?? dialog).focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialog.focus(); return }
      const first = items[0], last = items[items.length - 1], active = document.activeElement
      if (!(active instanceof Node) || !dialog.contains(active)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (background && !wasInert) background.removeAttribute('inert')
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [inertRef])

  if (typeof document === 'undefined') return null
  return createPortal(
    // Portaled outside MaisonPage, so re-attach the existing Geist font variables here.
    <div className={`${x.ref} ${x.layer} ${GeistSans.variable} ${GeistMono.variable}`} data-ref-theme={theme}
      onPointerDown={event => { pressedScrim.current = event.target === event.currentTarget }}
      onClick={event => { if (pressedScrim.current && event.target === event.currentTarget) onClose(); pressedScrim.current = false }}>
      <section ref={dialogRef} className={x.sheet} data-tall={tall || undefined} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={x.handle} aria-hidden="true" />
        <div className={x.sheetTitle}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={x.iconBtn} aria-label={closeLabel} onClick={onClose}><X size={20} strokeWidth={1.75} /></button>
        </div>
        <div className={x.sheetBody}>{children}</div>
      </section>
    </div>,
    document.body,
  )
}
