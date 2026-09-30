'use client'

import { apiUrl, type ApiResult } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { getDisclosures, listProducts, type CatalogProduct } from '@/lib/api/markets'
import { useI18n } from '@/lib/i18n'
import { trustCopy } from '@/lib/maison-trust-copy'
import { ArrowUpRight, FileText } from 'lucide-react'
import { Skeleton, StateBlock } from './maison/primitives'
import s from './maison/published.module.css'

type Disclosure = { id: string; title: string; kind: string; locale: string; url: string | null; publishedAt: string | null }
type ProductGroup = { product: CatalogProduct; disclosures: Disclosure[] }

function normalize(value: unknown): Disclosure[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.title !== 'string') return []
    return [{
      id: row.id,
      title: row.title,
      kind: typeof row.kind === 'string' ? row.kind : 'document',
      locale: typeof row.locale === 'string' ? row.locale : '',
      url: typeof row.url === 'string' ? row.url : null,
      publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : typeof row.published_at === 'string' ? row.published_at : null,
    }]
  })
}

async function load(): Promise<ApiResult<{ groups: ProductGroup[]; failed: number }>> {
  const products = await listProducts()
  if (!products.ok) return products
  const published = products.data.filter((product) => product.state === 'published')
  const settled = await Promise.all(published.map(async (product) => ({ product, result: await getDisclosures(product.id) })))
  return {
    ok: true,
    data: {
      groups: settled.flatMap(({ product, result }) => result.ok ? [{ product, disclosures: normalize(result.data) }] : []).filter((group) => group.disclosures.length),
      failed: settled.filter(({ result }) => !result.ok).length,
    },
  }
}

export function PublishedProductDisclosures() {
  const { locale } = useI18n()
  const c = trustCopy[locale]
  const query = useQuery('platform:product-disclosures', load, { staleTime: 60_000 })
  if (query.error) return <div className={s.wrap}><StateBlock tone="error" title={query.error.status === 0 ? c.network : c.discFailed} retry={query.refetch} retryLabel={c.retry} /></div>
  if (!query.data) return <div className={s.wrap} role="status" aria-label={c.discLoading}><Skeleton rows={3} /></div>
  if (!query.data.groups.length) return <div className={s.wrap}>{query.data.failed ? <StateBlock tone="error" title={c.discFailed} retry={query.refetch} retryLabel={c.retry} /> : <StateBlock title={c.discEmpty} />}</div>
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  return <div className={s.wrap}>
    {query.data.groups.map(({ product, disclosures }) => <section key={product.id} aria-label={product.displayName}>
      <h2 className={s.section} dir="auto">{product.displayName}</h2>
      <ul className={s.card}>{disclosures.map((file) => {
        const href = file.url && (file.url.startsWith('/v1/') ? apiUrl(file.url) : /^https:\/\//i.test(file.url) ? file.url : null)
        const at = file.publishedAt ? new Date(file.publishedAt) : null
        const meta = `${c.kinds[file.kind] ?? c.kinds.document}${file.locale ? ` · ${file.locale.toUpperCase()}` : ''}${at && !Number.isNaN(at.getTime()) ? ` · ${date.format(at)}` : ''}`
        const body = <><span className={s.rowIcon} aria-hidden="true"><FileText size={17} strokeWidth={1.6} /></span><span className={s.rowText}><b dir="auto">{file.title}</b><small>{meta}</small></span>{href && <ArrowUpRight className={s.chev} size={16} aria-hidden="true" />}</>
        return <li key={file.id}>{href ? <a className={s.row} href={href} target="_blank" rel="noopener noreferrer">{body}</a> : <div className={s.row}>{body}</div>}</li>
      })}</ul>
    </section>)}
    {query.data.failed > 0 && <StateBlock tone="error" title={c.discPartial.replace('{n}', String(query.data.failed))} retry={query.refetch} retryLabel={c.retry} />}
  </div>
}
