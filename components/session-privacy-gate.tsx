'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import AppLoading from './app-loading'
import { clearSession, readSession, SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import { clearAiChatSession } from '@/lib/ai-chat-session'
import { logout } from '@/lib/api/auth'
import { listSecurityFactors, stepUpWithPasskey } from '@/lib/api/security'
import { useI18n } from '@/lib/i18n'
import { needsIdleVerification } from '@/lib/session-idle'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { MaisonPage, maison as s } from './maison/primitives'
import { useStepUp } from './maison/StepUp'

const labels = {
  en: ['Unlock', 'Sign in again'], 'zh-CN': ['解锁', '重新登录'], hi: ['अनलॉक करें', 'फिर से लॉग इन करें'],
  es: ['Desbloquear', 'Iniciar sesión de nuevo'], ar: ['فتح القفل', 'تسجيل الدخول مجددًا'],
  fr: ['Déverrouiller', 'Se reconnecter'], pt: ['Desbloquear', 'Entrar novamente'],
} as const

/** Local privacy lock. It does not replace server-side session and money-out authorization. */
export default function SessionPrivacyGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { locale } = useI18n()
  const [status, setStatus] = useState<'checking' | 'open' | 'locked'>('checking')
  const [checkedPath, setCheckedPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef<{ key: string; last: number } | null>(null)
  const locked = useRef(false)
  const leaving = useRef(false)
  const pending = useRef<AbortController | null>(null)
  const { run, sheet } = useStepUp()

  useEffect(() => {
    const clearStoredAiThread = () => { try { clearAiChatSession(window.sessionStorage) } catch { /* Privacy cleanup must not block the session transition. */ } }
    window.addEventListener(SESSION_CHANGED, clearStoredAiThread)
    window.addEventListener(SESSION_EXPIRED, clearStoredAiThread)
    return () => {
      window.removeEventListener(SESSION_CHANGED, clearStoredAiThread)
      window.removeEventListener(SESSION_EXPIRED, clearStoredAiThread)
    }
  }, [])
  // The desktop trust presentation is public, even when an old mobile session exists.
  const publicAuth = pathname === '/desktop' || pathname === '/desktop/' ||
    /^\/(?:login|register|recover|auth)(?:\/|$)/.test(pathname) || pathname === '/terms' || pathname === '/privacy'

  const remember = () => {
    const item = current.current
    if (!item) return
    item.last = Date.now()
    try { localStorage.setItem(item.key, String(item.last)) } catch { /* Keep the in-memory clock. */ }
  }
  const unlock = () => { locked.current = false; remember(); setStatus('open') }

  useEffect(() => {
    let alive = true
    pending.current?.abort(); pending.current = null; setBusy(false)
    const autoPasskey = async () => {
      if (!window.isSecureContext || typeof window.PublicKeyCredential !== 'function' || typeof navigator.credentials?.get !== 'function') return
      const controller = new AbortController()
      pending.current?.abort()
      pending.current = controller
      setBusy(true)
      try {
        const factors = await listSecurityFactors()
        if (!alive || controller.signal.aborted || !locked.current) return
        if (!factors.ok || !factors.data.passkeys.some(item => item.state === 'active')) return
        const result = await stepUpWithPasskey(controller.signal)
        if (alive && !controller.signal.aborted && result.ok && locked.current) unlock()
      } finally { if (alive && pending.current === controller) { pending.current = null; setBusy(false) } }
    }
    const check = () => {
      if (document.visibilityState !== 'visible' || leaving.current) return
      setCheckedPath(pathname)
      const session = readSession()
      if (publicAuth || !session) {
        pending.current?.abort(); current.current = null; locked.current = false; setBusy(false); setStatus('open'); return
      }
      const key = `rwa.idle.${session.userId ?? 'user'}.${session.sessionId ?? session.loggedInAt}`
      if (current.current && current.current.key !== key) {
        pending.current?.abort(); locked.current = false; setBusy(false)
      }
      let last = current.current?.key === key ? current.current.last : Date.parse(session.loggedInAt)
      try { const stored = localStorage.getItem(key); if (stored !== null) last = Number(stored) } catch { /* Use the current session clock. */ }
      current.current = { key, last }
      if (locked.current || needsIdleVerification(last)) {
        const newlyLocked = !locked.current
        locked.current = true; setStatus('locked')
        if (newlyLocked) void autoPasskey()
      } else { remember(); setStatus('open') }
    }
    const activity = () => {
      if (document.visibilityState === 'visible' && !locked.current && current.current && Date.now() - current.current.last > 60_000) {
        if (needsIdleVerification(current.current.last)) check()
        else remember()
      }
    }
    const hide = () => { if (!locked.current) remember(); pending.current?.abort() }
    const visibility = () => { if (document.visibilityState === 'hidden') hide(); else check() }
    check()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pageshow', check)
    window.addEventListener('pagehide', hide)
    window.addEventListener(SESSION_CHANGED, check)
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('keydown', activity)
    return () => {
      alive = false; pending.current?.abort()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pageshow', check); window.removeEventListener('pagehide', hide)
      window.removeEventListener(SESSION_CHANGED, check)
      window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity)
    }
  // Route changes re-check the clock; verification closures only read refs and locale-independent state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, publicAuth])

  const verify = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await run(true, async () => ({ ok: true as const, data: true }))
      if (result?.ok) unlock()
    } finally { setBusy(false) }
  }
  const signIn = async () => {
    leaving.current = true
    pending.current?.abort()
    setBusy(true)
    // Hide content until navigation, even though logout dispatches SESSION_CHANGED.
    try { await logout() } finally { clearSession(); window.location.replace('/login') }
  }
  // History writes update Next's pathname before its effect runs. A fresh session (or guest)
  // must keep the same application mounted, otherwise its screen resets to old server props.
  const session = readSession()
  const sessionKey = session ? `rwa.idle.${session.userId ?? 'user'}.${session.sessionId ?? session.loggedInAt}` : null
  const canKeepMounted = !leaving.current && !locked.current && (!session ||
    (current.current?.key === sessionKey && !needsIdleVerification(current.current?.last)))
  if ((status === 'open' && (checkedPath === pathname || canKeepMounted)) || publicAuth) return children
  if (status !== 'locked') return <AppLoading />
  const t = fundsCopy[locale].stepUp
  const text = labels[locale]
  return <MaisonPage page="locked">
    <div style={{ minHeight: '85dvh', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 20 }} aria-busy={busy}>
      {status === 'locked' && <>
        <p className={s.muted}>{t.title}</p>
        <button type="button" className={s.cta} onClick={() => void verify()} disabled={busy}>{busy ? t.verifying : text[0]}</button>
        <button type="button" className={s.link} onClick={() => void signIn()} disabled={busy}>{text[1]}</button>
      </>}
    </div>
    {sheet}
  </MaisonPage>
}
