'use client'

import { Fingerprint, KeyRound, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import type { ApiResult } from '@/lib/api/_http'
import { listSecurityFactors, stepUpWithPasskey, stepUpWithRecoveryCode, stepUpWithTotp, type StepUpResult } from '@/lib/api/security'
import type { WalletIntegration } from '@/lib/api/wallet'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { marketCopy } from '@/lib/maison-market-copy'
import { openPath } from '@/lib/maison-nav'
import { Skeleton, StateBlock, maison as s } from './primitives'
import { Segmented } from './motion'
import { Sheet } from './Sheet'

/** One line of what is about to be authorised, shown under the title so the factor is entered against the real intent. */
export type StepUpLine = { label: string; value: ReactNode }

type Method = 'totp' | 'recovery' | 'passkey'

/** Wallet writes skip the server step-up only on the stub custodian with demo execution on; anything else needs a fresh factor. */
export const stepUpRequired = (integration: WalletIntegration | null | undefined) => !integration || !(integration.adapterMode === 'stub' && integration.demoExecutionEnabled)

/**
 * Session-bound re-authentication for money-out actions. Each action obtains fresh verification;
 * `run` asks for it up front when required and once more if the server still answers STEP_UP_REQUIRED.
 * The action receives the token and must keep its idempotency key independent of it, so the retry replays the same intent.
 */
export function useStepUp(): { run: <T>(required: boolean, action: (reauthentication?: string) => Promise<ApiResult<T>>, summary?: StepUpLine[]) => Promise<ApiResult<T> | null>; sheet: ReactNode } {
  const waiter = useRef<((value: string | null) => void) | null>(null)
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<StepUpLine[] | undefined>()

  const obtain = useCallback((lines?: StepUpLine[]) => {
    return new Promise<string | null>((resolve) => {
      waiter.current?.(null)
      waiter.current = resolve
      setSummary(lines)
      setOpen(true)
    })
  }, [])

  const settle = useCallback((result: StepUpResult | null) => {
    setOpen(false)
    const resolve = waiter.current
    waiter.current = null
    resolve?.(result?.reauthentication ?? null)
  }, [])

  useEffect(() => () => { waiter.current?.(null); waiter.current = null }, [])

  const run = useCallback(async <T,>(required: boolean, action: (reauthentication?: string) => Promise<ApiResult<T>>, lines?: StepUpLine[]) => {
    let reauthentication = required ? await obtain(lines) : null
    if (required && !reauthentication) return null
    let result = await action(reauthentication ?? undefined)
    if (!result.ok && result.error.code === 'STEP_UP_REQUIRED') {
      reauthentication = await obtain(lines)
      if (!reauthentication) return null
      result = await action(reauthentication)
    }
    return result
  }, [obtain])

  return { run, sheet: <StepUpSheet open={open} summary={summary} onDone={settle} /> }
}

function StepUpSheet({ open, summary, onDone }: { open: boolean; summary?: StepUpLine[]; onDone: (result: StepUpResult | null) => void }) {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const t = f.stepUp
  const common = marketCopy[locale].common
  const factors = useQuery(open ? 'security:factors' : null, listSecurityFactors, { staleTime: 30_000 })
  const [method, setMethod] = useState<Method | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const verification = useRef<AbortController | null>(null)

  useEffect(() => { if (open) { setCode(''); setError(null); setBusy(false); setMethod(null) } }, [open])
  useEffect(() => { if (!open) verification.current?.abort(); return () => verification.current?.abort() }, [open])

  const totp = factors.data?.totp.find((item) => item.state === 'active')
  const methods: Method[] = [
    ...(typeof window !== 'undefined' && window.isSecureContext && typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.get === 'function' && factors.data?.passkeys.some((item) => item.state === 'active') ? ['passkey' as const] : []),
    ...(totp ? ['totp' as const] : []),
    ...(totp && totp.recoveryCodesRemaining > 0 ? ['recovery' as const] : []),
  ]
  const active = method && methods.includes(method) ? method : methods[0] ?? null
  const valid = active === 'totp' ? /^\d{6}$/.test(code) : active === 'recovery' ? /^[A-Z0-9-]{8,16}$/.test(code) : active === 'passkey'

  const verify = async () => {
    if (!active || busy || !valid) return
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    verification.current = controller
    const result = active === 'totp' ? await stepUpWithTotp(code, controller.signal) : active === 'recovery' ? await stepUpWithRecoveryCode(code, controller.signal) : await stepUpWithPasskey(controller.signal)
    if (controller.signal.aborted) return
    verification.current = null
    setBusy(false)
    if (result.ok) { onDone(result.data); return }
    setError(f.errors[result.error.code] ?? result.error.message ?? common.errorGeneric)
    if (active !== 'passkey') setCode('')
  }
  const pick = (next: Method) => { setMethod(next); setCode(''); setError(null) }

  // Not `busy`-locked: closing mid-passkey aborts the pending verification, as before.
  return <Sheet open={open} onClose={() => { verification.current?.abort(); onDone(null) }} data-step-up=""
    kicker={<><ShieldCheck size={13} aria-hidden="true" />{t.required}</>} title={t.title} description={t.body}>
          {summary && summary.length > 0 && <dl className={s.summary} style={{ marginTop: 14 }}>
            {summary.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}
          </dl>}
          {factors.error && !factors.data ? <StateBlock tone="error" title={t.loadError} body={factors.error.message} retry={factors.refetch} retryLabel={common.retry} />
            : !factors.data ? <Skeleton rows={2} />
            : !active ? <StateBlock tone="unavailable" title={t.noFactors} body={t.noFactorsBody}
              action={<button type="button" className={s.link} onClick={() => { onDone(null); openPath('/profile/security') }}>{t.openSecurity}</button>} />
            : <form onSubmit={(event) => { event.preventDefault(); void verify() }}>
              {methods.length > 1 && <div style={{ marginTop: 14 }}><Segmented value={active} onChange={pick} label={t.title} role="group" options={methods.map((item) => ({ value: item, label: t[item] }))} /></div>}
              {active === 'passkey' ? <p className={s.muted} style={{ margin: '14px 0 0', fontSize: 12.5 }}><Fingerprint size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{t.passkeyBody}</p>
                : <label className={s.field}>
                  <span>{active === 'totp' ? t.totpLabel : t.recoveryLabel}</span>
                  <input autoFocus value={code} name="step-up-code" aria-invalid={Boolean(error)} aria-describedby="step-up-error"
                    inputMode={active === 'totp' ? 'numeric' : 'text'} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={active === 'totp' ? 6 : 16}
                    placeholder={active === 'totp' ? '000000' : 'XXXX-XXXX'}
                    onChange={(event) => { setCode(active === 'totp' ? event.target.value.replace(/\D/g, '') : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); setError(null) }} />
                </label>}
              {error && <p className={s.fieldError} id="step-up-error" role="alert">{error}</p>}
              <button type="submit" className={s.cta} style={{ marginTop: 16 }} disabled={!valid || busy} aria-busy={busy}>
                <span>{busy ? t.verifying : active === 'passkey' ? t.passkeyCta : t.verify}</span>
                <span className={s.ctaIcon}>{active === 'passkey' ? <Fingerprint size={17} /> : <KeyRound size={17} />}</span>
              </button>
            </form>}
  </Sheet>
}
