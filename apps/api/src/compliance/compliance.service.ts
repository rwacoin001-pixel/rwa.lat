import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { COMPLIANCE_ERROR_CODES } from './compliance.errors'
import { KycCase, type KycCaseState } from './kyc-case.entity'
import { EligibilityProfile, type EligibilityDecision } from './eligibility-profile.entity'
import { RiskFlag, type RiskFlagState } from './risk-flag.entity'
import { ScreeningCase, type ScreeningKind, type ScreeningState } from './screening-case.entity'
import type { KycProvider } from './kyc-provider.interface'
import type { SanctionsProvider } from './sanctions-provider.interface'
import { RegionPolicy } from './region-policy'

function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({
    error: { code, message },
    requestId: randomUUID(),
    path: '',
    timestamp: new Date().toISOString(),
  })
}

/**
 * 统一资格与合规服务（API-004）。
 *
 * 验收核心：用户、资产、订单都必须经由本服务的 evaluateEligibility 判定，
 * 同一策略引擎聚合 KYC 状态、制裁筛查、地域准入与风险标记。
 */
@Injectable()
export class ComplianceService {
  private readonly policyVersion: string

  constructor(
    @InjectRepository(KycCase) private readonly kycRepo: Repository<KycCase>,
    @InjectRepository(EligibilityProfile) private readonly eligibilityRepo: Repository<EligibilityProfile>,
    @InjectRepository(RiskFlag) private readonly riskRepo: Repository<RiskFlag>,
    @InjectRepository(ScreeningCase) private readonly screeningRepo: Repository<ScreeningCase>,
    @Inject('KycProvider') private readonly kycProvider: KycProvider,
    @Inject('SanctionsProvider') private readonly sanctionsProvider: SanctionsProvider,
    private readonly regionPolicy: RegionPolicy,
    private readonly crypto: IdentityCrypto,
    config: ConfigService,
  ) {
    this.policyVersion = config.get<string>('POLICY_VERSION') ?? '2026.1'
    const financialMode = config.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
    if (financialMode && (this.kycProvider.mode !== 'live' || this.sanctionsProvider.mode !== 'live')) {
      throw new Error('Financial production requires live KYC and sanctions provider implementations; stub providers are forbidden')
    }
  }

  // ---- KYC 生命周期 ----

  async startKyc(userId: string, provider: string): Promise<KycCase> {
    if (this.kycProvider.mode === 'live') {
      throw new BadRequestException('Use the hosted KYC session endpoint for a live provider')
    }
    if (provider.trim().toLowerCase() !== this.kycProvider.name) {
      throw new BadRequestException('The requested KYC provider is not enabled')
    }
    const open = await this.kycRepo.findOne({
      where: [
        { userId, state: 'not_started' },
        { userId, state: 'in_progress' },
      ],
    })
    if (open) return open
    const kyc = this.kycRepo.create({
      id: randomUUID(),
      userId,
      state: 'in_progress',
      provider,
      providerCaseHash: Buffer.from(''),
      providerCaseCiphertext: Buffer.from(''),
      encryptionKeyVersion: 1,
    })
    return this.kycRepo.save(kyc)
  }

  async submitKyc(userId: string, providerCaseRef: string): Promise<KycCase> {
    if (this.kycProvider.mode === 'live') {
      throw new BadRequestException('Provider case references cannot be submitted by clients in live KYC mode')
    }
    const kyc = await this.kycRepo.findOne({ where: { userId, state: 'in_progress' } })
    if (!kyc) throw notFound(COMPLIANCE_ERROR_CODES.KYC_CASE_NOT_FOUND, '没有进行中的 KYC 案件')
    const { ciphertext, keyVersion } = this.crypto.encrypt(providerCaseRef)
    kyc.state = 'submitted'
    kyc.providerCaseHash = this.crypto.hmac(providerCaseRef)
    kyc.providerCaseCiphertext = ciphertext
    kyc.encryptionKeyVersion = keyVersion
    kyc.submittedAt = new Date()
    return this.kycRepo.save(kyc)
  }

