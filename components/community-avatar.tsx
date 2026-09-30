'use client'

import { useEffect, useId, useState, type CSSProperties } from 'react'
import { apiUrl } from '@/lib/api/_http'
import x from './maison/community.module.css'

/** Community media is stored as API-relative paths (`/v1/community/media/<id>`); resolve them against the API origin. */
export function mediaSrc(url?: string | null): string | null {
  if (!url) return null
  return url.startsWith('/v1/') ? apiUrl(url) : url
}

function seedHash(seed: string): number {
  // FNV-1a: stable across sessions so a member keeps the same mark everywhere.
  let h = 0x811c9dc5
  for (const ch of seed.toLowerCase()) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}

type Seeded = { tone: number; variant: number; turn: number; a: number; b: number; c: number }
function seeded(seed: string): Seeded {
  const h = seedHash(seed || 'anonymous')
  return { tone: h % 4, variant: (h >>> 2) % 4, turn: ((h >>> 5) % 24) * 15, a: (h >>> 10) % 7, b: (h >>> 13) % 5, c: (h >>> 16) % 6 }
}

/** Arc of radius r from angle `from` sweeping `sweep` degrees, around (20,20). */
function arc(r: number, from: number, sweep: number) {
  const rad = (deg: number) => (deg - 90) * Math.PI / 180
  const p = (deg: number) => `${(20 + r * Math.cos(rad(deg))).toFixed(2)} ${(20 + r * Math.sin(rad(deg))).toFixed(2)}`
  return `M ${p(from)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${p(from + sweep)}`
}

function polygon(sides: number, r: number) {
  return Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2 - Math.PI / 2
    return `${(20 + r * Math.cos(t)).toFixed(2)},${(20 + r * Math.sin(t)).toFixed(2)}`
  }).join(' ')
}

/**
 * Generated member seal: a lacquer disc engraved with a seeded geometric figure in gilt.
 * Colours come from CSS variables so the same mark reads as ivory/lacquer or navy/gold per theme.
 */
export function CommunityMark({ seed, size = 40, className, style }: { seed: string; size?: number; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '')
  const s = seeded(seed)
  const figure = (() => {
    switch (s.variant) {
      case 0: // Orbits: three nested arcs with seeded gaps.
        return <>
          <path d={arc(13, 0, 250 + s.a * 12)} className={x.markStroke} />
          <path d={arc(9, 40 + s.b * 30, 200 + s.c * 14)} className={x.markStroke} />
          <path d={arc(5, 90, 180 + s.a * 20)} className={x.markSoft} />
          <circle cx="20" cy="7" r="1.6" className={x.markFill} />
        </>
      case 1: // Facet: a seeded polygon with a struck inner figure.
        return <>
          <polygon points={polygon(3 + (s.a % 4), 12.5)} className={x.markStroke} />
          <polygon points={polygon(3 + (s.b % 4), 6.5)} className={x.markSoft} transform="rotate(180 20 20)" />
          <circle cx="20" cy="20" r="1.8" className={x.markFill} />
        </>
      case 2: // Meridian: a ring crossed by a chord, with a crescent moon.
        return <>
          <circle cx="20" cy="20" r="12" className={x.markStroke} />
          <line x1="8" y1={20 - s.b} x2="32" y2={20 - s.b} className={x.markSoft} />
          <circle cx={20 + (s.c - 2.5) * 1.6} cy={20 + 5 - s.b / 2} r="4.2" className={x.markFill} />
        </>
      default: // Stack: three stepped bars, like a struck ingot mark.
        return <>
          {[0, 1, 2].map(i => <rect key={i} x={11 + ((s.a + i * s.b) % 4)} y={12 + i * 6} width={14 + ((s.c + i) % 3) * 2} height="3" rx="1.5" className={i === 1 ? x.markFill : x.markSoftFill} />)}
          <circle cx="20" cy="20" r="14" className={x.markSoft} />
        </>
    }
  })()
  return (
    <svg className={`${x.avatar} ${x.mark} ${className ?? ''}`} data-tone={s.tone} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={style}>
      <defs>
        <radialGradient id={`g${id}`} cx="30%" cy="22%" r="85%">
          <stop offset="0" className={x.markHi} />
          <stop offset="1" className={x.markLo} />
        </radialGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#g${id})`} />
      <g transform={`rotate(${s.turn} 20 20)`}>{figure}</g>
      <circle cx="20" cy="20" r="20" fill={`url(#s${id})`} />
      <circle cx="20" cy="20" r="19.4" className={x.markRim} />
    </svg>
  )
}

/** Real photo when the member has one and it loads; otherwise the generated seal for their handle. */
export function CommunityAvatar({ avatarUrl, handle, size = 40, className }: { avatarUrl?: string | null; handle?: string | null; size?: number; className?: string }) {
  const src = mediaSrc(avatarUrl)
  const [broken, setBroken] = useState<string | null>(null)
  useEffect(() => { setBroken(null) }, [src])
  if (src && broken !== src) {
    return <img className={`${x.avatar} ${className ?? ''}`} style={{ width: size, height: size }} src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(src)} />
  }
  return <CommunityMark seed={handle ?? 'anonymous'} size={size} className={className} />
}
