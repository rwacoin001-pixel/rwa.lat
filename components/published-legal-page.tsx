import type { ReactNode } from 'react'
import LegalPage, { Section } from './legal-page'
import type { ApiSchemas } from '@/lib/api/types'
import { BRAND } from '@/lib/brand/build-brand'
import { displayLegalPublication } from '@/lib/legal-publication'
import styles from './legal-page.module.css'

type Props = { kind: 'terms' | 'privacy'; version?: string; original?: boolean; children: ReactNode }
export default async function PublishedLegalPage({ kind, version, original = false, children }: Props) {
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
  if (document) {
    const shown = displayLegalPublication(document, BRAND, original)
    const documentHref = `/${kind}?version=${encodeURIComponent(document.version)}`
    return <LegalPage kind={kind} title={shown.document.title} updated={document.effectiveDate} effectiveDate={document.effectiveDate}>
    <div className={styles.publication}>
      <p>Published version <span dir="ltr">{document.version}</span> · Effective {document.effectiveDate}</p>
      {shown.adapted && <p>Brand, website and support references use the current KIMENG details. The published version and effective date are preserved. <a href={`${documentHref}&original=1`}>View the original publication</a>.</p>}
      {original && <p>Original publication. <a href={documentHref}>Return to the current brand view</a>.</p>}
    </div>
    {shown.document.sections.map((section, index) => <Section key={index} n={String(index + 1)} title={section.title}>
      {section.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>)}
    </Section>)}
  </LegalPage>
  }
  if (!production && (!version || version === '2026-09-18')) return children
  const title = kind === 'terms' ? 'Terms of Service' : 'Privacy Policy'
  return <LegalPage kind={kind} title={title} updated="" effectiveDate="">
    <p role="status">{missing ? 'Document not published.' : 'Document temporarily unavailable.'}</p>
  </LegalPage>
}
