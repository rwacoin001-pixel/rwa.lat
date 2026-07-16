'use client'

import styles from './animated-brand.module.css'

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
      className={`brand ${styles.brand} ${compact ? `${styles.compact} brand--compact` : ''} ${markOnly ? styles.markOnly : ''} ${homeMotion ? styles.homeMotion : ''}`}
      aria-label="RWA.LAT"
    >
      <img
        className={styles.lockup}
        src="/media/brand/rwa-logo-v2.svg"
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
