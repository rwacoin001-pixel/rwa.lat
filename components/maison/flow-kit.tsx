'use client'

import { ArrowRight, Check, ChevronDown, Delete } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'
import { flowKitCopy } from '@/lib/flow-kit-copy'
import { Sheet } from './Sheet'
import { maison as s } from './primitives'
import k from './flow-kit.module.css'

/**
 * The money-entry kit (palette A): an amount you type on our own keypad (no system keyboard, so nothing jumps), a
 * button that says what is missing, a review sheet that holds the consent, and a success page with a receipt.
 * Logic stays with each screen; these pieces only show and collect.
 */

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const MAX_INTEGER = 10

/** A light tap where the platform allows it (Android); silent elsewhere. */
export const haptic = (pattern: number | number[] = 6) => { try { navigator.vibrate?.(pattern) } catch { /* not supported */ } }

/** One keypress on a decimal amount: one dot, at most `decimals` (≤ 6) fraction digits, no leading zeros. */
export function applyKey(text: string, key: string, decimals: number): string {
  const places = Math.min(6, Math.max(0, decimals))
  if (key === 'back') return text.slice(0, -1)
  if (key === 'clear') return ''
  if (key === '.') return places === 0 || text.includes('.') ? text : text ? `${text}.` : '0.'
  if (!/^\d$/.test(key)) return text
  if (text.includes('.')) return text.split('.')[1].length >= places ? text : text + key
  if (text === '0') return key
  return text.length >= MAX_INTEGER ? text : text + key
}

/** The entered text as a number string the screens can parse ("12." → "12"). */
export const settled = (text: string) => text.endsWith('.') ? text.slice(0, -1) : text

/** `pct`% of an atomic amount, cut (never rounded up) to two decimals, as a plain decimal string. */
export function share(maxAtomic: string | null, pct: number, decimals: number): string | null {
  if (!maxAtomic || BigInt(maxAtomic) <= BigInt(0)) return null
  const step = BigInt(`1${'0'.repeat(Math.max(0, decimals - 2))}`)
  const part = pct >= 100 ? BigInt(maxAtomic) : (BigInt(maxAtomic) * BigInt(pct) / BigInt(100)) / step * step
  if (part <= BigInt(0)) return null
  const digits = part.toString().padStart(decimals + 1, '0')
  const integer = decimals ? digits.slice(0, -decimals) : digits
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, '') : ''
  return fraction ? `${integer}.${fraction}` : integer
}

const grouped = (text: string, locale: string) => {
  const [integer, fraction] = text.split('.')
  const head = integer ? Number(integer).toLocaleString(locale === 'ar' ? 'en' : locale, { maximumFractionDigits: 0 }) : '0'
  return fraction === undefined ? head : `${head}.${fraction}`
}

type SideKey = { label: string; value: string | null }

/**
 * Our keypad. `side` adds a column of quick amounts (25% / 50% / 75% / Max); `left` replaces the decimal key
 * (e.g. Paste for codes); `order` reorders the ten digits (shuffled PIN pad). Physical keys work too.
 */
export function NumPad({ onKey, side, current, decimal = true, left, order = DIGITS, disabled = false, onEnter, label }: {
  onKey: (key: string) => void; side?: SideKey[]; current?: string; decimal?: boolean; left?: ReactNode; order?: string[]
  disabled?: boolean; onEnter?: () => void; label?: string
}) {
  const { locale } = useI18n()
  const c = flowKitCopy(locale)
  const hold = useRef<number | null>(null)
  const held = useRef(false)
  const press = (key: string) => { if (disabled) return; haptic(); onKey(key) }
  const keyRef = useRef(press)
  keyRef.current = press
  const enterRef = useRef(onEnter)
  enterRef.current = onEnter
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]:not([data-flow-sheet])')) return
      if (/^\d$/.test(event.key)) { event.preventDefault(); keyRef.current(event.key) }
      else if ((event.key === '.' || event.key === ',') && decimal) { event.preventDefault(); keyRef.current('.') }
      else if (event.key === 'Backspace') { event.preventDefault(); keyRef.current('back') }
      else if (event.key === 'Escape') keyRef.current('clear')
      else if (event.key === 'Enter' && enterRef.current) { event.preventDefault(); enterRef.current() }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [decimal])
  // Holding delete clears the whole entry, as on a phone dialer.
  const startHold = () => { held.current = false; hold.current = window.setTimeout(() => { held.current = true; haptic([8, 30, 8]); onKey('clear') }, 480) }
  const endHold = () => { if (hold.current) window.clearTimeout(hold.current); hold.current = null }
  const digits = order.slice(0, 9)
  const zero = order[9] ?? '0'
  return <div className={k.pad} data-side={side ? 'true' : undefined} role="group" aria-label={label} dir="ltr">
    {side && <div className={k.side}>{side.map((item) => <button key={item.label} type="button" disabled={disabled || !item.value} aria-pressed={Boolean(item.value && current === item.value)}
      onClick={() => { if (item.value) { haptic(); onKey(`=${item.value}`) } }}>{item.label}</button>)}</div>}
    <div className={k.keys}>
      {digits.map((n) => <button key={n} type="button" disabled={disabled} aria-label={c.digit(n)} onClick={() => press(n)}>{n}</button>)}
      {left ?? (decimal ? <button type="button" disabled={disabled} aria-label="." onClick={() => press('.')}>.</button> : <span aria-hidden="true" />)}
      <button type="button" disabled={disabled} aria-label={c.digit(zero)} onClick={() => press(zero)}>{zero}</button>
      <button type="button" disabled={disabled} aria-label={c.backspace} onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
        onClick={() => { if (held.current) { held.current = false; return } press('back') }} onContextMenu={(event) => event.preventDefault()}><Delete size={24} strokeWidth={1.7} aria-hidden="true" /></button>
    </div>
  </div>
}

