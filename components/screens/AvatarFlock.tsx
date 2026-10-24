'use client'
import type { CSSProperties } from 'react'
import styles from './AvatarFlock.module.css'

/**
 * Palette A sign-in backdrop: people stream out of one brand-green core and fly past the viewer — the community you
 * join. Avatars are DiceBear "notionists" (CC0 1.0, by Zoish), the same style the app uses for profile pictures,
 * pre-rendered into /media/palette-a/avatars so the page never loads the avatar library.
 * Pure CSS 3D: every face runs one compositor-only keyframe loop with its own direction, tint and start offset.
 */
const FACES = 18
const COUNT = 30
const LOOP = 11 // seconds for one face to travel from the core past the viewer
const TINTS = ['#ffffff', '#dff6f1', '#eceff3', '#ffffff', '#c9f0e7', '#f4f5f7']

// Deterministic spread (no Math.random, so server and client render the same markup).
const FLOCK = Array.from({ length: COUNT }, (_, i) => {
  const angle = i * 2.39996 // golden angle: even coverage of every direction
  const reach = 150 + ((i * 37) % 5) * 26
  return {
    face: `a${String(i % FACES).padStart(2, '0')}`,
    x: Math.round(Math.cos(angle) * reach * 1.15),
    y: Math.round(Math.sin(angle) * reach * .95),
    delay: -((i * LOOP) / COUNT),
    size: 46 + ((i * 13) % 4) * 6,
    tint: TINTS[i % TINTS.length],
  }
})

export function AvatarFlock() {
  return <div className={styles.flock} aria-hidden="true">
    <div className={styles.space}>
      {FLOCK.map((f, i) => <span key={i} className={styles.face}
        style={{ '--x': `${f.x}px`, '--y': `${f.y}px`, '--d': `${f.delay}s`, '--s': `${f.size}px`, '--t': f.tint, '--loop': `${LOOP}s` } as CSSProperties}>
        <img src={`/media/palette-a/avatars/${f.face}.svg`} alt="" draggable={false} decoding="async" />
      </span>)}
    </div>
    <i className={styles.core} />
  </div>
}
