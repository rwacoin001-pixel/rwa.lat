'use client'

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Component, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

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
 * Screen changes move like a native stack (2026-11-04, user: switching pages felt like a website). Only one screen is
 * mounted, so just before React swaps it the outgoing page is copied (a static snapshot, sticky and fixed parts kept
 * where they were on screen). Forward: the new page slides in from the trailing edge over the copy, which eases back
 * and dims. Back: the copy slides away to the trailing edge and the page underneath comes forward. Dock tabs keep their
 * short cross-fade. The first load and reduced motion keep the CSS entrance. Transforms are cleared afterwards so
 * fixed actions inside a page keep their viewport anchor.
 */
export class ScreenTransition extends Component<ScreenTransitionProps> {
  private node: HTMLDivElement | null = null
  private setNode = (el: HTMLDivElement | null) => { this.node = el }

  getSnapshotBeforeUpdate(prev: ScreenTransitionProps): Snapshot | null {
    const motion = this.props.motion ?? 'enter'
    if (`${prev.screenKey}:${prev.motion}` === `${this.props.screenKey}:${motion}` || prev.screenKey === this.props.screenKey) return null
    if (skipNext) { skipNext = false; return null }
    if (motion !== 'enter') forgetPrevious()
    if (motion === 'tab' || !this.node || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    return takeSnapshot(this.node)
  }

  componentDidUpdate(_prev: ScreenTransitionProps, _state: unknown, snapshot: Snapshot | null) {
    if (!snapshot || !this.node) return
    // Floating sheet screens have their own rise; the stack slide is for full pages.
    if (snapshot.sheet || snapshot.host.dataset.sheet === 'true') { snapshot.clone.remove(); return }
    playStack(snapshot, this.node, this.props.motion === 'return' ? 'pop' : 'push')
  }

  render() {
    const motion = this.props.motion ?? 'enter'
    return (
      <div ref={this.setNode} key={`${this.props.screenKey}:${motion}`} className={`rwa-screen-transition rwa-${motion}`}>
        {motion === 'tab' && <SettleEntrances />}
        {this.props.children}
      </div>
    )
  }
}

type Snapshot = { clone: HTMLElement; host: HTMLElement; rect: DOMRect; sheet: boolean }
let running: { finish: () => void } | null = null
/** The frozen page under the current one (kept after a push), for the edge swipe back; and a one-shot skip. */
let previous: HTMLElement | null = null
let skipNext = false
export const stackPrevious = () => previous
export function forgetPrevious() { previous?.remove(); previous = null }
/** The edge swipe already moved the page; the pop it triggers must not animate a second time. */
export function skipNextTransition() { skipNext = true }

/** A static copy of the outgoing page at its on-screen position; sticky/fixed parts stay where they were seen. */
function takeSnapshot(el: HTMLElement): Snapshot | null {
  const host = el.parentElement
  if (!host) return null
  running?.finish()
  const rect = el.getBoundingClientRect()
  const pinned: Array<{ index: number; top: number; left: number; position: string }> = []
  const all = el.querySelectorAll<HTMLElement>('*')
  for (let index = 0; index < all.length; index++) {
    const position = getComputedStyle(all[index]).position
    if (position === 'sticky' || position === 'fixed') { const r = all[index].getBoundingClientRect(); pinned.push({ index, top: r.top, left: r.left, position }) }
  }
  const clone = el.cloneNode(true) as HTMLElement
  clone.classList.add('rwa-snap')
  clone.setAttribute('aria-hidden', 'true')
  clone.setAttribute('inert', '')
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
  // Canvases are copied empty; paint what the original showed (WebGL may refuse, which is fine).
  const fromCanvas = el.querySelectorAll('canvas'), toCanvas = clone.querySelectorAll('canvas')
  toCanvas.forEach((canvas, index) => { try { canvas.getContext('2d')?.drawImage(fromCanvas[index], 0, 0) } catch { /* leave it blank */ } })
  Object.assign(clone.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, margin: '0', zIndex: '0', pointerEvents: 'none', animation: 'none', transform: 'translateZ(0)' })
  host.insertBefore(clone, el)
  const copies = clone.querySelectorAll<HTMLElement>('*')
  for (const pin of pinned) {
    const copy = copies[pin.index]
    if (!copy) continue
    copy.style.position = pin.position === 'fixed' ? 'absolute' : 'relative'
    copy.style.top = '0px'
    const r = copy.getBoundingClientRect()
    copy.style.transform = `translate(${pin.left - r.left}px, ${pin.top - r.top}px)`
  }
  return { clone, host, rect, sheet: host.dataset.sheet === 'true' }
}

const EASE_STACK = 'cubic-bezier(.32, .72, 0, 1)'
const STACK_MS = 420

function pageBackground(el: HTMLElement) {
  for (const node of [el.firstElementChild as HTMLElement | null, el.parentElement, document.body]) {
    const colour = node ? getComputedStyle(node).backgroundColor : ''
    if (colour && colour !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(colour)) return colour
  }
  return '#f5f6f8'
}

/** iOS push/pop: the top page moves the full width, the one under it a third, with a shade at the seam. */
function playStack({ clone }: Snapshot, live: HTMLElement, kind: 'push' | 'pop') {
  const rtl = document.documentElement.dir === 'rtl' ? -1 : 1
  const full = `${100 * rtl}%`, part = `${-28 * rtl}%`
  const prior = { animation: live.style.animation, position: live.style.position, zIndex: live.style.zIndex, background: live.style.background, boxShadow: live.style.boxShadow, transform: live.style.transform }
  live.style.animation = 'none'
  live.style.position = 'relative'
  live.style.background = pageBackground(live)
  const timing: KeyframeAnimationOptions = { duration: STACK_MS, easing: EASE_STACK, fill: 'both' }
  const seam = '0 0 40px rgba(10, 12, 16, .18)'
  let animations: Animation[]
  if (kind === 'push') {
    live.style.zIndex = '1'
    live.style.boxShadow = seam
    animations = [
      live.animate([{ transform: `translate3d(${full}, 0, 0)` }, { transform: 'translate3d(0, 0, 0)' }], timing),
      clone.animate([{ transform: 'translate3d(0, 0, 0)', opacity: 1 }, { transform: `translate3d(${part}, 0, 0)`, opacity: .72 }], timing),
    ]
  } else {
    live.style.zIndex = '0'
    clone.style.zIndex = '2'
    clone.style.boxShadow = seam
    clone.style.background = pageBackground(clone)
    animations = [
      clone.animate([{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${full}, 0, 0)` }], timing),
      live.animate([{ transform: `translate3d(${part}, 0, 0)`, opacity: .72 }, { transform: 'translate3d(0, 0, 0)', opacity: 1 }], timing),
    ]
  }
  let done = false
  const finish = () => {
    if (done) return
    done = true
    for (const animation of animations) animation.cancel()
    clone.remove()
    // After a push the copy is kept (detached) as the page under this one, for the edge swipe back.
    forgetPrevious()
    if (kind === 'push') { clone.style.transform = 'translateZ(0)'; clone.style.opacity = ''; previous = clone }
    Object.assign(live.style, prior)
    if (running === handle) running = null
  }
  const handle = { finish }
  running = handle
  void Promise.all(animations.map((animation) => animation.finished)).then(finish, finish)
  // Hidden tabs and some WebViews pause animations; never leave the new page off-screen or the copy on top.
  window.setTimeout(finish, STACK_MS + 250)
  if (document.visibilityState === 'hidden') finish()
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
