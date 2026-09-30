/**
 * Product disclosures (资料室) data layer — via Core API catalog module.
 */
import { apiClient } from './api-client'

export type DisclosureKind = 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory'
export type DisclosureState = 'active' | 'superseded' | 'removed'

export type DisclosureFileView = {
  id: string
  product_id: string
  kind: DisclosureKind
  locale: string
  title: string
  storage_ref: string
  url?: string | null
  state: DisclosureState
  published_at: string
  [key: string]: unknown
}

export async function listProductDisclosures(productId: string): Promise<DisclosureFileView[]> {
  const { data } = await apiClient.axios.get(`/v1/catalog/products/${encodeURIComponent(productId)}/disclosures`)
  return Array.isArray(data) ? data : data?.items ?? []
}

export const DISCLOSURE_KIND_LABELS: Record<DisclosureKind, string> = {
  prospectus: '招募说明书',
  risk_disclosure: '风险披露',
  terms: '条款与条件',
  regulatory: '监管文件',
}

export const DISCLOSURE_KIND_ORDER: DisclosureKind[] = ['prospectus', 'risk_disclosure', 'terms', 'regulatory']

/** 资料完整度判定：至少需要招募说明书 + 风险披露才算可购买（圆桌第4场裁定） */
export function isDisclosureComplete(files: DisclosureFileView[]): boolean {
  const kinds = new Set(files.map((file) => file.kind))
  return kinds.has('prospectus') && kinds.has('risk_disclosure')
}
