'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DangerButton, LimeButton, OutlineButton } from './ui'
import { sameEntry } from './format'

export type ConfirmRow = { label: string; value: ReactNode; strong?: boolean }

/**
 * Confirmation for an action that cannot be undone: it says what will happen, row by row, and its key names the
 * action itself. With `typeToConfirm` the key stays off until that exact text is typed (large amounts).
 * `onConfirm` throwing keeps it open with the message on one line.
 */
export function Confirm({ open, onClose, title, rows = [], note, confirmLabel, danger, typeToConfirm, typeLabel, disabled, onConfirm, children }: {
  open: boolean
  onClose: () => void
  title: string
  rows?: ConfirmRow[]
  note?: ReactNode
  confirmLabel: string
  danger?: boolean
  typeToConfirm?: string
  typeLabel?: string
  disabled?: boolean
  onConfirm: () => Promise<void> | void
  children?: ReactNode
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inflight = useRef(false)
  useEffect(() => { if (open) { setTyped(''); setError(''); setBusy(false) } }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])
  if (!open) return null
  const typedOk = !typeToConfirm || sameEntry(typed, typeToConfirm)
  const can = typedOk && !disabled && !busy
  const run = async () => {
    if (!can || inflight.current) return
    inflight.current = true
    setBusy(true)
    setError('')
    try { await onConfirm(); onClose() } catch (err) { setError(err instanceof Error ? err.message : '操作失败') } finally { inflight.current = false; setBusy(false) }
  }
  const Key = danger ? DangerButton : LimeButton
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-t-[28px] border border-ops-line bg-ops-raised p-6 font-ops text-ops-text shadow-2xl sm:rounded-[28px]">
        <h2 className="text-[22px] font-normal tracking-[-0.01em]">{title}</h2>
        {rows.length > 0 && (
          <dl className="mt-5 divide-y divide-ops-line rounded-[18px] border border-ops-line">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="shrink-0 text-[13px] text-ops-muted">{r.label}</dt>
                <dd className={cn('min-w-0 break-all text-right tabular-nums', r.strong ? 'text-[17px] text-ops-text' : 'text-[14px] text-ops-text')}>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {note && <p className="mt-4 text-[13px] leading-relaxed text-ops-muted">{note}</p>}
        {children}
        {typeToConfirm && (
          <label className="mt-4 block">
            <span className="text-[13px] text-ops-muted">{typeLabel ?? `输入 ${typeToConfirm} 以确认`}</span>
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="decimal" className="mt-2 h-11 w-full rounded-full border border-ops-line bg-ops-card px-4 text-[15px] tabular-nums outline-none focus:border-ops-lime" />
          </label>
        )}
        {error && <p role="alert" className="mt-3 text-[13px] text-ops-down">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <OutlineButton onClick={onClose} disabled={busy}>取消</OutlineButton>
          <Key onClick={() => void run()} disabled={!can}>{busy ? '处理中…' : confirmLabel}</Key>
        </div>
      </div>
    </div>
  )
}