/**
 * Amount-first entry: the figure is the largest thing on the page, its unit a pill, one quiet line under it
 * (balance and ≈ $), the talking button, then the keypad. The typed text stays local, so "12." survives a render.
 */
export function AmountPad({ value, onChange, decimals, unit, onUnit, sub, error, invalid = false, side, cta, header, disabled = false }: {
  value: string; onChange: (value: string) => void; decimals: number; unit: string; onUnit?: () => void; sub?: ReactNode; error?: string | null; invalid?: boolean
  side?: SideKey[]; header?: ReactNode; disabled?: boolean
  cta: { label: string; disabled: boolean; busy?: boolean; onClick: () => void }
}) {
  const { locale } = useI18n()
  const [text, setText] = useState(value)
  const [nudge, setNudge] = useState(0)
  // Outside changes (MAX, reset) replace the text; our own keystrokes already match it.
  useEffect(() => { setText((current) => settled(current) === value ? current : value) }, [value])
  // A new problem (an error line, or the amount turning invalid) nudges the figure once and buzzes.
  const problem = error ?? (invalid ? 'invalid' : null)
  const lastProblem = useRef<string | null>(null)
  useEffect(() => { if (problem && problem !== lastProblem.current) { setNudge((n) => n + 1); haptic([10, 40, 10]) } lastProblem.current = problem }, [problem])
  // Keys can land faster than renders (fast typing, a held key); read the latest text from a ref.
  const latest = useRef(text)
  latest.current = text
  const key = (input: string) => {
    if (disabled) return
    const before = latest.current
    const next = input.startsWith('=') ? input.slice(1) : applyKey(before, input, decimals)
    if (next === before) { if (input !== 'back') setNudge((n) => n + 1); return }
    latest.current = next
    setText(next)
    onChange(settled(next))
  }
  const shown = grouped(text, locale)
  const size = shown.length <= 7 ? 'l' : shown.length <= 10 ? 'm' : 's'
  return <div className={k.flow} data-money-flow="">
    {header && <div className={k.header}>{header}</div>}
    <div className={k.stage} aria-live="polite">
      <p className={k.figure} data-size={size} data-empty={!text || undefined} data-invalid={problem ? 'true' : undefined} key={nudge} data-nudge={nudge > 0 || undefined}>
        <bdi dir="ltr">{text ? shown : '0'}</bdi><i className={k.caret} aria-hidden="true" />
      </p>
      {onUnit ? <button type="button" className={k.unit} onClick={onUnit}>{unit}<ChevronDown size={15} aria-hidden="true" /></button> : <span className={k.unit}>{unit}</span>}
      <p className={k.sub} data-tone={error ? 'error' : undefined} role={error ? 'alert' : undefined}>{error ?? sub}</p>
    </div>
    <div className={k.bottom}>
      <button type="button" className={`${s.cta} ${k.cta}`} disabled={cta.disabled || cta.busy} aria-busy={cta.busy} onClick={() => { haptic(8); cta.onClick() }}><span>{cta.label}</span>{!cta.disabled && !cta.busy && <span className={s.ctaIcon} aria-hidden="true"><ArrowRight size={18} /></span>}</button>
      <NumPad onKey={key} side={side} current={settled(text)} decimal={decimals > 0} disabled={disabled} onEnter={cta.disabled ? undefined : cta.onClick} />
    </div>
  </div>
}

