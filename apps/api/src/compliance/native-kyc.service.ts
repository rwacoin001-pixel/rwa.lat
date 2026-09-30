import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { KycCase } from './kyc-case.entity'
import type { KycImage, KycProvider, NativeKycChecks } from './kyc-provider.interface'

export type CapturedFile = KycImage & { originalname?: string }

@Injectable()
export class NativeKycService {
  constructor(
    @InjectRepository(KycCase) private readonly cases: Repository<KycCase>,
    @Inject('KycProvider') private readonly provider: KycProvider,
    private readonly crypto: IdentityCrypto,
    private readonly config: ConfigService,
  ) {}

  async capture(userId: string, key: string | undefined, documentType: string, files: { front?: CapturedFile[]; back?: CapturedFile[]; selfie?: CapturedFile[] }): Promise<KycCase> {
    if (this.config.get<string>('DIDIT_NATIVE_CAPTURE_ENABLED') !== 'true' || this.provider.name !== 'didit' || this.provider.mode !== 'live' || !this.provider.verifyImages) {
      throw new ServiceUnavailableException({ code: 'KYC_CAPTURE_UNAVAILABLE', message: 'Identity capture is not enabled.' })
    }
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('A UUID Idempotency-Key is required')
    if (!['passport', 'id_card'].includes(documentType)) throw new BadRequestException('Unsupported document type')
    const front = validateKycImage(files.front?.[0])
    const selfie = validateKycImage(files.selfie?.[0])
    const back = documentType === 'id_card' ? validateKycImage(files.back?.[0]) : undefined
    const hash = this.crypto.hmac(`native:${userId}:${key.toLowerCase()}`)
    const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex')
    const fingerprint = this.crypto.hmac(JSON.stringify({ documentType, front: digest(front.buffer), back: back ? digest(back.buffer) : null, selfie: digest(selfie.buffer) })).toString('hex')
    let claimed = false
    const row = await this.cases.manager.transaction(async manager => {
      // Serialize claims across API replicas without keeping a database transaction open during provider calls.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`native-kyc:${userId}`])
      const repo = manager.getRepository(KycCase)
      const previous = await repo.findOne({ where: { userId, provider: 'didit', providerCaseHash: hash } })
      if (previous) {
        const stored = JSON.parse(this.crypto.decrypt(previous.providerCaseCiphertext, previous.encryptionKeyVersion).slice(7)) as { fingerprint: string }
        if (stored.fingerprint !== fingerprint) throw new ConflictException('Idempotency key was reused with different images')
        if (previous.state === 'in_progress') throw new ConflictException('Verification is still processing')
        return previous
      }
      const latest = await repo.findOne({ where: { userId }, order: { createdAt: 'DESC' } })
      if (latest && (['approved', 'submitted'].includes(latest.state) || (latest.state === 'in_progress' && this.crypto.decrypt(latest.providerCaseCiphertext, latest.encryptionKeyVersion).startsWith('native:')))) throw new ConflictException('Verification is already approved or processing')
      const encrypted = this.crypto.encrypt(`native:${JSON.stringify({ phase: 'processing', fingerprint })}`)
      claimed = true
      return repo.save(repo.create({ id: randomUUID(), userId, provider: 'didit', state: 'in_progress', providerCaseHash: hash, providerCaseCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion, submittedAt: null, decidedAt: null, reasonCode: null, expiresAt: null }))
    })
    if (!claimed) return row

    let checks: NativeKycChecks
    try { checks = await this.provider.verifyImages({ userId, documentType: documentType as 'passport' | 'id_card', front, back, selfie }) }
    catch {
      row.state = 'needs_information'
      row.reasonCode = 'native_provider_unavailable'
      const encrypted = this.crypto.encrypt(`native:${JSON.stringify({ phase: 'uncertain', fingerprint })}`)
      row.providerCaseCiphertext = encrypted.ciphertext; row.encryptionKeyVersion = encrypted.keyVersion
      await this.cases.save(row)
      // The original key is consumed. A lost provider response must not trigger duplicate paid calls.
      throw new ServiceUnavailableException({ code: 'KYC_CAPTURE_FAILED', message: 'Verification could not finish. Please check the verification status before retrying.' })
    }
    const encrypted = this.crypto.encrypt(`native:${JSON.stringify({ phase: 'complete', fingerprint, ...checks })}`)
    row.providerCaseCiphertext = encrypted.ciphertext; row.encryptionKeyVersion = encrypted.keyVersion
    // Activation and this decision rule require the explicit native-flow policy choice.
    const all = [checks.document, checks.liveness, checks.faceMatch]
    const clean = all.every(check => check.status === 'Approved' && check.warnings.length === 0)
      && (checks.liveness.score ?? 0) >= 60 && (checks.faceMatch.score ?? 0) >= 60
    const declined = all.some(check => check.status === 'Declined')
    row.state = declined ? 'rejected' : clean ? 'approved' : 'submitted'
    row.reasonCode = declined ? 'native_checks_declined' : clean ? null : 'native_checks_require_review'
    row.submittedAt = new Date()
    row.decidedAt = row.state === 'submitted' ? null : new Date()
    return this.cases.save(row)
  }

  enabled() { return this.config.get<string>('DIDIT_NATIVE_CAPTURE_ENABLED') === 'true' && this.provider.name === 'didit' && this.provider.mode === 'live' && Boolean(this.provider.verifyImages) }

  async reviewEvidence(caseId: string) {
    const row = await this.cases.findOne({ where: { id: caseId } })
    if (!row) throw new BadRequestException('Verification case not found')
    const reference = this.crypto.decrypt(row.providerCaseCiphertext, row.encryptionKeyVersion)
    if (!reference.startsWith('native:')) return { kind: 'hosted', requestIds: [reference] }
    const data = JSON.parse(reference.slice(7)) as Partial<NativeKycChecks> & { phase: string }
    return { kind: 'native', phase: data.phase, requestIds: data.references ?? [], document: data.document, liveness: data.liveness, faceMatch: data.faceMatch }
  }
}

export function validateKycImage(image: KycImage | undefined): KycImage {
  if (!image || !Buffer.isBuffer(image.buffer) || image.buffer.length < 16 || image.buffer.length > 5 * 1024 * 1024) throw new BadRequestException('A JPEG or PNG photo under 5 MB is required')
  const jpeg = image.mimetype === 'image/jpeg' && image.buffer[0] === 0xff && image.buffer[1] === 0xd8 && image.buffer[2] === 0xff
  const png = image.mimetype === 'image/png' && image.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!jpeg && !png) throw new BadRequestException('The photo contents do not match its image type')
  return image
}
