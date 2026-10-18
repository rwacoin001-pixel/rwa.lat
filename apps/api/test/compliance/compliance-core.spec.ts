import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { ComplianceService } from '../../src/compliance/compliance.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { KycCase } from '../../src/compliance/kyc-case.entity'
import { EligibilityProfile } from '../../src/compliance/eligibility-profile.entity'
import { RiskFlag } from '../../src/compliance/risk-flag.entity'
import { ScreeningCase } from '../../src/compliance/screening-case.entity'
import { StubKycProvider } from '../../src/compliance/stub-kyc.provider'
import { StubSanctionsProvider } from '../../src/compliance/stub-sanctions.provider'
import type { KycProvider } from '../../src/compliance/kyc-provider.interface'

function repoMock(): any {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((entityLike: object) => ({ ...entityLike })),
    save: jest.fn((e: object) => Promise.resolve({ ...e })),
  }
}

describe('ComplianceService 核心逻辑', () => {
  let service: ComplianceService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kycRepo: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eligibilityRepo: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let riskRepo: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let screeningRepo: any
  let sanctions: StubSanctionsProvider

  const userId = randomUUID()

  beforeEach(async () => {
    kycRepo = repoMock() as never
    eligibilityRepo = repoMock() as never
    riskRepo = repoMock() as never
    screeningRepo = repoMock() as never
    sanctions = new StubSanctionsProvider({ get: () => '' } as never)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: getRepositoryToken(KycCase), useValue: kycRepo },
        { provide: getRepositoryToken(EligibilityProfile), useValue: eligibilityRepo },
        { provide: getRepositoryToken(RiskFlag), useValue: riskRepo },
        { provide: getRepositoryToken(ScreeningCase), useValue: screeningRepo },
        { provide: 'KycProvider', useClass: StubKycProvider },
        { provide: 'SanctionsProvider', useValue: sanctions },
        { provide: ConfigService, useValue: { get: (k: string) => `test-${k}` } },
        {
          provide: IdentityCrypto,
          useValue: {
            encrypt: (p: string) => ({ ciphertext: Buffer.from(p), keyVersion: 1 }),
            decrypt: (b: Buffer) => b.toString(),
            hmac: (v: string) => Buffer.from(v),
          },
        },
        { provide: 'ConfigService', useValue: { get: () => '2026.1' } },
      ],
    }).compile()

    service = module.get(ComplianceService)
  })

  it('KYC 状态机：start -> submit -> decide approved -> 资格 eligible', async () => {
    kycRepo.findOne!.mockResolvedValueOnce(null) // start: 无进行中
    kycRepo.findOne!.mockResolvedValueOnce({ id: 'c1', userId, state: 'in_progress' } as KycCase) // submit
    kycRepo.findOne!.mockResolvedValueOnce({ id: 'c1', userId, state: 'submitted' } as KycCase) // decide
    kycRepo.findOne!.mockResolvedValueOnce({ id: 'c1', userId, state: 'approved' } as KycCase) // evaluateEligibility 内 getKycStatus
    eligibilityRepo.findOne!.mockResolvedValue(null)

    await service.startKyc(userId, 'stub')
    await service.submitKyc(userId, 'stub:ref:1')
    const decided = await service.decideKyc('c1', 'approved')
    expect(decided.state).toBe('approved')

    // decideKyc 触发 evaluateEligibility -> eligible
    expect(eligibilityRepo.save).toHaveBeenCalled()
    const saved = (eligibilityRepo.save as jest.Mock).mock.calls.at(-1)![0] as EligibilityProfile
    expect(saved.decision).toBe('eligible')
  })

  it('制裁筛查 confirmed_match -> 资格 manual_review + 打开风险标记', async () => {
    ;(sanctions as unknown as { blocklist: Set<string> }).blocklist = new Set(['0xbad'])
    screeningRepo.findOne!.mockResolvedValue({ id: 's1', userId, kind: 'sanctions', state: 'confirmed_match' } as ScreeningCase)
    eligibilityRepo.findOne!.mockResolvedValue(null)

    const sc = await service.screen(userId, 'sanctions', { walletAddress: '0xbad' })
    expect(sc.state).toBe('confirmed_match')
    expect(riskRepo.save).toHaveBeenCalled()
    const flag = (riskRepo.save as jest.Mock).mock.calls.at(-1)![0] as RiskFlag
    expect(flag.severity).toBe('high')

    const saved = (eligibilityRepo.save as jest.Mock).mock.calls.at(-1)![0] as EligibilityProfile
    expect(saved.decision).toBe('manual_review')
  })

  it('地区规则待合规确认：忽略客户端地区且不产生地区阻断', async () => {
    kycRepo.findOne!.mockResolvedValue({ id: 'c1', userId, state: 'approved' } as KycCase)
    screeningRepo.findOne!.mockResolvedValue(null)
    riskRepo.find!.mockResolvedValue([])
    eligibilityRepo.findOne!.mockResolvedValue(null)
    const profile = await service.evaluateEligibility(userId, 'rwa-token', 'KP')
    expect(profile.decision).toBe('eligible')
    expect(profile.reasonCodes).not.toContain('region_blocked')
    expect(profile.evidenceReferences.region).toBeNull()
  })

  it('高风险/严重风险标记 -> 资格 manual_review', async () => {
    riskRepo.find!.mockResolvedValue([{ id: 'f1', severity: 'critical', state: 'open' } as RiskFlag])
    kycRepo.findOne!.mockResolvedValue(null)
    screeningRepo.findOne!.mockResolvedValue(null)
    eligibilityRepo.findOne!.mockResolvedValue(null)

    const profile = await service.evaluateEligibility(userId, 'rwa-token')
    expect(profile.decision).toBe('manual_review')
    expect(profile.reasonCodes).toContain('risk_flag_open')
  })

  describe('KYC 开关 KYC_REQUIRED_FOR_INVESTMENT', () => {
    const saved = process.env.KYC_REQUIRED_FOR_INVESTMENT
    afterEach(() => {
      if (saved === undefined) delete process.env.KYC_REQUIRED_FOR_INVESTMENT
      else process.env.KYC_REQUIRED_FOR_INVESTMENT = saved
    })
    function noOtherBlocks(kyc: unknown) {
      riskRepo.find!.mockResolvedValue([])
      kycRepo.findOne!.mockResolvedValue(kyc)
      screeningRepo.findOne!.mockResolvedValue(null)
      eligibilityRepo.findOne!.mockResolvedValue(null)
    }

    it('默认（未设置）不要求 KYC：从未认证的账户也是 eligible', async () => {
      delete process.env.KYC_REQUIRED_FOR_INVESTMENT
      noOtherBlocks(null)
      const profile = await service.evaluateEligibility(userId, 'rwa-token')
      expect(profile.decision).toBe('eligible')
      expect(profile.reasonCodes).not.toContain('kyc_not_approved')
      expect(profile.evidenceReferences.kycState).toBeNull()
    })

    it.each(['false', '', '0'])('值为 %p 时同样不要求 KYC', async (value) => {
      process.env.KYC_REQUIRED_FOR_INVESTMENT = value
      noOtherBlocks(null)
      expect((await service.evaluateEligibility(userId, 'rwa-token')).decision).toBe('eligible')
    })

    it('关闭时仍记录已有的 KYC 状态作为证据', async () => {
      delete process.env.KYC_REQUIRED_FOR_INVESTMENT
      noOtherBlocks({ id: 'c1', userId, state: 'submitted' } as KycCase)
      const profile = await service.evaluateEligibility(userId, 'rwa-token')
      expect(profile.decision).toBe('eligible')
      expect(profile.evidenceReferences.kycState).toBe('submitted')
    })

    it('设为 true 后恢复限制：KYC 未批准 -> browse_only', async () => {
      process.env.KYC_REQUIRED_FOR_INVESTMENT = 'true'
      noOtherBlocks(null)
      const profile = await service.evaluateEligibility(userId, 'rwa-token')
      expect(profile.decision).toBe('browse_only')
      expect(profile.reasonCodes).toContain('kyc_not_approved')
    })

    it('设为 true 且 KYC 已批准 -> eligible', async () => {
      process.env.KYC_REQUIRED_FOR_INVESTMENT = 'true'
      noOtherBlocks({ id: 'c1', userId, state: 'approved' } as KycCase)
      expect((await service.evaluateEligibility(userId, 'rwa-token')).decision).toBe('eligible')
    })

    it('关闭 KYC 不会绕过制裁筛查或高风险标记', async () => {
      delete process.env.KYC_REQUIRED_FOR_INVESTMENT
      riskRepo.find!.mockResolvedValue([{ id: 'f1', severity: 'critical', state: 'open' } as RiskFlag])
      kycRepo.findOne!.mockResolvedValue(null)
      screeningRepo.findOne!.mockResolvedValue({ id: 's1', userId, state: 'confirmed_match' })
      eligibilityRepo.findOne!.mockResolvedValue(null)
      const profile = await service.evaluateEligibility(userId, 'rwa-token')
      expect(profile.decision).toBe('manual_review')
      expect(profile.reasonCodes).toEqual(expect.arrayContaining(['sanctions_match', 'risk_flag_open']))
    })
  })
})
