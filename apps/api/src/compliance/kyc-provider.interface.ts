export interface KycSubmissionResult {
  providerCaseRef: string
  status: 'submitted' | 'in_progress'
}

export interface KycProviderCase {
  state: 'submitted' | 'needs_information' | 'approved' | 'rejected'
  decision?: 'approved' | 'rejected'
  reason?: string
}

/**
 * 外部 KYC 供应商适配接口（PARTNER-001）。
 * 生产环境由真实供应商（如 SumSub / Onfido / Persona）实现；
 * 原型使用 StubKycProvider 占位，不发起外部调用。
 */
export interface KycProvider {
  readonly name: string
  readonly mode: 'stub' | 'live'
  submitCase(input: { userId: string; payload: Record<string, unknown> }): Promise<KycSubmissionResult>
  getCase(ref: string): Promise<KycProviderCase>
}
