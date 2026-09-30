import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { RiskProfile, type RiskBand } from './risk-profile.entity'

export const RISK_QUESTIONNAIRE_VERSION = '2026.1'
const PROFILE_TTL_MS = 365 * 24 * 60 * 60 * 1000

export const RISK_QUESTIONS = [
  {
    key: 'experience',
    prompt: 'How much investing experience do you have?',
    options: ['None', 'Less than 1 year', '1–3 years', '3–7 years', 'More than 7 years'],
  },
  {
    key: 'horizon',
    prompt: 'How long do you plan to keep this investment?',
    options: ['Under 6 months', '6–12 months', '1–3 years', '3–7 years', 'More than 7 years'],
  },
  {
    key: 'drawdown',
    prompt: 'What temporary loss could you tolerate without selling?',
    options: ['None', 'Up to 5%', 'Up to 10%', 'Up to 25%', 'More than 25%'],
  },
  {
    key: 'objective',
    prompt: 'What is your primary objective?',
    options: ['Preserve capital', 'Income with low risk', 'Balanced growth', 'High growth', 'Maximum growth'],
  },
  {
    key: 'stability',
    prompt: 'How stable is your income?',
    options: ['Very unstable', 'Somewhat unstable', 'Neutral', 'Stable', 'Very stable'],
  },
  {
    key: 'liquidity',
    prompt: 'How soon might you need this money back in cash?',
    options: ['Any time', 'Within a year', '1–3 years', '3+ years', 'I will not need it'],
  },
] as const

const QUESTION_KEYS = RISK_QUESTIONS.map((question) => question.key)

export interface RiskProfileView {
  band: RiskBand
  score: number
  questionnaireVersion: string
  completedAt: string
  expiresAt: string
  stale: boolean
  answers: Record<string, number>
}

@Injectable()
export class RiskProfileService {
  constructor(@InjectRepository(RiskProfile) private readonly profiles: Repository<RiskProfile>) {}

  get questionnaire() {
    return { version: RISK_QUESTIONNAIRE_VERSION, questions: RISK_QUESTIONS }
  }

  async getProfile(userId: string): Promise<RiskProfileView | null> {
    const profile = await this.profiles.findOne({ where: { userId } })
    if (!profile) return null
    return this.toView(profile)
  }

  async submitProfile(userId: string, answers: Record<string, number>): Promise<RiskProfileView> {
    const normalized: Record<string, number> = {}
    for (const key of QUESTION_KEYS) {
      const value = answers?.[key]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
        throw new BadRequestException({
          code: 'RISK_PROFILE_INVALID_ANSWERS',
          message: `Answer "${key}" must be an integer from 1 to 5.`,
        })
      }
      normalized[key] = value
    }
    const total = QUESTION_KEYS.reduce((sum, key) => sum + normalized[key], 0)
    const score = Math.round(((total - QUESTION_KEYS.length) / (QUESTION_KEYS.length * 4)) * 100)
    const band = this.bandFor(score)
    const existing = await this.profiles.findOne({ where: { userId } })
    const now = new Date()
    const profile = this.profiles.create({
      id: existing?.id ?? randomUUID(),
      userId,
      answersJson: normalized,
      score,
      band,
      questionnaireVersion: RISK_QUESTIONNAIRE_VERSION,
      completedAt: now,
      expiresAt: new Date(now.getTime() + PROFILE_TTL_MS),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    const saved = await this.profiles.save(profile)
    return this.toView(saved)
  }

  async deleteProfile(userId: string): Promise<{ deleted: true }> {
    await this.profiles.delete({ userId })
    return { deleted: true }
  }

  private bandFor(score: number): RiskBand {
    if (score < 30) return 'conservative'
    if (score < 55) return 'balanced'
    if (score < 80) return 'growth'
    return 'aggressive'
  }

  private toView(profile: RiskProfile): RiskProfileView {
    return {
      band: profile.band,
      score: profile.score,
      questionnaireVersion: profile.questionnaireVersion,
      completedAt: profile.completedAt.toISOString(),
      expiresAt: profile.expiresAt.toISOString(),
      stale: profile.expiresAt.getTime() <= Date.now(),
      answers: profile.answersJson,
    }
  }
}
