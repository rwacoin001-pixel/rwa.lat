import { validateEnvironment } from '../../src/config/production-environment'

function production(overrides: Record<string, string> = {}) {
  return {
    APP_ENV: 'production',
    PRODUCTION_DATABASE_URL: 'postgresql://rwa:secret@db.example.com:5432/rwa_lat_production',
    CORS_ORIGINS: 'https://app.rwa.lat',
    PUBLIC_API_URL: 'https://api.rwa.lat',
    PUBLIC_APP_URL: 'https://app.rwa.lat',
    AUTH_ADAPTER: 'production',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: 'no-reply@rwa.lat',
    SMTP_HOST: 'smtp.rwa.lat',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_AUTH_MODE: 'plain',
    SMTP_USER: 'rwa-production',
    SMTP_PASSWORD: 'smtp-password-from-secret-manager',
    GOOGLE_OAUTH_ENABLED: 'false',
    X_OAUTH_ENABLED: 'false',
    IDENTITY_HMAC_KEY: '1'.repeat(64),
    IDENTITY_ENC_KEY: '2'.repeat(64),
    PASSKEY_RP_ID: 'rwa.lat',
    PASSKEY_ORIGIN: 'https://app.rwa.lat',
    METRICS_BEARER_TOKEN: 'metrics-secret-value-at-least-32-characters',
    TRUST_PROXY_HOPS: '1',
    OBJECT_STORAGE_ENABLED: 'false',
    PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false',
    ...overrides,
  }
}

