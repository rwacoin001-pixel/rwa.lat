import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Sign-in and recovery: the console's dark page, the text wordmark, a big light title and one dark card. */
export function AuthFrame({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="ops-root flex min-h-screen flex-col font-ops antialiased">
      <header className="mx-auto flex h-[76px] w-full max-w-[1480px] items-center px-5 sm:px-8">
        <span className="text-[19px] font-medium tracking-[-0.02em]">A-REIT</span>
        <span className="ml-3 rounded-full border border-ops-line px-3 py-1 text-[12px] text-ops-muted">运营后台</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-[8vh] sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[40px] font-normal leading-[1.05] tracking-[-0.02em] sm:text-[44px]">{title}</h1>
          {intro && <p className="mt-3 text-[14px] leading-relaxed text-ops-muted">{intro}</p>}
          <div className="mt-8 rounded-[28px] border border-ops-line bg-ops-card p-6 sm:p-7">{children}</div>
          {footer && <div className="mt-6 text-center text-[13px] text-ops-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export function AuthField({ label, id, hint, className, ...input }: { label: string; id: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] text-ops-muted">{label}</label>
      <input id={id} {...input}
        className={cn('h-12 w-full rounded-full border border-ops-line bg-ops-bg px-5 text-[15px] text-ops-text outline-none transition-colors placeholder:text-[#5B6270] focus:border-ops-lime disabled:opacity-60', className)} />
      {hint && <div className="mt-2 text-[12px] text-ops-muted">{hint}</div>}
    </div>
  )
}

export function AuthSubmit({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy}
      className="flex h-12 w-full items-center justify-center rounded-full bg-ops-lime text-[15px] font-medium text-ops-ink transition-opacity hover:opacity-90 disabled:opacity-60">
      {children}
    </button>
  )
}

/** One plain line: errors in the down colour, notices muted. No tinted boxes. */
export function AuthMessage({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  return <p role={kind === 'error' ? 'alert' : 'status'} className={cn('mb-5 text-[14px] leading-relaxed', kind === 'error' ? 'text-ops-down' : 'text-ops-muted')}>{children}</p>
}
