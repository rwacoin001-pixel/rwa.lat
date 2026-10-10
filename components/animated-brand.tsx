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
      aria-label="A-REIT"
    >
      <img
        className={`${styles.lockup} ${styles.darkLockup}`}
        src={markOnly ? '/brand/a-reit/mark-dark.svg' : '/brand/a-reit/logo-dark.svg'}
        alt=""
        aria-hidden="true"
      />
      <img
        className={`${styles.lockup} ${styles.lightLockup}`}
        src={markOnly ? '/brand/a-reit/mark-light.svg' : '/brand/a-reit/logo-light.svg'}
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
