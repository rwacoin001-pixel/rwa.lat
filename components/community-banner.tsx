'use client'

import { useId, type CSSProperties } from 'react'
import c from './community-x.module.css'

/**
 * Default profile banner: a seeded mesh gradient (soft colour fields) with contour lines and fine grain.
 * The handle picks one of the curated hue families plus the field layout, so every member gets a stable,
 * distinct banner. Colours are CSS variables with a light and a dark set; the theme switch in
 * community-x.module.css picks one, so the banner follows the app theme without re-rendering.
 */

/** Hue families (degrees); each banner uses a base hue and two seeded neighbours from its family. */
const FAMILIES = [
  [28, 12, 345], // apricot → coral → rose
  [205, 225, 185], // sky → cornflower → lagoon
  [158, 140, 190], // sage → moss → teal
  [42, 30, 58], // sand → amber → straw
  [265, 290, 235], // lilac → orchid → periwinkle
  [350, 15, 320], // blush → peach → mauve
  [190, 165, 215], // sea glass
  [220, 260, 200], // dusk blue → violet
] as const

function hash(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32) so the same handle always draws the same banner. */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 600, H = 200

export function CommunityBanner({ seed }: { seed: string }) {
  const id = useId().replace(/:/g, '')
  const r = rng(hash(seed || 'a-reit'))
  const family = FAMILIES[Math.floor(r() * FAMILIES.length)]
  const hues = family.map((hue) => (hue + Math.round((r() - .5) * 14) + 360) % 360)
  // Light: airy pastels. Dark: deep, low-light versions of the same hues, so the banner reads on #000.
  const vars: Record<string, string> = {}
  hues.forEach((hue, i) => {
    vars[`--bn-l${i}`] = `hsl(${hue} ${66 + i * 6}% ${76 - i * 5}%)`
    vars[`--bn-d${i}`] = `hsl(${hue} ${42 + i * 6}% ${24 + i * 4}%)`
  })
  vars['--bn-lb'] = `hsl(${hues[0]} 40% 92%)`
  vars['--bn-db'] = `hsl(${hues[0]} 30% 12%)`
  const fields = [0, 1, 2, 1, 0].map((tone, i) => ({
    tone,
    cx: Math.round((i / 4) * W * .9 + r() * W * .2),
    cy: Math.round(r() * H),
    rx: Math.round(W * (.22 + r() * .18)),
    ry: Math.round(H * (.45 + r() * .4)),
  }))
  // Contour lines: a family of stacked waves sharing one seeded phase, like a topographic map.
  const phase = r() * Math.PI * 2, amp = 10 + r() * 14, freq = 1.2 + r() * 1.4, tilt = (r() - .5) * 60
  const contours = Array.from({ length: 5 }, (_, k) => {
    const base = 30 + k * 38 + (r() - .5) * 12, swell = amp * (.6 + r() * .8)
    const points = Array.from({ length: 25 }, (_, j) => {
      const x = (j / 24) * W
      const y = base + tilt * (j / 24 - .5) + Math.sin(phase + (j / 24) * Math.PI * 2 * freq + k * .7) * swell
      return `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    return points.join(' ')
  })
  return <svg className={c.bannerArt} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={vars as CSSProperties} aria-hidden="true" focusable="false">
    <defs>
      <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="38" /></filter>
      <filter id={`${id}-grain`}><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .9 0" /></filter>
    </defs>
    <rect width={W} height={H} className={c.bannerBase} />
    <g filter={`url(#${id}-blur)`}>
      {fields.map((f, i) => <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} className={c[`bannerTone${f.tone}`]} />)}
    </g>
    <g className={c.bannerLines}>{contours.map((d, i) => <path key={i} d={d} />)}</g>
    <rect width={W} height={H} filter={`url(#${id}-grain)`} className={c.bannerGrain} />
  </svg>
}
