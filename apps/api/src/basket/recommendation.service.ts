import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export interface RecommendationAnswers {
  horizon: 'short' | 'medium' | 'long'
  riskAppetite: 'conservative' | 'balanced' | 'growth'
  focus: 'income' | 'growth' | 'diversified'
  experience: 'new' | 'intermediate' | 'experienced'
}

export interface RecommendationItem {
  portfolioId: string
  name: string
  slug: string
  fitScore: number
  reasons: string[]
}

const ENGINE_VERSION = 'rules-v1'

/**
 * 确定性规则推荐引擎 v1（v1 前端规则问答对应）。
 * 输入 4 个答案 → 对现有组合打分（30–98）→ 推荐 Top3。
 * 每次调用都会落草稿（answers + result + 引擎版本），可追溯。
 */
@Injectable()
export class BasketRecommendationService {
  constructor(private readonly ds: DataSource) {}

  async recommend(userId: string | null, answers: RecommendationAnswers) {
    const rows = (await this.ds.query(
      `SELECT id, name, slug, COALESCE(risk_level, 'medium') AS risk_level
       FROM app.basket_portfolios
       WHERE status IN ('pilot', 'active')
       ORDER BY name`,
    )) as Array<{ id: string; name: string; slug: string; risk_level: string }>

    const recommended = rows
      .map((p) => this.score(p, answers))
      .sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name))
      .slice(0, 3)

    const result = { engineVersion: ENGINE_VERSION, recommended }
    const [draft] = (await this.ds.query(
      `INSERT INTO app.basket_recommendation_drafts (user_id, answers_json, result_json, engine_version)
       VALUES ($1, $2::jsonb, $3::jsonb, $4)
       RETURNING id`,
      [userId, JSON.stringify(answers), JSON.stringify(result), ENGINE_VERSION],
    )) as Array<{ id: string }>

    return { draftId: draft?.id ?? null, engineVersion: ENGINE_VERSION, recommended }
  }

  private score(
    p: { id: string; name: string; slug: string; risk_level: string },
    a: RecommendationAnswers,
  ): RecommendationItem {
    let score = 50
    const reasons: string[] = []
    const low = p.risk_level === 'low'

    if (a.riskAppetite === 'conservative') {
      if (low) {
        score += 30
        reasons.push('Matches a conservative risk profile with lower drawdown exposure')
      } else score -= 15
    } else if (a.riskAppetite === 'balanced') {
      if (!low) {
        score += 25
        reasons.push('Suited to a balanced risk profile')
      } else {
        score += 10
        reasons.push('Adds stability within a balanced mix')
      }
    } else {
      if (!low) {
        score += 25
        reasons.push('Growth-oriented allocation for higher risk appetite')
      } else score += 5
    }

    if (a.focus === 'income') {
      if (p.slug === 'foundation-rwa') {
        score += 20
        reasons.push('Income focus: diversified funds and commodities with a stable cash buffer')
      } else score -= 5
    } else if (a.focus === 'growth') {
      if (p.slug === 'digital-economy-leaders') {
        score += 25
        reasons.push('Growth focus: leading tokenized equities in the digital economy')
      } else score -= 5
    } else {
      if (p.slug === 'global-balanced-rwa') {
        score += 25
        reasons.push('Diversified across tokenized equities, funds and commodities')
      } else score += 5
    }

    score += a.horizon === 'long' ? 5 : a.horizon === 'medium' ? 3 : 0
    if (a.experience === 'new' && low) {
      score += 8
      reasons.push('Simpler, lower-volatility starting point for newer investors')
    }
    if (a.experience === 'experienced' && !low) score += 4

    score = Math.max(30, Math.min(98, score))
    return { portfolioId: p.id, name: p.name, slug: p.slug, fitScore: score, reasons: reasons.slice(0, 3) }
  }
}
