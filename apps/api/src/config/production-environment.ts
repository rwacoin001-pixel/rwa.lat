type Environment = Record<string, unknown>

const REQUIRED_PRODUCTION_VALUES = [
  'PRODUCTION_DATABASE_URL',
  'CORS_ORIGINS',
  'PUBLIC_API_URL',
  'IDENTITY_HMAC_KEY',
  'PASSKEY_RP_ID',
  'PASSKEY_ORIGIN',
  'METRICS_BEARER_TOKEN',
  'TRUST_PROXY_HOPS',
  'AUTH_ADAPTER',
  'PUBLIC_APP_URL',
] as const

export function validateEnvironment(input: Environment): Environment {
  if (input.APP_ENV !== 'production') return input

  const missing = REQUIRED_PRODUCTION_VALUES.filter((key) => !read(input, key))
  if (missing.length) throw new Error(`Production configuration is missing: ${missing.join(', ')}`)

  assertHttps(input, 'PUBLIC_API_URL')
  assertHttps(input, 'PASSKEY_ORIGIN')
  assertHttps(input, 'PUBLIC_APP_URL')
  assertNoLocalOrigins(read(input, 'CORS_ORIGINS'))
  assertProductionKey(input, 'IDENTITY_HMAC_KEY')
  const encryptionKeys = assertProductionEncryptionKeys(input)
  requireValue(input, 'METRICS_BEARER_TOKEN', 32)
  assertTrustProxyHops(input)
  if (read(input, 'AUTH_ADAPTER').toLowerCase() !== 'production') {
    throw new Error('AUTH_ADAPTER=production is required in production')
  }
  assertEmailDelivery(input)
  assertOAuthProviders(input)
  if (encryptionKeys.includes(read(input, 'IDENTITY_HMAC_KEY').toLowerCase())) {
    throw new Error('IDENTITY_HMAC_KEY and IDENTITY_ENC_KEY must use different production keys')
  }
  if (read(input, 'POLYMARKET_TRADING_ENABLED') === 'true') {
    throw new Error('POLYMARKET_TRADING_ENABLED=true is forbidden because authenticated order submission is not installed')
  }
  if (read(input, 'POLYMARKET_GAMMA_URL')) assertHttps(input, 'POLYMARKET_GAMMA_URL')
  if (read(input, 'POLYMARKET_CLOB_URL')) assertHttps(input, 'POLYMARKET_CLOB_URL')
  assertObjectStorage(input)

  const financialFeatures = read(input, 'PRODUCTION_FINANCIAL_FEATURES_ENABLED')
  if (financialFeatures !== 'true' && financialFeatures !== 'false') {
    throw new Error('PRODUCTION_FINANCIAL_FEATURES_ENABLED must be explicitly true or false in production')
  }
  if (financialFeatures !== 'true' && read(input, 'WALLET_EXECUTION_ENABLED') === 'true') {
    throw new Error('WALLET_EXECUTION_ENABLED=true is forbidden while production financial features are disabled')
  }

  if (financialFeatures === 'true') {
    requireNonStub(input, 'KYC_PROVIDER')
    requireNonStub(input, 'SANCTIONS_PROVIDER')
    requireNonStub(input, 'WALLET_CUSTODY_ADAPTER')
    requireValue(input, 'WALLET_WEBHOOK_SECRET', 32)
    if (read(input, 'WALLET_EXECUTION_ENABLED') !== 'true') {
      throw new Error('WALLET_EXECUTION_ENABLED=true is required when production financial features are enabled')
    }
    if (read(input, 'WALLET_EXECUTION_WORKER_ENABLED') !== 'true') {
      throw new Error('WALLET_EXECUTION_WORKER_ENABLED=true is required when production financial features are enabled')
    }
    const regions = read(input, 'ALLOWED_REGIONS')
    if (!regions || regions.trim().toUpperCase() === 'ALL') {
      throw new Error('ALLOWED_REGIONS must be an explicit reviewed allowlist in financial production')
    }
    const addressCooldown = requireInteger(input, 'WITHDRAWAL_ADDRESS_COOLDOWN_SECONDS', 86_400, 2_592_000)
    const newDeviceCooldown = requireInteger(input, 'WITHDRAWAL_NEW_DEVICE_COOLDOWN_SECONDS', 86_400, 2_592_000)
    const perTransactionLimit = requireAtomic(input, 'WITHDRAWAL_PER_TRANSACTION_LIMIT_ATOMIC')
    const dailyLimit = requireAtomic(input, 'WITHDRAWAL_DAILY_LIMIT_ATOMIC')
    if (dailyLimit < perTransactionLimit) {
      throw new Error('WITHDRAWAL_DAILY_LIMIT_ATOMIC must be greater than or equal to WITHDRAWAL_PER_TRANSACTION_LIMIT_ATOMIC')
    }
    requireInteger(input, 'WITHDRAWAL_ADMIN_APPROVALS_REQUIRED', 2, 5)
    const withdrawalLease = requireInteger(input, 'WITHDRAWAL_EXECUTION_LEASE_SECONDS', 30, 900)
    const queueLease = requireInteger(input, 'WALLET_EXECUTION_QUEUE_LEASE_SECONDS', 60, 900)
    requireInteger(input, 'WALLET_EXECUTION_WORKER_POLL_MS', 1_000, 60_000)
    if (queueLease < withdrawalLease) {
      throw new Error('WALLET_EXECUTION_QUEUE_LEASE_SECONDS must be greater than or equal to WITHDRAWAL_EXECUTION_LEASE_SECONDS')
    }
    // Read variables are intentionally used here so missing/invalid values cannot
    // be hidden by service defaults in a real-funds process.
    void addressCooldown
    void newDeviceCooldown
  }

  return input
}

