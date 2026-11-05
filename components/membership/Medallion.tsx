'use client'

/**
 * The level gem (2026-11-05 v3, user: "the badge still is not right — 3D, faceted metal, premium"): one compass star —
 * four long points and four short ones — whose material climbs graphite → silver → champagne → platinum → ice crystal →
 * black and silver → black and gold. Studio renders keyed to alpha in public/media/membership/gem-L{n}.webp (source
 * render + the gradient-map script in G:/Media/a-reit-levels/v2 and tools/family.py). Pure image, so it costs no frames.
 */
export function Medallion({ level, size = 64, className }: { level: number; size?: number; className?: string }) {
  const n = Math.min(7, Math.max(1, Math.round(level || 1)))
  return <img src={gemSrc(n)} alt="" width={size} height={size} className={className} draggable={false} decoding="async" aria-hidden="true" />
}

export const gemSrc = (level: number) => `/media/membership/gem-L${Math.min(7, Math.max(1, Math.round(level || 1)))}.webp`