  async createHostedKycSession(userId: string, payload: Record<string, unknown>) {
    if (this.kycProvider.mode !== 'live') {
      throw new ServiceUnavailableException('A hosted KYC provider is not configured')
    }
    const latest = await this.getKycStatus(userId)
    if (latest?.state === 'approved') {
      throw new ConflictException('KYC is already approved')
    }

    const submission = await this.kycProvider.submitCase({ userId, payload })
    if (!submission.verificationUrl) {
      throw new ServiceUnavailableException('The KYC provider did not return a hosted verification URL')
    }
    const encrypted = this.crypto.encrypt(submission.providerCaseRef)
    const kyc = latest
      && latest.provider === this.kycProvider.name
      && ['in_progress', 'submitted', 'needs_information'].includes(latest.state)
      ? latest
      : this.kycRepo.create({ id: randomUUID(), userId })
    kyc.state = 'submitted'
    kyc.provider = this.kycProvider.name
    kyc.providerCaseHash = this.crypto.hmac(submission.providerCaseRef)
    kyc.providerCaseCiphertext = encrypted.ciphertext
    kyc.encryptionKeyVersion = encrypted.keyVersion
    kyc.reasonCode = null
    kyc.submittedAt = kyc.submittedAt ?? new Date()
    kyc.decidedAt = null
    kyc.expiresAt = null
    const saved = await this.kycRepo.save(kyc)
    return { case: saved, verificationUrl: submission.verificationUrl }
  }

  async receiveDiditWebhook(input: {
    body: unknown
    signatureV2: string | undefined
    timestamp: string | undefined
    isTest: boolean
  }) {
    if (this.kycProvider.name !== 'didit' || !this.kycProvider.verifyWebhook || !this.kycProvider.mapStatus) {
      throw new ServiceUnavailableException('Didit webhook processing is not enabled')
    }
    let event
    try {
      event = this.kycProvider.verifyWebhook({
        body: input.body,
        signatureV2: input.signatureV2 ?? '',
        timestamp: input.timestamp ?? '',
      })
    } catch {
      throw new UnauthorizedException('Didit webhook authentication failed')
    }

    if (input.isTest || !['status.updated', 'data.updated'].includes(event.webhookType)) {
      return { accepted: true, updated: false }
    }
    const kyc = await this.kycRepo.findOne({
      where: {
        provider: this.kycProvider.name,
        providerCaseHash: this.crypto.hmac(event.sessionId),
      },
    })
    if (!kyc || ['approved', 'rejected', 'expired'].includes(kyc.state)) {
      return { accepted: true, updated: false }
    }

    const providerCase = this.kycProvider.mapStatus(event.status)
    if (providerCase.state === kyc.state) return { accepted: true, updated: false }
    kyc.state = providerCase.state
    kyc.reasonCode = providerCase.reason?.slice(0, 128) ?? null
    if (providerCase.state === 'approved' || providerCase.state === 'rejected') {
      kyc.decidedAt = new Date()
    }
    await this.kycRepo.save(kyc)
    if (providerCase.state === 'approved' || providerCase.state === 'rejected') {
      await this.evaluateEligibility(kyc.userId, 'default')
    }
    return { accepted: true, updated: true }
  }

  toPublicKycCase(kyc: KycCase | null) {
    if (!kyc) return null
    return {
      id: kyc.id,
      userId: kyc.userId,
      state: kyc.state,
      provider: kyc.provider,
      reasonCode: kyc.reasonCode,
      submittedAt: kyc.submittedAt,
      decidedAt: kyc.decidedAt,
      expiresAt: kyc.expiresAt,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    }
  }

  async decideKyc(caseId: string, decision: 'approved' | 'rejected', reasonCode?: string): Promise<KycCase> {
    const kyc = await this.kycRepo.findOne({ where: { id: caseId } })
    if (!kyc) throw notFound(COMPLIANCE_ERROR_CODES.KYC_CASE_NOT_FOUND, 'KYC 案件不存在')
    if (kyc.state !== 'submitted') {
      throw new ConflictException({
        error: { code: COMPLIANCE_ERROR_CODES.KYC_NOT_SUBMITTED, message: 'KYC 尚未提交，无法裁决' },
        requestId: randomUUID(),
        path: '',
        timestamp: new Date().toISOString(),
      })
    }
    kyc.state = decision === 'approved' ? 'approved' : 'rejected'
    kyc.reasonCode = reasonCode ?? null
    kyc.decidedAt = new Date()
    const saved = await this.kycRepo.save(kyc)
    await this.evaluateEligibility(kyc.userId, 'default')
    return saved
  }

  async getKycStatus(userId: string): Promise<KycCase | null> {
    return this.kycRepo.findOne({ where: { userId }, order: { updatedAt: 'DESC' } })
  }

  // ---- 制裁 / 筛查 ----

