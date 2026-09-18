import { computeScore, scoreContractRisk, scoreLiquidity, scoreMarketRisk, scoreYield } from '../../src/rwa-analysis/scoring.service'

describe('scoring rules (deterministic units)', () => {
  it('scores yield bands', () => {
    expect(scoreYield(null)).toBe(50)
    expect(scoreYield('-1')).toBe(20)
    expect(scoreYield('0.5')).toBe(45)
    expect(scoreYield('1.5')).toBe(55)
    expect(scoreYield('3')).toBe(70)
    expect(scoreYield('4.5')).toBe(82)
    expect(scoreYield('7')).toBe(90)
    expect(scoreYield('12')).toBe(95)
  })

  it('scores liquidity bands', () => {
    expect(scoreLiquidity(null)).toBe(40)
    expect(scoreLiquidity('0')).toBe(40)
    expect(scoreLiquidity('50000')).toBe(25)
    expect(scoreLiquidity('500000')).toBe(45)
    expect(scoreLiquidity('2000000')).toBe(60)
    expect(scoreLiquidity('15000000')).toBe(75)
    expect(scoreLiquidity('50000000')).toBe(88)
    expect(scoreLiquidity('500000000')).toBe(95)
  })

  it('scores market risk by worst observed move', () => {
    expect(scoreMarketRisk(null, null, null)).toBe(50)
    expect(scoreMarketRisk('0.5', null, '0.2')).toBe(95)
    expect(scoreMarketRisk('2', null, null)).toBe(85)
    expect(scoreMarketRisk('5', null, null)).toBe(70)
    expect(scoreMarketRisk('10', null, null)).toBe(55)
    expect(scoreMarketRisk('20', '2', null)).toBe(40)
    expect(scoreMarketRisk('45', null, null)).toBe(25)
  })

  it('scores contract risk with transfer restrictions', () => {
    expect(scoreContractRisk({ isTokenized: false, hasContractRows: false, contractTransferRestricted: null, contractWhitelistRequired: null })).toBe(85)
    expect(scoreContractRisk({ isTokenized: true, hasContractRows: false, contractTransferRestricted: null, contractWhitelistRequired: null })).toBe(60)
    expect(scoreContractRisk({ isTokenized: true, hasContractRows: true, contractTransferRestricted: false, contractWhitelistRequired: false })).toBe(70)
    expect(scoreContractRisk({ isTokenized: true, hasContractRows: true, contractTransferRestricted: true, contractWhitelistRequired: false })).toBe(45)
    expect(scoreContractRisk({ isTokenized: true, hasContractRows: true, contractTransferRestricted: true, contractWhitelistRequired: true })).toBe(40)
  })

  it('computes a weighted overall score with risk level', () => {
    const result = computeScore({
      assetId: 'x',
      assetClass: 'treasury',
      isTokenized: true,
      redemptionType: 'instant',
      hasIssuer: true,
      issuerVerified: true,
      issuerTokenCount: 100,
      issuerHasWebsite: true,
      contractTransferRestricted: null,
      contractWhitelistRequired: null,
      hasContractRows: false,
      priceUsd: '100',
      marketCapUsd: '5000000',
      volume24hUsd: '15000000',
      apy: '4.5',
      change24hPct: '0.5',
      change7dPct: '0.5',
      change30dPct: '0.5',
      dataTimestamp: new Date(),
    })
    expect(result.yieldScore).toBe(82)
    expect(result.liquidityScore).toBe(75)
    expect(result.issuerScore).toBe(90)
    expect(result.collateralScore).toBe(92)
    expect(result.redemptionScore).toBe(95)
    expect(result.contractRiskScore).toBe(60)
    expect(result.marketRiskScore).toBe(95)
    expect(result.dataQualityScore).toBe(100)
    expect(result.overallScore).toBeCloseTo(85.48, 2)
    expect(result.riskLevel).toBe('low')
  })
})
