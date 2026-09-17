import { Injectable } from '@nestjs/common'
import type { ScreeningKind } from './screening-case.entity'
import type { SanctionsProvider, ScreeningResult } from './sanctions-provider.interface'

/**
 * 操作方显式关闭制裁/PEP 筛查（2026-09-18 决策：完全绕过）。
 *
 * 所有筛查一律返回 clear，但每条 ScreeningCase 都会如实记录
 * reason=screening_disabled_by_operator —— 审计上可以看出是"人工关闭"，
 * 而不是静默跳过。需要恢复筛查时把 SANCTIONS_PROVIDER 切回 stub/live 即可。
 */
@Injectable()
export class DisabledSanctionsProvider implements SanctionsProvider {
  readonly name = 'disabled'
  readonly mode = 'disabled' as const

  async screen(_input: {
    userId: string
    kind: ScreeningKind
    identifiers: Record<string, string>
  }): Promise<ScreeningResult> {
    return { state: 'clear', reason: 'screening_disabled_by_operator' }
  }
}
