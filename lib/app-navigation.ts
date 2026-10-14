'use client'
import { useCallback, useLayoutEffect, useRef, useState, type SetStateAction } from 'react'
import { SESSION_CHANGED, SESSION_EXPIRED } from './api/_http'
import { NavigationMemory } from './navigation-memory'

const memory = new NavigationMemory()
const MOTION_EVENT = 'rwa:navigation-motion'
let activeEntry: string | null = null
let restoring = false
const panel = () => document.querySelector<HTMLElement>('.rwa-mobile [data-maison-page]')
const entryId = () => window.history.state?.rwaEntryId ?? `initial:${window.location.pathname}`

export function captureNavigationPosition() {
  if (typeof window === 'undefined' || restoring) return
  memory.savePosition(activeEntry ?? entryId(), { x: window.scrollX, y: window.scrollY, panel: panel()?.scrollTop ?? 0 })
}

/** Call before a history write; each pushed visit has its own return position. */
export function nextNavigationState(replace = false) {
  captureNavigationPosition()
  const id = replace ? entryId() : crypto.randomUUID()
  activeEntry = id
  window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: 'enter' }))
  return { rwaNavigation: replace ? Boolean(history.state?.rwaNavigation) : true, rwaEntryId: id }
}

/** State setters persist synchronously so leaving immediately cannot lose a filter. */
export function usePageState<T>(key: string, initial: T | (() => T)) {
  const activeId = typeof window === 'undefined' ? 'server' : entryId()
  const id = useRef(activeId)
  const [value, setValue] = useState<T>(() => memory.read<T>(id.current, key) ?? (typeof initial === 'function' ? (initial as () => T)() : initial))
  const current = useRef(value)
  current.current = value
  if (id.current !== activeId) {
    id.current = activeId
    setValue(memory.read<T>(activeId, key) ?? (typeof initial === 'function' ? (initial as () => T)() : initial))
  }
  const update = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action
    current.current = next
    memory.save(id.current, key, next)
    setValue(next)
  }, [key])
  return [value, update] as const
}

export function useNavigationViewport(routeKey: string) {
  const [motion, setMotion] = useState<'enter' | 'return'>('enter')
  useLayoutEffect(() => {
    activeEntry = entryId()
    if (!history.state?.rwaEntryId) history.replaceState({ ...history.state, rwaEntryId: activeEntry }, '', window.location.href)
    const oldRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const onScroll = () => captureNavigationPosition()
    const onPop = () => {
      captureNavigationPosition() // activeEntry still refers to the page we are leaving.
      activeEntry = entryId()
      setMotion('return')
    }
    const onMotion = (event: Event) => setMotion((event as CustomEvent<'enter' | 'return'>).detail)
    const clear = () => memory.clear()
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('popstate', onPop)
    window.addEventListener(MOTION_EVENT, onMotion)
    window.addEventListener(SESSION_CHANGED, clear)
    window.addEventListener(SESSION_EXPIRED, clear)
    return () => {
      history.scrollRestoration = oldRestoration
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(MOTION_EVENT, onMotion)
      window.removeEventListener(SESSION_CHANGED, clear)
      window.removeEventListener(SESSION_EXPIRED, clear)
    }
  }, [])

  useLayoutEffect(() => {
    const id = entryId()
    activeEntry = id
    const target = memory.position(id) ?? { x: 0, y: 0, panel: 0 }
    restoring = true
    let stopped = false
    let frame = 0
    const stop = () => {
      if (stopped) return
      stopped = true
      restoring = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      clearTimeout(timeout)
      for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) window.removeEventListener(event, stop, true)
    }
    const attempt = () => {
      if (stopped || entryId() !== id) return
      window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' })
      const element = panel()
      if (element) element.scrollTop = target.panel
      const loading = document.querySelector('.rwa-mobile [data-app-loading], .rwa-mobile [data-navigation-loading]')
      if (!loading && Math.abs(window.scrollY - target.y) < 2 && (!target.panel || (element && Math.abs(element.scrollTop - target.panel) < 2))) stop()
    }
    // Dynamic screens/data can mount after the first frame. Retry only on layout changes.
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(attempt) })
    observer.observe(document.querySelector('.rwa-mobile') ?? document.body, { childList: true, subtree: true })
    const timeout = setTimeout(stop, 8000)
    for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) window.addEventListener(event, stop, { capture: true, passive: true })
    frame = requestAnimationFrame(attempt)
    return stop
  }, [routeKey])
  return motion
}
