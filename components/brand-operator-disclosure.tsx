'use client'
import { BRAND } from '@/lib/brand/build-brand'
import { useI18n } from '@/lib/i18n'
import { trustCopy } from '@/lib/maison-trust-copy'
import { request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'

type Operator = { legalName: string; registrationNumber: string; supportEmail: string }
const load = () => request<Operator>('/v1/platform/brands/kimeng')
export default function BrandOperatorDisclosure() {
  const { locale } = useI18n()
  const query = useQuery(BRAND.id === 'kimeng' ? 'brand:kimeng:operator' : null, load, { staleTime: 30_000, loading: 'silent' })
  if (BRAND.id !== 'kimeng') return null
  const c = trustCopy[locale]
  return <span style={{ display: 'block', flexBasis: '100%', lineHeight: 1.7 }}>
    {query.data ? <><a href="/trust/platform">{query.data.legalName} · {query.data.registrationNumber}</a><br /><a href={`mailto:${query.data.supportEmail}`}>{query.data.supportEmail}</a></> : c.unpublished}
  </span>
}
