import type { ReactNode } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import styles from './notice.module.css'

export type NoticeTone = 'error' | 'ok' | 'info'

// Inline message card: icon + soft tinted background, colours from the --notice-* tokens.
export function Notice({ tone = 'info', quiet, className, children }: { tone?: NoticeTone; quiet?: boolean; className?: string; children: ReactNode }) {
  const Icon = tone === 'ok' ? Check : tone === 'error' ? AlertTriangle : Info
  return <div className={className ? `${styles.notice} ${className}` : styles.notice} data-tone={tone} data-quiet={quiet || undefined} role={tone === 'error' && !quiet ? 'alert' : 'status'}>
    <Icon size={16} aria-hidden="true" />
    <span>{children}</span>
  </div>
}
