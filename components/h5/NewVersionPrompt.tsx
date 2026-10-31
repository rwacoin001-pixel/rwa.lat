'use client'

import { useI18n } from '@/lib/i18n'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import styles from './new-version-prompt.module.css'

/** A newer release is live (2026-10-31). Offered as one quiet pill: only tapping it reloads the page. */
export function NewVersionPrompt({ onUpdate }: { onUpdate: () => void }) {
  const { locale } = useI18n()
  const copy = rwaH5Copy[locale].shell
  return <div className={styles.prompt} role="status">
    <span>{copy.newVersion}</span>
    <button type="button" onClick={onUpdate}>{copy.updateNow}</button>
  </div>
}