function read(input: Environment, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : ''
}

function requireValue(input: Environment, key: string, minimumLength = 1) {
  if (read(input, key).length < minimumLength) throw new Error(`${key} must contain at least ${minimumLength} characters`)
}

function requireNonStub(input: Environment, key: string) {
  const value = read(input, key).toLowerCase()
  if (!value || value === 'stub' || value === 'demo') throw new Error(`${key} must name a reviewed live adapter in financial production`)
}

function requireInteger(input: Environment, key: string, minimum: number, maximum: number): number {
  const value = read(input, key)
  if (!/^\d+$/.test(value)) throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`)
  }
  return parsed
}

function requireAtomic(input: Environment, key: string): bigint {
  const value = read(input, key)
  if (!/^[1-9]\d{0,77}$/.test(value)) throw new Error(`${key} must be a positive smallest-unit integer`)
  return BigInt(value)
}

function assertHttps(input: Environment, key: string) {
  let parsed: URL
  try {
    parsed = new URL(read(input, key))
  } catch {
    throw new Error(`${key} must be a valid URL`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`${key} must use HTTPS in production`)
}

function assertNoLocalOrigins(value: string) {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean)
  if (!origins.length || origins.some((origin) => /localhost|127\.0\.0\.1|:\/\/0\.0\.0\.0/i.test(origin))) {
    throw new Error('CORS_ORIGINS must contain explicit non-local production origins')
  }
  for (const origin of origins) {
    if (new URL(origin).protocol !== 'https:') throw new Error('Every production CORS origin must use HTTPS')
  }
}

function assertProductionKey(input: Environment, key: string) {
  const value = read(input, key)
  if (!/^[a-fA-F0-9]{64}$/.test(value) || /^0+$/.test(value)) {
    throw new Error(`${key} must be a non-placeholder 32-byte hex key in production`)
  }
}

function assertProductionEncryptionKeys(input: Environment): string[] {
  const encoded = read(input, 'IDENTITY_ENC_KEYS_JSON')
  if (!encoded) {
    if (!read(input, 'IDENTITY_ENC_KEY')) throw new Error('Production configuration is missing: IDENTITY_ENC_KEY or IDENTITY_ENC_KEYS_JSON')
    assertProductionKey(input, 'IDENTITY_ENC_KEY')
    return [read(input, 'IDENTITY_ENC_KEY').toLowerCase()]
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(encoded)
  } catch {
    throw new Error('IDENTITY_ENC_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('IDENTITY_ENC_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  const values: string[] = []
  for (const [version, key] of Object.entries(parsed)) {
    if (!/^[1-9]\d*$/.test(version) || typeof key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(key) || /^0+$/.test(key)) {
      throw new Error('IDENTITY_ENC_KEYS_JSON contains an invalid version or production AES-256 key')
    }
    values.push(key.toLowerCase())
  }
  const active = read(input, 'IDENTITY_ACTIVE_KEY_VERSION')
  if (!active || !(active in (parsed as Record<string, unknown>))) {
    throw new Error('IDENTITY_ACTIVE_KEY_VERSION must select a key present in IDENTITY_ENC_KEYS_JSON')
  }
  return values
}

function assertTrustProxyHops(input: Environment) {
  const value = read(input, 'TRUST_PROXY_HOPS')
  if (!/^\d+$/.test(value) || Number(value) > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10 matching the deployed proxy path')
  }
}

function assertObjectStorage(input: Environment) {
  const enabled = read(input, 'OBJECT_STORAGE_ENABLED')
  if (enabled !== 'true' && enabled !== 'false') {
    throw new Error('OBJECT_STORAGE_ENABLED must be explicitly true or false in production')
  }
  if (enabled !== 'true') return

  requireValue(input, 'S3_REGION')
  requireValue(input, 'S3_KMS_KEY_ID', 8)
  requireValue(input, 'OBJECT_STORAGE_SCAN_CALLBACK_SECRET', 32)
  requireNonStub(input, 'OBJECT_STORAGE_SCAN_PROVIDER')
  assertS3BucketMap(input)
  if (read(input, 'S3_ENDPOINT')) assertHttps(input, 'S3_ENDPOINT')

  const authMode = read(input, 'S3_AUTH_MODE')
  if (authMode !== 'workload' && authMode !== 'static') {
    throw new Error('S3_AUTH_MODE must be workload or static when object storage is enabled')
  }
  if (authMode === 'static') {
    requireValue(input, 'S3_ACCESS_KEY', 8)
    requireValue(input, 'S3_SECRET_KEY', 24)
  }
}

function assertEmailDelivery(input: Environment) {
  if (read(input, 'EMAIL_PROVIDER') !== 'smtp') {
    throw new Error('EMAIL_PROVIDER=smtp is required until another reviewed production delivery adapter is installed')
  }
  requireValue(input, 'SMTP_HOST')
  requireInteger(input, 'SMTP_PORT', 1, 65_535)
  const secure = read(input, 'SMTP_SECURE')
  if (secure !== 'true' && secure !== 'false') throw new Error('SMTP_SECURE must be explicitly true or false')
  const authMode = read(input, 'SMTP_AUTH_MODE')
  if (authMode !== 'plain' && authMode !== 'none') throw new Error('SMTP_AUTH_MODE must be plain or none')
  if (authMode === 'plain') {
    requireValue(input, 'SMTP_USER')
    requireValue(input, 'SMTP_PASSWORD', 16)
  }
  const from = read(input, 'EMAIL_FROM')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error('EMAIL_FROM must be a valid production sender address')
}

function assertOAuthProviders(input: Environment) {
  for (const prefix of ['GOOGLE', 'X'] as const) {
    const enabledKey = `${prefix}_OAUTH_ENABLED`
    const enabled = read(input, enabledKey)
    if (enabled !== 'true' && enabled !== 'false') {
      throw new Error(`${enabledKey} must be explicitly true or false`)
    }
    if (enabled !== 'true') continue
    requireValue(input, `${prefix}_OAUTH_CLIENT_ID`, 8)
    requireValue(input, `${prefix}_OAUTH_CLIENT_SECRET`, 16)
    const redirectKey = `${prefix}_OAUTH_REDIRECT_URI`
    assertHttps(input, redirectKey)
    const host = new URL(read(input, redirectKey)).hostname
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host)) {
      throw new Error(`${redirectKey} must use a non-local production host`)
    }
  }
  const timeout = read(input, 'OAUTH_HTTP_TIMEOUT_MS')
  if (timeout) requireInteger(input, 'OAUTH_HTTP_TIMEOUT_MS', 1_000, 30_000)
}

function assertS3BucketMap(input: Environment) {
  const value = read(input, 'S3_BUCKET_MAP_JSON')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('S3_BUCKET_MAP_JSON must map every logical bucket to a production physical bucket')
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('S3_BUCKET_MAP_JSON must map every logical bucket to a production physical bucket')
  }
  const mapping = parsed as Record<string, unknown>
  const logicalBuckets = ['rwa-kyc', 'rwa-assets', 'rwa-attachments']
  const physical = logicalBuckets.map((logical) => mapping[logical])
  if (physical.some((bucket) => typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))) {
    throw new Error('S3_BUCKET_MAP_JSON must map every logical bucket to a valid production physical bucket')
  }
  if (new Set(physical).size !== physical.length) {
    throw new Error('S3_BUCKET_MAP_JSON physical bucket names must be distinct')
  }
}
