'use client'
import { useSyncExternalStore } from 'react'
import { SESSION_CHANGED, SESSION_EXPIRED, getSessionToken, readSession, request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import type { SessionView, KycStatusView, KycState } from '@/lib/session-data'

function subscribe(notify: () => void) {
  window.addEventListener(SESSION_CHANGED, notify)
  window.addEventListener(SESSION_EXPIRED, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(SESSION_CHANGED, notify)
    window.removeEventListener(SESSION_EXPIRED, notify)
    window.removeEventListener('storage', notify)
  }
}
const sessionKey = () => getSessionToken() ? (readSession()?.userId ?? 'current') : ''

/** Client-only sign-in marker; the server snapshot is always a guest so hydration stays stable. */
export function useSignedIn() {
  return useSyncExternalStore(subscribe, () => Boolean(getSessionToken()), () => false)
}

export type KycRing = 'approved' | 'pending' | 'attention' | null
export function kycRing(state: KycState | undefined): KycRing {
  if (state === 'approved') return 'approved'
  if (state === 'in_progress' || state === 'submitted') return 'pending'
  if (state === 'needs_information' || state === 'rejected' || state === 'expired') return 'attention'
  return null
}

/** Shared account chrome state; queries are keyed per user so a new sign-in never shows the previous account. */
export function useAccount() {
  const userKey = useSyncExternalStore(subscribe, sessionKey, () => '')
  const signedIn = userKey !== ''
  const session = useQuery(signedIn ? `auth:session:${userKey}` : null, () => request<SessionView>('/v1/auth/session'), { staleTime: 60_000 })
  const kyc = useQuery(signedIn ? `compliance:kyc-status:${userKey}` : null, () => request<KycStatusView | null>('/v1/compliance/kyc/status'), { staleTime: 60_000 })
  const label = session.data?.accountLabel ?? null
  // userId is the stable, unique avatar seed; a nickname could collide between accounts.
  const userId = signedIn ? (userKey !== 'current' ? userKey : session.data?.userId ?? null) : null
  return { signedIn, session, kyc, label, userId, initial: label ? label.charAt(0).toUpperCase() : null, ring: kycRing(kyc.data?.state) }
}
