'use client'
import { useCallback, useEffect, useRef, type PointerEvent } from 'react'
import { PenLine, Ticket } from 'lucide-react'
import type { ComposeKind } from '@/lib/compose-key'
import { PaperBuddy, type BuddyMood } from '@/lib/paper-buddy'
import { onBuddySignal } from '@/lib/buddy-signals'
import { subscribeToast, getToast } from '@/lib/toast-store'
import { useUnread } from '@/hooks/useUnread'
import { useSignedIn } from '@/lib/maison-nav'
import { watchUnread } from '@/lib/api/notification-stream'
import { useAiOverlay } from '@/lib/ai-overlay'
import styles from './Buddy.module.css'

const QUIET_MS = 60_000

/**
 * The AI buddy in the dock (palette A). It shows how things stand at a glance:
 * - unread notifications: a count on its rim; a new one makes it light up ("insight");
 * - the AI chat: listening while you type or talk, thinking while it waits, replying when the answer lands, a slip on
 *   errors (signals from the chat screen, see lib/buddy-signals);
 * - the app: a success toast makes it celebrate, an error toast makes it droop;
 * - quiet: after a minute without input it drifts off; late at night it sleeps until tapped.
 * Tap: opens the AI chat; unread notifications wait above its composer
 * On Community (2026-11-02, `compose`) the ball morphs in place into an ink compose key (a pen; a ticket on the 晒单 tab):
 * tap composes, a long press still opens the AI. Same button, same box, so the pin rule and its position never change.
 */
export type OrbCompose = { kind: ComposeKind; label: string; longPress: string; hint: boolean; onCompose: () => void }
const LONG_PRESS_MS = 480

