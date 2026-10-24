'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Check, ClipboardPaste, LoaderCircle } from 'lucide-react'
import { ANDROID_APP_UA } from '@/lib/android-app'
import type { AppLocale } from '@/lib/app-locales'
import { applyInviteCode, currentInvite, displayInviteCode, isInviteCodeShape, lookupInviteCode, normalizeInviteCode, type InviteAttribution } from '@/lib/referral-invite'
import styles from './InviteCodeField.module.css'

type Status = 'loading' | 'idle' | 'checking' | 'valid' | 'invalid' | 'locked'
type Copy = { placeholder: string; valid: string; invalid: string; unavailable: string; required: string }

export const inviteCopy: Record<AppLocale, Copy> = {
  'zh-CN': { placeholder: '邀请码', valid: '邀请码有效', invalid: '未找到这个邀请码，请核对', unavailable: '暂时无法确认邀请码，请重试', required: '请填写邀请码' },
  en: { placeholder: 'Invitation code', valid: 'Valid invitation code', invalid: 'This code was not found. Check it and try again', unavailable: 'Couldn’t confirm the code. Try again', required: 'Enter your invitation code' },
  hi: { placeholder: 'आमंत्रण कोड', valid: 'आमंत्रण कोड मान्य है', invalid: 'यह कोड नहीं मिला। जाँचकर फिर कोशिश करें', unavailable: 'कोड की पुष्टि नहीं हो सकी। फिर कोशिश करें', required: 'आमंत्रण कोड दर्ज करें' },
  es: { placeholder: 'Código de invitación', valid: 'Código de invitación válido', invalid: 'No encontramos este código. Revísalo', unavailable: 'No se pudo confirmar el código. Inténtalo de nuevo', required: 'Introduce tu código de invitación' },
  ar: { placeholder: 'رمز الدعوة', valid: 'رمز الدعوة صالح', invalid: 'لم يُعثر على هذا الرمز. تحقق منه', unavailable: 'تعذّر تأكيد الرمز. حاول مجددًا', required: 'أدخل رمز الدعوة' },
  fr: { placeholder: 'Code d’invitation', valid: 'Code d’invitation valide', invalid: 'Code introuvable. Vérifiez-le', unavailable: 'Impossible de confirmer le code. Réessayez', required: 'Saisissez votre code d’invitation' },
  pt: { placeholder: 'Código de convite', valid: 'Código de convite válido', invalid: 'Código não encontrado. Confira e tente de novo', unavailable: 'Não foi possível confirmar o código. Tente de novo', required: 'Informe seu código de convite' },
}

export type InviteCodeState = ReturnType<typeof useInviteCode>

/**
 * The signup invitation. A code carried by a /r/ link is already on record (first click wins), so no field is needed;
 * otherwise the code is required, checked live, and recorded right before the first registration request.
 */
