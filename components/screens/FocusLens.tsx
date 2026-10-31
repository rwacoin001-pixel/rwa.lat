'use client'

/**
 * The sign-in hero (2026-11-01, user: redesign the welcome — simple, refined, technical). The brand line is "Bring assets
 * into focus", so the picture is a lens: a slow colour field inside a glass disc that sharpens once when the page opens,
 * ringed by a thin instrument dial (fine ticks, a dashed scale, one teal marker going round). Paper behind it, no photo.
 * Motion: the field drifts, the dial turns very slowly; all of it stops under reduced motion or off screen.
 */
import { MeshGradient } from '@paper-design/shaders-react'
import { useEffect, useRef, useState } from 'react'
import f from './auth-focus.module.css'

const DAY = ['#14b8a6', '#2563eb', '#7c3aed', '#f0abfc', '#99f6e4', '#fef3c7']
const NIGHT = ['#0d9488', '#1d4ed8', '#6d28d9', '#be185d', '#134e4a', '#0f172a']

const TICKS = Array.from({ length: 120 }, (_, i) => i)

export function FocusLens({ night = false }: { night?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [still, setStill] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setStill(media.matches)
    sync()
    media.addEventListener('change', sync)
    const node = ref.current
    const watch = node && 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)) : null
    if (node && watch) watch.observe(node)
    return () => { media.removeEventListener('change', sync); watch?.disconnect() }
  }, [])
  return <div ref={ref} className={f.lens} aria-hidden="true">
    <span className={f.halo} />
    <span className={f.disc}>
      <MeshGradient className={f.mesh} colors={night ? NIGHT : DAY} distortion={0.8} swirl={0.6} speed={visible && !still ? 0.32 : 0} minPixelRatio={1} maxPixelCount={360 * 360} />
      <span className={f.glass} />
    </span>
    <svg className={f.dial} viewBox="0 0 200 200">
      <g className={f.ticks}>
        {TICKS.map((i) => <line key={i} x1="100" y1={i % 10 === 0 ? 1.5 : 3.5} x2="100" y2="7" transform={`rotate(${i * 3} 100 100)`} data-major={i % 10 === 0 || undefined} />)}
      </g>
      <circle className={f.scale} cx="100" cy="100" r="88" />
      <g className={f.orbit}><circle className={f.ring} cx="100" cy="100" r="93" /><circle className={f.marker} cx="100" cy="7" r="2.4" /></g>
    </svg>
  </div>
}
