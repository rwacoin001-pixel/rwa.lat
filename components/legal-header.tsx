'use client'

import Link from 'next/link'
import { Moon, Sun } from 'lucide-react'
import LanguageMenu from '@/components/language-menu'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import styles from './legal-page.module.css'

export default function LegalHeader({ kind }: { kind: 'terms' | 'privacy' }) {
  const { locale } = useI18n()
  const { theme, toggleTheme } = useRwaTheme()
  const copy = authVisualCopy[locale]

  return <header className={styles.header}>
    <div className={styles.topbar}>
      <Link href="/" className={styles.brand} aria-label="A-REIT" translate="no">A<i>-</i>REIT</Link>
      <div className={styles.actions}>
        <button className={styles.themeButton} type="button" onClick={toggleTheme} aria-label={copy.switchTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        <LanguageMenu variant="compact" />
      </div>
    </div>
    <nav className={styles.navigation} aria-label={`${copy.terms} / ${copy.privacy}`}>
      <Link href="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>{copy.terms}</Link>
      <Link href="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>{copy.privacy}</Link>
    </nav>
  </header>
}
