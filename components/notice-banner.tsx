'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Info, X } from 'lucide-react'

const storageKey = (id: string) => `rwa:notice-dismissed:${id}`

/** In-app notice shown until the user closes it; the dismissal is remembered per `id` on this device. */
export default function NoticeBanner({ id, title, children, closeLabel }: { id: string; title?: string; children: ReactNode; closeLabel: string }) {
  // Hidden until the stored dismissal is read, so a dismissed notice never flashes on load.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    try { setVisible(window.localStorage.getItem(storageKey(id)) !== '1') } catch { setVisible(true) }
  }, [id])
  if (!visible) return null
  const dismiss = () => {
    setVisible(false)
    try { window.localStorage.setItem(storageKey(id), '1') } catch { /* private mode: closes for this visit only */ }
  }
  return <div className="notice-banner" role="status">
    <Info size={17} aria-hidden />
    <div>{title && <b>{title}</b>}<p>{children}</p></div>
    <button type="button" aria-label={closeLabel} onClick={dismiss}><X size={15} /></button>
  </div>
}
