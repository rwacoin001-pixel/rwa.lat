type Environment = Record<string, unknown>

export type ProductionCapabilityMode = 'stub' | 'live' | 'manual' | 'disabled'

// This manifest is compiled into the release image. It must be changed only
// when the corresponding reviewed implementation is actually wired into the
// Nest modules; environment variable names alone cannot claim live capability.
// 'manual' and 'disabled' are deliberate, reviewed operating modes chosen by
// the operator and are allowed to boot with real funds; 'stub' placeholders
// never are.
export const INSTALLED_PRODUCTION_CAPABILITIES: Record<'kyc' | 'sanctions' | 'custody', ProductionCapabilityMode> = {
  kyc: 'live',
  // 2026-09-18: 操作方决策完全绕过制裁/PEP 筛查（ScreeningCase 如实记录关闭原因）。
  sanctions: 'disabled',
  custody: 'stub',
}

export function validateProductionRuntimeCapabilities(input: Environment): Environment {
  if (input.APP_ENV !== 'production' || input.PRODUCTION_FINANCIAL_FEATURES_ENABLED !== 'true') return input
  const unavailable = Object.entries(INSTALLED_PRODUCTION_CAPABILITIES)
    .filter(([, mode]) => mode === 'stub')
    .map(([name]) => name)
  if (unavailable.length) {
    throw new Error(`Release image does not contain reviewed live implementations for: ${unavailable.join(', ')}`)
  }
  return input
}
