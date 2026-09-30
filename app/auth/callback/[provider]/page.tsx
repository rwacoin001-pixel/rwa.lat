'use client'

/**
 * 认证回调页：/auth/callback/google · /auth/callback/x · /auth/callback/email
 *
 * 流程：
 *  · OAuth（google/x）：?code=...&state=... → 换取会话 → 存本地 → 跳首页
 *  · 魔法链接（email）：?token=... → POST /v1/auth/login/email/confirm → 同上
 */

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { confirmLoginEmail, confirmOAuth } from '@/lib/api/auth'
import { useI18n } from '@/lib/i18n'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import AppLoading from '@/components/app-loading'
import { consumeAuthDestination } from '@/lib/api/auth-navigation'
import { authErrorMessage } from '@/lib/auth-error-copy'
import { continueAuth } from '@/lib/api/auth-flow'

type Phase = 'working' | 'error' | 'registration-required'
type CallbackInput = { provider: string; token: string | null; code: string | null; state: string | null; error: string | null }
type CallbackResult = Awaited<ReturnType<typeof confirmOAuth>>
type CallbackAttempt = { input: CallbackInput; request: Promise<CallbackResult> | null }

/** One-time OAuth/link credentials can survive a second navigation (PWA service-worker
 *  takeover, app-switch return). Holding them for the session lets that hop finish. */
const CALLBACK_CACHE_KEY = 'rwa.auth-callback'

function persistCallback(input: CallbackInput): void {
  try {
    window.sessionStorage.setItem(CALLBACK_CACHE_KEY, JSON.stringify(input))
  } catch {
    // Storage can be unavailable (private mode); the in-memory attempt still works.
  }
}

function restoreCallback(provider: string): CallbackInput | null {
  try {
    const raw = window.sessionStorage.getItem(CALLBACK_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CallbackInput>
    if (parsed?.provider !== provider) return null
    if (!parsed.code && !parsed.token) return null
    return {
      provider,
      token: parsed.token ?? null,
      code: parsed.code ?? null,
      state: parsed.state ?? null,
      error: null,
    }
  } catch {
    return null
  }
}

function clearCallback(): void {
  try {
    window.sessionStorage.removeItem(CALLBACK_CACHE_KEY)
  } catch {
    // Ignore: nothing to clean up when storage is unavailable.
  }
}

export default function OAuthCallbackPage() {
  const { locale, t } = useI18n()
  const visual = authVisualCopy[locale]
  const failure = authErrorMessage({ code: 'OAUTH_CALLBACK_INVALID', status: 400 }, locale)
  const params = useParams<{ provider: string }>()
  const [phase, setPhase] = useState<Phase>('working')
  const [message, setMessage] = useState('')
  const attemptRef = useRef<CallbackAttempt | null>(null)

  useEffect(() => {
    let active = true
    const routeProvider = String(params?.provider || '').toLowerCase()
    let attempt = attemptRef.current
    if (!attempt || attempt.input.provider !== routeProvider) {
      const query = new URLSearchParams(window.location.search)
      const fromUrl: CallbackInput = {
        provider: routeProvider,
        token: query.get('token'),
        code: routeProvider === 'x' ? query.get('oauth_verifier') ?? query.get('code') : query.get('code'),
        state: routeProvider === 'x' ? query.get('oauth_token') ?? query.get('state') : query.get('state'),
        error: query.get('error') ?? (routeProvider === 'x' && query.has('denied') ? 'access_denied' : null),
      }
      const hasCredentials = Boolean(fromUrl.code || fromUrl.token || fromUrl.error)
      if (hasCredentials) persistCallback(fromUrl)
      attempt = {
        input: hasCredentials ? fromUrl : restoreCallback(routeProvider) ?? fromUrl,
        request: null,
      }
      attemptRef.current = attempt
      // Keep the one-time credentials out of the address bar and history. The session copy written
      // above is what lets a second navigation (PWA service-worker takeover, app-switch return)
      // still finish the exchange instead of showing "start again in this browser".
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      } catch {
        // The callback can still finish if history state is unavailable.
      }
    }

    const { provider, token, code, state, error: err } = attempt.input
    if (err) {
      setPhase('error')
      setMessage(err === 'access_denied' ? authErrorMessage({ code: 'OAUTH_CANCELLED', status: 400 }, locale) : failure)
      return () => { active = false }
    }
    if (provider !== 'google' && provider !== 'x' && provider !== 'email') {
      setPhase('error')
      setMessage(failure)
      return () => { active = false }
    }
    if (provider === 'email' && !token) {
      setPhase('error')
      setMessage(authErrorMessage({ code: 'INVALID_VERIFICATION_TOKEN', status: 400 }, locale))
      return () => { active = false }
    }
    if (provider !== 'email' && (!code || !state)) {
      setPhase('error')
      setMessage(failure)
      return () => { active = false }
    }

    let registrationRedirect: number | null = null
    const request = attempt.request ?? (provider === 'email'
      ? confirmLoginEmail(token as string)
      : confirmOAuth(provider, code as string, state as string))
    attempt.request = request
    void request.then(result => {
        if (!active) return
        if (!result.ok) {
          if (result.error.code === 'AUTH_FLOW_REQUIRED') {
            if (provider !== 'email') sessionStorage.setItem('rwa.auth-oauth', '1')
            if (continueAuth(result.error)) return
          }
          if (result.error.code === 'REGISTRATION_REQUIRED') {
            setPhase('registration-required')
            setMessage(visual.createAccount)
            registrationRedirect = window.setTimeout(() => {
              if (active) window.location.replace('/register')
            }, 1100)
            return
          }
          setPhase('error')
          setMessage(authErrorMessage(result.error, locale))
          return
        }
        clearCallback()
        window.location.replace(consumeAuthDestination(window.sessionStorage, window.location.origin, provider !== 'email'))
      }).catch(() => {
        if (!active) return
        setPhase('error')
        setMessage(failure)
      })
    return () => {
      active = false
      if (registrationRedirect !== null) window.clearTimeout(registrationRedirect)
    }
  }, [params, locale, failure, visual.createAccount])

  if (phase === 'working') return <AppLoading />
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        transition: 'background-color 280ms ease, color 280ms ease',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div
          style={{
            width: 44,
            height: 44,
            margin: '0 auto 20px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            border: '1.5px solid color-mix(in srgb, var(--accent) 55%, transparent)',
            color: 'var(--accent)',
            font: '600 20px/1 var(--font-geist-sans, system-ui)',
          }}
          aria-hidden="true"
        >!</div>
        <p role="alert" style={{ fontSize: 15, lineHeight: 1.65, opacity: 0.92 }}>{message}</p>
        {(phase === 'error' || phase === 'registration-required') && (
          <div style={{ marginTop: 20, display: 'flex', gap: 18, justifyContent: 'center' }}>
            {phase === 'registration-required'
              ? <a href="/register" style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>{visual.createAccount}</a>
              : <a href="/login" style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>{visual.signIn}</a>}
            <a href="/home" style={{ color: 'var(--ink-3)', fontSize: 14, textDecoration: 'none' }}>{t('nav.home')}</a>
          </div>
        )}
      </div>
    </main>
  )
}
