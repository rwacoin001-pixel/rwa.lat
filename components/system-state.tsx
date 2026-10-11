'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight, Compass, RotateCw, ShieldCheck } from 'lucide-react'
import AnimatedBrand from './animated-brand'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { systemStateCopy } from '@/lib/system-state-copy'
import styles from './system-state.module.css'

/** Full-page recovery surface shared by the error boundary and the 404 route, in the Maison warm/cool palette. */
export function SystemState({ kind, reference, onRetry, retrying = false }: {
  kind: 'error' | 'notFound'
  /** Error digest or status code, shown so support can trace the failure. */
  reference?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  const { locale } = useI18n()
  const { theme } = useRwaTheme()
  const all = systemStateCopy[locale]
  const copy = kind === 'error' ? all.error : all.notFound
  const homeLabel = copy.home
  const primary: ReactNode = kind === 'error' && onRetry
    ? <button type="button" className={styles.primary} onClick={onRetry} disabled={retrying}>
        <span>{retrying ? all.error.reloading : all.error.retry}</span>
        <span className={styles.primaryIcon} data-spin={retrying} aria-hidden="true"><RotateCw size={18} strokeWidth={1.7} /></span>
      </button>
    : <Link href="/home" className={styles.primary}>
        <span>{homeLabel}</span>
        <span className={styles.primaryIcon} aria-hidden="true"><ArrowUpRight size={18} strokeWidth={1.7} /></span>
      </Link>

  return <main className={styles.page} data-theme={theme === 'dark' ? 'cool' : 'warm'} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <span className={styles.glow} aria-hidden="true" />
    <header className={styles.top}><AnimatedBrand compact /></header>
    <section className={styles.card} aria-labelledby="system-state-title">
      <span className={styles.grain} aria-hidden="true" />
      <div className={styles.head}>
        <span className={styles.seal} aria-hidden="true">
          {kind === 'error' ? <RotateCw size={20} strokeWidth={1.5} /> : <Compass size={20} strokeWidth={1.5} />}
        </span>
        {reference && <p className={styles.reference} dir="ltr"><span>{kind === 'error' ? all.error.reference : 'HTTP'}</span>{reference}</p>}
      </div>
      <p className={styles.kicker}>{copy.kicker}</p>
      <h1 id="system-state-title" className={styles.title}>{copy.title}</h1>
      <p className={styles.body}>{copy.body}</p>
      <p className={styles.safe}><ShieldCheck size={16} strokeWidth={1.7} aria-hidden="true" /><span>{copy.safe}</span></p>
      <div className={styles.actions}>
        {primary}
        {kind === 'error'
          ? <Link href="/home" className={styles.secondary}>{homeLabel}</Link>
          : <Link href="/profile/support" className={styles.secondary}>{all.notFound.help}</Link>}
      </div>
    </section>
  </main>
}
