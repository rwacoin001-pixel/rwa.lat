import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { DataSource, EntityManager } from 'typeorm'
import { IDENTITY_ERROR_CODES } from './identity.errors'

/**
 * Development preview fallback only. Production requires published legal text.
 * Eligibility is covered by Section 2 of the Terms of Service; there is no
 * separate, versioned eligibility document in the public app today.
 */
export const REGISTRATION_CONSENT_REQUIREMENTS = [
  { documentType: 'terms', version: '2026-09-18', href: '/terms' },
  { documentType: 'privacy', version: '2026-09-18', href: '/privacy' },
] as const

export type RegistrationConsentDocumentType = (typeof REGISTRATION_CONSENT_REQUIREMENTS)[number]['documentType']

export interface RegistrationConsentAcceptance {
  documentType: RegistrationConsentDocumentType
  version: string
  accepted: true
}

export type RegistrationConsentRequirement = { documentType: RegistrationConsentDocumentType; version: string; href: string }

export async function loadRegistrationConsents(db: Pick<DataSource | EntityManager, 'query'>, config: ConfigService, lock = false): Promise<RegistrationConsentRequirement[]> {
  const rows: Array<{ kind: RegistrationConsentDocumentType; version: string }> = await db.query(`SELECT d.kind,v.version
    FROM app.legal_documents d JOIN app.legal_document_versions v ON v.kind=d.kind AND v.revision=d.published_revision
    ORDER BY d.kind${lock ? ' FOR SHARE OF d' : ''}`)
  const production = config.get('APP_ENV') === 'production' || config.get('NODE_ENV') === 'production'
  if (production && rows.length !== 2) throw new ServiceUnavailableException({ code: 'LEGAL_PUBLICATION_REQUIRED', message: 'Registration is temporarily unavailable.' })
  return REGISTRATION_CONSENT_REQUIREMENTS.map(fallback => {
    const version = rows.find(row => row.kind === fallback.documentType)?.version ?? fallback.version
    return { documentType: fallback.documentType, version, href: `${fallback.href}?version=${encodeURIComponent(version)}` }
  })
}

export function validateRegistrationConsents(input: unknown, requirements: readonly RegistrationConsentRequirement[] = REGISTRATION_CONSENT_REQUIREMENTS): RegistrationConsentAcceptance[] {
  if (!Array.isArray(input)) throw consentRequired(requirements)

  const byType = new Map<string, Record<string, unknown>>()
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw consentRequired(requirements)
    const row = item as Record<string, unknown>
    if (typeof row.documentType !== 'string' || byType.has(row.documentType)) throw consentRequired(requirements)
    byType.set(row.documentType, row)
  }

  const accepted: RegistrationConsentAcceptance[] = []
  for (const required of requirements) {
    const supplied = byType.get(required.documentType)
    if (!supplied || supplied.accepted !== true || typeof supplied.version !== 'string') throw consentRequired(requirements)
    if (supplied.version !== required.version) {
      throw new ConflictException({
        code: IDENTITY_ERROR_CODES.CONSENT_VERSION_MISMATCH,
        message: 'The registration terms have changed. Review the current documents and try again.',
        requiredConsents: requirements,
      })
    }
    accepted.push({ documentType: required.documentType, version: required.version, accepted: true })
  }

  if (byType.size !== requirements.length) throw consentRequired(requirements)
  return accepted
}

function consentRequired(requirements: readonly RegistrationConsentRequirement[]): BadRequestException {
  return new BadRequestException({
    code: IDENTITY_ERROR_CODES.CONSENT_REQUIRED,
    message: 'Accept the current Terms of Service and Privacy Policy before creating an account.',
    requiredConsents: requirements,
  })
}
