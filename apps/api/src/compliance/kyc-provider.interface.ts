export type KycProviderState =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'expired'

export interface KycSubmissionResult {
  providerCaseRef: string
  status: 'not_started' | 'submitted' | 'in_progress'
  verificationUrl?: string
}

export interface KycProviderCase {
  state: KycProviderState
  decision?: 'approved' | 'rejected'
  reason?: string
}

export interface KycWebhookEvent {
  eventId: string
  webhookType: string
  sessionId: string
  status: string
  workflowId?: string
}

export interface KycWebhookVerificationInput {
  body: unknown
  signatureV2: string
  timestamp: string
  now?: Date
}

/**
 * External KYC adapter boundary. The application stores only an encrypted
 * provider reference and redacted state; raw identity documents stay with the
 * reviewed provider.
 */
export interface KycProvider {
  readonly name: string
  readonly mode: 'stub' | 'live'
  submitCase(input: { userId: string; payload: Record<string, unknown> }): Promise<KycSubmissionResult>
  getCase(ref: string): Promise<KycProviderCase>
  verifyWebhook?(input: KycWebhookVerificationInput): KycWebhookEvent
  mapStatus?(status: string): KycProviderCase
  verifyImages?(input: NativeKycImages): Promise<NativeKycChecks>
}

export type KycImage = { buffer: Buffer; mimetype: string }
export type NativeKycImages = { userId: string; documentType: 'passport' | 'id_card'; front: KycImage; back?: KycImage; selfie: KycImage }
export type NativeKycCheck = { status: 'Approved' | 'Declined'; score?: number; warnings: string[] }
export type NativeKycChecks = { references: string[]; document: NativeKycCheck; liveness: NativeKycCheck; faceMatch: NativeKycCheck }
