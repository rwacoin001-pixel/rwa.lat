import { request } from '@/lib/api/_http'

/** Batch 3 account contracts checked against the public controllers and view serializers.
 * Dates are JSON ISO strings. These calls return ApiResult; failures are never empty data.
 * See docs/frontend-completion/接口交接-B1.md for limits and verification status.
 */

const json = (method: string, body?: unknown): RequestInit => ({ method, body: JSON.stringify(body ?? {}) })
const id = (value: string) => encodeURIComponent(value)

/* ---- Session ---- */
export type SessionInfo = { userId: string; sessionId: string; emailVerified: boolean; authAdapter: string; expiresAt: string; accountLabel: string | null }
export const getSessionInfo = () => request<SessionInfo>('/v1/auth/session')

/* ---- KYC ---- */
export type KycState = 'not_started' | 'in_progress' | 'submitted' | 'needs_information' | 'approved' | 'rejected' | 'expired'
export type KycCase = { id: string; userId: string; state: KycState; provider: string; reasonCode: string | null; submittedAt: string | null; decidedAt: string | null; expiresAt: string | null; createdAt: string; updatedAt: string }
export const getKyc = () => request<KycCase | null>('/v1/compliance/kyc/status')
export const getKycCaptureConfig = () => request<{ enabled: boolean }>('/v1/compliance/kyc/capture-config')
export const createKycSession = (language?: string) => request<{ case: KycCase; verificationUrl: string }>('/v1/compliance/kyc/session', json('POST', { language }))
export const submitKycCapture = (input: { documentType: 'passport' | 'id_card'; front: Blob; back?: Blob; selfie: Blob; idempotencyKey: string }) => {
  const body = new FormData()
  body.set('documentType', input.documentType)
  body.set('front', input.front, 'front.jpg')
  if (input.back) body.set('back', input.back, 'back.jpg')
  body.set('selfie', input.selfie, 'selfie.jpg')
  return request<KycCase>('/v1/compliance/kyc/capture', { method: 'POST', body, idempotencyKey: input.idempotencyKey, timeoutMs: 90_000 })
}
/** Stub-provider path only (the server rejects both calls when a live provider is configured). */
export const startKyc = (provider: string) => request<KycCase>('/v1/compliance/kyc/start', json('POST', { provider }))
export const submitKyc = (providerCaseRef: string) => request<KycCase>('/v1/compliance/kyc/submit', json('POST', { providerCaseRef }))

/* ---- Eligibility ---- */
export type EligibilityDecision = 'browse_only' | 'ineligible' | 'eligible' | 'manual_review'
export type Eligibility = { id: string; userId: string; productScope: string; policyVersion: string; decision: EligibilityDecision; reasonCodes: string[]; evidenceReferences: { kycState?: string | null; screeningState?: string | null; region?: string | null }; decidedAt: string; expiresAt: string | null; createdAt: string; updatedAt: string }
export const getEligibility = (scope: string) => request<Eligibility>(`/v1/compliance/eligibility/${id(scope)}`)
export const evaluateEligibility = (productScope: string, region?: string) => request<Eligibility>('/v1/compliance/eligibility/evaluate', json('POST', { productScope, region }))

/* ---- Risk profile ---- */
export type RiskQuestion = { key: string; prompt: string; options: string[] }
export type RiskQuestionnaire = { version: string; questions: RiskQuestion[] }
/** Answers use option index + 1 (integer 1–5), never the zero-based UI index. */
export type RiskBand = 'conservative' | 'balanced' | 'growth' | 'aggressive'
export type RiskProfile = { band: RiskBand; score: number; questionnaireVersion: string; completedAt: string; expiresAt: string; stale: boolean; answers: Record<string, number> }
export const getRiskQuestionnaire = () => request<RiskQuestionnaire>('/v1/compliance/risk-profile/questionnaire')
export const getRiskProfile = () => request<RiskProfile | null>('/v1/compliance/risk-profile')
export const submitRiskProfile = (answers: Record<string, number>) => request<RiskProfile>('/v1/compliance/risk-profile', json('POST', { answers }))
export const deleteRiskProfile = () => request<{ deleted: true }>('/v1/compliance/risk-profile', { method: 'DELETE' })

/* ---- Sessions and devices ---- */
export type SecuritySession = { id: string; state: string; createdAt: string; lastSeenAt: string | null; expiresAt: string; isCurrent: boolean; device: { id: string; name: string; trustState: string } | null }
export type SecurityDevice = { id: string; name: string; trustState: string; firstSeenAt: string; lastSeenAt: string | null; trustedAt: string | null; isCurrent: boolean; activeSessionCount: number }
export const listSessions = () => request<SecuritySession[]>('/v1/security/sessions')
export const revokeSession = (sessionId: string) => request<{ revoked: true; isCurrent: boolean }>(`/v1/security/sessions/${id(sessionId)}`, { method: 'DELETE' })
export const revokeOtherSessions = () => request<{ revokedCount: number }>('/v1/security/sessions/revoke-others', json('POST'))
export const listDevices = () => request<SecurityDevice[]>('/v1/security/devices')
export const revokeDevice = (deviceId: string) => request<{ revoked: true; currentSessionRevoked: boolean }>(`/v1/security/devices/${id(deviceId)}`, { method: 'DELETE' })
export const trustCurrentDevice = (reauthentication: string) => request<{ trusted: true; deviceId: string }>('/v1/security/devices/current/trust', json('POST', { reauthentication }))

