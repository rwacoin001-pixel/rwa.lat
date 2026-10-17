'use client'

import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import styles from './HomeSectionHeading.module.css'

// Home sections are not a sequence, so they carry no 01–06 numbering; the title alone leads each block.
export function HomeSectionHeading({ index, title, more, onMore, children }: { index?: string; title: string; more?: string; onMore?: () => void; children?: ReactNode }) {
  return <div className={styles.root} data-home-section={index}>
    <h2><span>{title}</span></h2>
    {onMore && <button type="button" onClick={onMore}>{more}<ArrowUpRight size={15} aria-hidden="true" /></button>}
    {children}
  </div>
}