export function BuddyOrb({ label, active, onOpenAi, compose = null }: { label: string; active: boolean; onOpenAi: () => void; compose?: OrbCompose | null }) {
  const host = useRef<HTMLSpanElement>(null)
  const buddy = useRef<PaperBuddy | null>(null)
  const signedIn = useSignedIn()
  const { unread, refetch } = useUnread(signedIn)
  const held = useRef(false)
  const passing = useRef(0)
  const quiet = useRef(0)
  const lastUnread = useRef<number | null>(null)

  const base = useCallback((): BuddyMood => {
    const hour = new Date().getHours()
    return hour >= 1 && hour < 6 ? 'sleep' : 'idle'
  }, [])
  const settle = useCallback(() => { if (!held.current) buddy.current?.set(base()) }, [base])
  const show = useCallback((mood: BuddyMood, { hold = false, ms = 3500 } = {}) => {
    const b = buddy.current
    if (!b) return
    held.current = hold
    clearTimeout(passing.current)
    if (b.mood !== mood) b.set(mood)
    if (!hold) passing.current = window.setTimeout(() => { held.current = false; settle() }, ms)
  }, [settle])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const b = new PaperBuddy(el, 96, base())
    buddy.current = b
    return () => { b.destroy(); buddy.current = null }
  }, [base])

  // Live: the server tells us when the unread count changes, so a new notification shows at once (polling stays as
  // the fallback). Only while the page is visible; the stream closes when the app goes to the background.
  const latestUnread = useRef(unread)
  latestUnread.current = unread
  const reload = useRef(refetch)
  reload.current = refetch
  useEffect(() => {
    if (!signedIn) return
    let controller: AbortController | null = null
    const start = () => {
      if (controller || document.visibilityState !== 'visible') return
      controller = new AbortController()
      watchUnread((count) => { if (count !== latestUnread.current) void reload.current() }, controller.signal)
    }
    const stop = () => { controller?.abort(); controller = null }
    const onVisibility = () => { if (document.visibilityState === 'visible') start(); else stop() }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [signedIn])

  // Notifications: the count on the rim; a rise lights the buddy up.
  useEffect(() => {
    buddy.current?.badge(unread)
    if (lastUnread.current !== null && unread > lastUnread.current) show('insight', { ms: 4200 })
    lastUnread.current = unread
  }, [unread, show])

  // Signals from screens (the AI chat), and the shared toast.
  useEffect(() => onBuddySignal(signal => {
    if (signal.mood === 'idle') { held.current = false; clearTimeout(passing.current); settle(); return }
    show(signal.mood, { hold: signal.hold, ms: signal.ms })
  }), [show, settle])
  useEffect(() => {
    let lastId = 0
    return subscribeToast(() => {
      const toast = getToast()
      if (!toast || toast.id === lastId || held.current) return
      lastId = toast.id
      if (toast.tone === 'ok') show('done', { ms: 3200 })
      if (toast.tone === 'error') show('down', { ms: 2600 })
    })
  }, [show])

  // Quiet: drift off after a minute without input; any input brings it back. Eyes follow the pointer.
  useEffect(() => {
    const wake = (event?: Event) => {
      clearTimeout(quiet.current)
      if (buddy.current?.mood === 'drift') settle()
      quiet.current = window.setTimeout(() => { if (!held.current && buddy.current?.mood === 'idle') buddy.current.set('drift') }, QUIET_MS)
      if (event instanceof PointerEvent) buddy.current?.lookAt(event.clientX, event.clientY)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll'] as const
    events.forEach(name => window.addEventListener(name, wake, { passive: true }))
    wake()
    return () => { clearTimeout(quiet.current); events.forEach(name => window.removeEventListener(name, wake)) }
  }, [settle])

  // Tap (2026-10-28): the ball squashes under the finger, springs, and a ring of the AI's colours spreads from it
  // across the page as the AI layer arrives — the layer visibly comes out of the ball. When the layer closes, the
  // ball pops back into the dock.
  const button = useRef<HTMLButtonElement>(null)
  const opening = useRef(false)
  const tap = () => {
    if (opening.current) return
    const b = buddy.current
    navigator.vibrate?.([8, 40, 12])
    if (b?.mood === 'sleep') b.set('wake')
    b?.spin(); b?.hop()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rect = button.current?.getBoundingClientRect()
    if (rect && !reduced) {
      const ripple = document.createElement('span')
      ripple.className = styles.ripple
      ripple.setAttribute('aria-hidden', 'true')
      ripple.style.left = `${rect.left + rect.width / 2}px`
      ripple.style.top = `${rect.top + rect.height / 2}px`
      document.body.appendChild(ripple)
      window.setTimeout(() => ripple.remove(), 900)
    }
    opening.current = true
    window.setTimeout(() => { opening.current = false; onOpenAi() }, reduced ? 0 : 140)
  }
  // Long press on the compose key = the AI (with its own buzz); the click that ends the press is swallowed.
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const pressed = useRef(false)
  const release = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null } }
  useEffect(() => release, [])
  const onPointerDown = (event: PointerEvent) => {
    if (!compose || event.button !== 0) return
    release(); pressed.current = false
    press.current = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => { press.current = null; pressed.current = true; navigator.vibrate?.([10, 30, 14]); tap() }, LONG_PRESS_MS) }
  }
  const onPointerMove = (event: PointerEvent) => {
    const start = press.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) release()
  }
  const onClick = () => {
    if (pressed.current) { pressed.current = false; return }
    if (!compose) { tap(); return }
    navigator.vibrate?.(6)
    compose.onCompose()
  }
  const { open } = useAiOverlay()
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) {
      const el = button.current
      if (el) { el.dataset.back = ''; window.setTimeout(() => { delete el.dataset.back }, 520) }
      buddy.current?.hop()
    }
    wasOpen.current = open
  }, [open])

  return <>
    <button ref={button} type="button" className={`ai-orb ${styles.orb}`} data-active={active || undefined} data-compose={compose?.kind}
      aria-label={compose ? `${compose.label} · ${compose.longPress}` : unread > 0 ? `${label} · ${unread}` : label} title={compose ? undefined : label} onClick={onClick}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      onContextMenu={compose ? (event) => event.preventDefault() : undefined}>
      <span ref={host} className={styles.host} aria-hidden="true" />
      <span className={styles.key} aria-hidden="true">
        <PenLine className={styles.glyph} data-glyph="post" size={22} strokeWidth={1.9} />
        <Ticket className={styles.glyph} data-glyph="cards" size={22} strokeWidth={1.9} />
      </span>
      {compose && <span className={styles.hint} data-on={compose.hint || undefined} aria-hidden="true">{compose.longPress}</span>}
    </button>
  </>
}
