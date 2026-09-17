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
  /**
   * 'stub' — 占位实现（仅演示模式可用）；
   * 'live' — 真实供应商适配器；
   * 'disabled' — 操作方显式关闭筛查（一律放行，案件记录如实标注原因）。
   */
  readonly mode: 'stub' | 'live' | 'disabled'
  screen(input: {
    userId: string
    kind: ScreeningKind
    identifiers: Record<string, string>
  }): Promise<ScreeningResult>
}
