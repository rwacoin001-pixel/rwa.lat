import { RegionPolicy } from '../../src/compliance/region-policy'
import { ComplianceService } from '../../src/compliance/compliance.service'
import { StubKycProvider } from '../../src/compliance/stub-kyc.provider'
import { StubSanctionsProvider } from '../../src/compliance/stub-sanctions.provider'

// 用真实 RegionPolicy 但注入最小 config
class RegionPolicyStub {
  private inner: RegionPolicy
  constructor(raw: string) {
    this.inner = new RegionPolicy({ get: (k: string) => (k === 'ALLOWED_REGIONS' ? raw : '') } as never)
  }
  isAllowed(r: string) {
    return this.inner.isAllowed(r)
  }
}

describe('PARTNER-001 桩适配器（类型化占位）', () => {
  it('资金生产模式拒绝实际注入的 Stub KYC/制裁适配器', () => {
    const kyc = new StubKycProvider()
    const sanctions = new StubSanctionsProvider({ get: () => '' } as never)
    const config = {
      get: (key: string) => key === 'PRODUCTION_FINANCIAL_FEATURES_ENABLED' ? 'true' : undefined,
    }

    expect(() => new ComplianceService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      kyc,
      sanctions,
      {} as never,
      {} as never,
      config as never,
    )).toThrow(/live KYC and sanctions provider implementations/)
  })

  it('StubKycProvider 返回提交引用且不发起外部调用', async () => {
    const p = new StubKycProvider()
    const res = await p.submitCase({ userId: 'u1', payload: {} })
    expect(res.providerCaseRef).toContain('stub:')
    expect(res.status).toBe('submitted')
  })

  it('StubSanctionsProvider 默认放行，命中黑名单返回 confirmed_match', async () => {
    const clean = new StubSanctionsProvider({ get: () => '' } as never)
    const r1 = await clean.screen({ userId: 'u1', kind: 'sanctions', identifiers: {} })
    expect(r1.state).toBe('clear')

    const blocked = new StubSanctionsProvider({ get: () => '0xbanned' } as never)
    const r2 = await blocked.screen({ userId: 'u1', kind: 'sanctions', identifiers: { walletAddress: '0xbanned' } })
    expect(r2.state).toBe('confirmed_match')
  })
})

describe('RegionPolicy 地域准入', () => {
  it('默认 ALL 允许所有地域', () => {
    const policy = new RegionPolicyStub('ALL')
    expect(policy.isAllowed('KP')).toBe(true)
  })

  it('白名单模式拒绝未列明地域', () => {
    const policy = new RegionPolicyStub('US, EU')
    expect(policy.isAllowed('US')).toBe(true)
    expect(policy.isAllowed('KP')).toBe(false)
  })
})
