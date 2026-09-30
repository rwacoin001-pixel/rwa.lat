'use client'

import { useEffect, useRef, useState } from 'react'
import { invalidate } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { refreshCopy } from '@/lib/maison-refresh-copy'
import styles from './ptr.module.css'

const THRESHOLD = 72
const MAX = 120
const HOLD_MS = 900

type Phase = 'idle' | 'pull' | 'armed' | 'refreshing' | 'done' | 'failed'

/**
 * Pull-to-refresh for tab roots. The brand W is traced as the page is pulled; past the threshold it fills,
 * and release refetches every mounted query. Touch only; mouse and keyboard users keep focus refetch.
 */
export function PullToRefresh() {
  const { locale } = useI18n()
  const copy = refreshCopy[locale]
  const host = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')

  useEffect(() => {
    const el = host.current
    if (!el) return
    let startY: number | null = null
    let startX = 0
    let distance = 0
    let disposed = false
    const timers=new Set<number>()
    const delay=(ms:number,value=true)=>new Promise<boolean>(resolve=>{const timer=window.setTimeout(()=>{timers.delete(timer);resolve(value)},ms);timers.add(timer)})
    const set = (next: Phase) => { if (phaseRef.current !== next) { phaseRef.current = next; setPhase(next) } }
    const paint = (value: number) => { el.style.setProperty('--ptr', String(Math.min(value / THRESHOLD, 1))); el.style.setProperty('--ptr-y', `${value}px`) }
    const blocked = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('[role="dialog"], [data-sheet]:not([data-sheet="false"]), input, textarea, select, [data-no-ptr]'))

    const onStart = (event: TouchEvent) => {
      const busy = phaseRef.current === 'refreshing' || phaseRef.current === 'done' || phaseRef.current === 'failed'
      if (busy || event.touches.length !== 1 || window.scrollY > 0 || blocked(event.target)) { startY = null; return }
      startY = event.touches[0].clientY
      startX = event.touches[0].clientX
      distance = 0
    }
    const onMove = (event: TouchEvent) => {
      if (startY === null) return
      if(event.touches.length!==1){startY=null;distance=0;paint(0);set('idle');return}
      const dy = event.touches[0].clientY - startY
      const dx = Math.abs(event.touches[0].clientX - startX)
      // Horizontal swipes (tabs, carousels, edge-back) and upward scrolls are not pulls.
      if (dy <= 0 || window.scrollY > 0 || (distance === 0 && dx > dy)) { if (distance > 0) { distance = 0; paint(0); set('idle') } ; if (dy <= 0 || dx > dy) startY = null; return }
      // Rubber band: the further the pull, the heavier it gets.
      distance = Math.min(MAX, dy * 0.5)
      paint(distance)
      set(distance >= THRESHOLD ? 'armed' : 'pull')
    }
    const onEnd = () => {
      if (startY === null) return
      startY = null
      if (phaseRef.current !== 'armed') { distance = 0; paint(0); set('idle'); return }
      set('refreshing')
      paint(THRESHOLD * 0.8)
      void (async()=>{
        let deadline=0
        const timeout=new Promise<boolean>(resolve=>{deadline=window.setTimeout(()=>{timers.delete(deadline);resolve(false)},30_000);timers.add(deadline)})
        const [success]=await Promise.all([Promise.race([invalidate(''),timeout]),delay(HOLD_MS)])
        window.clearTimeout(deadline);timers.delete(deadline)
        if(disposed)return
        set(success?'done':'failed')
        await delay(success?520:1800)
        if(!disposed){paint(0);set('idle')}
      })()
    }
    const onCancel=()=>{startY=null;distance=0;if(phaseRef.current==='pull'||phaseRef.current==='armed'){paint(0);set('idle')}}
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onCancel)
    return () => {
      disposed=true
      timers.forEach(timer=>window.clearTimeout(timer))
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
    }
  }, [])

  const label = phase === 'armed' ? copy.release : phase === 'refreshing' ? copy.refreshing : phase === 'done' ? copy.done : phase === 'failed' ? copy.failed : copy.pull
  return <div ref={host} className={styles.ptr} data-phase={phase} aria-hidden={phase === 'idle' ? true : undefined}>
    <span className={styles.mark}>
      <svg viewBox="140 188 226 124" aria-hidden="true" focusable="false">
        <path pathLength={1} d="M150 198h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L150 198Z" />
        <path pathLength={1} d="m228.3 251.1 12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L304 302h-51.2l-24.5-50.9Z" />
        <path pathLength={1} data-accent="" d="M305.4 198H356l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z" />
      </svg>
    </span>
    {/* Announce only the result states; the pull itself is a gesture, not news. */}
    <span className={styles.label} role="status">{phase === 'refreshing' || phase === 'done' || phase === 'failed' ? label : ''}</span>
    <span className={styles.hint}>{phase === 'pull' || phase === 'armed' ? label : ''}</span>
  </div>
}
