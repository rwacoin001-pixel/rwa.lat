'use client'

import { useEffect, useRef } from 'react'

/**
 * A page's own top tabs claim the side swipe first (2026-11-04, user: on 市场 a swipe must step 量化 · 预测 · 篮子 · 资产
 * before anything else; only past the last tab does the personal centre come in, and back past the first tab goes to
 * the previous dock page; 社区 the same). The page registers a stepper; the shell's swipe asks it before acting.
 * `step(1)` = next tab, `step(-1)` = previous; it returns false when there is no tab that way.
 */
type Stepper = { can: (dir: 1 | -1) => boolean; step: (dir: 1 | -1) => void }
let current: Stepper | null = null

export function pageTabs(): Stepper | null { return current }

export function usePageTabs<T>(tabs: readonly T[], value: T, onChange: (next: T) => void, enabled = true) {
  const live = useRef({ tabs, value, onChange })
  live.current = { tabs, value, onChange }
  useEffect(() => {
    if (!enabled) return
    const stepper: Stepper = {
      can: (dir) => { const { tabs, value } = live.current; const i = tabs.indexOf(value) + dir; return i >= 0 && i < tabs.length },
      step: (dir) => {
        const { tabs, value, onChange } = live.current
        const next = tabs[tabs.indexOf(value) + dir]
        if (next === undefined) return
        navigator.vibrate?.(4)
        onChange(next)
        window.scrollTo({ top: 0 })
      },
    }
    current = stepper
    return () => { if (current === stepper) current = null }
  }, [enabled])
}

/**
 * What moves with the finger (2026-11-04, user: like the personal centre, the page must not just pop — you should see
 * it change). The page marks its tab bar with `data-page-tabs`; everything after it slides, the bar stays. A swipe to
 * the previous dock page slides the bar too.
 */
export function stage(withTabs: boolean): HTMLElement[] {
  const bar = document.querySelector<HTMLElement>('.rwa-mobile [data-page-tabs]')
  if (!bar) return []
  const out: HTMLElement[] = withTabs ? [bar] : []
  for (let el = bar.nextElementSibling; el; el = el.nextElementSibling) if (el instanceof HTMLElement) out.push(el)
  return out
}

const EASE = 'cubic-bezier(.22, 1, .36, 1)'
export function place(els: HTMLElement[], x: number, ms = 0) {
  const fade = Math.min(1, Math.abs(x) / Math.max(1, window.innerWidth))
  for (const el of els) {
    el.style.transition = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
    el.style.opacity = x ? String(1 - fade * .35) : ''
  }
}
export function clear(els: HTMLElement[]) {
  for (const el of els) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = '' }
}

/** Finish a tab swipe: the old tab leaves the way the finger went, the new one comes in from the other side. */
export function slideTab(els: HTMLElement[], x: number, step: () => void) {
  const width = window.innerWidth, out = Math.sign(x) * width
  place(els, out, 170)
  window.setTimeout(() => {
    step()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clear(els)
      const next = stage(false)
      place(next, -out * .45)
      void next[0]?.offsetWidth
      place(next, 0, 300)
      window.setTimeout(() => clear(next), 320)
    }))
  }, 170)
}

/** Settle back when the swipe was too short. */
export function settle(els: HTMLElement[]) {
  place(els, 0, 220)
  window.setTimeout(() => clear(els), 240)
}
