'use client'
import { useEffect, useRef } from 'react'
import { PaperBuddy, type BuddyMood } from '@/lib/paper-buddy'
import styles from './Buddy.module.css'

/** The paper buddy at any size (`size` = the ball's diameter in px), showing `mood`. `still` draws it once, no motion. */
export function BuddyFace({ size, mood = 'idle', still = false, className }: { size: number; mood?: BuddyMood; still?: boolean; className?: string }) {
  const host = useRef<HTMLSpanElement>(null)
  const buddy = useRef<PaperBuddy | null>(null)
  const canvas = Math.round(size * 148 / 88)
  useEffect(() => {
    if (!host.current) return
    const b = new PaperBuddy(host.current, canvas, mood, still)
    buddy.current = b
    return () => { b.destroy(); buddy.current = null }
    // A new buddy only when its size or stillness changes; moods are passed to the running one below.
  }, [canvas, still])
  useEffect(() => { if (buddy.current && buddy.current.mood !== mood) buddy.current.set(mood) }, [mood])
  return <span className={`${styles.face} ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true">
    <span ref={host} className={styles.faceHost} style={{ width: canvas, height: canvas, margin: `${-canvas / 2}px 0 0 ${-canvas / 2}px` }} />
  </span>
}
