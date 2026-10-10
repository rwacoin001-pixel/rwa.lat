/**
 * API Client for A-REIT H5 Frontend
 *
 * This wraps the shared @rwa-lat/api-client package with H5-specific configuration
 * using NEXT_PUBLIC_API_URL from environment variables.
 */

import { createUserApiClient, ApiClient, ApiClientError } from '@rwa-lat/api-client'
import { clearSession, getSessionToken, handleSessionUnauthorized, isKycEligibilityError, saveSession, shouldExpireSessionOn401 } from './api/_http'

// Get base URL from environment variable (falls back to localhost:4000 for development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''

// Create the API client instance
export const apiClient = createUserApiClient(API_BASE_URL, {
  getAuthToken: getSessionToken,
  onUnauthorized: (error) => {
    const headers = error.config?.headers as unknown as {
      get?: (name: string) => unknown
      Authorization?: unknown
      authorization?: unknown
    } | undefined
    const authorization = headers?.get?.('Authorization') ?? headers?.Authorization ?? headers?.authorization
    const body = error.response?.data as { code?: unknown; error?: { code?: unknown } } | undefined
    const code = typeof body?.code === 'string' ? body.code : typeof body?.error?.code === 'string' ? body.error.code : undefined
    if (shouldExpireSessionOn401(error.config?.url, typeof authorization === 'string' && authorization.length > 0, code)) {
      handleSessionUnauthorized()
    }
  },
})

apiClient.axios.interceptors.response.use(undefined, (error: unknown) => {
  if (error instanceof ApiClientError && typeof window !== 'undefined'
    && isKycEligibilityError({ status: error.status ?? 0, code: error.code, message: error.message, details: error.details })) {
    window.dispatchEvent(new CustomEvent('rwa:kyc-required', { detail: error }))
  }
  return Promise.reject(error)
})

// Re-export types for convenience
export type {
  // Auth
  RegisterEmailRequest,
  RegisterEmailResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  LoginRequest,
  LoginResponse,
  SessionInfo,
  // KYC
  KycState,
  KycCase,
  SubmitKycRequest,
  SubmitKycResponse,
  // Wallet
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
  // Catalog
  AssetClass,
  Product,
  ProductView,
  ListProductsRequest,
  ListProductsResponse,
  PriceQuote,
  DisclosureFile,
  // Orders
  OrderType,
  OrderState,
  CreateOrderRequest,
  OrderResponse,
  OrderReceipt,
  PaginatedResponse,
  // Portfolio
  Position,
  // Admin
  AdminUser,
  AdminUserDetail,
  AdminListUsersRequest,
  AdminListUsersResponse,
  AdminKycCase,
  AdminKycAction,
  // Health
  HealthResponse,
} from '@rwa-lat/api-client'

// Re-export the client class for advanced usage
export { ApiClient } from '@rwa-lat/api-client'

// Helper function to set auth token (called after login)
export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    saveSession(token)
  }
}

// Helper function to clear auth token (called on logout)
export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    clearSession()
  }
}

// Helper to get current auth token
export function getAuthToken(): string | null {
  return getSessionToken()
}

// Helper to check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return Boolean(getAuthToken())
  }
  return false
}

// Demo login helper - uses the Core API demo login endpoint
export async function demoLogin(
  email: string = 'demo@user.a-reit.com',
  type: 'user' | 'admin' = 'user'
): Promise<{ token: string; userId: string; expiresAt: string }> {
  const response = await apiClient.axios.post('/v1/auth/demo/login', { email, type })
  return response.data
}
