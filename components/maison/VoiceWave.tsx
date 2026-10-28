'use client'
import { useEffect, useRef } from 'react'

// Syllable envelope from React Bits Voice Pill (start, length, peak in seconds over a 4.8 s loop). The recognizer owns
// the microphone (Android cannot share it with an analyser), so the bars follow its speech events, not raw audio.
const LOOP = 4.8
const SYLLABLES = [[.1, .16, .9], [.3, .12, .7], [.5, .2, 1], [.95, .14, .8], [1.15, .1, .6], [1.3, .22, .95], [1.9, .16, .85], [2.12, .12, .7], [2.3, .18, .9], [2.55, .1, .5], [3.05, .24, 1], [3.4, .12, .75], [3.6, .16, .9]]
const voiced = (t: number) => {
  const u = t % LOOP
  let a = .06
  for (const [s, d, p] of SYLLABLES) { const x = (u - s) / d; if (x >= 0 && x <= 1) a = Math.max(a, p * .5 * (1 - Math.cos(2 * Math.PI * x))) }
  return a * (.7 + .3 * Math.abs(Math.sin(2 * Math.PI * 7.1 * u)))
}

/** Scrolling bars, newest on the right, fading out to the left; tall while speech is heard, a low murmur otherwise. */
export function VoiceWave({ active, speaking }: { active: boolean; speaking: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), talk = useRef(speaking)
  talk.current = speaking
  useEffect(() => {
    const node = canvas.current
    if (!node || !active) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = getComputedStyle(node).color
    const hist: number[] = []
    let raf = 0, tick = 0, acc = 0, env = 0, last = performance.now()
    const t0 = last
    const frame = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now
      const target = talk.current ? voiced((now - t0) / 1000) : .05 + .04 * Math.abs(Math.sin(now / 260))
      env += (target - env) * (1 - Math.exp(-dt / (target > env ? .04 : .24)))
      const dpr = Math.min(2, window.devicePixelRatio || 1), rect = node.getBoundingClientRect()
      const W = Math.max(1, Math.round(rect.width * dpr)), H = Math.max(1, Math.round(rect.height * dpr))
      if (node.width !== W || node.height !== H) { node.width = W; node.height = H }
      const ctx = node.getContext('2d')
      if (!ctx) return
      acc = Math.max(acc, env); tick = (tick + 1) % 4
      if (tick === 0) { hist.push(acc); acc = 0; if (hist.length > 90) hist.shift() }
      const bw = 2 * dpr, step = 4 * dpr, shift = (tick / 4) * step
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = color
      for (let i = 0; i < hist.length; i++) {
        const v = hist[hist.length - 1 - i], x = W - (i + 1) * step - shift
        if (x + bw < 0) break
        const h = Math.max(bw, (.1 + .9 * Math.min(1, v)) * H), f = Math.min(1, Math.max(0, x / (W * .45)))
        ctx.globalAlpha = (.35 + .65 * Math.min(1, v)) * f * f * (3 - 2 * f)
        ctx.beginPath(); ctx.roundRect(x, (H - h) / 2, bw, h, bw / 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return <canvas ref={canvas} className="ai-voice-wave" aria-hidden="true" style={{ flex: '1 1 auto', minWidth: 0, width: '100%', height: 28, color: 'inherit' }} />
}
