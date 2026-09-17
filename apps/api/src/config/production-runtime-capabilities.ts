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
  // 2026-09-18: 手动托管模式（自持密钥 + 操作员地址池 + TronGrid 监听/广播）已接入模块。
  custody: 'manual',
}

export function validateProductionRuntimeCapabilities(
  input: Environment,
  manifest: Record<'kyc' | 'sanctions' | 'custody', ProductionCapabilityMode> = INSTALLED_PRODUCTION_CAPABILITIES,
): Environment {
  if (input.APP_ENV !== 'production' || input.PRODUCTION_FINANCIAL_FEATURES_ENABLED !== 'true') return input
  const unavailable = Object.entries(manifest)
    .filter(([, mode]) => mode === 'stub')
    .map(([name]) => name)
  if (unavailable.length) {
    throw new Error(`Release image does not contain reviewed live implementations for: ${unavailable.join(', ')}`)
  }
  return input
}