/** A recipient or address row: the field with paste / scan / book as icons inside it, recent picks underneath. */
export function RecipientField({ label, value, onChange, placeholder, state, status, actions, recents, disabled = false, readOnly = false, display }: {
  label: string; value: string; onChange?: (value: string) => void; placeholder?: string; state?: 'valid' | 'invalid'; status?: ReactNode
  actions: Array<{ label: string; icon: ReactNode; onClick: () => void }>; disabled?: boolean; readOnly?: boolean; display?: ReactNode
  recents?: { title: string; items: Array<{ key: string; label: ReactNode; active?: boolean; onPick: () => void }> }
}) {
  return <div className={k.recipient}>
    <label className={k.field} data-state={state}>
      <span className={k.fieldLabel}>{label}</span>
      <span className={k.fieldRow}>
        {display && readOnly ? <span className={k.fieldValue}>{display}</span>
          : <input value={value} disabled={disabled} readOnly={readOnly} autoComplete="off" spellCheck={false} autoCapitalize="off" placeholder={placeholder} aria-invalid={state === 'invalid'}
            onChange={(event) => onChange?.(event.target.value.replace(/\s/g, ''))} />}
        <span className={k.fieldActions}>{actions.map((action) => <button key={action.label} type="button" disabled={disabled} aria-label={action.label} title={action.label}
          onClick={(event) => { event.preventDefault(); haptic(); action.onClick() }}>{action.icon}</button>)}</span>
      </span>
    </label>
    {status && <p className={k.status} data-state={state}>{status}</p>}
    {recents && recents.items.length > 0 && <div className={k.recents}>
      <small>{recents.title}</small>
      <div>{recents.items.map((item) => <button key={item.key} type="button" aria-pressed={item.active || undefined} disabled={disabled} onClick={() => { haptic(); item.onPick() }}>{item.label}</button>)}</div>
    </div>}
  </div>
}

