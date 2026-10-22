'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Check, LoaderCircle, Ticket } from 'lucide-react'
import type { AppLocale } from '@/lib/app-locales'
import { applyInviteCode, currentInvite, displayInviteCode, isInviteCodeShape, lookupInviteCode, normalizeInviteCode, type InviteAttribution } from '@/lib/referral-invite'
import styles from './InviteCodeField.module.css'

type Status = 'loading' | 'idle' | 'checking' | 'valid' | 'invalid' | 'locked'
type Copy = { label: string; optional: string; placeholder: string; valid: string; invalid: string; unavailable: string; linked: string; entered: string; window: string; blocked: string }

export const inviteCopy: Record<AppLocale, Copy> = {
  'zh-CN': { label: '邀请码', optional: '选填', placeholder: '6 位邀请码', valid: '邀请码有效，注册后建立邀请关系', invalid: '未找到这个邀请码，请核对', unavailable: '暂时无法确认邀请码，请重试', linked: '已通过邀请链接记录邀请', entered: '已记录邀请码', window: '以首次邀请为准，30 天内注册有效', blocked: '邀请码无效：请修改，或清空后继续' },
  en: { label: 'Invitation code', optional: 'Optional', placeholder: '6-character code', valid: 'Valid code. The invitation is linked when you sign up', invalid: 'This code was not found. Check it and try again', unavailable: 'Couldn’t confirm the code. Try again', linked: 'Invitation recorded from your link', entered: 'Invitation code recorded', window: 'The first invitation counts, valid for 30 days', blocked: 'Invalid code: correct it, or clear it to continue' },
  hi: { label: 'आमंत्रण कोड', optional: 'वैकल्पिक', placeholder: '6 अक्षरों का कोड', valid: 'कोड मान्य है। साइन अप पर आमंत्रण जुड़ जाएगा', invalid: 'यह कोड नहीं मिला। जाँचकर फिर कोशिश करें', unavailable: 'कोड की पुष्टि नहीं हो सकी। फिर कोशिश करें', linked: 'आपके लिंक से आमंत्रण दर्ज हुआ', entered: 'आमंत्रण कोड दर्ज हुआ', window: 'पहला आमंत्रण मान्य, 30 दिनों तक', blocked: 'अमान्य कोड: सुधारें या हटाकर आगे बढ़ें' },
  es: { label: 'Código de invitación', optional: 'Opcional', placeholder: 'Código de 6 caracteres', valid: 'Código válido. La invitación se vincula al registrarte', invalid: 'No encontramos este código. Revísalo', unavailable: 'No se pudo confirmar el código. Inténtalo de nuevo', linked: 'Invitación registrada desde tu enlace', entered: 'Código de invitación registrado', window: 'Cuenta la primera invitación, válida 30 días', blocked: 'Código no válido: corrígelo o bórralo para continuar' },
  ar: { label: 'رمز الدعوة', optional: 'اختياري', placeholder: 'رمز من 6 أحرف', valid: 'الرمز صالح. ترتبط الدعوة عند التسجيل', invalid: 'لم يُعثر على هذا الرمز. تحقق منه', unavailable: 'تعذّر تأكيد الرمز. حاول مجددًا', linked: 'سُجّلت الدعوة من رابطك', entered: 'سُجّل رمز الدعوة', window: 'تُحتسب الدعوة الأولى، صالحة 30 يومًا', blocked: 'رمز غير صالح: صحّحه أو امسحه للمتابعة' },
  fr: { label: 'Code d’invitation', optional: 'Facultatif', placeholder: 'Code à 6 caractères', valid: 'Code valide. L’invitation est liée à l’inscription', invalid: 'Code introuvable. Vérifiez-le', unavailable: 'Impossible de confirmer le code. Réessayez', linked: 'Invitation enregistrée depuis votre lien', entered: 'Code d’invitation enregistré', window: 'La première invitation compte, valable 30 jours', blocked: 'Code invalide : corrigez-le ou effacez-le pour continuer' },
  pt: { label: 'Código de convite', optional: 'Opcional', placeholder: 'Código de 6 caracteres', valid: 'Código válido. O convite é vinculado no cadastro', invalid: 'Código não encontrado. Confira e tente de novo', unavailable: 'Não foi possível confirmar o código. Tente de novo', linked: 'Convite registrado pelo seu link', entered: 'Código de convite registrado', window: 'Vale o primeiro convite, por 30 dias', blocked: 'Código inválido: corrija ou apague para continuar' },
}

export type InviteCodeState = ReturnType<typeof useInviteCode>

/**
 * The signup invitation: shows one carried by a /r/ link (locked, first click wins), or takes a typed code,
 * checks it live, and records it right before the first registration request so every sign-up path binds it.
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

  /** Call before any registration request. Resolves false when the user must fix the field first. */
  const commit = async (): Promise<boolean> => {
    if (status === 'locked' || status === 'loading' || !value) return true
    if (!isInviteCodeShape(value)) { setMessage('blocked'); return false }
    const valid = status === 'valid' ? true : await check(value)
    if (valid === null) { setMessage('unavailable'); return false }
    if (!valid) { setMessage('blocked'); return false }
    const attribution = await applyInviteCode(value)
    if (!attribution) { setMessage('unavailable'); return false }
    setLocked({ attribution, source: attribution.code.toUpperCase() === value ? 'typed' : 'link' }); setStatus('locked'); setMessage('')
    return true
  }

  return { value, status, locked, message, change, commit }
}

export function InviteCodeField({ invite, locale, disabled }: { invite: InviteCodeState; locale: AppLocale; disabled?: boolean }) {
  const copy = inviteCopy[locale]
  const id = useId()
  const { status, locked, message, value } = invite
  if (status === 'loading') return <div className={styles.placeholder} aria-hidden="true" />
  if (status === 'locked' && locked) return <div className={styles.locked} role="status">
    <span className={styles.seal} aria-hidden="true"><Ticket size={17} strokeWidth={1.7} /></span>
    <span className={styles.lockedText}>
      <small>{locked.source === 'link' ? copy.linked : copy.entered}</small>
      <b dir="ltr">{displayInviteCode(locked.attribution.code)}</b>
      <small>{copy.window}</small>
    </span>
    <Check className={styles.lockedCheck} size={18} strokeWidth={2.2} aria-hidden="true" />
  </div>
  const note = message === 'blocked' ? copy.blocked : message === 'unavailable' ? copy.unavailable : status === 'valid' ? copy.valid : status === 'invalid' ? copy.invalid : ''
  const tone = message || status === 'invalid' ? 'error' : status === 'valid' ? 'ok' : undefined
  return <div className={styles.wrap}>
    <label className={styles.field} htmlFor={`${id}-invite`} data-state={tone}>
      <span className={styles.label}><Ticket size={14} strokeWidth={1.8} aria-hidden="true" />{copy.label}<em>{copy.optional}</em></span>
      <input id={`${id}-invite`} value={displayInviteCode(value)} placeholder={copy.placeholder} disabled={disabled}
        onChange={event => invite.change(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={19} dir="ltr"
        aria-invalid={tone === 'error' ? true : undefined} aria-describedby={`${id}-invite-note`} />
      <span className={styles.status} aria-hidden="true">
        {status === 'checking' ? <LoaderCircle className={styles.spin} size={17} /> : status === 'valid' ? <Check size={17} strokeWidth={2.2} /> : tone === 'error' ? <AlertCircle size={17} /> : null}
      </span>
    </label>
    <p id={`${id}-invite-note`} className={styles.note} data-tone={tone} aria-live="polite">{note}</p>
  </div>
}
