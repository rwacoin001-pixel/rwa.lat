'use client'

import { levelKey } from '@/lib/api/membership'
import { LEVEL_NAMES } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import s from './membership.module.css'

/** A line glyph per level (ink only, no tinted tile — docs/design-system.md §6): dust, planet, star, cluster, nebula, galaxy, band. */
export function LevelGlyph({ level, size = 14 }: { level: number; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, 'aria-hidden': true }
  switch (Math.min(7, Math.max(1, level))) {
    case 1: return <svg {...common}><circle cx="4" cy="6" r=".8" fill="currentColor" /><circle cx="9" cy="4" r=".6" fill="currentColor" /><circle cx="11" cy="10" r=".9" fill="currentColor" /><circle cx="6" cy="11" r=".6" fill="currentColor" /></svg>
    case 2: return <svg {...common}><circle cx="8" cy="8" r="4" /><ellipse cx="8" cy="8" rx="7" ry="2.2" transform="rotate(-20 8 8)" /></svg>
    case 3: return <svg {...common}><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2 2M10.6 10.6l2 2M12.6 3.4l-2 2M5.4 10.6l-2 2" /><circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" /></svg>
    case 4: return <svg {...common}>{[[8, 4], [4.5, 7], [11.5, 7], [6, 11], [10, 11], [8, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="currentColor" stroke="none" />)}</svg>
    case 5: return <svg {...common}><path d="M3 10.5c-1.5-1.5-.5-4 1.8-4 .4-2.2 3.6-2.8 4.8-1 2-.6 3.8 1 3.2 3 1.4.8.9 3-1 3H4.6" /></svg>
    case 6: return <svg {...common}><path d="M8 8c1.3-1 .6-2.8-1-2.8C5 5.2 4 7.2 4.6 9c.8 2.4 4 3.2 6.2 1.8 2.6-1.7 2.6-5.6.2-7.4" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /></svg>
    default: return <svg {...common}><path d="M1.5 11.5C5 9 11 7 14.5 4.5" /><circle cx="4" cy="9" r=".7" fill="currentColor" stroke="none" /><circle cx="8" cy="7.6" r=".9" fill="currentColor" stroke="none" /><circle cx="12" cy="6" r=".7" fill="currentColor" stroke="none" /></svg>
  }
}

/** Glyph + level name. `tone="light"` for use on dark/photo grounds. */
export function GalaxyBadge({ level, tone = 'ink', className }: { level: number; tone?: 'ink' | 'light'; className?: string }) {
  const { locale } = useI18n()
  const name = (LEVEL_NAMES[locale] ?? LEVEL_NAMES.en)[levelKey(level)]
  return <span className={`${s.badge}${className ? ` ${className}` : ''}`} data-tone={tone} data-level={level}><LevelGlyph level={level} />{name}</span>
}
