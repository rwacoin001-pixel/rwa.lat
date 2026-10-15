'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { request, saveSession } from '@/lib/api/_http'
import { APP_HANDOFF_COPY, readInjectedHandoff } from '@/lib/app-handoff'
import styles from '@/components/screens/P02-Login.module.css'
import { AuthShell } from '@/components/screens/AuthShell'

declare global { interface Window { __rwaAppHandoff?: unknown } }

/**
 * Opened inside the Android app after the browser hands a code back (lib/app-handoff.ts). The app injects the code
 * and its verifier at document start; nothing is read from the URL. Redeems them for the app's own session.
 */
export default function AppHandoffPage() {
  const { locale } = useI18n()
  const copy = APP_HANDOFF_COPY[locale] ?? APP_HANDOFF_COPY.en
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let waited = 0
    const run = async () => {
      const handoff = readInjectedHandoff(window.__rwaAppHandoff)
      if (!handoff) {
        // Older WebViews inject after the page starts; give them a moment.
        if ((waited += 100) < 4000) { window.setTimeout(() => { if (active) void run() }, 100); return }
        setFailed(true)
        return
      }
      window.__rwaAppHandoff = undefined
      const result = await request<{ token: string; sessionId: string; userId: string }>('/v1/auth/app-handoff/redeem', { method: 'POST', body: JSON.stringify(handoff), loading: 'silent' })
      if (!active) return
      if (!result.ok || !result.data.token) { setFailed(true); return }
      saveSession(result.data.token, { sessionId: result.data.sessionId, userId: result.data.userId })
      location.replace('/home')
    }
    void run()
    return () => { active = false }
  }, [])

  return <AuthShell attrs={{ 'data-auth-mode': 'app-handoff', 'data-auth-compact': 'true' }}>
    <header className={styles.cardHead}>
      <h1 className={styles.cardTitle}>{copy.title}</h1>
      <p className={styles.cardLede} role="status">{failed ? copy.failed : copy.inApp}</p>
    </header>
    {failed && <a className={styles.primary} href="/login">{copy.toLogin}</a>}
  </AuthShell>
}
