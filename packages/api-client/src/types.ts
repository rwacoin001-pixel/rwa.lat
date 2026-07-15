/**
 * Type definitions for RWA.LAT API
 * 
 * These types match the OpenAPI spec from the Core API and Admin API
 */

// ─── Base Response Types ───

export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Auth Types ───

export interface RegisterEmailRequest {
  email: string
  locale?: string
}

export interface RegisterEmailResponse {
  accepted: true
}

export interface VerifyEmailRequest {
  token: string
}

export interface VerifyEmailResponse {
  userId: string
  verified: true
  sessionId: string
  token: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface LoginResponse {
  userId: string
  sessionId: string
  token: string
  expiresAt: string
}

export interface SessionInfo {
  id: string
  state: 'active' | 'revoked' | 'expired'
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  isCurrent: boolean
  device: {
    id: string
    name: string
    trustState: 'untrusted' | 'trusted' | 'revoked'
  } | null
}

// ─── KYC & Compliance ───

export type KycState = 'not_started' | 'in_progress' | 'submitted' | 'needs_information' | 'approved' | 'rejected' | 'expired'

export interface KycCase {
  id: string
  userId: string
  state: KycState
  provider: string
  reasonCode?: string
  submittedAt?: string
  decidedAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface SubmitKycRequest {
  provider: string
  documentType: 'id_card' | 'passport' | 'drivers_license'
  documentFront: string // base64
  documentBack?: string // base64
  selfie: string // base64
  address: {
    country: string
    region: string
    city: string
    street: string
    postalCode: string
  }
  personalInfo: {
    firstName: string
    lastName: string
    dateOfBirth: string // ISO date
    nationality: string
    documentNumber: string
  }
}

export interface SubmitKycResponse {
  caseId: string
  status: KycState
  estimatedReviewTime: string
}

// ─── Wallet / Networks ───

export type WalletNetwork = 'tron' | 'ethereum' | 'arbitrum'

export interface WalletNetworkInfo {
  network: WalletNetwork
  displayName: string
  minDepositAtomic: string
  minWithdrawAtomic: string
  feeAtomic: string
  requiredConfirmations: number
  state: 'enabled' | 'disabled'
}

export interface ListNetworksResponse {
  networks: WalletNetworkInfo[]
  integration: 'stub' | 'live'
}

export interface DepositAddress {
  address: string
  network: WalletNetwork
  qrCode: string // base64 data URL
  minAmountAtomic: string
}

export interface GetDepositAddressResponse {
  address: DepositAddress
}

export interface CreateDepositRequest {
  txHash: string
  network: WalletNetwork
  amountAtomic: string
  assetCode: 'USDT'
  assetDecimals: 6
}

export interface DepositRecord {
  id: string
  network: WalletNetwork
  txHash: string
  amountAtomic: string
  assetCode: string
  assetDecimals: number
  confirmations: number
  requiredConfirmations: number
  state: 'detected' | 'confirming' | 'credited' | 'rejected' | 'manual_review'
  detectedAt: string
  confirmedAt?: string
  creditedAt?: string
}

export interface BalanceAccount {
  purpose: string
  atomicBalance: string
  assetCode: string
  assetDecimals: number
}

export interface ListBalancesResponse {
  asset: { code: string; decimals: number }
  balances: Record<string, string> // purpose -> atomic amount
}

export interface LedgerEntry {
  entryId: string
  accountId: string
  purpose: string
  side: 'debit' | 'credit'
  atomicAmount: string
  assetCode: string
  assetDecimals: number
}

export interface LedgerTransaction {
  id: string
  transactionType: string
  referenceType: string
  referenceId: string
  effectiveAt: string
  createdAt: string
  entries: LedgerEntry[]
}

export interface ListTransactionsResponse {
  transactions: LedgerTransaction[]
  limit: number
}

// ─── Catalog / Products ───

export interface AssetClass {
  id: string
  displayName: string
  description: string
  state: 'active' | 'deprecated'
  createdAt: string
}

export interface Product {
  id: string
  assetClassId: string
  version: number
  externalRef?: string
  displayName: string
  summary?: string
  assetCode: string
  assetDecimals: number
  network?: WalletNetwork
  minOrderAtomicAmount?: string
  maxOrderAtomicAmount?: string
  state: 'draft' | 'published' | 'suspended' | 'retired'
  publishedAt?: string
  retiredAt?: string
  createdAt: string
}

export interface ProductView extends Product {}

export interface ListProductsRequest {
  assetClass?: string
  state?: 'published' | 'suspended'
  limit?: number
  offset?: number
}

export interface ListProductsResponse {
  items: ProductView[]
  total: number
}

export interface PriceQuote {
  productId: string
  unitPriceAtomicAmount: string
  currency: string
  source: string
  validUntil: string
  capturedAt: string
  stale: boolean
}

export interface DisclosureFile {
  id: string
  productId: string
  kind: 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory'
  locale: string
  title: string
  storageRef: string
  contentHash: string // hex
  state: 'active' | 'superseded' | 'removed'
  publishedAt: string
  supersededAt?: string
}

// ─── Orders ───

export type OrderType = 'subscription' | 'redemption' | 'buy' | 'sell'
export type OrderState = 'created' | 'reviewing' | 'submitted' | 'processing' | 'filled' | 'partially_filled' | 'failed' | 'cancelled'

export interface CreateOrderRequest {
  idempotencyKey: string
  productId: string
  type: OrderType
  amountAtomic: string
  priceAtomic?: string
  quoteId?: string
}

export interface OrderResponse {
  id: string
  userId: string
  productId: string
  type: OrderType
  state: OrderState
  amountAtomic: string
  filledAtomic: string
  priceAtomic: string
  feeAtomic: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  filledAt?: string
  failedAt?: string
  cancelledAt?: string
  reasonCode?: string
}

export interface OrderReceipt {
  order: OrderResponse
  product: ProductView
  price: PriceQuote
  balances: {
    availableBefore: string
    availableAfter: string
    lockedAfter: string
  }
}

// ─── Portfolio / Positions ───

export interface Position {
  id: string
  userId: string
  productId: string
  product: ProductView
  quantityAtomic: string
  costBasisAtomic: string
  currentValueAtomic: string
  unrealizedPnlAtomic: string
  realizedPnlAtomic: string
  createdAt: string
  updatedAt: string
}

// ─── Admin Types ───

export interface AdminUser {
  id: string
  status: string
  locale: string
  createdAt: string
  updatedAt: string | null
}

export interface AdminUserDetail extends AdminUser {
  kyc: KycCase | null
  wallet: {
    custodyWalletId: string
    addresses: Array<{ network: WalletNetwork; address: string }>
    balances: ListBalancesResponse
  }
  orders: OrderResponse[]
  positions: Position[]
  referrals: Array<{ id: string; status: string; rewardAtomic: string }>
}

export interface AdminListUsersRequest {
  limit?: number
  offset?: number
  search?: string
  status?: string
}

export interface AdminListUsersResponse {
  count: number
  users: AdminUser[]
}

export interface AdminKycCase {
  id: string
  userId: string
  userEmail: string
  state: KycState
  provider: string
  submittedAt?: string
  decidedAt?: string
  reasonCode?: string
  documents: Array<{
    type: string
    url: string
  }>
}

export interface AdminKycAction {
  action: 'approve' | 'reject' | 'request_info'
  reasonCode?: string
  notes?: string
}

export interface AdminProduct extends Product {
  quoted: boolean
  quote?: PriceQuote
}

// ─── Health ───

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  app: string
  time: string
  checks?: {
    database: 'ok' | 'down'
    redis: 'ok' | 'down' | 'n/a'
    external: Record<string, 'ok' | 'down' | 'n/a'>
  }
}
