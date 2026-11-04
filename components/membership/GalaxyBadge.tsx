'use client'

import { levelKey } from '@/lib/api/membership'
import { LEVEL_NAMES } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { Medallion } from './Medallion'
import s from './membership.module.css'

/** A small coin + "L4 星座" (2026-11-05: the rank is always explicit; the coin's material carries the tier). `tone="light"` on dark grounds. */
export function GalaxyBadge({ level, tone = 'ink', className }: { level: number; tone?: 'ink' | 'light'; className?: string }) {
  const { locale } = useI18n()
  const n = Math.min(7, Math.max(1, Math.round(level || 1)))
  const name = (LEVEL_NAMES[locale] ?? LEVEL_NAMES.en)[levelKey(n)]
  return <span className={`${s.badge}${className ? ` ${className}` : ''}`} data-tone={tone} data-level={n}><Medallion level={n} size={16} className={s.badgeCoin} /><span className={s.badgeRank}>L{n}</span>{name}</span>
}
