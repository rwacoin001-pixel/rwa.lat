import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

// Type-safe window access for SSR-compatible code
const isBrowser = typeof window !== 'undefined'
const getWindow = () => isBrowser ? window : undefined

import type {
  // Types
  ApiResponse,
  ApiError,
  RegisterEmailRequest,
  RegisterEmailResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  LoginRequest,
  LoginResponse,
  SessionInfo,
  KycState,
  KycCase,
  SubmitKycRequest,
  SubmitKycResponse,
  WalletNetwork,
  WalletNetworkInfo,
  ListNetworksResponse,
  DepositAddress,
  GetDepositAddressResponse,
  CreateDepositRequest,
  DepositRecord,
  BalanceAccount,
  ListBalancesResponse,
  LedgerEntry,
  LedgerTransaction,
  ListTransactionsResponse,
  AssetClass,
  Product,
  ProductView,
  ListProductsRequest,
  ListProductsResponse,
  PriceQuote,
  DisclosureFile,
  OrderType,
  OrderState,
  CreateOrderRequest,
  OrderResponse,
  OrderReceipt,
  Position,
  AdminUser,
  AdminUserDetail,
  AdminListUsersRequest,
  AdminListUsersResponse,
  AdminKycCase,
  AdminKycAction,
  PaginatedResponse,
  HealthResponse
} from './types'

// ─── Configuration ───

export interface ApiClientConfig {
  baseUrl: string
  getAuthToken?: () => string | null
  timeout?: number
}

// ─── Error Class ───

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  static fromAxiosError(error: AxiosError<ApiError>): ApiClientError {
    if (error.response) {
      const data = error.response.data
      return new ApiClientError(
        data?.code || 'API_ERROR',
        data?.message || error.message,
        error.response.status,
        data?.details
      )
    }
    if (error.code === 'ECONNABORTED') {
      return new ApiClientError('TIMEOUT', 'Request timeout', 408)
    }
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      return new ApiClientError('NETWORK_ERROR', 'Network error - check your connection', 0)
    }
    return new ApiClientError('UNKNOWN_ERROR', error.message)
  }
}

// ─── Main Client ───

export class ApiClient {
  private client: AxiosInstance
  private config: Required<ApiClientConfig>

  constructor(config: ApiClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      getAuthToken: config.getAuthToken || (() => null),
      timeout: config.timeout || 30000
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Request interceptor for auth tokens
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const authToken = this.config.getAuthToken()
        if (authToken) {
          config.headers.set('Authorization', `Bearer ${authToken}`)
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => Promise.reject(ApiClientError.fromAxiosError(error))
    )
  }

  // Expose the axios instance for direct requests
  public get axios() {
    return this.client
  }

  // Helper to check if we're in browser
  private isBrowser(): boolean {
    return typeof window !== 'undefined'
  }

  // ─── Auth ───

  async registerEmail(data: RegisterEmailRequest): Promise<RegisterEmailResponse> {
    const response = await this.client.post<RegisterEmailResponse>('/v1/auth/register/email', data)
    return response.data
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const response = await this.client.post<VerifyEmailResponse>('/v1/auth/verify-email', data)
    return response.data
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/v1/auth/login', data)
    return response.data
  }

  async logout(sessionId: string, token: string): Promise<{ revoked: boolean }> {
    const response = await this.client.post<{ revoked: boolean }>('/v1/auth/logout', { sessionId, token })
    return response.data
  }

  async getSessions(): Promise<SessionInfo[]> {
    const response = await this.client.get<SessionInfo[]>('/v1/auth/sessions')
    return response.data
  }

  async revokeSession(sessionId: string, requestId?: string): Promise<{ revoked: boolean; isCurrent: boolean }> {
    const response = await this.client.post<{ revoked: boolean; isCurrent: boolean }>(
      `/v1/auth/sessions/${sessionId}/revoke`,
      {},
      { headers: requestId ? { 'x-request-id': requestId } : undefined }
    )
    return response.data
  }

