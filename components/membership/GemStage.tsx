'use client'

/**
 * The level gem on stage (2026-11-05 v3, user: "3D, with fitting motion"). The gem is a studio render; the depth is
 * ours: it leans toward the finger (and the phone's tilt on Android) in real perspective, floats and sways a little at
 * rest, a band of light crosses its facets every few seconds (masked to the gem itself), and a hairline orbit passes
 * behind it and in front of it with one small bead travelling the near side. It swings in once on entry. Reduced motion
 * keeps everything still. Transform and opacity only.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { gemSrc } from './Medallion'
import st from './gem-stage.module.css'

const MAX_TILT = 14

export function GemStage({ level, size = 168, className, track }: { level: number; size?: number; className?: string; /** An element whose pointer moves also lean the gem (the hero card). */ track?: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  const src = gemSrc(level)

  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const lean = (x: number, y: number) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--rx', `${(-y * MAX_TILT).toFixed(2)}deg`)
        node.style.setProperty('--ry', `${(x * MAX_TILT).toFixed(2)}deg`)
      })
    }
    const area = track?.current ?? node
    const move = (event: PointerEvent) => {
      const box = area.getBoundingClientRect()
      node.dataset.held = ''
      lean(Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1)), Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1)))
    }
    const rest = () => { delete node.dataset.held; lean(0, 0) }
    area.addEventListener('pointermove', move)
    area.addEventListener('pointerleave', rest)
    area.addEventListener('pointerup', rest)
    area.addEventListener('pointercancel', rest)
    // Android gives orientation without a prompt; iOS would ask, which we never do for decoration.
    const Orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined
    let base: { b: number; g: number } | null = null
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null || node.dataset.held !== undefined) return
      base ??= { b: event.beta, g: event.gamma }
      lean(Math.max(-1, Math.min(1, (event.gamma - base.g) / 22)), Math.max(-1, Math.min(1, (event.beta - base.b) / 22)))
    }
    const gyro = Boolean(Orientation && typeof Orientation.requestPermission !== 'function')
    if (gyro) window.addEventListener('deviceorientation', onTilt)
    return () => {
      cancelAnimationFrame(frame)
      area.removeEventListener('pointermove', move); area.removeEventListener('pointerleave', rest); area.removeEventListener('pointerup', rest); area.removeEventListener('pointercancel', rest)
      if (gyro) window.removeEventListener('deviceorientation', onTilt)
    }
  }, [track])

  return <div ref={ref} className={`${st.stage}${className ? ` ${className}` : ''}`} style={{ width: size, height: size, ['--gem' as string]: `url(${src})` } as CSSProperties} aria-hidden="true">
    <svg className={st.orbit} viewBox="-100 -100 200 200" data-side="back"><g transform="rotate(-16)"><path d="M -94 0 A 94 21 0 0 1 94 0" /></g></svg>
    <div className={st.lean}>
      <div className={st.float}>
        <img src={src} alt="" width={size} height={size} draggable={false} className={st.gem} />
        <i className={st.sheen} />
      </div>
    </div>
    <svg className={st.orbit} viewBox="-100 -100 200 200" data-side="front">
      <g transform="rotate(-16)">
        <path id={`orbit-front-${level}`} d="M 94 0 A 94 21 0 0 1 -94 0" />
        <circle r="2.4" className={st.bead}>
          <animateMotion dur="7s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.5;1" calcMode="linear"><mpath href={`#orbit-front-${level}`} /></animateMotion>
          <animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;.06;.44;.5;1" />
        </circle>
      </g>
    </svg>
    <i className={st.shadow} />
  </div>
}
