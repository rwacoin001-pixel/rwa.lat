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
