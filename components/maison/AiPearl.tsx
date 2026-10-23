'use client'
import { useEffect, useRef } from 'react'

/**
 * The assistant's presence: a lacquer pearl drawn on a 2D canvas (no WebGL, so it stays cheap on mid-range
 * Android). One object carries every state, so the user reads what the assistant is doing from the pearl itself:
 *   idle       breathes slowly; a band of gold light drifts across the surface
 *   listening  rings open outward, and each recognised word swells the pearl (driven by recognition events,
 *              never by a second microphone stream, which interrupts the Android recogniser)
 *   thinking   a thin gold arc orbits the rim
 *   speaking   the surface brightens and pulses once per reveal
 * Warm theme: ivory pearl, bronze light. Cool theme: midnight pearl, gold light with a cool rim.
 */
export type PearlState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type PearlTheme = 'light' | 'dark'
type Palette = { hi: string; mid: string; edge: string; band: string; band2: string; shade: string; rim: string; spec: string; arc: string; cancel: string }

const PALETTES: Record<PearlTheme, Palette> = {
  light: { hi: '#fffdf8', mid: '#eee5d5', edge: '#cdbb9e', band: '166,128,74', band2: '214,186,140', shade: '27,24,19', rim: 'rgba(27,24,19,.12)', spec: 'rgba(255,255,255,.92)', arc: '#8a6a3b', cancel: '176,83,63' },
  dark: { hi: '#34435f', mid: '#152036', edge: '#0a111f', band: '227,187,122', band2: '150,176,212', shade: '0,0,0', rim: 'rgba(169,184,208,.26)', spec: 'rgba(233,237,243,.5)', arc: '#e3bb7a', cancel: '239,143,125' },
}
// Palette A preview (html[data-palette='a'], styles/palette-a.css): white / graphite pearl with brand-green light.
const PALETTES_A: Record<PearlTheme, Palette> = {
  light: { hi: '#ffffff', mid: '#eef1f4', edge: '#c9d0da', band: '25,199,170', band2: '120,150,190', shade: '11,18,32', rim: 'rgba(11,18,32,.12)', spec: 'rgba(255,255,255,.92)', arc: '#087a67', cancel: '214,69,61' },
  dark: { hi: '#2a313d', mid: '#151920', edge: '#0a0c10', band: '25,199,170', band2: '142,163,192', shade: '0,0,0', rim: 'rgba(255,255,255,.18)', spec: 'rgba(242,244,247,.5)', arc: '#19c7aa', cancel: '255,107,94' },
}
const paletteA = () => typeof document !== 'undefined' && document.documentElement.dataset.palette === 'a'

export type PearlFrame = { size: number; time: number; state: PearlState; energy: number; theme: PearlTheme; inset: number; cancel: boolean; still: boolean }

/** Pure frame geometry, shared by the renderer and the tests. */
export function pearlGeometry({ size, time, state, energy, inset, still }: Pick<PearlFrame, 'size' | 'time' | 'state' | 'energy' | 'inset' | 'still'>) {
  const base = size * inset
  const breathe = still ? 0 : Math.sin(time * 1.6) * base * .018
  const swell = state === 'listening' ? energy * base * .07 : state === 'speaking' ? energy * base * .05 : 0
  const drift = still ? .6 : time * (state === 'listening' ? .9 : state === 'thinking' ? .22 : .35)
  const arcStart = still ? -Math.PI / 2 : time * 2.2
  return { radius: base + breathe + swell, drift, arcStart, arcLength: Math.PI * .55 }
}

