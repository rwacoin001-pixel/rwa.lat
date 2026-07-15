'use client'

import Link from 'next/link'
import { ArrowRight, RotateCw, ShieldAlert } from 'lucide-react'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <section className="system-state-card system-state-card--error">
        <span className="system-state-icon"><ShieldAlert size={29} /></span>
        <p>RWA.LAT · SAFE RECOVERY</p>
        <h1>This view could not be loaded.</h1>
        <small>No order, transfer, or account change was submitted. You can safely retry the view or return to your workspace.</small>
        <div className="system-state-actions">
          <button type="button" onClick={reset}><RotateCw size={18} />Retry view</button>
          <Link href="/home">Return to Home <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
  )
}
