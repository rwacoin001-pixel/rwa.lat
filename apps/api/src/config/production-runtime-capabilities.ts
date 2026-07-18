type Environment = Record<string, unknown>

// This manifest is compiled into the release image. It must be changed only
// when the corresponding reviewed implementation is actually wired into the
// Nest modules; environment variable names alone cannot claim live capability.
export const INSTALLED_PRODUCTION_CAPABILITIES: Record<'kyc' | 'sanctions' | 'custody', 'stub' | 'live'> = {
  kyc: 'live',
  sanctions: 'stub',
  custody: 'stub',
}

export function validateProductionRuntimeCapabilities(input: Environment): Environment {
  if (input.APP_ENV !== 'production' || input.PRODUCTION_FINANCIAL_FEATURES_ENABLED !== 'true') return input
  const unavailable = Object.entries(INSTALLED_PRODUCTION_CAPABILITIES)
    .filter(([, mode]) => mode !== 'live')
    .map(([name]) => name)
  if (unavailable.length) {
    throw new Error(`Release image does not contain reviewed live implementations for: ${unavailable.join(', ')}`)
  }
  return input
}
