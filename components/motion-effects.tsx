'use client'

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

import { DUR, EASE, reduced } from '@/lib/motion'

type MagneticProps = {
  children: ReactNode
  className?: string
  strength?: number
  disabled?: boolean
}

/** Small, pointer-safe magnetic wrapper. Motion is capped to 2px by design. */
export function Magnetic({ children, className = '', strength = 0.18, disabled = false }: MagneticProps) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 420, damping: 28, mass: 0.35 })
  const springY = useSpring(y, { stiffness: 420, damping: 28, mass: 0.35 })
  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled || reduced || event.pointerType !== 'mouse' || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set(Math.max(-2, Math.min(2, (event.clientX - (rect.left + rect.width / 2)) * strength)))
    y.set(Math.max(-2, Math.min(2, (event.clientY - (rect.top + rect.height / 2)) * strength)))
  }
  const reset = () => { x.set(0); y.set(0) }
  return (
    <motion.span ref={ref} className={`rwa-magnetic ${className}`.trim()} style={{ x: springX, y: springY }} onPointerMove={move} onPointerLeave={reset}>
      {children}
    </motion.span>
  )
}

/** Handoff alias for the installed Magnet primitive. */
export const Magnet = Magnetic

type LiquidSelectionProps = { active: boolean; className?: string; id?: string }

/** A shared layout indicator used by the dock and segmented controls. */
export function LiquidSelection({ active, className = '', id = 'rwa-liquid-selection' }: LiquidSelectionProps) {
  const reduced = useReducedMotion()
  if (!active) return null
  return <motion.span layoutId={id} className={`rwa-liquid-selection ${className}`.trim()} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 30, mass: 0.7 }} aria-hidden="true" />
}

/** Handoff alias: the shared indicator is the gooey navigation primitive. */
export const GooeyNavSelection = LiquidSelection

type TiltedSurfaceProps = { children: ReactNode; className?: string; maxTilt?: number; style?: CSSProperties }

/** Lightweight 3D card tilt; pointer motion is disabled on touch/reduced-motion. */
export function TiltedSurface({ children, className = '', style }: TiltedSurfaceProps) {
  return <div className={`rwa-card card-media ${className}`} style={style}>{children}</div>
}

/** Handoff alias for product surfaces that use the TiltedCard interaction. */
export const TiltedCardSurface = TiltedSurface

type SplitFlapTextProps = { value: string; className?: string; label?: string }

/** Compact number transition that keeps the rendered value available to SSR. */
export function SplitFlapText({ value, className = '', label }: SplitFlapTextProps) {
  const [displayed, setDisplayed] = useState(value)
  useEffect(() => setDisplayed(value), [value])
  const chars = displayed.split('')
  return (
    <span className={`rwa-split-flap ${className}`.trim()} aria-label={label ?? value}>
      {chars.map((char, index) => <span key={`${index}-${char}`} className={/[0-9]/.test(char) ? 'rwa-split-flap__digit' : 'rwa-split-flap__punct'}>{char}</span>)}
    </span>
  )
}

type ScreenTransitionProps = { screenKey: string; children: ReactNode; motion?: 'enter' | 'return' | 'tab' }

/**
 * A compositing-only screen transition. It deliberately animates opacity and
 * blur instead of transform so fixed order/wallet actions keep their viewport
 * anchor while a route changes.
 */
export function ScreenTransition({ screenKey, children, motion = 'enter' }: ScreenTransitionProps) {
  // CSS-driven fade: identical markup on server and client (no hydration mismatch).
  // prefers-reduced-motion is handled in CSS (.rwa-screen-fade media query).
  return (
    <div key={`${screenKey}:${motion}`} className={`rwa-screen-transition rwa-${motion}`}>
      {motion === 'tab' && <SettleEntrances />}
      {children}
    </div>
  )
}

/**
 * Tabs behave like a native tab bar: the new tab is simply there. Every one-shot entrance inside it (block
 * rises, title slides, staggered lists) jumps to its end on the first frames; looping animations such as
 * spinners and skeleton shimmer keep running, and only the container's own short fade remains.
 */
function SettleEntrances() {
  const marker = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const container = marker.current?.parentElement
    if (!container || typeof container.getAnimations !== 'function') return
    const settle = () => { for (const animation of container.getAnimations({ subtree: true })) {
      const target = (animation.effect as KeyframeEffect | null)?.target
      if (target === container || animation.effect?.getTiming().iterations === Infinity) continue
      try { animation.finish() } catch { /* An animation with an unresolved end cannot be finished; leave it. */ }
    } }
    settle()
    // Data-driven blocks mount a moment later; settle them too, but only within the switch itself.
    const frames = [requestAnimationFrame(settle), window.setTimeout(settle, 120), window.setTimeout(settle, 360)]
    return () => { cancelAnimationFrame(frames[0]); clearTimeout(frames[1]); clearTimeout(frames[2]) }
  }, [])
  return <span ref={marker} hidden />
}

type FlowProgressProps = { current: number; total: number; label?: string }

/** Compact progress rail shared by investment and wallet execution flows. */
export function FlowProgress({ current, total, label }: FlowProgressProps) {
  const safeTotal = Math.max(1, total)
  const safeCurrent = Math.min(Math.max(0, current), safeTotal)
  return (
    <div className="rwa-flow-progress" role="progressbar" aria-valuemin={0} aria-valuemax={safeTotal} aria-valuenow={safeCurrent} aria-label={label}>
      {Array.from({ length: safeTotal }, (_, index) => (
        <span key={index} className={index < safeCurrent ? 'is-complete' : index === safeCurrent ? 'is-active' : ''} />
      ))}
    </div>
  )
}

export type RwaFlipState = { rect: DOMRect }
export function captureSharedFlip(target: Element | null): RwaFlipState | null {
  return target && !reduced() ? { rect: target.getBoundingClientRect() } : null
}
export function playSharedFlip(state: RwaFlipState | null, target: Element | null) {
  if (!state || !target || reduced()) return
  return target.animate([{ opacity: .5 }, { opacity: 1 }], { duration: DUR.base, easing: `cubic-bezier(${EASE.std.join(',')})` })
}
