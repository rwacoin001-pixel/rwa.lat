const API_ERROR_CODES = Object.freeze({
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
})

const states = (...values) => Object.freeze(values)
const IDENTITY_STATES = Object.freeze({
  user: states('active', 'restricted', 'suspended', 'closed'),
  loginIdentity: states('pending', 'verified', 'revoked'),
  session: states('active', 'revoked', 'expired'),
  deviceTrust: states('untrusted', 'trusted', 'revoked'),
  kycCase: states('not_started', 'in_progress', 'submitted', 'needs_information', 'approved', 'rejected', 'expired'),
  eligibility: states('browse_only', 'ineligible', 'eligible', 'manual_review'),
  riskFlag: states('open', 'under_review', 'resolved', 'dismissed'),
  screeningCase: states('pending', 'clear', 'potential_match', 'confirmed_match', 'dismissed'),
})

module.exports = { API_ERROR_CODES, IDENTITY_STATES }
