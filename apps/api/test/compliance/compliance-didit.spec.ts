import { ConfigService } from '@nestjs/config'
import { ComplianceService } from '../../src/compliance/compliance.service'
import type { KycProvider } from '../../src/compliance/kyc-provider.interface'
import { StubSanctionsProvider } from '../../src/compliance/stub-sanctions.provider'

function repository() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn((value: object) => Promise.resolve(value)),
  }
}

function fixture() {
  const kycRepo = repository()
  const provider: KycProvider = {
    name: 'didit',
    mode: 'live',
    submitCase: jest.fn().mockResolvedValue({
      providerCaseRef: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      status: 'submitted',
      verificationUrl: 'https://verify.didit.me/en/session/token',
    }),
    getCase: jest.fn(),
    verifyWebhook: jest.fn().mockReturnValue({
      eventId: 'event-1',
      webhookType: 'status.updated',
      sessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      status: 'Approved',
    }),
    mapStatus: jest.fn().mockReturnValue({ state: 'approved', decision: 'approved' }),
  }
  const crypto = {
    encrypt: (value: string) => ({ ciphertext: Buffer.from(value), keyVersion: 1 }),
    decrypt: (value: Buffer) => value.toString(),
    hmac: (value: string) => Buffer.from(`hash:${value}`),
  }
  const service = new ComplianceService(
    kycRepo as never,
    repository() as never,
    repository() as never,
    repository() as never,
    provider,
    new StubSanctionsProvider({ get: () => '' } as never),
    { isAllowed: () => true } as never,
    crypto as never,
    { get: (key: string) => key === 'PRODUCTION_FINANCIAL_FEATURES_ENABLED' ? 'false' : undefined } as ConfigService,
  )
  return { kycRepo, provider, service }
}

describe('ComplianceService Didit integration boundary', () => {
  it('creates a hosted session and stores only encrypted/reference hashes', async () => {
    const { kycRepo, service } = fixture()
    kycRepo.findOne.mockResolvedValue(null)

    const result = await service.createHostedKycSession('user-1', { language: 'zh-CN' })

    expect(result.verificationUrl).toBe('https://verify.didit.me/en/session/token')
    expect(kycRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      state: 'submitted',
      provider: 'didit',
      providerCaseHash: Buffer.from('hash:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
    }))
    const publicCase = service.toPublicKycCase(result.case)
    expect(publicCase).not.toHaveProperty('providerCaseHash')
    expect(publicCase).not.toHaveProperty('providerCaseCiphertext')
  })

  it('accepts a verified final callback once and refreshes eligibility', async () => {
    const { kycRepo, service } = fixture()
    const row = {
      id: 'case-1',
      userId: 'user-1',
      state: 'submitted',
      provider: 'didit',
      providerCaseHash: Buffer.alloc(1),
      providerCaseCiphertext: Buffer.alloc(1),
      encryptionKeyVersion: 1,
      reasonCode: null,
      submittedAt: new Date(),
      decidedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    kycRepo.findOne.mockResolvedValue(row)
    jest.spyOn(service, 'evaluateEligibility').mockResolvedValue({} as never)

    await expect(service.receiveDiditWebhook({
      body: {},
      signatureV2: 'a'.repeat(64),
      timestamp: '1784419200',
      isTest: false,
    })).resolves.toEqual({ accepted: true, updated: true })
    expect(row.state).toBe('approved')
    expect(row.decidedAt).toBeInstanceOf(Date)
    expect(service.evaluateEligibility).toHaveBeenCalledWith('user-1', 'default')
  })

  it('does not mutate state for Didit console test deliveries', async () => {
    const { kycRepo, service } = fixture()
    await expect(service.receiveDiditWebhook({
      body: {},
      signatureV2: 'a'.repeat(64),
      timestamp: '1784419200',
      isTest: true,
    })).resolves.toEqual({ accepted: true, updated: false })
    expect(kycRepo.findOne).not.toHaveBeenCalled()
  })
})
