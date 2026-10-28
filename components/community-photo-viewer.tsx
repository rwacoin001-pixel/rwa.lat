'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import v from './community-photo-viewer.module.css'

/**
 * Photo viewer (2026-10-28, after the "photo drawer" reference): a post's photos full screen on black. Swipe sideways
 * between them (native scroll snap), double-tap to look closer (2×, then drag to pan), tap the dark or ✕ — or the
 * system back — to return to the feed where it was. The count shows where you are.
 */
export function PhotoViewer({ images, start, label, onClose }: { images: string[]; start: number; label: { close: string; photo: string }; onClose: () => void }) {
  const strip = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const [zoomed, setZoomed] = useState<number | null>(null)
  const lastTap = useRef(0)

  // Back closes the viewer: one history entry while it is open.
  useEffect(() => {
    window.history.pushState({ ...window.history.state, rwaPhoto: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const root = document.documentElement
    root.dataset.photoOpen = 'true'
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); delete root.dataset.photoOpen; root.style.overflow = overflow }
  }, [])
  const close = () => { if (window.history.state?.rwaPhoto) window.history.back(); else onClose() }

  useEffect(() => { const el = strip.current; if (el) el.scrollLeft = start * el.clientWidth }, [start])
  const onScroll = () => { const el = strip.current; if (!el) return; const next = Math.round(el.scrollLeft / el.clientWidth); if (next !== index) { setIndex(next); setZoomed(null) } }
  const onTap = (i: number) => {
    const now = Date.now()
    if (now - lastTap.current < 300) { setZoomed(zoomed === i ? null : i); lastTap.current = 0; return }
    lastTap.current = now
  }

  return createPortal(<div className={v.layer} role="dialog" aria-modal="true" aria-label={label.photo}>
    <div ref={strip} className={v.strip} onScroll={onScroll} data-locked={zoomed !== null || undefined}>
      {images.map((src, i) => <div key={src} className={v.slide} data-zoomed={zoomed === i || undefined} onClick={(event) => { if (event.target === event.currentTarget && zoomed === null) close() }}>
        <img src={src} alt="" decoding="async" draggable={false} onClick={() => onTap(i)} />
      </div>)}
    </div>
    <div className={v.bar}>
      {images.length > 1 ? <span aria-live="polite">{index + 1} / {images.length}</span> : <span />}
      <button type="button" aria-label={label.close} onClick={close}><X size={22} strokeWidth={2} /></button>
    </div>
  </div>, document.body)
}
