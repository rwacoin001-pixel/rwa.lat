import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ScreeningKind } from './screening-case.entity'
import type { SanctionsProvider, ScreeningResult } from './sanctions-provider.interface'

@Injectable()
export class StubSanctionsProvider implements SanctionsProvider {
  readonly name = 'stub'
  readonly mode = 'stub' as const
  private readonly blocklist: Set<string>

  constructor(config: ConfigService) {
    const raw = (config.get<string>('SANCTIONS_BLOCKLIST') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    this.blocklist = new Set(raw)
  }

  async screen(input: {
    userId: string
    kind: ScreeningKind
    identifiers: Record<string, string>
  }): Promise<ScreeningResult> {
    const address = (input.identifiers.walletAddress ?? '').toLowerCase()
    if (address && this.blocklist.has(address)) {
      return { state: 'confirmed_match', reason: 'blocklist_hit' }
    }
    return { state: 'clear' }
  }
}