export function useInviteCode() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('loading')
  const [locked, setLocked] = useState<{ attribution: InviteAttribution; source: 'link' | 'typed' } | null>(null)
  const [message, setMessage] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    let active = true
    void currentInvite().then(attribution => {
      if (!active) return
      if (attribution) { setLocked({ attribution, source: 'link' }); setStatus('locked') } else setStatus(current => current === 'loading' ? 'idle' : current)
    })
    return () => { active = false }
  }, [])

  const check = useCallback(async (code: string) => {
    const mine = ++seq.current
    setStatus('checking')
    const result = await lookupInviteCode(code)
    if (mine !== seq.current) return null
    const valid = result.ok && result.data.valid
    setStatus(result.ok ? valid ? 'valid' : 'invalid' : 'idle')
    if (!result.ok) setMessage('unavailable')
    return result.ok ? valid : null
  }, [])

  useEffect(() => {
    if (status === 'locked' || status === 'loading' || !isInviteCodeShape(value)) return
    const timer = setTimeout(() => { void check(value) }, 350)
    return () => clearTimeout(timer)
  }, [value, check])

  const change = (raw: string) => {
    const next = normalizeInviteCode(raw)
    seq.current++
    setValue(next); setMessage('')
    setStatus(isInviteCodeShape(next) ? 'checking' : 'idle')
  }

  /** Call before a registration request. `required` blocks an empty field; resolves false when the user must fix it first. */
  const commit = async ({ required = true } = {}): Promise<boolean> => {
    if (status === 'locked') return true
    if (status === 'loading') return !required
    if (!value) { if (required) setMessage('required'); return !required }
    if (!isInviteCodeShape(value)) { setMessage('invalid'); return false }
    const valid = status === 'valid' ? true : await check(value)
    if (valid === null) { setMessage('unavailable'); return false }
    if (!valid) { setMessage('invalid'); return false }
    const attribution = await applyInviteCode(value)
    if (!attribution) { setMessage('unavailable'); return false }
    setLocked({ attribution, source: attribution.code.toUpperCase() === value ? 'typed' : 'link' }); setStatus('locked'); setMessage('')
    return true
  }

  /** A /r/ link already carries the invitation; the field stays out of the way. */
  const fromLink = locked?.source === 'link'
  return { value, status, locked, message, fromLink, change, commit }
}

const PASTE: Partial<Record<AppLocale, string>> = { 'zh-CN': '粘贴', en: 'Paste', es: 'Pegar', fr: 'Coller', pt: 'Colar', hi: 'पेस्ट', ar: 'لصق' }

export function InviteCodeField({ invite, locale, disabled }: { invite: InviteCodeState; locale: AppLocale; disabled?: boolean }) {
  const copy = inviteCopy[locale]
  const id = useId()
  // Inside the Android app: the browser copied the invitation code on download, so offer to paste it.
  const [inApp, setInApp] = useState(false)
  useEffect(() => { setInApp(navigator.userAgent.includes(ANDROID_APP_UA) && Boolean(navigator.clipboard?.readText)) }, [])
  const paste = async () => { try { const text = await navigator.clipboard.readText(); if (text.trim()) invite.change(text.trim()) } catch { /* clipboard denied: type it */ } }
  const { status, message, value, locked } = invite
  if (status === 'loading' || invite.fromLink) return null
  const shown = status === 'locked' && locked ? locked.attribution.code : value
  const ok = status === 'valid' || status === 'locked'
  const note = message === 'required' ? copy.required : message === 'unavailable' ? copy.unavailable : message === 'invalid' || status === 'invalid' ? copy.invalid : ok ? copy.valid : ''
  const tone = message || status === 'invalid' ? 'error' : ok ? 'ok' : undefined
  return <div className={styles.wrap}>
    <label className={styles.field} htmlFor={`${id}-invite`} data-state={tone}>
      <span className={styles.srOnly}>{copy.placeholder}</span>
      <input id={`${id}-invite`} value={displayInviteCode(shown)} placeholder={copy.placeholder} disabled={disabled} readOnly={status === 'locked'} required
        onChange={event => invite.change(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={19} dir="ltr" enterKeyHint="send"
        aria-invalid={tone === 'error' ? true : undefined} aria-describedby={`${id}-invite-note`} />
      {inApp && !value && status === 'idle' && <button type="button" className={styles.paste} onClick={() => { void paste() }}><ClipboardPaste size={14} aria-hidden="true" />{PASTE[locale] ?? PASTE.en}</button>}
      <span className={styles.status} aria-hidden="true">
        {status === 'checking' ? <LoaderCircle className={styles.spin} size={18} /> : ok ? <Check size={18} strokeWidth={2.2} /> : tone === 'error' ? <AlertCircle size={18} /> : null}
      </span>
    </label>
    <p id={`${id}-invite-note`} className={styles.note} data-tone={tone} aria-live="polite">{note}</p>
  </div>
}