describe('production environment validation', () => {
  it('does not impose production requirements on development and test', () => {
    expect(validateEnvironment({ APP_ENV: 'test' })).toEqual({ APP_ENV: 'test' })
  })

  it('rejects missing core values, local origins and placeholder identity keys', () => {
    expect(() => validateEnvironment({ APP_ENV: 'production' })).toThrow(/missing/i)
    expect(() => validateEnvironment(production({ CORS_ORIGINS: 'http://localhost:3000' }))).toThrow(/CORS/i)
    expect(() => validateEnvironment(production({ IDENTITY_HMAC_KEY: '0'.repeat(64) }))).toThrow(/IDENTITY_HMAC_KEY/)
  })

  it('accepts a versioned encryption keyring and requires its active version', () => {
    expect(validateEnvironment(production({
      IDENTITY_ENC_KEY: '',
      IDENTITY_ENC_KEYS_JSON: JSON.stringify({ 1: '2'.repeat(64), 2: '3'.repeat(64) }),
      IDENTITY_ACTIVE_KEY_VERSION: '2',
    }))).toMatchObject({ IDENTITY_ACTIVE_KEY_VERSION: '2' })
    expect(() => validateEnvironment(production({
      IDENTITY_ENC_KEY: '',
      IDENTITY_ENC_KEYS_JSON: JSON.stringify({ 1: '2'.repeat(64) }),
      IDENTITY_ACTIVE_KEY_VERSION: '2',
    }))).toThrow(/ACTIVE_KEY_VERSION/)
  })

  it('allows a production runtime with all financial mutations explicitly disabled', () => {
    expect(validateEnvironment(production())).toMatchObject({ APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })
    expect(() => validateEnvironment(production({ WALLET_EXECUTION_ENABLED: 'true' }))).toThrow(/forbidden/i)
  })

  it('rejects Polymarket trading activation and non-HTTPS provider URLs', () => {
    expect(() => validateEnvironment(production({ POLYMARKET_TRADING_ENABLED: 'true' }))).toThrow(/not installed/i)
    expect(() => validateEnvironment(production({ POLYMARKET_GAMMA_URL: 'http://gamma.example.com' }))).toThrow(/HTTPS/i)
  })

  it('requires protected metrics and an explicit proxy topology', () => {
    expect(() => validateEnvironment(production({ METRICS_BEARER_TOKEN: 'short' }))).toThrow(/METRICS_BEARER_TOKEN/)
    expect(() => validateEnvironment(production({ TRUST_PROXY_HOPS: 'true' }))).toThrow(/TRUST_PROXY_HOPS/)
  })

  it('requires a reviewed SMTP or Resend production delivery adapter', () => {
    expect(() => validateEnvironment(production({ EMAIL_PROVIDER: '' }))).toThrow(/EMAIL_PROVIDER/)
    expect(() => validateEnvironment(production({ SMTP_AUTH_MODE: 'plain', SMTP_PASSWORD: 'short' }))).toThrow(/SMTP_PASSWORD/)
    expect(() => validateEnvironment(production({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'invalid' }))).toThrow(/RESEND_API_KEY/)
    expect(validateEnvironment(production({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: `re_${'a'.repeat(32)}`,
      RESEND_HTTP_TIMEOUT_MS: '10000',
    }))).toMatchObject({ EMAIL_PROVIDER: 'resend' })
    expect(() => validateEnvironment(production({ AUTH_ADAPTER: 'demo' }))).toThrow(/AUTH_ADAPTER/)
  })

  it('keeps each OAuth provider explicitly disabled or requires confidential-client parameters', () => {
    expect(() => validateEnvironment(production({ GOOGLE_OAUTH_ENABLED: '' }))).toThrow(/GOOGLE_OAUTH_ENABLED/)
    expect(() => validateEnvironment(production({ GOOGLE_OAUTH_ENABLED: 'true' }))).toThrow(/GOOGLE_OAUTH_CLIENT_ID/)
    expect(validateEnvironment(production({
      GOOGLE_OAUTH_ENABLED: 'true',
      GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret-from-manager',
      GOOGLE_OAUTH_REDIRECT_URI: 'https://app.rwa.lat/auth/callback/google',
    }))).toMatchObject({ GOOGLE_OAUTH_ENABLED: 'true' })
  })

  it('keeps object storage explicitly disabled or requires a production scanner and encryption key', () => {
    expect(() => validateEnvironment(production({ OBJECT_STORAGE_ENABLED: '' }))).toThrow(/OBJECT_STORAGE_ENABLED/)
    expect(() => validateEnvironment(production({ OBJECT_STORAGE_ENABLED: 'true' }))).toThrow(/S3_REGION/)
    expect(validateEnvironment(production({
      OBJECT_STORAGE_ENABLED: 'true',
      S3_REGION: 'ap-southeast-1',
      S3_AUTH_MODE: 'workload',
      S3_KMS_KEY_ID: 'alias/rwa-object-storage',
      S3_BUCKET_MAP_JSON: JSON.stringify({
        'rwa-kyc': 'rwa-lat-prod-kyc',
        'rwa-assets': 'rwa-lat-prod-assets',
        'rwa-attachments': 'rwa-lat-prod-attachments',
      }),
      OBJECT_STORAGE_SCAN_PROVIDER: 'approved-scanner',
      OBJECT_STORAGE_SCAN_CALLBACK_SECRET: 'scan-callback-secret-at-least-32-characters',
    }))).toMatchObject({ OBJECT_STORAGE_ENABLED: 'true' })
  })

  it('requires the official Didit endpoint and complete hosted-verification settings', () => {
    expect(() => validateEnvironment(production({ KYC_PROVIDER: 'didit' }))).toThrow(/DIDIT_API_KEY/)

    const didit = {
      KYC_PROVIDER: 'didit',
      DIDIT_API_KEY: 'didit-api-key-from-secret-manager',
      DIDIT_WORKFLOW_ID: '00000000-0000-4000-8000-000000000001',
      DIDIT_WEBHOOK_SECRET: 'didit-webhook-secret-from-secret-manager',
      DIDIT_CALLBACK_URL: 'https://rwa.lat/profile/kyc/callback',
    }
    expect(validateEnvironment(production(didit))).toMatchObject({ KYC_PROVIDER: 'didit' })
    expect(() => validateEnvironment(production({
      ...didit,
      DIDIT_API_BASE_URL: 'https://proxy.example.com',
    }))).toThrow(/DIDIT_API_BASE_URL/)
    expect(() => validateEnvironment(production({
      ...didit,
      DIDIT_CALLBACK_URL: 'https://localhost/profile/kyc/callback',
    }))).toThrow(/non-local/)
  })

  it('rejects financial production with stub partners or unrestricted regions', () => {
    expect(() => validateEnvironment(production({
      PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
      KYC_PROVIDER: 'stub',
      SANCTIONS_PROVIDER: 'live-sanctions',
      WALLET_CUSTODY_ADAPTER: 'live-custody',
      WALLET_WEBHOOK_SECRET: 's'.repeat(32),
      WALLET_EXECUTION_ENABLED: 'true',
      ALLOWED_REGIONS: 'SG',
    }))).toThrow(/KYC_PROVIDER/)

    expect(() => validateEnvironment(production({
      PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
      KYC_PROVIDER: 'live-kyc',
      SANCTIONS_PROVIDER: 'live-sanctions',
      WALLET_CUSTODY_ADAPTER: 'live-custody',
      WALLET_WEBHOOK_SECRET: 's'.repeat(32),
      WALLET_EXECUTION_ENABLED: 'true',
      WALLET_EXECUTION_WORKER_ENABLED: 'true',
      ALLOWED_REGIONS: 'ALL',
    }))).toThrow(/ALLOWED_REGIONS/)
  })

  it('requires explicit financial withdrawal limits, cooldowns, leases and dual approval', () => {
    const base = {
      PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
      KYC_PROVIDER: 'live-kyc',
      SANCTIONS_PROVIDER: 'live-sanctions',
      WALLET_CUSTODY_ADAPTER: 'live-custody',
      WALLET_WEBHOOK_SECRET: 's'.repeat(32),
      WALLET_EXECUTION_ENABLED: 'true',
      WALLET_EXECUTION_WORKER_ENABLED: 'true',
      ALLOWED_REGIONS: 'SG,BR',
      WITHDRAWAL_ADDRESS_COOLDOWN_SECONDS: '86400',
      WITHDRAWAL_NEW_DEVICE_COOLDOWN_SECONDS: '86400',
      WITHDRAWAL_PER_TRANSACTION_LIMIT_ATOMIC: '1000000000',
      WITHDRAWAL_DAILY_LIMIT_ATOMIC: '5000000000',
      WITHDRAWAL_ADMIN_APPROVALS_REQUIRED: '2',
      WITHDRAWAL_EXECUTION_LEASE_SECONDS: '120',
      WALLET_EXECUTION_QUEUE_LEASE_SECONDS: '300',
      WALLET_EXECUTION_WORKER_POLL_MS: '5000',
    }
    expect(validateEnvironment(production(base))).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true' })
    expect(() => validateEnvironment(production({ ...base, WITHDRAWAL_ADMIN_APPROVALS_REQUIRED: '1' }))).toThrow(/APPROVALS_REQUIRED/)
    expect(() => validateEnvironment(production({ ...base, WITHDRAWAL_DAILY_LIMIT_ATOMIC: '1' }))).toThrow(/DAILY_LIMIT/)
    expect(() => validateEnvironment(production({ ...base, WALLET_EXECUTION_WORKER_ENABLED: 'false' }))).toThrow(/WORKER_ENABLED/)
    expect(() => validateEnvironment(production({ ...base, WALLET_EXECUTION_QUEUE_LEASE_SECONDS: '60' }))).toThrow(/QUEUE_LEASE_SECONDS/)
  })
})
