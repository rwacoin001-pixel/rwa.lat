import type { ReactNode } from 'react'
import LegalPage, { Section } from './legal-page'
import type { ApiSchemas } from '@/lib/api/types'

type Props = { kind: 'terms' | 'privacy'; version?: string; children: ReactNode }
export default async function PublishedLegalPage({ kind, version, children }: Props) {
  const production = process.env.NODE_ENV === 'production'
  const base = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL ||
    (production ? '' : 'http://127.0.0.1:4000')).replace(/\/+$/, '')
  let document: ApiSchemas['PublishedLegalDocumentDto'] | null = null
  let missing = false
  try {
    if (!base) throw new Error('API base URL required')
    const query = version ? `?version=${encodeURIComponent(version)}` : ''
    const response = await fetch(`${base}/v1/legal/${kind}${query}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    missing = response.status === 404
    if (response.ok) document = await response.json()
  } catch { /* Never substitute an old template for a production publication. */ }
  if (document) return <LegalPage kind={kind} title={document.title} updated={document.effectiveDate} effectiveDate={document.effectiveDate}>
    {document.sections.map((section, index) => <Section key={index} n={String(index + 1)} title={section.title}>
      {section.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>)}
    </Section>)}
  </LegalPage>
  if (!production && (!version || version === '2026-09-18')) return children
  const title = kind === 'terms' ? 'Terms of Service' : 'Privacy Policy'
  return <LegalPage kind={kind} title={title} updated="" effectiveDate="">
    <p role="status">{missing ? 'Document not published.' : 'Document temporarily unavailable.'}</p>
  </LegalPage>
}
