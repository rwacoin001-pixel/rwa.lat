'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { adminErrorMessage } from '@/lib/admin-errors'
import type { QueueKey } from './nav'

// GET /admin/console/today (apps/admin/src/admin-today.service.ts).
export type QueueState = {
  count: number
  oldestAt: string | null
  amountAtomic?: string | null
  assetCode?: string | null
  status: 'ok' | 'forbidden' | 'error'
  /** quantSettlement only: the day due (null when nothing is due), its step, and today's cutoff in the product's zone. */
  state?: 'none' | 'draft' | 'approved' | 'posted'
  tradeDate?: string | null
  cutoffAt?: string | null
  overdue?: boolean
  productSlug?: string | null
  timezone?: string
}
export type TodayDay = { day: string; depositsAtomic: string; withdrawalsAtomic: string; netAtomic: string }
export type TodayAlertKind = 'withdrawalExecutionPaused' | 'hotWalletError' | 'hotWalletLow' | 'reconciliationMismatch' | 'deadJobs'
export type TodayAlert = { kind: TodayAlertKind; severity: 'critical' | 'warning'; at: string | null; detail: Record<string, unknown> }
export type Today = {
  generatedAt: string
  queues: Record<QueueKey, QueueState>
  today: {
    assetCode: string
    deposits: { count: number; amountAtomic: string } | null
    withdrawals: { count: number; amountAtomic: string } | null
    netAtomic: string | null
    activeUsers: number | null
    registrations: number | null
    quantPrincipalAtomic: string | null
    series: TodayDay[]
  }
  alerts: TodayAlert[]
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(adminErrorMessage(body, response.status))
  return body as T
}

export async function sendJson<T>(url: string, method: 'POST' | 'PUT' | 'PATCH', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `ops_${crypto.randomUUID().replace(/-/g, '')}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(adminErrorMessage(result, response.status))
  return result as T
}

/**
 * A request that refreshes itself every `intervalMs` while the tab is visible and right away when it becomes visible
 * again. `updatedAt` drives the "15 秒前更新" line.
 */
export function usePolled<T>(url: string | null, intervalMs = 30_000) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(url))
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!url) return
    const mine = ++seq.current
    setLoading(true)
    try {
      const body = await getJson<T>(url)
      if (mine !== seq.current) return
      setData(body)
      setError('')
      setUpdatedAt(Date.now())
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return }
    void load()
    if (!intervalMs) return
    const tick = () => { if (document.visibilityState === 'visible') void load() }
    const timer = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [url, intervalMs, load])

  return { data, error, loading, updatedAt, reload: load }
}

// One shared copy of /console/today for the shell (badges, bell, tab title) and the pages that use it.
let todayState: { data: Today | null; error: string; updatedAt: number | null } = { data: null, error: '', updatedAt: null }
const listeners = new Set<() => void>()
let todayTimer: number | null = null
let todayInflight: Promise<void> | null = null

async function refreshToday() {
  if (todayInflight) return todayInflight
  todayInflight = getJson<Today>('/api/admin/console/today')
    .then((data) => { todayState = { data, error: '', updatedAt: Date.now() } })
    .catch((err) => { todayState = { ...todayState, error: err instanceof Error ? err.message : '请求失败' } })
    .finally(() => { todayInflight = null; listeners.forEach((fn) => fn()) })
  return todayInflight
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  if (listeners.size === 1) {
    void refreshToday()
    // Every 30 s while visible. In a background tab it keeps going every 60 s only when notifications are on,
    // so new work can still pop a notification; otherwise it waits until the tab is back.
    let beat = 0
    const tick = () => {
      beat += 1
      const notifying = typeof Notification !== 'undefined' && Notification.permission === 'granted'
      if (document.visibilityState === 'visible' || (notifying && beat % 2 === 0)) void refreshToday()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshToday() }
    todayTimer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', onVisible)
    ;(subscribe as unknown as { stop?: () => void }).stop = () => { if (todayTimer) window.clearInterval(todayTimer); document.removeEventListener('visibilitychange', onVisible) }
  }
  return () => {
    listeners.delete(fn)
    if (!listeners.size) (subscribe as unknown as { stop?: () => void }).stop?.()
  }
}

export function useToday() {
  const state = useSyncExternalStore(subscribe, () => todayState, () => todayState)
  return { ...state, reload: refreshToday }
}

/** Open work across every queue the admin can see (the quant settlement counts while it is not posted). */
export function openWork(today: Today | null): number {
  if (!today) return 0
  return Object.values(today.queues).reduce((sum, q) => sum + (q.status === 'ok' ? q.count : 0), 0)
}
