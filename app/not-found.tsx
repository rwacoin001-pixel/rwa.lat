import Link from 'next/link'
import { ArrowRight, Radar } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <div className="not-found-radar" aria-hidden="true"><i /><i /><i /><span /></div>
        <p className="not-found-brand">RWA.LAT <b>•</b> ROUTE MONITOR</p>
        <p className="not-found-code">404 / UNAVAILABLE ROUTE</p>
        <h1>This workspace route is not available.</h1>
        <p className="not-found-body">The address may be outdated, restricted, or not part of this Demo release. Your wallet and account state have not changed.</p>
        <div className="not-found-status"><Radar size={17} /><span><b>System status: online</b><small>Public Demo services are responding normally.</small></span></div>
        <Link href="/home" className="not-found-cta">Return to Home <ArrowRight size={20} /></Link>
        <Link href="/support" className="not-found-help">Need help with a link?</Link>
      </section>
    </main>
  )
}
