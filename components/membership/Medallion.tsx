'use client'

/**
 * The level medallion (2026-11-05, user: the level icons must be refined and premium; designed with Codex): one family
 * of seven coins that climb graphite → steel → silver, gold only on L6–L7 — studio renders keyed to alpha in
 * public/media/membership/L{n}.webp (sources + prompts in G:/Media/a-reit-levels). Pure image, so it costs no frames.
 */
export function Medallion({ level, size = 64, className }: { level: number; size?: number; className?: string }) {
  const n = Math.min(7, Math.max(1, Math.round(level || 1)))
  return <img src={`/media/membership/L${n}.webp`} alt="" width={size} height={size} className={className} draggable={false} decoding="async" aria-hidden="true" />
}
