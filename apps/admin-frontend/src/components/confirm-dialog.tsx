'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ConfirmDetail = { label: string; value: ReactNode; mono?: boolean; emphasis?: boolean }

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  details?: ConfirmDetail[]
  /** When set, the confirm button stays disabled until the user types this exact text. */
  typeToConfirm?: string
  typeToConfirmLabel?: string
  confirmLabel?: string
  destructive?: boolean
  confirmDisabled?: boolean
  /** Throw to keep the dialog open and show the message. */
  onConfirm: () => Promise<void> | void
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details = [],
  typeToConfirm,
  typeToConfirmLabel,
  confirmLabel = '确认',
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    if (open) { setTyped(''); setError('') }
  }, [open])

  const typedOk = !typeToConfirm || typed.trim() === typeToConfirm
  const canConfirm = typedOk && !confirmDisabled && !pending

  const confirm = async () => {
    if (!canConfirm || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError('')
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent
        onEscapeKeyDown={(e) => { if (pending) e.preventDefault() }}
        onPointerDownOutside={(e) => { if (pending) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {details.length > 0 && (
          <dl className="divide-y divide-ink/[0.06] rounded-xl border border-ink/[0.08] bg-ink/[0.02] text-sm">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className={cn('break-all', d.mono && 'font-mono text-xs leading-5', d.emphasis && 'font-semibold text-ink')}>{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
        {typeToConfirm && (
          <label className="grid gap-1.5 text-sm">
            <span>{typeToConfirmLabel ?? <>请输入 <span className="font-mono font-semibold">{typeToConfirm}</span> 以确认</>}</span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} disabled={pending} className="font-mono" />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-negative">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={!canConfirm} onClick={() => void confirm()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
