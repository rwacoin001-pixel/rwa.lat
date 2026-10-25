'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PaperBuddy, type BuddyMood } from '@/lib/paper-buddy'
import { onBuddySignal } from '@/lib/buddy-signals'
import { subscribeToast, getToast } from '@/lib/toast-store'
import { useUnread } from '@/hooks/useUnread'
import { useSignedIn } from '@/lib/maison-nav'
import { BuddyDigest } from './BuddyDigest'
import styles from './Buddy.module.css'

const QUIET_MS = 60_000

/**
 * The AI buddy in the dock (palette A). It shows how things stand at a glance:
 * - unread notifications: a count on its rim; a new one makes it light up ("insight");
 * - the AI chat: listening while you type or talk, thinking while it waits, replying when the answer lands, a slip on
 *   errors (signals from the chat screen, see lib/buddy-signals);
 * - the app: a success toast makes it celebrate, an error toast makes it droop;
 * - quiet: after a minute without input it drifts off; late at night it sleeps until tapped.
 * Tap: with unread notifications it opens a short digest of them; otherwise the AI chat.
 */
export function BuddyOrb({ label, active, onOpenAi }: { label: string; active: boolean; onOpenAi: () => void }) {
  const host = useRef<HTMLSpanElement>(null)
  const buddy = useRef<PaperBuddy | null>(null)
  const signedIn = useSignedIn()
  const { data, unread } = useUnread(signedIn)
  const [digest, setDigest] = useState(false)
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

  const tap = () => {
    const b = buddy.current
    if (!b) return
    navigator.vibrate?.(6)
    if (b.mood === 'sleep') { b.set('wake'); return }
    b.spin(); b.hop()
    if (signedIn && unread > 0) { setDigest(true); show('listening', { hold: true }); return }
    onOpenAi()
  }

  return <>
    <button type="button" className={`ai-orb ${styles.orb}`} data-active={active || undefined} aria-label={unread > 0 ? `${label} · ${unread}` : label} title={label} onClick={tap}>
      <span ref={host} className={styles.host} aria-hidden="true" />
    </button>
    {digest && <BuddyDigest items={Array.isArray(data) ? data : []} onClose={() => { setDigest(false); held.current = false; settle() }}
      onAllRead={() => { setDigest(false); show('satisfied', { ms: 3000 }) }} onAskAi={() => { setDigest(false); held.current = false; onOpenAi() }} />}
  </>
}
