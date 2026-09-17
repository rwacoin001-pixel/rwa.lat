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
    const message = typeof error.message === 'string' ? error.message : Array.isArray(error.message) ? error.message.join('；') : `HTTP ${response.status}`
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const adminApi = {
  getProfile: () => request<{ id: string; email: string; roleName: string; permissions: string[] }>('/auth/me'),
  listApprovals: (params?: { state?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.set('state', params.state)
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<any[]>(`/approvals${qs.size ? `?${qs}` : ''}`)
  },
  createApproval: (data: { action: string; objectType: string; objectId?: string; payload: Record<string, unknown> }) =>
    request<any>('/approvals', { method: 'POST', body: JSON.stringify(data) }),
  decideApproval: (id: string, approved: boolean, reasonCode?: string) =>
    request<any>(`/approvals/${id}/${approved ? 'decide' : 'reject'}`, { method: 'PUT', body: JSON.stringify({ reasonCode }) }),
  exportAudit: (params: { actorType?: string; userId?: string; action?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined) qs.set(key, String(value)) })
    return request<any[]>(`/audit?${qs}`)
  },
  listAssetClasses: () => request<AssetClass[]>('/control/asset-classes'),
  saveAssetClass: (data: AssetClassInput) => request<AssetClass>('/control/asset-classes', { method: 'POST', body: JSON.stringify(data) }),
  deprecateAssetClass: (id: string) => request<AssetClass>(`/control/asset-classes/${encodeURIComponent(id)}/deprecate`, { method: 'PUT' }),
  listProducts: () => request<AdminProduct[]>('/control/products'),
  createProduct: (data: ProductInput) => request<AdminProduct>('/control/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<ProductInput>) => request<AdminProduct>(`/control/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  setProductState: (id: string, state: ProductState) => request<AdminProduct>(`/control/products/${encodeURIComponent(id)}/state`, { method: 'PUT', body: JSON.stringify({ state }) }),
  listPrices: (id: string) => request<PriceQuote[]>(`/control/products/${encodeURIComponent(id)}/prices`),
  addPrice: (id: string, data: PriceInput) => request<PriceQuote[]>(`/control/products/${encodeURIComponent(id)}/prices`, { method: 'POST', body: JSON.stringify(data) }),
  listDisclosures: (id: string) => request<Disclosure[]>(`/control/products/${encodeURIComponent(id)}/disclosures`),
  addDisclosure: (id: string, data: DisclosureInput) => request<Disclosure[]>(`/control/products/${encodeURIComponent(id)}/disclosures`, { method: 'POST', body: JSON.stringify(data) }),
  listSwitches: () => request<OperationalSwitch[]>('/control/switches'),
  updateSwitch: (key: string, enabled: boolean, reason: string) => request<any>(`/control/switches/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ enabled, reason }) }),
  getStorageStatus: () => request<StorageStatus>('/control/storage/status'),
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
}
export type AdminProduct = ProductInput & {
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
export type AssetClassInput = { id: string; displayName: string; description?: string }
export type PriceQuote = { id: string; productId: string; assetCode: string; unitPriceAtomicAmount: string; currency: string; source: string; validUntil: string; capturedAt: string }
export type PriceInput = { unitPriceAtomicAmount: string; currency: string; source: string; validUntil: string }
export type Disclosure = { id: string; productId: string; kind: string; locale: string; title: string; storageRef: string; contentHash: string; state: string; publishedAt: string }
export type DisclosureInput = { kind: 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory'; locale: string; title: string; storageRef: string; contentHash: string }
export type OperationalSwitch = { key: string; label: string; description: string; current: { enabled: boolean; reason: string; updatedAt: string } | null; environmentReady: boolean; canEnable: boolean }
export type StorageStatus = { enabled: boolean; bucket: string; uploadFlow: string; message: string }
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
  scanMode: string
  internalScanAvailable: boolean
  externalEndpoint: boolean
  buckets: { name: string; label: string; maxBytes: number; contentTypes: string[] }[]
  uploadFlow: string
  message: string
}
