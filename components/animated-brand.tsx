'use client'

import styles from './animated-brand.module.css'

export default function AnimatedBrand({ compact = false, markOnly = false }: { compact?: boolean; markOnly?: boolean }) {
  return (
    <div
      className={`brand ${styles.brand} ${compact ? `${styles.compact} brand--compact` : ''} ${markOnly ? styles.markOnly : ''}`}
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
