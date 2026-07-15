/**
 * API Client for RWA.LAT H5 Frontend
 * 
 * This wraps the shared @rwa-lat/api-client package with H5-specific configuration
 * using NEXT_PUBLIC_API_URL from environment variables.
 */

import { createUserApiClient, ApiClient } from '@rwa-lat/api-client'

// Get base URL from environment variable (falls back to localhost:4000 for development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// Create the API client instance
export const apiClient = createUserApiClient(API_BASE_URL)

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
    localStorage.setItem('auth_token', token)
  }
}

// Helper function to clear auth token (called on logout)
export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
  }
}

// Helper to get current auth token
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token')
  }
  return null
}

// Helper to check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('auth_token')
  }
  return false
}

// Demo login helper - uses the Core API demo login endpoint
export async function demoLogin(
  email: string = 'demo@user.rwa.lat', 
  type: 'user' | 'admin' = 'user'
): Promise<{ token: string; userId: string; expiresAt: string }> {
  const response = await apiClient.client.post('/v1/auth/demo/login', { email, type })
  return response.data
}