import type { ScreeningKind } from './screening-case.entity'

export interface ScreeningResult {
  state: 'clear' | 'potential_match' | 'confirmed_match'
  reason?: string
}

/**
 * 制裁/PEP/负面媒体筛查供应商适配接口（PARTNER-001）。
 * 生产环境由真实筛查服务（如 ComplyAdvantage / Refinitiv）实现；
 * 原型使用 StubSanctionsProvider 占位，按可配置黑名单返回结果。
 */
export interface SanctionsProvider {
  readonly name: string
  readonly mode: 'stub' | 'live'
  screen(input: {
    userId: string
    kind: ScreeningKind
    identifiers: Record<string, string>
  }): Promise<ScreeningResult>
}