  async screen(userId: string, kind: ScreeningKind, identifiers: Record<string, string> = {}): Promise<ScreeningCase> {
    const result = await this.sanctionsProvider.screen({ userId, kind, identifiers })
    const sc = this.screeningRepo.create({
      id: randomUUID(),
      userId,
      kind,
      state: result.state as ScreeningState,
      provider: this.sanctionsProvider.name,
      providerReferenceHash: identifiers.walletAddress ? this.crypto.hmac(identifiers.walletAddress) : null,
      reasonCode: result.reason ?? null,
      decidedAt: result.state === 'clear' || result.state === 'confirmed_match' || result.state === 'potential_match' ? new Date() : null,
    })
    const saved = await this.screeningRepo.save(sc)
    if (result.state === 'confirmed_match') {
      await this.openRiskFlag(userId, 'sanctions', 'high', 'screening', 'confirmed_match')
    }
    await this.evaluateEligibility(userId, 'default')
    return saved
  }

  async listScreening(userId: string): Promise<ScreeningCase[]> {
    return this.screeningRepo.find({ where: { userId }, order: { openedAt: 'DESC' } })
  }

  // ---- 统一资格评估（验收核心） ----

  async evaluateEligibility(userId: string, productScope: string, region?: string): Promise<EligibilityProfile> {
    const reasons: string[] = []
    let decision: EligibilityDecision = 'eligible'

    // 1) 地域准入
    if (region && !this.regionPolicy.isAllowed(region)) {
      decision = 'ineligible'
      reasons.push('region_blocked')
    }

    // 2) KYC 状态
    const kyc = await this.getKycStatus(userId)
    if (!kyc || kyc.state !== 'approved') {
      if (decision === 'eligible') {
        decision = 'browse_only'
        reasons.push('kyc_not_approved')
      }
    }

    // 3) 制裁 / PEP 筛查
    const screening = await this.screeningRepo.findOne({
      where: { userId },
      order: { openedAt: 'DESC' },
    })
    if (screening && (screening.state === 'confirmed_match' || screening.state === 'potential_match')) {
      decision = 'manual_review'
      reasons.push(screening.state === 'confirmed_match' ? 'sanctions_match' : 'sanctions_review')
    }

    // 4) 未关闭的风险标记
    const openFlags = await this.riskRepo.find({ where: { userId } })
    const blocking = openFlags.filter((f) => f.state === 'open' || f.state === 'under_review')
    if (blocking.some((f) => f.severity === 'critical' || f.severity === 'high')) {
      decision = 'manual_review'
      reasons.push('risk_flag_open')
    }

    const existing = await this.eligibilityRepo.findOne({
      where: { userId, policyVersion: this.policyVersion, productScope },
    })
    const profile = existing ?? this.eligibilityRepo.create({
      id: randomUUID(),
      userId,
      policyVersion: this.policyVersion,
      productScope,
    })
    profile.decision = decision
    profile.reasonCodes = reasons
    profile.evidenceReferences = {
      kycState: kyc?.state ?? null,
      screeningState: screening?.state ?? null,
      region: region ?? null,
    }
    profile.decidedAt = new Date()
    profile.expiresAt = null
    return this.eligibilityRepo.save(profile)
  }

  async getEligibility(userId: string, productScope: string): Promise<EligibilityProfile> {
    const profile = await this.eligibilityRepo.findOne({
      where: { userId, policyVersion: this.policyVersion, productScope },
    })
    if (!profile) throw notFound(COMPLIANCE_ERROR_CODES.ELIGIBILITY_NOT_FOUND, '尚无资格评估记录')
    return profile
  }

  // ---- 风险标记 ----

  async openRiskFlag(
    userId: string,
    category: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    source: string,
    reasonCode: string,
  ): Promise<RiskFlag> {
    const flag = this.riskRepo.create({
      id: randomUUID(),
      userId,
      category,
      severity,
      state: 'open',
      source,
      reasonCode,
      openedAt: new Date(),
      resolvedAt: null,
    })
    return this.riskRepo.save(flag)
  }

  async resolveRiskFlag(id: string, state: RiskFlagState): Promise<RiskFlag> {
    const flag = await this.riskRepo.findOne({ where: { id } })
    if (!flag) throw notFound(COMPLIANCE_ERROR_CODES.RISK_FLAG_NOT_FOUND, '风险标记不存在')
    flag.state = state
    flag.resolvedAt = state === 'resolved' || state === 'dismissed' ? new Date() : null
    const saved = await this.riskRepo.save(flag)
    await this.evaluateEligibility(flag.userId, 'default')
    return saved
  }
}
