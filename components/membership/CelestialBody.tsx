'use client'

import { useEffect, useRef } from 'react'

/**
 * One celestial body per galaxy level (2026-11-04), drawn on a canvas so it can move a little: dust drifting, a lit
 * planet turning, a star breathing, a cluster twinkling, a nebula's clouds rolling, a spiral galaxy turning, the Milky
 * Way's band of stars. Ink and brand teal only, on deep space; stars come from a seeded generator so a level always
 * looks the same. Pauses when off screen; reduced motion draws one still frame.
 */
type Star = { x: number; y: number; r: number; a: number; p: number }

function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const TEAL = '42, 196, 168'
const ICE = '170, 214, 255'
const WARM = '255, 214, 160'

export function CelestialBody({ level, size = 160, still = false, className }: { level: number; size?: number; still?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size * dpr; canvas.height = size * dpr
    const g = canvas.getContext('2d')
    if (!g) return
    g.scale(dpr, dpr)
    const rand = seeded(level * 7919)
    const c = size / 2
    const field: Star[] = Array.from({ length: 60 + level * 25 }, () => ({ x: rand() * size, y: rand() * size, r: rand() * 1.1 + .2, a: rand() * .6 + .2, p: rand() * Math.PI * 2 }))
    const cluster: Star[] = Array.from({ length: 90 }, () => { const d = Math.pow(rand(), 1.8) * size * .32, t = rand() * Math.PI * 2; return { x: c + Math.cos(t) * d, y: c + Math.sin(t) * d, r: rand() * 1.6 + .4, a: rand() * .5 + .5, p: rand() * 6.3 } })
    const arms: Star[] = Array.from({ length: 520 }, () => { const arm = rand() < .5 ? 0 : Math.PI, d = Math.pow(rand(), .9), t = arm + d * 4.2 + (rand() - .5) * .55; return { x: d, y: t, r: rand() * 1.1 + .3, a: rand() * .6 + .3, p: rand() * 6.3 } })
    const band: Star[] = Array.from({ length: 700 }, () => { const u = rand(), off = (rand() + rand() + rand() - 1.5) * size * .12; return { x: u * size, y: off, r: rand() * 1 + .2, a: rand() * .7 + .2, p: rand() * 6.3 } })
    const reduced = still || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0, raf = 0, visible = true, last = 0
    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(${rgb}, ${a})`); grad.addColorStop(1, `rgba(${rgb}, 0)`)
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
    const dot = (x: number, y: number, r: number, rgb: string, a: number) => { g.fillStyle = `rgba(${rgb}, ${a})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
    const draw = (t: number) => {
      g.clearRect(0, 0, size, size)
      for (const s of field) dot(s.x, s.y, s.r, '255, 255, 255', s.a * (.65 + .35 * Math.sin(t * 1.3 + s.p)))
      switch (level) {
        case 1: // stardust: a loose drifting veil of grains
          for (let i = 0; i < 160; i++) { const s = cluster[i % cluster.length], dx = Math.sin(t * .3 + s.p) * 6; dot(s.x + dx, s.y + Math.cos(t * .2 + s.p) * 4, s.r * .7, i % 3 ? '255, 255, 255' : TEAL, s.a * .55) }
          break
        case 2: { // planet: a lit sphere with a thin ring
          const r = size * .26
          glow(c, c, r * 1.7, TEAL, .16)
          const body = g.createRadialGradient(c - r * .45, c - r * .45, r * .1, c, c, r)
          body.addColorStop(0, 'rgba(160, 236, 220, 1)'); body.addColorStop(.6, 'rgba(24, 120, 104, 1)'); body.addColorStop(1, 'rgba(6, 28, 30, 1)')
          g.fillStyle = body; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill()
          g.save(); g.translate(c, c); g.rotate(-.35); g.scale(1, .28); g.strokeStyle = `rgba(${ICE}, .55)`; g.lineWidth = 3
          g.beginPath(); g.arc(0, 0, r * 1.55, Math.PI * .02 + t * 0, Math.PI * .98); g.stroke(); g.restore()
          break
        }
        case 3: { // star: a breathing sun with a corona
          const pulse = 1 + Math.sin(t * 1.6) * .05
          glow(c, c, size * .48 * pulse, WARM, .22); glow(c, c, size * .3 * pulse, WARM, .45)
          dot(c, c, size * .13, '255, 246, 228', 1)
          g.strokeStyle = `rgba(${WARM}, .35)`; g.lineWidth = 1
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * .1, r1 = size * .17, r2 = size * (.26 + .03 * Math.sin(t * 2 + i)); g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke() }
          break
        }
        case 4: // cluster: a tight ball of twinkling stars
          glow(c, c, size * .36, ICE, .14)
          for (const s of cluster) dot(s.x, s.y, s.r, s.p > 4.5 ? TEAL : '255, 255, 255', s.a * (.6 + .4 * Math.sin(t * 2.2 + s.p)))
          break
        case 5: // nebula: three rolling clouds and a few young stars
          glow(c - size * .12 + Math.sin(t * .2) * 6, c - size * .06, size * .34, TEAL, .32)
          glow(c + size * .14, c + size * .08 + Math.cos(t * .25) * 5, size * .3, '120, 140, 255', .26)
          glow(c, c + size * .16, size * .22, WARM, .16)
          for (let i = 0; i < 24; i++) { const s = cluster[i]; dot(s.x, s.y, s.r, '255, 255, 255', .85) }
          break
        case 6: { // galaxy: two spiral arms turning slowly
          glow(c, c, size * .16, WARM, .6)
          const spin = t * .12
          for (const s of arms) { const d = s.x * size * .44, a = s.y + spin; dot(c + Math.cos(a) * d, c + Math.sin(a) * d * .62, s.r, s.x < .25 ? WARM : s.p > 4 ? TEAL : '255, 255, 255', s.a * (1 - s.x * .5)) }
          break
        }
        default: { // milky way: a tilted band of dense stars with a dust lane
          g.save(); g.translate(c, c); g.rotate(-.5); g.translate(-c, 0)
          glow(c, 0, size * .5, ICE, .1)
          for (const s of band) { const x = (s.x + t * 4) % size; dot(x, s.y, s.r, s.p > 5 ? TEAL : s.p > 4.4 ? WARM : '255, 255, 255', s.a * (1 - Math.abs(s.y) / (size * .3))) }
          g.fillStyle = 'rgba(4, 6, 12, .55)'; g.fillRect(0, -2, size, 4)
          g.restore()
        }
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible || now - last < 33) return
      last = now; frame += 1
      draw(now / 1000)
    }
    draw(0)
    if (reduced) return
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(canvas)
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); io.disconnect(); void frame }
  }, [level, size, still])
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}
