import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageProps = {
  badge: string
  title: string
  updated: string
  children: ReactNode
}

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-medium tracking-tight text-white sm:text-lg">
        <span className="mr-2 text-[#2fe6bf]">{n}.</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function RiskNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#ff627a]/25 bg-[#ff627a]/10 p-5 text-[#ffd9e0]">
      {children}
    </div>
  )
}

export default function LegalPage({ badge, title, updated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-black text-[#f5f7f8]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rwa-mark.svg" alt="RWA.LAT" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold tracking-wide">RWA.LAT</span>
          </Link>
          <nav className="flex items-center gap-5 text-xs text-[#929aa6]">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#2fe6bf]">{badge}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-6 inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-[#929aa6]">
          Effective date: {updated}
        </p>
        <div className="mt-8 h-px w-full bg-[#2fe6bf]/30" />
        <div className="mt-12">{children}</div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-xs text-[#626a75] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 RWA.LAT — All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="transition-colors hover:text-[#929aa6]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[#929aa6]">
              Terms of Service
            </Link>
            <a href="mailto:support@rwa.lat" className="transition-colors hover:text-[#929aa6]">
              support@rwa.lat
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
