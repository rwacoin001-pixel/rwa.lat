import type { ReactNode } from 'react'
import LegalHeader from './legal-header'
import styles from './legal-page.module.css'

type LegalPageProps = {
  kind: 'terms' | 'privacy'
  title: string
  updated: string
  effectiveDate: string
  children: ReactNode
}

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {title && <h2 className={styles.sectionTitle}>
        <span className={styles.sectionNumber}>{n}.</span>
        {title}
      </h2>}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

export function RiskNote({ children }: { children: ReactNode }) {
  return (
    <div className={styles.riskNote}>
      {children}
    </div>
  )
}

export default function LegalPage({ kind, title, updated, effectiveDate, children }: LegalPageProps) {
  return (
    <div className={styles.root}>
      <a href="#legal-content" className={styles.skipLink}>{title}</a>
      <LegalHeader kind={kind} />

      <main id="legal-content" className={styles.main} tabIndex={-1}>
        <article className={styles.document} aria-labelledby="legal-title">
          <header className={styles.documentHeader}>
            <h1 id="legal-title">{title}</h1>
            {updated && <time dateTime={effectiveDate || undefined}>{updated}</time>}
          </header>
          <div className={styles.content}>{children}</div>
        </article>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 RWA.LAT</p>
        <a href="mailto:support@rwa.lat">support@rwa.lat</a>
      </footer>
    </div>
  )
}
