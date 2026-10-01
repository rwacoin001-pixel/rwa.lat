'use client'
import { useLayoutEffect, useRef } from 'react'

let captured: HTMLElement | null = null
/** A non-interactive visual copy of the page at the moment its wallet sheet opens. */
export function captureWalletBackdrop() {
  const page = document.querySelector<HTMLElement>('.rwa-mobile')
  if (!page || page.dataset.sheet === 'true') return
  captured = page.cloneNode(true) as HTMLElement
  captured.dataset.sheet = 'false'
  captured.setAttribute('aria-hidden', 'true')
  captured.inert = true
  captured.removeAttribute('id')
  captured.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
  captured.querySelectorAll('[data-maison-page]').forEach(node => node.removeAttribute('data-maison-page'))
  captured.style.transform = `translateY(${-window.scrollY}px)`
}
export function WalletPageBackdrop() {
  const host = useRef<HTMLDivElement>(null)
  const snapshot = useRef(captured)
  useLayoutEffect(() => {
    if (snapshot.current) host.current?.append(snapshot.current)
    return () => { host.current?.replaceChildren(); captured = null }
  }, [])
  return <div ref={host} className="wallet-page-backdrop" aria-hidden="true" inert />
}