  // ─── KYC ───

  async submitKyc(data: SubmitKycRequest): Promise<SubmitKycResponse> {
    const response = await this.client.post<SubmitKycResponse>('/v1/compliance/kyc/session', data)
    return response.data
  }

  async getKycStatus(): Promise<KycCase | null> {
    const response = await this.client.get<KycCase | null>('/v1/compliance/kyc/status')
    return response.data
  }

  async getEligibility(): Promise<{
    allowedRegions: string[]
    allowedAssetClasses: string[]
    decision: string
  }> {
    const response = await this.client.get('/v1/compliance/eligibility')
    return response.data
  }

  // ─── Wallet / Networks ───

  async listNetworks(): Promise<ListNetworksResponse> {
    const response = await this.client.get<ListNetworksResponse>('/v1/wallet/networks')
    return response.data
  }

  async getDepositAddress(network: WalletNetwork): Promise<GetDepositAddressResponse> {
    const response = await this.client.post<GetDepositAddressResponse>(`/v1/wallet/deposit-addresses/${network}`)
    return response.data
  }

  async createDeposit(data: CreateDepositRequest): Promise<DepositRecord> {
    const response = await this.client.post<DepositRecord>('/v1/wallet/deposits', data, {
      headers: { 'idempotency-key': data.txHash }
    })
    return response.data
  }

  async listDeposits(limit = 10): Promise<DepositRecord[]> {
    const response = await this.client.get<{ items: DepositRecord[] }>('/v1/wallet/deposits', {
      params: { limit }
    })
    return response.data.items
  }

  // ─── Balances / Ledger ───

  async getBalances(): Promise<ListBalancesResponse> {
    const response = await this.client.get<ListBalancesResponse>('/v1/wallet')
    return response.data
  }

  async listTransactions(limit = 50): Promise<ListTransactionsResponse> {
    const response = await this.client.get<ListTransactionsResponse>('/v1/ledger/transactions', {
      params: { limit }
    })
    return response.data
  }

  // ─── Products / Catalog ───

  async listAssetClasses(): Promise<AssetClass[]> {
    const response = await this.client.get<AssetClass[]>('/v1/catalog/asset-classes')
    return response.data
  }

  async listProducts(params: ListProductsRequest = {}): Promise<ListProductsResponse> {
    const response = await this.client.get<ListProductsResponse>('/v1/catalog/products', { params })
    return response.data
  }

  async getProduct(id: string): Promise<ProductView> {
    const response = await this.client.get<ProductView>(`/v1/catalog/products/${id}`)
    return response.data
  }

  async getProductPrice(id: string): Promise<PriceQuote> {
    const response = await this.client.get<PriceQuote>(`/v1/catalog/products/${id}/quote`)
    return response.data
  }

  async listDisclosures(productId: string): Promise<DisclosureFile[]> {
    const response = await this.client.get<DisclosureFile[]>(`/v1/catalog/products/${productId}/disclosures`)
    return response.data
  }

  // ─── Orders ───

  async createOrder(data: CreateOrderRequest): Promise<OrderResponse> {
    const response = await this.client.post<OrderResponse>('/v1/orders', data, {
      headers: { 'idempotency-key': data.idempotencyKey }
    })
    return response.data
  }

  async getOrder(id: string): Promise<OrderResponse> {
    const response = await this.client.get<OrderResponse>(`/v1/orders/${id}`)
    return response.data
  }

  async getOrderReceipt(id: string): Promise<OrderReceipt> {
    const response = await this.client.get<OrderReceipt>(`/v1/orders/${id}/receipt`)
    return response.data
  }

