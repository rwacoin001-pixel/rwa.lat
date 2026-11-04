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

/**
 * A real pager for the top tabs (2026-11-04, user: between two tabs there was a black gap). When the finger locks
 * sideways the current tab is frozen into a copy (only its content, not the bar) and the next tab is rendered at once
 * beside it; both follow the finger as one strip. Release past the threshold settles on the new tab; otherwise the
 * strip springs back and the old tab is restored under the copy (scroll position included) before the copy goes.
 * The live content's offset is a CSS variable, so content React mounts a frame later is placed too.
 */
export type TabDrag = { move: (x: number) => void; commit: () => void; cancel: () => void }
export function beginTabDrag(dir: 1 | -1, step: (dir: 1 | -1) => void, freeze: (el: HTMLElement) => HTMLElement | null): TabDrag | null {
  const live = document.querySelector<HTMLElement>('.rwa-mobile > .rwa-screen-transition:not(.rwa-snap)')
  const bar = live?.querySelector<HTMLElement>('[data-page-tabs]')
  if (!live || !bar) return null
  const scroll = window.scrollY
  const copy = freeze(live)
  if (!copy) return null
  // Walk the same path inside the copy; keep only what follows the bar, see-through everywhere else.
  const path: number[] = []
  for (let el: Element | null = bar; el && el !== live; el = el.parentElement) path.unshift(Array.prototype.indexOf.call(el.parentElement!.children, el))
  let node: Element = copy
  copy.style.background = 'transparent'
  path.forEach((index, depth) => {
    const children = Array.from(node.children) as HTMLElement[]
    children.forEach((child, i) => { if (i < index || (i > index && depth < path.length - 1)) child.style.visibility = 'hidden' })
    node = children[index]
    if (depth < path.length - 1) { (node as HTMLElement).style.background = 'transparent'; (node as HTMLElement).style.backgroundImage = 'none' }
  })
  ;(node as HTMLElement).style.visibility = 'hidden'
  copy.style.zIndex = '2'
  const width = window.innerWidth
  const sign = dir * (document.documentElement.dir === 'rtl' ? -1 : 1)
  live.dataset.tabDrag = ''
  step(dir)
  let x = 0
  const apply = (ms = 0) => {
    const ease = ms ? `transform ${ms}ms ${EASE}` : 'none'
    copy.style.transition = ease
    copy.style.transform = `translate3d(${x}px, 0, 0)`
    live.style.setProperty('--tab-t', ease)
    live.style.setProperty('--tab-x', `${x + sign * width}px`)
  }
  const end = () => { copy.remove(); delete live.dataset.tabDrag; live.style.removeProperty('--tab-x'); live.style.removeProperty('--tab-t') }
  apply()
  return {
    move: (next) => { x = next; apply() },
    commit: () => { x = -sign * width; apply(280); window.setTimeout(end, 300) },
    cancel: () => {
      x = 0; apply(240)
      window.setTimeout(() => {
        step(-dir as 1 | -1)
        requestAnimationFrame(() => requestAnimationFrame(() => { window.scrollTo(0, scroll); end() }))
        window.setTimeout(end, 400)
      }, 250)
    },
  }
}