/** The review sheet: the amount again, every line that matters, the consent, then one confirm button. */
export function FlowConfirm({ open, onClose, title, amount, unit, rows, consent, note, error, busy = false, confirmLabel, onConfirm }: {
  open: boolean; onClose: () => void; title: string; amount: string; unit: string; rows: Array<{ label: string; value: ReactNode; strong?: boolean }>; note?: ReactNode
  consent?: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void }; error?: string | null; busy?: boolean; confirmLabel: string; onConfirm: () => void
}) {
  return <Sheet open={open} onClose={onClose} busy={busy} title={title} data-flow-sheet="">
    <div className={k.review}>
      <p className={k.reviewAmount}><bdi dir="ltr">{amount}</bdi><small>{unit}</small></p>
      <dl className={k.reviewRows}>{rows.map((row) => <div key={row.label} data-strong={row.strong || undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      {consent && <label className={k.consent}>
        <input type="checkbox" checked={consent.checked} disabled={busy} onChange={(event) => { haptic(); consent.onChange(event.target.checked) }} />
        <i aria-hidden="true"><Check size={13} strokeWidth={3} /></i><span>{consent.label}</span>
      </label>}
      {note && <p className={k.reviewNote}>{note}</p>}
      {error && <p className={k.reviewError} role="alert">{error}</p>}
      <button type="button" className={`${s.cta} ${k.cta}`} disabled={busy || Boolean(consent && !consent.checked)} aria-busy={busy} onClick={() => { haptic(8); onConfirm() }}><span>{confirmLabel}</span><span className={s.ctaIcon} aria-hidden="true"><ArrowRight size={18} /></span></button>
    </div>
  </Sheet>
}

/** Success: a drawn check, the amount, a short receipt, then done / again / records. */
export function FlowSuccess({ title, amount, unit, rows, note, pending = false, onDone, onAgain, onRecords }: {
  title: string; amount: string; unit: string; rows: Array<{ label: string; value: ReactNode }>; note?: ReactNode; pending?: boolean
  onDone: () => void; onAgain: () => void; onRecords: () => void
}) {
  const { locale } = useI18n()
  const c = flowKitCopy(locale)
  useEffect(() => { haptic([12, 60, 18]) }, [])
  return <div className={k.success} data-pending={pending || undefined} data-money-flow="">
    <svg className={k.check} viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="32" pathLength={1} />
      <path d={pending ? 'M36 20v18l10 6' : 'M23 37.5l9 9 17-19'} pathLength={1} />
    </svg>
    <h2 className={k.successTitle} aria-live="polite">{title}</h2>
    <p className={k.successAmount}><bdi dir="ltr">{amount}</bdi><small>{unit}</small></p>
    <dl className={k.receipt}>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    {note && <p className={k.successNote}>{note}</p>}
    <div className={k.successActions}>
      <button type="button" className={`${s.cta} ${k.cta}`} onClick={onDone}><span>{c.done}</span><span className={s.ctaIcon} aria-hidden="true"><ArrowRight size={18} /></span></button>
      <div>
        <button type="button" className={k.textButton} onClick={onAgain}>{c.again}</button>
        <span aria-hidden="true">·</span>
        <button type="button" className={k.textButton} onClick={onRecords}>{c.records}</button>
      </div>
    </div>
  </div>
}

/** Recent transfer recipients, kept on this device only (newest first, five at most). */
export function useRecentRecipients(owner: string | null) {
  const key = owner ? `rwa.transfer.recents.${owner}` : null
  const [items, setItems] = useState<string[]>([])
  useEffect(() => {
    if (!key) { setItems([]); return }
    try { const list = JSON.parse(window.localStorage.getItem(key) ?? '[]'); setItems(Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, 5) : []) } catch { setItems([]) }
  }, [key])
  const remember = (id: string) => {
    if (!key) return
    const next = [id, ...items.filter((item) => item !== id)].slice(0, 5)
    setItems(next)
    try { window.localStorage.setItem(key, JSON.stringify(next)) } catch { /* not remembered */ }
  }
  return { items, remember }
}

/** Six digits found in pasted or copied text (the code inside an email line), else null. */
export const codeIn = (text: string, length = 6) => text.match(new RegExp(`(?:^|\D)(\d{${length}})(?!\d)`))?.[1] ?? null

/**
 * A one-time code on our keypad: six slots, Paste in the corner, and a quiet switch back to the system keyboard
 * (which keeps the platform's own code autofill). When the clipboard is readable without a prompt, a code the user
 * just copied from the email is filled in as they come back to the page.
 */
export function CodePad({ value, onChange, length = 6, disabled = false, invalid = false, label }: {
  value: string; onChange: (value: string) => void; length?: number; disabled?: boolean; invalid?: boolean; label: string
}) {
  const { locale } = useI18n()
  const c = flowKitCopy(locale)
  const [system, setSystem] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(value)
  latest.current = value
  const take = (text: string) => { const found = codeIn(text, length); if (!found) return false; onChange(found); setNote(c.pasted); haptic([8, 30, 8]); return true }
  const takeRef = useRef(take)
  takeRef.current = take
  useEffect(() => {
    if (disabled) return
    let live = true
    const peek = async () => {
      if (document.visibilityState !== 'visible' || latest.current.length >= length) return
      try {
        const state = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName })
        if (!live || state?.state !== 'granted') return
        const text = await navigator.clipboard.readText()
        if (live) takeRef.current(text)
      } catch { /* not readable without asking; Paste stays one tap away */ }
    }
    void peek()
    document.addEventListener('visibilitychange', peek)
    window.addEventListener('focus', peek)
    return () => { live = false; document.removeEventListener('visibilitychange', peek); window.removeEventListener('focus', peek) }
  }, [disabled, length])
  useEffect(() => { if (system) input.current?.focus() }, [system])
  const paste = async () => {
    try { if (!take(await navigator.clipboard.readText())) setNote(null) } catch { setSystem(true) }
  }
  const key = (pressed: string) => {
    if (disabled) return
    setNote(null)
    const next = pressed === 'back' ? latest.current.slice(0, -1) : pressed === 'clear' ? '' : /^\d$/.test(pressed) && latest.current.length < length ? latest.current + pressed : latest.current
    latest.current = next
    onChange(next)
  }
  return <div className={k.code} data-invalid={invalid || undefined}>
    <label className={k.slots} dir="ltr" onClick={() => { if (system) input.current?.focus() }}>
      {Array.from({ length }, (_, i) => <span key={i} data-filled={i < value.length || undefined} data-current={(!disabled && i === value.length) || undefined}>{value[i] ?? ''}</span>)}
      <input ref={input} className={k.codeInput} value={value} disabled={disabled} aria-label={label} aria-invalid={invalid} inputMode={system ? 'numeric' : 'none'} autoComplete="one-time-code"
        pattern="[0-9]*" maxLength={length} tabIndex={system ? 0 : -1} onChange={(event) => { const raw = event.target.value; if (raw.length - latest.current.length > 1 && take(raw)) return; onChange(raw.replace(/\D/g, '').slice(0, length)) }} />
    </label>
    <p className={k.codeNote} aria-live="polite">{note}</p>
    {!system && <NumPad onKey={key} decimal={false} disabled={disabled} label={label}
      left={<button type="button" className={k.keySmall} disabled={disabled} onClick={() => { haptic(); void paste() }}>{c.paste}</button>} />}
    <button type="button" className={k.switch} onClick={() => setSystem((on) => !on)}>{system ? c.customKeyboard : c.systemKeyboard}</button>
  </div>
}