  async listOrders(params: { state?: OrderState; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<OrderResponse>> {
    const response = await this.client.get<PaginatedResponse<OrderResponse>>('/v1/orders', { params })
    return response.data
  }

  // ─── Portfolio / Positions ───

  async listPositions(): Promise<Position[]> {
    const response = await this.client.get<Position[]>('/v1/portfolio/positions')
    return response.data
  }

  async getPosition(id: string): Promise<Position> {
    const response = await this.client.get<Position>(`/v1/portfolio/positions/${id}`)
    return response.data
  }

  // ─── Admin API ───

  async adminListUsers(params: AdminListUsersRequest = {}): Promise<AdminListUsersResponse> {
    const response = await this.client.get<AdminListUsersResponse>('/users', { params })
    return response.data
  }

  async adminGetUser(id: string): Promise<AdminUserDetail> {
    const response = await this.client.get<AdminUserDetail>(`/users/${id}`)
    return response.data
  }

  async adminListKyc(params: { state?: KycState; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminKycCase>> {
    const response = await this.client.get<PaginatedResponse<AdminKycCase>>('/kyc', { params })
    return response.data
  }

  async adminGetKyc(id: string): Promise<AdminKycCase> {
    const response = await this.client.get<AdminKycCase>(`/kyc/${id}`)
    return response.data
  }

  async adminDecideKyc(id: string, action: AdminKycAction): Promise<{ decided: boolean }> {
    const response = await this.client.post<{ decided: boolean }>(`/kyc/${id}/decide`, action)
    return response.data
  }

  async adminListProducts(params: ListProductsRequest = {}): Promise<ListProductsResponse> {
    const response = await this.client.get<ListProductsResponse>('/products', { params })
    return response.data
  }

  async adminCreateProduct(data: Partial<Product> & { assetClassId: string }): Promise<Product> {
    const response = await this.client.post<Product>('/products', data)
    return response.data
  }

  async adminUpdateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const response = await this.client.patch<Product>(`/products/${id}`, data)
    return response.data
  }

  async adminListOrders(params: { state?: OrderState; userId?: string; productId?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<OrderResponse>> {
    const response = await this.client.get<PaginatedResponse<OrderResponse>>('/orders', { params })
    return response.data
  }

  async adminGetOrder(id: string): Promise<OrderResponse> {
    const response = await this.client.get<OrderResponse>(`/orders/${id}`)
    return response.data
  }

  async adminAdvanceOrder(id: string, state: OrderState, requestId?: string): Promise<OrderResponse> {
    const response = await this.client.post<OrderResponse>(
      `/orders/${id}/advance`,
      { state },
      { headers: requestId ? { 'x-request-id': requestId } : undefined }
    )
    return response.data
  }

  async adminListDeposits(params: { state?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<DepositRecord>> {
    const response = await this.client.get<PaginatedResponse<DepositRecord>>('/deposits', { params })
    return response.data
  }

  async adminConfirmDeposit(id: string, requestId?: string): Promise<{ confirmed: boolean }> {
    const response = await this.client.post<{ confirmed: boolean }>(
      `/deposits/${id}/confirm`,
      {},
      { headers: requestId ? { 'x-request-id': requestId } : undefined }
    )
    return response.data
  }

  // ─── Health ───

  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/v1/health')
    return response.data
  }
}

// ─── Factory Functions ───

export function createUserApiClient(baseUrl?: string): ApiClient {
  return new ApiClient({
    baseUrl: baseUrl || (isBrowser 
      ? (getWindow() as any).__NEXT_PUBLIC_API_URL__ || 'http://localhost:4000' 
      : 'http://localhost:4000'),
    getAuthToken: () => {
      if (isBrowser) {
        return getWindow()?.localStorage.getItem('auth_token') || null
      }
      return null
    }
  })
}

export function createAdminApiClient(baseUrl?: string): ApiClient {
  return new ApiClient({
    // Admin callers must use the same-origin BFF. It resolves the HttpOnly
    // session server-side and never exposes an administrator credential.
    baseUrl: baseUrl || '/api/admin',
  })
}
