/**
 * @rwa-lat/api-client - Shared API client for RWA.LAT
 * 
 * Provides typed API clients for:
 * - User-facing Core API (v1/*)
 * - Admin API (v1/admin/*)
 * 
 * Usage:
 * ```typescript
 * import { createUserApiClient, createAdminApiClient } from '@rwa-lat/api-client'
 * 
 * const userApi = createUserApiClient()
 * const adminApi = createAdminApiClient('/api/admin')
 * ```
 */

export { ApiClient, createUserApiClient, createAdminApiClient, ApiClientError } from './client'
export * from './types'
