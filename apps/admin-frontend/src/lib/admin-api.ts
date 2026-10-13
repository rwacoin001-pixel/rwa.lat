import { adminErrorMessage } from './admin-errors'

const API_BASE = '/api/admin'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(adminErrorMessage(error, response.status))
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const adminApi = {
  getLegal: (kind: LegalKind) => request<LegalConfiguration>(`/legal/${kind}`),
  saveLegal: (kind: LegalKind, expectedRevision: number, content: LegalContent) => request<LegalConfiguration>(`/legal/${kind}`, { method: 'PUT', body: JSON.stringify({ expectedRevision, content }) }),
  publishLegal: (kind: LegalKind, expectedRevision: number) => request<LegalConfiguration>(`/legal/${kind}/publish`, { method: 'POST', body: JSON.stringify({ expectedRevision }) }),
  legalVersions: (kind: LegalKind) => request<LegalVersion[]>(`/legal/${kind}/versions`),
  accountClosures:()=>request<Array<{id:string;userId:string;state:string;reason:string;createdAt:string}>>('/account-closures'),
  accountClosure:(id:string)=>request<{id:string;userId:string;state:string;reason:string;createdAt:string;blockers:{code:string;count:number}[]}>(`/account-closures/${encodeURIComponent(id)}`),
  reviewAccountClosure:(id:string,body:{decision:'close'|'reject';note:string})=>request(`/account-closures/${encodeURIComponent(id)}/review`,{method:'POST',body:JSON.stringify(body)}),
  settlementInfo: (kind: 'orders' | 'redemptions', id: string) => request<{ id: string; userId: string; state: string; productName: string; quantityDecimals: number; feeRequired: boolean }>(`/manual-settlements/${kind}/${encodeURIComponent(id)}`),
  postSettlement: (kind: 'orders' | 'redemptions', id: string, data: { externalReference: string; evidenceRef: string; amountAtomic: string; quantityAtomic: string; feeAtomic?: string }) => request(`/manual-settlements/${kind}/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(data) }),
  reviewSettlement: (id: string, state: 'verified' | 'exception', note: string) => request(`/manual-settlements/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ state, note }) }),
  getPlatform: () => request<PlatformConfiguration>('/platform'),
  savePlatform: (expectedRevision: number, content: PlatformContent) => request<PlatformConfiguration>('/platform', { method: 'PUT', body: JSON.stringify({ expectedRevision, content }) }),
  publishPlatform: (expectedRevision: number) => request<PlatformConfiguration>('/platform/publish', { method: 'POST', body: JSON.stringify({ expectedRevision }) }),
  platformVersions: () => request<Array<{ revision: number; publishedAt: string }>>('/platform/versions'),
  getVerifiedAccess: (id: string) => request<VerifiedAccess | null>(`/platform/users/${encodeURIComponent(id)}/access`),
  saveVerifiedAccess: (id: string, data: VerifiedAccess) => request<VerifiedAccess>(`/platform/users/${encodeURIComponent(id)}/access`, { method: 'PUT', body: JSON.stringify(data) }),
  getProfile: () => request<{ id: string; email: string; roleName: string; permissions: string[] }>('/auth/me'),
  createApproval: (data: { action: string; objectType: string; objectId?: string; payload?: Record<string, unknown> }) =>
    request<unknown>('/approvals', { method: 'POST', body: JSON.stringify(data) }),
  // 管理 API 为 POST /approvals/:id/decide|reject（再转发为核心侧 PUT）
  decideApproval: (id: string, approved: boolean, reasonCode?: string) =>
    request<unknown>(`/approvals/${encodeURIComponent(id)}/${approved ? 'decide' : 'reject'}`, { method: 'POST', body: JSON.stringify({ reasonCode }) }),
  listAssetClasses: () => request<AssetClass[]>('/control/asset-classes'),
  saveAssetClass: (data: AssetClassInput) => request<AssetClass>('/control/asset-classes', { method: 'POST', body: JSON.stringify(data) }),
  deprecateAssetClass: (id: string) => request<AssetClass>(`/control/asset-classes/${encodeURIComponent(id)}/deprecate`, { method: 'PUT' }),
  listProducts: () => request<AdminProduct[]>('/control/products'),
  createProduct: (data: ProductInput) => request<AdminProduct>('/control/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<ProductInput>) => request<AdminProduct>(`/control/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  setProductState: (id: string, state: ProductState) => request<AdminProduct>(`/control/products/${encodeURIComponent(id)}/state`, { method: 'PUT', body: JSON.stringify({ state }) }),
  listPrices: (id: string) => request<PriceQuote[]>(`/control/products/${encodeURIComponent(id)}/prices`),
  saveAutomaticQuote: (id: string, data: Omit<AutomaticQuoteBinding, 'revision' | 'bindingId'> & { expectedRevision: number }) =>
    request<AdminProduct>(`/control/products/${encodeURIComponent(id)}/automatic-quote`, { method: 'PUT', body: JSON.stringify(data) }),
  addPrice: (id: string, data: PriceInput) => request<PriceQuote[]>(`/control/products/${encodeURIComponent(id)}/prices`, { method: 'POST', body: JSON.stringify(data) }),
  listDisclosures: (id: string) => request<Disclosure[]>(`/control/products/${encodeURIComponent(id)}/disclosures`),
  addDisclosure: (id: string, data: DisclosureInput) => request<Disclosure[]>(`/control/products/${encodeURIComponent(id)}/disclosures`, { method: 'POST', body: JSON.stringify(data) }),
  listSwitches: () => request<OperationalSwitch[]>('/control/switches'),
  updateSwitch: (key: string, enabled: boolean, reason: string) => request<any>(`/control/switches/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ enabled, reason }) }),
  listTreasuryAddresses: () => request<TreasuryAddress[]>('/control/wallet/treasury-addresses'),
  saveTreasuryAddress: (data: TreasuryAddressInput) => request<TreasuryAddress>('/control/wallet/treasury-addresses', { method: 'POST', body: JSON.stringify(data) }),
  deactivateTreasuryAddress: (id: string) => request<TreasuryAddress[]>(`/control/wallet/treasury-addresses/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ── 对象存储（文件上传）───────────────────────────────────
  getStorageReadiness: () => request<StorageReadiness>('/storage/status'),
  presignUpload: (data: PresignUploadInput) =>
    request<PresignUploadResult>('/storage/presign-upload', { method: 'POST', body: JSON.stringify(data) }),
  completeUpload: (data: { presignedId: string; sizeBytes: number; md5?: string }) =>
    request<StoredObject>('/storage/complete', { method: 'POST', body: JSON.stringify(data) }),
  listObjects: (params?: { bucket?: string; scanStatus?: string; q?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([key, value]) => { if (value !== undefined && value !== '') qs.set(key, String(value)) })
    return request<StoredObjectPage>(`/storage/objects${qs.size ? `?${qs}` : ''}`)
  },
  scanObject: (id: string) => request<StoredObject>(`/storage/objects/${encodeURIComponent(id)}/scan`, { method: 'POST', body: JSON.stringify({}) }),
  downloadObject: (id: string, disposition?: 'inline' | 'attachment') =>
    request<{ url: string; expiresInSec: number; objectId: string }>(`/storage/objects/${encodeURIComponent(id)}/download`, {
      method: 'POST',
      body: JSON.stringify({ disposition }),
    }),
  deleteObject: (id: string) => request<{ deleted: boolean; objectId: string }>(`/storage/objects/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({}) }),
}

export type LegalKind = 'terms' | 'privacy'
export type LegalContent = { title: string; effectiveDate: string; sections: Array<{ title: string; body: string }> }
export type LegalConfiguration = { kind: LegalKind; revision: number; draft: Partial<LegalContent>; publishedRevision: number | null; updatedAt: string }
export type LegalVersion = { revision: number; version: string; content: LegalContent; publishedAt: string }

export type ProductState = 'draft' | 'published' | 'suspended' | 'retired'
export type AssetClass = { id: string; displayName: string; description: string | null; state: string }
export type ProductInput = {
  assetClassId: string
  externalRef?: string
  displayName: string
  summary?: string
  assetCode: string
  assetDecimals: number
  network?: 'tron' | 'ethereum' | 'arbitrum'
  minOrderAtomicAmount?: string
  maxOrderAtomicAmount?: string
  metadata?: Record<string, unknown>
  yieldTerms?: Record<string, unknown>
  riskDisclosure?: Record<string, unknown>
  mediaRefs?: string[]
  coverStorageRef?: string | null
}
export type AdminProduct = ProductInput & {
  quoteBinding?: AutomaticQuoteBinding | null
  quoteSyncCheckedAt?: string | null
  quoteSyncError?: string | null
  id: string
  version: number
  state: ProductState
  publishedAt: string | null
  updatedAt: string
  latestPriceAtomicAmount?: string | null
  latestPriceCurrency?: string | null
  priceValidUntil?: string | null
  priceSource?: string | null
}
export type AutomaticQuoteBinding = {
  revision: number; bindingId: string; enabled: boolean; issuerName: string; tokenName: string;
  tokenSymbol: string; chain: string; contractAddress: string
}
export type AssetClassInput = { id: string; displayName: string; description?: string }
export type PriceQuote = { unitPriceDecimals: number; id: string; productId: string; assetCode: string; unitPriceAtomicAmount: string; currency: string; source: string; validUntil: string; capturedAt: string }
export type PriceInput = { unitPriceDecimals?: number; unitPriceAtomicAmount: string; currency: string; source: string; validUntil: string }
export type Disclosure = { id: string; productId: string; kind: string; locale: string; title: string; storageRef: string; contentHash: string; state: string; publishedAt: string }
export type DisclosureInput = { kind: 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory'; locale: string; title: string; storageRef: string; contentHash: string }
export type OperationalSwitch = { key: string; label: string; description: string; current: { enabled: boolean; reason: string; updatedAt: string } | null; environmentReady: boolean; canEnable: boolean }
export type TreasuryAddress = { id: string; network: string; assetCode: string; purpose: string; label: string; address: string; memo: string | null; state: string; updatedAt: string }
export type TreasuryAddressInput = { network: 'tron' | 'ethereum' | 'arbitrum'; assetCode: string; purpose: 'deposit' | 'withdrawal' | 'collection' | 'operational'; label: string; address: string; memo?: string; state?: 'active' | 'inactive' }

// ── 存储类型 ─────────────────────────────────────────────────
export type StoredObject = {
  id: string
  bucket: string
  key: string
  storageRef: string
  contentType: string
  sizeBytes: string
  expectedSizeBytes?: string | null
  checksumSha256: string | null
  scanStatus: 'pending' | 'clean' | 'quarantined' | 'failed'
  scanProvider?: string | null
  scannedAt?: string | null
  tags?: Record<string, unknown>
  uploadedBy?: string | null
  uploadedAt: string
}
export type StoredObjectPage = { items: StoredObject[]; total: number; page: number; pageSize: number }
export type PresignUploadInput = {
  bucket: 'rwa-kyc' | 'rwa-assets' | 'rwa-attachments'
  fileName: string
  contentType: string
  expectedSizeBytes: number
  checksumSha256: string
  purpose?: 'product-media' | 'disclosure' | 'kyc' | 'misc'
  productId?: string
}
export type PresignUploadResult = {
  presignedUrl: string
  presignedId: string
  objectId: string
  objectKey: string
  expiresInSec: number
  requiredHeaders: Record<string, string>
}
export type StorageReadiness = {
  enabled: boolean
  requireScan: boolean
  scanMode: string
  internalScanAvailable: boolean
  externalEndpoint: boolean
  buckets: { name: string; label: string; maxBytes: number; contentTypes: string[] }[]
  uploadFlow: string
  message: string
}

export type PlatformContent = {
  legalName: string; registrationNumber: string; jurisdiction: string; address: string;
  supportEmail: string; description: string; allowedRegions: string[]; investorTypes: string[];
  documents: Array<{ title: string; storageRef: string; public: boolean; kind?: 'general'|'reserve_audit'|'reserve_custody'; reportDate?: string; asOfDate?: string; issuer?: string }>;
  officialChannels: Array<{ kind: 'website' | 'x' | 'telegram' | 'linkedin' | 'discord' | 'other'; label: string; url: string; note: string }>;
}
export type PlatformConfiguration = { revision: number; draft: Partial<PlatformContent>; published: PlatformContent | null; publishedRevision: number | null; publishedAt: string | null }
export type VerifiedAccess = { region: string; investorType: string; evidenceRef: string; verifiedAt?: string }
