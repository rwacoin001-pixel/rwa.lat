'use client'

// Gyroscope light: one deviceorientation listener writes --tilt-x / --tilt-y (−1…1, low-passed) on <html>,
// so every lit surface shifts its shadow and highlight with the phone. Off under prefers-reduced-motion.
// iOS 13+ gates the sensor behind DeviceOrientationEvent.requestPermission(), which must run inside a user
// gesture — callers invoke requestTilt() from a press on a lit surface.
type PermissionedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

const RANGE = 24 // degrees of tilt that map to full travel
const SMOOTH = .18
let state: 'idle' | 'listening' | 'denied' = 'idle'
let baseBeta: number | null = null
let x = 0
let y = 0
let targetX = 0
let targetY = 0
let frame = 0

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (value: number) => Math.max(-1, Math.min(1, value))

function paint() {
  x += (targetX - x) * SMOOTH
  y += (targetY - y) * SMOOTH
  const root = document.documentElement.style
  root.setProperty('--tilt-x', x.toFixed(3))
  root.setProperty('--tilt-y', y.toFixed(3))
  frame = Math.abs(targetX - x) + Math.abs(targetY - y) > .002 ? requestAnimationFrame(paint) : 0
}

function onOrientation(event: DeviceOrientationEvent) {
  if (event.beta == null || event.gamma == null) return
  // The resting hold angle becomes neutral, so light sits centred however the phone is held.
  baseBeta ??= event.beta
  targetX = clamp(event.gamma / RANGE)
  targetY = clamp((event.beta - baseBeta) / RANGE)
  if (!frame) frame = requestAnimationFrame(paint)
}

function listen() {
  if (state === 'listening') return
  state = 'listening'
  window.addEventListener('deviceorientation', onOrientation)
}

/** Starts the sensor where no permission is needed; iOS waits for requestTilt(). */
export function startTilt() {
  if (typeof window === 'undefined' || state !== 'idle' || reducedMotion() || !('DeviceOrientationEvent' in window)) return
  if (typeof (DeviceOrientationEvent as PermissionedOrientation).requestPermission === 'function') return
  listen()
}

/** Call from a user gesture. Asks iOS once; a denial is remembered for the session. */
export function requestTilt() {
  if (typeof window === 'undefined' || state !== 'idle' || reducedMotion() || !('DeviceOrientationEvent' in window)) return
  const ask = (DeviceOrientationEvent as PermissionedOrientation).requestPermission
  if (typeof ask !== 'function') { listen(); return }
  state = 'denied' // until answered, so repeated presses do not stack prompts
  ask().then((answer) => { state = 'idle'; if (answer === 'granted') listen(); else state = 'denied' }).catch(() => { state = 'denied' })
}
