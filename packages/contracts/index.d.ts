export declare const API_ERROR_CODES: Readonly<{
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE'
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