/* ---- Factors ---- */
export type TotpEnrollment = { factorId: string; otpauthUri: string; recoveryCodes: string[]; expiresNotice?: string }
export const startTotpEnrollment = () => request<TotpEnrollment>('/v1/security/totp/enrollment', json('POST'))
export const confirmTotpEnrollment = (factorId: string, code: string) => request<{ enabled: true; factorId: string }>('/v1/security/totp/enrollment/confirm', json('POST', { factorId, code }))
export const removeTotp = (factorId: string, reauthentication: string) => request<{ revoked: true; factorId: string }>(`/v1/security/factors/totp/${id(factorId)}`, json('DELETE', { reauthentication }))
export const removePasskey = (passkeyId: string, reauthentication: string) => request<{ revoked: true; passkeyId: string }>(`/v1/security/passkeys/${id(passkeyId)}`, json('DELETE', { reauthentication }))

/* ---- Preferences ---- */
export type Preferences = { userId: string; locale?: string | null; channels: Record<string, boolean>; communicationConsent: boolean; updatedAt: string }
export const getPreferences = () => request<Preferences>('/v1/user-ops/preferences')
/** `channels` replaces the stored map wholesale, so callers send the merged map. */
export const putPreferences = (body: { locale?: string; channels?: Record<string, boolean>; communication_consent?: boolean }) => request<Preferences>('/v1/user-ops/preferences', json('PUT', body))

/* ---- Invitations and rewards ---- */
export type Invitation = { id: string; inviterUserId: string; email?: string | null; role: string; state: string; acceptedUserId?: string | null; acceptedAt?: string | null; expiresAt: string; createdAt: string }
export type Reward = { id: string; userId: string; kind: string; amountAtomic: string; currency: string; decimals: number | null; state: string; referenceType?: string | null; referenceId?: string | null; earnedAt: string }
export type AcceptInvitationResult = { invitation: Invitation; inviterReward: Reward; inviteeReward: Reward }
export const listInvitations = () => request<Invitation[]>('/v1/user-ops/invitations')
export const createInvitation = (email?: string) => request<{ view: Invitation; token: string }>('/v1/user-ops/invitations', json('POST', email ? { role: 'member', email } : { role: 'member' }))
export const revokeInvitation = (invitationId: string) => request<Invitation>(`/v1/user-ops/invitations/${id(invitationId)}/revoke`, json('PUT'))
export const listRewards = () => request<Reward[]>('/v1/user-ops/rewards')
/** Safe to retry after an uncertain response; acceptance and both rewards commit atomically. */
export const acceptInvitation = (token: string) => request<AcceptInvitationResult>('/v1/user-ops/invitations/accept', json('POST', { token }))

/* ---- Support tickets ---- */
export type TicketStatus = 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'
export type TicketCategory = 'support' | 'dispute' | 'appeal' | 'scam_report'
export type Ticket = { id: string; authorUserId: string; subject: string; body: string; status: TicketStatus; priority: string; category: TicketCategory; orderId?: string | null; reference: string; assignee?: string | null; createdAt: string; updatedAt: string; closedAt?: string | null }
export type TicketTimeline = {
  ticket: Ticket
  messages: Array<{ id: string; actorType: string; body: string; attachments: Record<string, unknown>; createdAt: string }>
  events: Array<{ id: string; eventType: string; actorType: string; previousStatus?: string | null; nextStatus?: string | null; metadata: Record<string, unknown>; createdAt: string }>
}
export type CreateTicketInput = { subject: string; body: string; category: TicketCategory; order_id?: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; attachmentObjectIds?: string[] }
export const listTickets = () => request<Ticket[]>('/v1/user-ops/tickets')
export const createTicket = (body: CreateTicketInput, idempotencyKey?: string) => request<Ticket>('/v1/user-ops/tickets', { ...json('POST', body), idempotencyKey })
export const getTicketTimeline = (ticketId: string) => request<TicketTimeline>(`/v1/user-ops/tickets/${id(ticketId)}/timeline`)
export const replyTicket = (ticketId: string, body: string, attachmentObjectIds?: string[]) => request<TicketTimeline>(`/v1/user-ops/tickets/${id(ticketId)}/messages`, json('POST', { body, attachmentObjectIds }))
export const closeTicket = (ticketId: string) => request<Ticket>(`/v1/user-ops/tickets/${id(ticketId)}/close`, json('PUT'))
