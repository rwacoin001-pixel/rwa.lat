import { RiskProfileService, RISK_QUESTIONS } from '../../src/compliance/risk-profile.service'
import { RiskProfile } from '../../src/compliance/risk-profile.entity'
import { Repository } from 'typeorm'

describe('Risk profile answer contract', () => {
  const userId = '22222222-2222-4222-8222-222222222222'
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock }
  let service: RiskProfileService
  const answers = (value: number) => Object.fromEntries(RISK_QUESTIONS.map(({ key }) => [key, value]))

  beforeEach(() => {
    repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((v) => v), save: jest.fn(async (v) => v) }
    service = new RiskProfileService(repo as unknown as Repository<RiskProfile>)
  })

  it.each([0, 6, 1.4, 4.6, '3', null, undefined, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-option answer %s without persisting', async (bad) => {
    await expect(service.submitProfile(userId, { ...answers(3), experience: bad } as Record<string, number>))
      .rejects.toMatchObject({ response: { code: 'RISK_PROFILE_INVALID_ANSWERS' } })
    expect(repo.save).not.toHaveBeenCalled()
  })

  it.each([[1, 0, 'conservative'], [3, 50, 'balanced'], [5, 100, 'aggressive']])('preserves the existing score model for option %s', async (option, score, band) => {
    const result = await service.submitProfile(userId, answers(Number(option)))
    expect(result).toMatchObject({ score, band, stale: false, answers: answers(Number(option)), questionnaireVersion: service.questionnaire.version })
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(new Date(result.completedAt).getTime())
    expect(repo.save).toHaveBeenCalledTimes(1)
  })
})
