'use client'

/**
 * 3D card (after React Bits' Tilted Card + Glare Hover, rebuilt for phones):
 * - the card leans toward the finger while it is pressed or dragged, with a soft glare where the light would hit;
 * - on Android the phone's own tilt moves it a little (iOS asks for a permission, so it is skipped there);
 * - the first time it scrolls into view it turns once, so the depth is visible without touching it.
 * Children marked `data-depth` sit in front of the card (translateZ in CSS) and move more than it: real parallax.
 * Reduced motion: a flat card.
 */
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, animate } from 'motion/react'
import styles from './Tilt3D.module.css'

const SPRING = { stiffness: 220, damping: 22, mass: .6 }

// One orientation listener for every card on the page.
type Lean = { x: number; y: number }
const leaners = new Set<(lean: Lean) => void>()
let base: { beta: number; gamma: number } | null = null
let listening = false
function onOrientation(event: DeviceOrientationEvent) {
  if (event.beta === null || event.gamma === null) return
  base ??= { beta: event.beta, gamma: event.gamma }
  // Drift the resting angle slowly, so holding the phone a new way becomes the new flat.
  base = { beta: base.beta + (event.beta - base.beta) * .02, gamma: base.gamma + (event.gamma - base.gamma) * .02 }
  const lean = { x: Math.max(-1, Math.min(1, (event.beta - base.beta) / 20)), y: Math.max(-1, Math.min(1, (event.gamma - base.gamma) / 20)) }
  leaners.forEach(fn => fn(lean))
}
function subscribeLean(fn: (lean: Lean) => void) {
  leaners.add(fn)
  // iOS needs requestPermission from a tap; only listen where no permission is asked for.
  const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function'
  if (!listening && !needsPermission && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) { window.addEventListener('deviceorientation', onOrientation); listening = true }
  return () => { leaners.delete(fn); if (!leaners.size && listening) { window.removeEventListener('deviceorientation', onOrientation); listening = false; base = null } }
}

export function Tilt3D({ children, className, max = 10, intro = true }: { children: ReactNode; className?: string; max?: number; intro?: boolean }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: .5 })
  const pressing = useRef(false)
  const rx = useSpring(0, SPRING), ry = useSpring(0, SPRING)
  const gx = useMotionValue(50), gy = useMotionValue(30), glare = useSpring(0, SPRING)
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255, 255, 255, .5), rgba(255, 255, 255, 0) 58%)`

  // Once per page view: a slow turn when the card first comes into view.
  const introDone = useRef(false)
  useEffect(() => {
    if (reduced || !intro || !inView || introDone.current) return
    introDone.current = true
    const a = animate(ry, [0, -max * .8, max * .5, 0], { duration: 1.6, ease: 'easeInOut' })
    const b = animate(rx, [0, max * .3, -max * .2, 0], { duration: 1.6, ease: 'easeInOut' })
    return () => { a.stop(); b.stop() }
  }, [inView, reduced, intro, max, rx, ry])

  useEffect(() => {
    if (reduced || !inView) return
    return subscribeLean(lean => { if (pressing.current) return; rx.set(-lean.x * max * .6); ry.set(lean.y * max * .6) })
  }, [inView, reduced, max, rx, ry])

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced) return
    if (event.pointerType !== 'mouse' && !pressing.current) return
    const box = event.currentTarget.getBoundingClientRect()
    const px = (event.clientX - box.left) / box.width, py = (event.clientY - box.top) / box.height
    rx.set((.5 - py) * max * 2); ry.set((px - .5) * max * 2)
    gx.set(px * 100); gy.set(py * 100); glare.set(1)
  }
  const rest = () => { pressing.current = false; rx.set(0); ry.set(0); glare.set(0) }

  return <div ref={ref} className={`${styles.stage} ${className ?? ''}`}
    onPointerDown={event => { pressing.current = true; lean(event) }} onPointerMove={lean} onPointerUp={rest} onPointerCancel={rest} onPointerLeave={rest}>
    <motion.div className={styles.body} style={reduced ? undefined : { rotateX: rx, rotateY: ry }}>
      {children}
      {!reduced && <motion.span className={styles.glare} style={{ background: glareBg, opacity: glare }} aria-hidden="true" />}
    </motion.div>
  </div>
}

/** A short spark burst from where the finger lifted (after React Bits' Click Spark): for the reward moments. */
export function sparkBurst(event: { clientX: number; clientY: number }, color = 'var(--m-accent, #0a8a73)') {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const host = document.createElement('span')
  host.className = styles.spark
  host.style.left = `${event.clientX}px`; host.style.top = `${event.clientY}px`; host.style.color = color
  for (let i = 0; i < 8; i++) { const ray = document.createElement('i'); ray.style.setProperty('--a', `${i * 45}deg`); host.appendChild(ray) }
  document.body.appendChild(host)
  window.setTimeout(() => host.remove(), 600)
}