export function drawPearl(ctx: CanvasRenderingContext2D, frame: PearlFrame) {
  const { size, time, state, energy, theme, cancel, still } = frame
  const p = (paletteA() ? PALETTES_A : PALETTES)[theme], c = size / 2
  const { radius: r, drift, arcStart, arcLength } = pearlGeometry(frame)
  const band = cancel ? p.cancel : p.band
  ctx.clearRect(0, 0, size, size)

  if (state === 'listening' && !still) for (let k = 0; k < 3; k++) {
    const phase = (time * .7 + k / 3) % 1
    ctx.beginPath(); ctx.arc(c, c, r + 4 + phase * (size / 2 - r - 4) * (.55 + energy * .45), 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${band},${((1 - phase) * .34).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.stroke()
  }

  const body = ctx.createRadialGradient(c - r * .35, c - r * .42, r * .08, c, c, r)
  body.addColorStop(0, p.hi); body.addColorStop(.58, p.mid); body.addColorStop(1, p.edge)
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill()

  ctx.save(); ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.clip()
  const bright = state === 'speaking' ? .62 + energy * .2 : state === 'listening' ? .52 + energy * .2 : .48
  const bx = c + Math.cos(drift) * r * .55, by = c + Math.sin(drift * 1.3) * r * .36
  const light = ctx.createRadialGradient(bx, by, 0, bx, by, r * .95)
  light.addColorStop(0, `rgba(${band},${bright.toFixed(3)})`); light.addColorStop(1, `rgba(${band},0)`)
  ctx.fillStyle = light; ctx.fillRect(0, 0, size, size)
  const cx2 = c - Math.cos(drift * .7) * r * .45, cy2 = c + Math.sin(drift * .9) * r * .4
  const cool = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r * .7)
  cool.addColorStop(0, `rgba(${p.band2},.32)`); cool.addColorStop(1, `rgba(${p.band2},0)`)
  ctx.fillStyle = cool; ctx.fillRect(0, 0, size, size)
  const shade = ctx.createRadialGradient(c + r * .32, c + r * .48, 0, c + r * .32, c + r * .48, r * .85)
  shade.addColorStop(0, `rgba(${p.shade},${theme === 'dark' ? .42 : .2})`); shade.addColorStop(1, `rgba(${p.shade},0)`)
  ctx.fillStyle = shade; ctx.fillRect(0, 0, size, size)
  const spec = ctx.createRadialGradient(c - r * .4, c - r * .46, 0, c - r * .4, c - r * .46, r * .2)
  spec.addColorStop(0, p.spec); spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec; ctx.fillRect(0, 0, size, size)
  ctx.restore()

  ctx.beginPath(); ctx.arc(c, c, r - .5, 0, Math.PI * 2); ctx.strokeStyle = p.rim; ctx.lineWidth = 1; ctx.stroke()

  if (state === 'thinking') {
    ctx.beginPath(); ctx.arc(c, c, r + Math.max(3, size * .03), arcStart, arcStart + arcLength)
    ctx.strokeStyle = cancel ? `rgb(${p.cancel})` : p.arc; ctx.lineWidth = Math.max(1.5, size * .012); ctx.lineCap = 'round'; ctx.stroke()
  }
}

/** Reads the theme from the nearest `data-theme` ancestor so the pearl follows the warm/cool switch anywhere. */
function themeOf(el: Element | null): PearlTheme {
  return el?.closest('[data-theme]')?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export default function AiPearl({ state = 'idle', size, pulse = 0, cancel = false, still = false, inset = .36, className, label }: {
  state?: PearlState; size: number; pulse?: number; cancel?: boolean; still?: boolean; inset?: number; className?: string; label?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ state, cancel, energy: 0, pulse, theme: 'light' as PearlTheme, redraw: () => {} })
  live.current.state = state; live.current.cancel = cancel
  if (pulse !== live.current.pulse) { live.current.pulse = pulse; live.current.energy = 1 }

  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = Math.round(size * dpr); el.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, visible = true, last = performance.now(), time = 0, painted = 0
    const paint = (frozen: boolean) => {
      const s = live.current
      drawPearl(ctx, { size, time, state: s.state, energy: s.energy, theme: s.theme, inset, cancel: s.cancel, still: frozen })
    }
    const loop = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt
      live.current.energy *= Math.pow(.25, dt)
      // Idle is a slow breath (a few pixels a second), so 30 frames a second draw the same motion at half the cost; the
      // pearl in the dock is on screen on every page. Listening, thinking and speaking keep every frame.
      const calm = live.current.state === 'idle' && live.current.energy < .01
      if (!calm || now - painted >= 32) { painted = now; paint(false) }
      frame = requestAnimationFrame(loop)
    }
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0
      live.current.theme = themeOf(el)
      const frozen = still || motion.matches || !visible || document.hidden
      paint(still || motion.matches)
      if (!frozen) { last = performance.now(); frame = requestAnimationFrame(loop) }
    }
    live.current.redraw = sync
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync() })
    io?.observe(el)
    const themeHost = el.closest('[data-theme]')
    const mo = themeHost && typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null
    if (themeHost) mo?.observe(themeHost, { attributes: true, attributeFilter: ['data-theme'] })
    document.addEventListener('visibilitychange', sync); motion.addEventListener?.('change', sync)
    sync()
    return () => { cancelAnimationFrame(frame); io?.disconnect(); mo?.disconnect(); document.removeEventListener('visibilitychange', sync); motion.removeEventListener?.('change', sync) }
  }, [size, still, inset])

  // A still pearl (message avatars, reduced motion) repaints only when its state changes.
  useEffect(() => { live.current.redraw() }, [state, cancel])

  return <canvas ref={canvas} className={className} style={{ width: size, height: size, display: 'block' }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-state={state} />
}
