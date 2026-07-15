type Environment = Record<string, unknown>

const REQUIRED = [
  'ADMIN_DATABASE_URL',
  'ADMIN_CORS_ORIGINS',
  'PUBLIC_ADMIN_API_URL',
  'TRUST_PROXY_HOPS',
] as const

export function validateAdminEnvironment(input: Environment): Environment {
  if (input.APP_ENV !== 'production') return input
  const missing = REQUIRED.filter((key) => !read(input, key))
  if (missing.length) throw new Error(`Admin production configuration is missing: ${missing.join(', ')}`)

  assertHttps(input, 'PUBLIC_ADMIN_API_URL')
  assertProductionDatabase(read(input, 'ADMIN_DATABASE_URL'))
  assertCorsOrigins(read(input, 'ADMIN_CORS_ORIGINS'))
  assertTrustProxyHops(read(input, 'TRUST_PROXY_HOPS'))
  assertMfaKeyring(input)
  if (read(input, 'ADMIN_MFA_REQUIRED') !== 'true') {
    throw new Error('ADMIN_MFA_REQUIRED=true is mandatory in production')
  }
  return input
}

function read(input: Environment, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : ''
}

function assertHttps(input: Environment, key: string) {
  let url: URL
  try {
    url = new URL(read(input, key))
  } catch {
    throw new Error(`${key} must be a valid URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${key} must use HTTPS in production`)
}

function assertProductionDatabase(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('ADMIN_DATABASE_URL must be a valid PostgreSQL URL')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('ADMIN_DATABASE_URL must use PostgreSQL')
  }
  if (!url.pathname.slice(1).endsWith('_production')) {
    throw new Error('ADMIN_DATABASE_URL database name must end with _production')
  }
}

function assertCorsOrigins(value: string) {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean)
  if (!origins.length) throw new Error('ADMIN_CORS_ORIGINS must contain an exact HTTPS origin')
  for (const origin of origins) {
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error('ADMIN_CORS_ORIGINS contains an invalid origin')
    }
    if (url.protocol !== 'https:' || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url.hostname)) {
      throw new Error('ADMIN_CORS_ORIGINS must contain only non-local HTTPS origins')
    }
  }
}

function assertTrustProxyHops(value: string) {
  if (!/^\d+$/.test(value) || Number(value) > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10 matching the deployed proxy path')
  }
}

function assertMfaKey(value: string) {
  let key: Buffer
  try {
    key = Buffer.from(value, 'base64')
  } catch {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be a 32-byte base64 key')
  }
  if (key.length !== 32 || key.every((byte) => byte === 0)) {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be a non-placeholder 32-byte base64 key')
  }
}

function assertMfaKeyring(input: Environment) {
  const encoded = read(input, 'ADMIN_MFA_KEYS_JSON')
  if (!encoded) {
    const legacy = read(input, 'ADMIN_MFA_ENCRYPTION_KEY')
    if (!legacy) throw new Error('Admin production configuration is missing: ADMIN_MFA_ENCRYPTION_KEY or ADMIN_MFA_KEYS_JSON')
    assertMfaKey(legacy)
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(encoded)
  } catch {
    throw new Error('ADMIN_MFA_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('ADMIN_MFA_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  for (const [version, key] of Object.entries(parsed)) {
    if (!/^[1-9]\d*$/.test(version) || typeof key !== 'string') {
      throw new Error('ADMIN_MFA_KEYS_JSON contains an invalid version or key')
    }
    assertMfaKey(key)
  }
  const active = read(input, 'ADMIN_MFA_ACTIVE_KEY_VERSION')
  if (!active || !(active in (parsed as Record<string, unknown>))) {
    throw new Error('ADMIN_MFA_ACTIVE_KEY_VERSION must select a key present in ADMIN_MFA_KEYS_JSON')
  }
}
