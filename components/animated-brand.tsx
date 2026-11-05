'use client'

import styles from './animated-brand.module.css'
import { BRAND } from '@/lib/brand/build-brand'

export default function AnimatedBrand({
  compact = false,
  markOnly = false,
  homeMotion = false,
}: {
  compact?: boolean
  markOnly?: boolean
  homeMotion?: boolean
}) {
  return (
    <div
      className={`brand ${styles.brand} ${BRAND.id === 'kimeng' ? styles.monochrome : ''} ${compact ? `${styles.compact} brand--compact` : ''} ${markOnly ? styles.markOnly : ''} ${homeMotion ? styles.homeMotion : ''}`}
      aria-label={BRAND.name}
    >
      <img
        className={`${styles.lockup} ${styles.darkLockup}`}
        src={`${BRAND.assets}/${markOnly ? 'mark' : 'logo'}-dark.svg`}
        alt=""
        aria-hidden="true"
      />
      <img
        className={`${styles.lockup} ${styles.lightLockup}`}
        src={`${BRAND.assets}/${markOnly ? 'mark' : 'logo'}-light.svg`}
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
