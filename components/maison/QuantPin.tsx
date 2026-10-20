'use client'

import type { ReactNode } from 'react'
import styles from './quant.module.css'

/**
 * The dial scrolls away with the page like any other content. The three sub-dials sit directly under it as a sticky
 * row: once they reach the topbar they stay there, and the dial passes beneath the topbar's background. Pure CSS
 * sticky, so scrolling does no per-frame JavaScript or layout work.
 */
export function QuantPin({ children, subs }: { children: ReactNode; subs?: ReactNode }) {
  return <>
    <div className={styles.pinDial}>{children}</div>
    {subs && <div className={styles.pinSubs}>{subs}</div>}
  </>
}
