'use client'
import { useEffect } from 'react'
import { PALETTE_A_MEDIA } from '@/lib/palette-media'

/**
 * Palette A preview only (html[data-palette='a'], see lib/document-preferences-bootstrap.ts): swaps the warm artwork
 * for the cool-white / green set without touching any screen. Everyone else never runs past the first check.
 * CSS background images are swapped in their own modules; this covers <img> src / srcset.
 */
export default function PaletteMedia() {
  useEffect(() => {
    if (document.documentElement.dataset.palette !== 'a') return
    // Plain paths, and the encoded ones inside next/image's /_next/image?url=… sources.
    const swap = (value: string) => value
      .replace(/\/media\/[^\s,?&"']+/g, path => PALETTE_A_MEDIA[path] ?? path)
      .replace(/%2Fmedia%2F[^\s,&"']+/gi, encoded => {
        const next = PALETTE_A_MEDIA[decodeURIComponent(encoded)]
        return next ? encodeURIComponent(next) : encoded
      })
    const fix = (img: HTMLImageElement) => {
      for (const attr of ['src', 'srcset'] as const) {
        const value = img.getAttribute(attr)
        if (!value || !/\/media\/|%2Fmedia%2F/i.test(value)) continue
        const next = swap(value)
        if (next !== value) img.setAttribute(attr, next)
      }
      // The new set keeps its subject in the right-hand part of the frame (the left is left quiet for text).
      if (/palette-a/.test(img.getAttribute('src') ?? '') && img.style.objectPosition !== '72% 50%') img.style.objectPosition = '72% 50%'
    }
    const scan = (root: ParentNode) => root.querySelectorAll('img').forEach(fix)
    scan(document)
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLImageElement) fix(record.target)
        record.addedNodes.forEach(node => {
          if (node instanceof HTMLImageElement) fix(node)
          else if (node instanceof Element) scan(node)
        })
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'style'] })
    return () => observer.disconnect()
  }, [])
  return null
}
