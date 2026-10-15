'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { clearSession, readSession, request } from '@/lib/api/_http'
import { APP_HANDOFF_COPY, appReturnUrls, readAppLoginParams } from '@/lib/app-handoff'
import styles from '@/components/screens/P02-Login.module.css'
import { AuthShell } from '@/components/screens/AuthShell'

type Phase = { kind: 'working' } | { kind: 'back'; intent: string; scheme: string } | { kind: 'invalid' } | { kind: 'failed' }

/**
 * Opened by the Android app in the system browser (lib/app-handoff.ts). Signs in as usual if needed (login returns
 * here), then asks for the app's one-time code and hands it back to the app.
 */
export default function AppLoginPage() {
  const { locale } = useI18n()
  const copy = APP_HANDOFF_COPY[locale] ?? APP_HANDOFF_COPY.en
  const [phase, setPhase] = useState<Phase>({ kind: 'working' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const params = readAppLoginParams(location.search)
    if (!params) { setPhase({ kind: 'invalid' }); return }
    if (!readSession()) {
      location.replace(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    let active = true
    setPhase({ kind: 'working' })
    void request<{ code: string }>('/v1/auth/app-handoff', { method: 'POST', body: JSON.stringify({ challenge: params.challenge }), loading: 'silent' }).then(result => {
      if (!active) return
      // The browser's session ended since: sign in again, then come back here.
      if (!result.ok && result.error.status === 401) {
        clearSession()
        location.replace(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      const urls = result.ok ? appReturnUrls(result.data.code, params.state) : null
      if (!urls) { setPhase({ kind: 'failed' }); return }
      setPhase({ kind: 'back', ...urls })
      // Android browsers that understand intent links open the app at once; the button stays for the rest.
      if (/Android/i.test(navigator.userAgent)) location.href = urls.intent
    })
    return () => { active = false }
  }, [attempt])

  return <AuthShell attrs={{ 'data-auth-mode': 'app-login', 'data-auth-compact': 'true' }}>
    <header className={styles.cardHead}>
      <h1 className={styles.cardTitle}>{copy.title}</h1>
      <p className={styles.cardLede} role="status">
        {phase.kind === 'working' ? copy.signingIn : phase.kind === 'back' ? copy.backHint : phase.kind === 'invalid' ? copy.invalid : copy.failed}
      </p>
    </header>
    {phase.kind === 'back' && <a className={styles.primary} href={phase.scheme}>{copy.back}</a>}
    {phase.kind === 'failed' && <button type="button" className={styles.primary} onClick={() => setAttempt(value => value + 1)}>{copy.retry}</button>}
  </AuthShell>
}
