export declare const API_ERROR_CODES: Readonly<{
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE'
}>

export declare const SECURITY_ERROR_CODES: Readonly<{
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED'
  SESSION_EXPIRED: 'SESSION_EXPIRED'
  SESSION_NOT_FOUND: 'SECURITY_SESSION_NOT_FOUND'
  DEVICE_NOT_FOUND: 'SECURITY_DEVICE_NOT_FOUND'
  TOTP_ALREADY_CONFIGURED: 'TOTP_ALREADY_CONFIGURED'
  TOTP_NOT_CONFIGURED: 'TOTP_NOT_CONFIGURED'
  TOTP_INVALID: 'TOTP_INVALID'
  PASSKEY_CHALLENGE_INVALID: 'PASSKEY_CHALLENGE_INVALID'
  PASSKEY_VERIFICATION_FAILED: 'PASSKEY_VERIFICATION_FAILED'
  PASSKEY_NOT_FOUND: 'PASSKEY_NOT_FOUND'
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED'
}>

export declare const COMPLIANCE_ERROR_CODES: Readonly<{
  KYC_CASE_NOT_FOUND: 'COMPLIANCE_KYC_CASE_NOT_FOUND'
  KYC_ALREADY_SUBMITTED: 'COMPLIANCE_KYC_ALREADY_SUBMITTED'
  KYC_NOT_SUBMITTED: 'COMPLIANCE_KYC_NOT_SUBMITTED'
  KYC_DECISION_CONFLICT: 'COMPLIANCE_KYC_DECISION_CONFLICT'
  ELIGIBILITY_NOT_FOUND: 'COMPLIANCE_ELIGIBILITY_NOT_FOUND'
  SCREENING_NOT_FOUND: 'COMPLIANCE_SCREENING_NOT_FOUND'
  REGION_BLOCKED: 'COMPLIANCE_REGION_BLOCKED'
  RISK_FLAG_NOT_FOUND: 'COMPLIANCE_RISK_FLAG_NOT_FOUND'
  PROVIDER_ERROR: 'COMPLIANCE_PROVIDER_ERROR'
}>

export declare const WALLET_ERROR_CODES: Readonly<{
  NETWORK_UNSUPPORTED: 'WALLET_NETWORK_UNSUPPORTED'
  WALLET_UNAVAILABLE: 'WALLET_UNAVAILABLE'
  ADDRESS_NOT_FOUND: 'WALLET_ADDRESS_NOT_FOUND'
  ADDRESS_INVALID: 'WALLET_ADDRESS_INVALID'
  AMOUNT_INVALID: 'WALLET_AMOUNT_INVALID'
  AMOUNT_BELOW_MINIMUM: 'WALLET_AMOUNT_BELOW_MINIMUM'
  INSUFFICIENT_BALANCE: 'WALLET_INSUFFICIENT_BALANCE'
  IDEMPOTENCY_KEY_REQUIRED: 'WALLET_IDEMPOTENCY_KEY_REQUIRED'
  EXECUTION_DISABLED: 'WALLET_EXECUTION_DISABLED'
  CALLBACK_SIGNATURE_INVALID: 'WALLET_CALLBACK_SIGNATURE_INVALID'
  CALLBACK_STALE: 'WALLET_CALLBACK_STALE'
  CALLBACK_PAYLOAD_INVALID: 'WALLET_CALLBACK_PAYLOAD_INVALID'
}>

export declare const LEDGER_ERROR_CODES: Readonly<{
  WITHDRAWAL_NOT_FOUND: 'LEDGER_WITHDRAWAL_NOT_FOUND'
  WITHDRAWAL_STATE_INVALID: 'LEDGER_WITHDRAWAL_STATE_INVALID'
  CHAIN_TRANSACTION_UNCONFIRMED: 'LEDGER_CHAIN_TRANSACTION_UNCONFIRMED'
  ACCOUNT_NOT_FOUND: 'LEDGER_ACCOUNT_NOT_FOUND'
  RECONCILIATION_INPUT_INVALID: 'LEDGER_RECONCILIATION_INPUT_INVALID'
}>

export declare const IDENTITY_STATES: Readonly<{
  user: readonly ['active', 'restricted', 'suspended', 'closed']
  loginIdentity: readonly ['pending', 'verified', 'revoked']
  session: readonly ['active', 'revoked', 'expired']
  deviceTrust: readonly ['untrusted', 'trusted', 'revoked']
  kycCase: readonly ['not_started', 'in_progress', 'submitted', 'needs_information', 'approved', 'rejected', 'expired']
  eligibility: readonly ['browse_only', 'ineligible', 'eligible', 'manual_review']
  riskFlag: readonly ['open', 'under_review', 'resolved', 'dismissed']
  screeningCase: readonly ['pending', 'clear', 'potential_match', 'confirmed_match', 'dismissed']
}>

export declare const FINANCE_STATES: Readonly<{
  custodyWallet: readonly ['provisioning', 'active', 'restricted', 'closed']
  walletAddress: readonly ['active', 'disabled', 'quarantined']
  chainTransaction: readonly ['detected', 'confirming', 'confirmed', 'failed', 'reorged']
  deposit: readonly ['detected', 'confirming', 'credited', 'rejected', 'manual_review']
  withdrawal: readonly [
    'requested', '2fa_verified', 'risk_review', 'approved', 'signing',
    'broadcast', 'confirming', 'completed', 'rejected', 'failed', 'cancelled'
  ]
  internalTransfer: readonly ['requested', 'risk_review', 'posted', 'rejected', 'reversed']
}>
