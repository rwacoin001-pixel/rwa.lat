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
    throw new Error(error.message || `HTTP ${response.status}`)
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

