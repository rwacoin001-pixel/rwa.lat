'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { SESSION_EXPIRED, SESSION_CHANGED, getSessionToken, type ApiError, type ApiResult } from './_http'
import { beginUiLoading } from '@/lib/ui-loading'
type Snapshot<T> = { data?: T; error?: ApiError; loading: boolean }
type Entry<T> = { snapshot: Snapshot<T>; updatedAt: number; listeners: Set<() => void>; pending?: Promise<void>; generation: number; refresh?: () => Promise<void>; finishLoading?: () => void }
const cache = new Map<string, Entry<unknown>>()
const empty: Snapshot<never> = { loading: false }
function entry<T>(key: string): Entry<T> {
  if (!cache.has(key)) cache.set(key, { snapshot: empty, updatedAt: 0, listeners: new Set(), generation: 0 })
  return cache.get(key) as Entry<T>
}
function publish<T>(item: Entry<T>, snapshot: Snapshot<T>) { item.snapshot = snapshot; item.listeners.forEach(notify => notify()) }
export async function invalidate(prefixes: string | string[]): Promise<boolean> {
  const keys = Array.isArray(prefixes) ? prefixes : [prefixes]
  const refreshes: Promise<boolean>[]=[]
  cache.forEach((item,key)=>{
    if(!keys.some(prefix=>key.startsWith(prefix))) return
    item.updatedAt=0
    if(item.listeners.size && item.refresh){
      const generation=item.generation
      refreshes.push((async()=>{await item.refresh!();return generation===item.generation && item.updatedAt>0 && !item.snapshot.loading && !item.snapshot.error})())
    }
  })
  const results=await Promise.allSettled(refreshes)
  return results.length>0 && results.every(result=>result.status==='fulfilled' && result.value)
}
export function clearQueryCache() {
  cache.forEach(item => { item.finishLoading?.(); item.generation++; item.updatedAt = 0; item.pending = undefined; publish(item, empty) })
}
if (typeof window !== 'undefined') window.addEventListener(SESSION_EXPIRED, clearQueryCache)
if (typeof window !== 'undefined') window.addEventListener(SESSION_CHANGED, () => {
  clearQueryCache()
  // Never retain a previous account's cached records after a normal sign-in/out.
  if (getSessionToken()) queueMicrotask(() => cache.forEach(item => { if (item.listeners.size) void item.refresh?.() }))
})

export function useQuery<T>(key: string | null, loader: () => Promise<ApiResult<T>>, options: { staleTime?: number; pollInterval?: number; loading?: 'silent' | 'overlay' } = {}) {
  const loadRef = useRef(loader)
  loadRef.current = loader
  const item = key === null ? undefined : entry<T>(key)
  const subscribe = useCallback((notify: () => void) => { item?.listeners.add(notify); return () => { item?.listeners.delete(notify); if (item && !item.listeners.size) item.finishLoading?.() } }, [item])
  const snapshot = useSyncExternalStore(subscribe, () => item?.snapshot ?? empty, () => empty)
  const refetch = useCallback(async () => {
    if (!item) return
    if (item.pending) return item.pending
    const generation = item.generation
    const finishLoading = options.loading !== 'silent' && item.snapshot.data === undefined && item.listeners.size ? beginUiLoading() : () => {}
    item.finishLoading = finishLoading
    publish(item, { ...item.snapshot, error: undefined, loading: true })
    item.pending = (async () => {
      try {
        const result = await loadRef.current()
        if (generation !== item.generation) return
        if (result.ok) { item.updatedAt = Date.now(); publish(item, { data: result.data, loading: false }) }
        else publish(item, { data: item.snapshot.data, error: result.error, loading: false })
      } catch {
        if (generation === item.generation) publish(item, { data: item.snapshot.data, loading: false, error: { status: 0, code: 'QUERY_ERROR', message: '加载失败，请重试' } })
      } finally { finishLoading(); if (generation === item.generation) item.pending = undefined }
    })()
    return item.pending
  }, [item, options.loading])
  const staleTime = options.staleTime ?? 45_000
  useEffect(() => {
    if (!item) return
    item.refresh = refetch
    if (!item.updatedAt || Date.now() - item.updatedAt >= staleTime) void refetch()
    const focus = () => { if (Date.now() - item.updatedAt >= staleTime) void refetch() }
    // Polling stops while the app is in the background (no data or battery spent on a screen nobody sees) and
    // catches up the moment it is back: anything older than its poll interval, or stale, refreshes at once.
    // visibilitychange rather than focus alone: an iPhone Home Screen app resuming does not reliably fire focus.
    const poll = options.pollInterval
    const hidden = () => typeof document !== 'undefined' && document.hidden
    const tick = () => { if (!hidden()) void refetch() }
    const visible = () => {
      if (hidden()) return
      const age = Date.now() - item.updatedAt
      if (age >= staleTime || (poll && age >= poll)) void refetch()
    }
    window.addEventListener('focus', focus)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible)
    const timer = poll ? setInterval(tick, poll) : undefined
    return () => { window.removeEventListener('focus', focus); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible); if (timer) clearInterval(timer) }
  }, [item, refetch, staleTime, options.pollInterval])
  return { ...snapshot, refetch }
}
