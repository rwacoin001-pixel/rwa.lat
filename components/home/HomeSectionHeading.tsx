'use client'

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import styles from './HomeSectionHeading.module.css'

export function HomeSectionHeading({ index, title, more, onMore, children }: { index: string; title: string; more?: string; onMore?: () => void; children?: ReactNode }) {
  return <div className={styles.root} data-home-section={index}>
    <h2><span className={styles.index} aria-hidden="true">{index}</span><span>{title}</span></h2>
    {onMore && <button type="button" onClick={onMore}>{more}<ChevronRight size={14} aria-hidden="true" /></button>}
    {children}
  </div>
}
