import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { KycProvider, KycProviderCase, KycSubmissionResult } from './kyc-provider.interface'

@Injectable()
export class StubKycProvider implements KycProvider {
  readonly name = 'stub'
  readonly mode = 'stub' as const

  async submitCase(input: { userId: string; payload: Record<string, unknown> }): Promise<KycSubmissionResult> {
    return { providerCaseRef: `stub:${input.userId}:${randomUUID()}`, status: 'submitted' }
  }

  async getCase(_ref: string): Promise<KycProviderCase> {
    return { state: 'submitted' }
  }
}
