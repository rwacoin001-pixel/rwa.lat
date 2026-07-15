'use client'

import styles from './animated-brand.module.css'

export default function AnimatedBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand ${styles.brand} ${compact ? `${styles.compact} brand--compact` : ''}`}
      aria-label="RWA.LAT"
    >
      <svg
        className={styles.lockup}
        viewBox="0 0 194 56"
        role="img"
        aria-hidden="true"
      >
        <g id="brand-mark" className={styles.mark}>
          <circle
            id="brand-ring"
            className={styles.ring}
            cx="28"
            cy="28"
            r="20.5"
            pathLength="1"
          />
          <path
            id="brand-axis"
            className={styles.axis}
            d="M7.5 28H46.5"
            pathLength="1"
          />
          <circle id="brand-node" className={styles.node} cx="47" cy="28" r="3.6" />
        </g>

        <g id="brand-wordmark" className={styles.wordmark}>
          <text id="brand-letter-r" className={`${styles.letter} ${styles.letterR}`} x="67" y="34">R</text>
          <text id="brand-letter-w" className={`${styles.letter} ${styles.letterW}`} x="86" y="34">W</text>
          <text id="brand-letter-a1" className={`${styles.letter} ${styles.letterA1}`} x="111" y="34">A</text>
          <text id="brand-letter-dot" className={`${styles.letter} ${styles.letterDot}`} x="132" y="34">.</text>
          <text id="brand-letter-l" className={`${styles.letter} ${styles.letterL}`} x="144" y="34">L</text>
          <text id="brand-letter-a2" className={`${styles.letter} ${styles.letterA2}`} x="163" y="34">A</text>
          <text id="brand-letter-t" className={`${styles.letter} ${styles.letterT}`} x="185" y="34">T</text>
        </g>
      </svg>
    </div>
  )
}
