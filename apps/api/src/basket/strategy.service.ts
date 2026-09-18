import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { slugify } from '../rwa-market/normalizers/rwa.normalizer'
import { BASKET_DEFAULTS, BASKET_ERROR_CODES } from './basket.constants'

export type CreateStrategyInput = {
  name: string
  slug?: string
  description?: string
  riskLevel?: 'low' | 'medium' | 'high'
  benchmark?: string
  rebalanceMode?: 'manual' | 'auto'
  rebalanceFrequency?: string
  minimumSubscriptionUsd?: string
  minimumRedemptionUsd?: string
  cashBufferTargetPct?: string
}

export type CreateVersionInput = {
  methodology?: Record<string, unknown>
  scoringWeights?: Record<string, unknown>
  riskRules?: Record<string, unknown>
}

export type TargetAllocationParams = {
  assetClasses?: string[]
  minScore?: number
  maxAssets?: number
  cashBufferPct?: number
  maxWeightPct?: number
  excludeRestricted?: boolean
}

const DEFAULT_CLASSES = ['treasury', 'money_market', 'bond', 'stable_value', 'commodity', 'fund', 'equity']

/**
 * 策略服务（规格 §38-52）：
 * - 策略（basket_strategies）→ 版本（basket_strategy_versions）→ 目标配置（basket_strategy_assets）
 * - 目标配置由确定性规则生成（评分排序 + 权重上限 + 现金缓冲；AI 不直接决定权重 §9）
 */
@Injectable()
export class BasketStrategyService {
  constructor(private readonly ds: DataSource) {}

  async createStrategy(input: CreateStrategyInput) {
    const slug = (input.slug?.trim() || slugify(input.name)).slice(0, 120)
    if (!slug) throw new ConflictException({ code: BASKET_ERROR_CODES.ALLOCATION_EMPTY, message: 'Strategy slug could not be derived.' })
    try {
      const [row] = (await this.ds.query(
        `INSERT INTO app.basket_strategies
           (slug, name, description, risk_level, base_currency, benchmark, rebalance_mode, rebalance_frequency,
            minimum_subscription_usd, minimum_redemption_usd, cash_buffer_target_pct)
         VALUES ($1, $2, $3, $4, 'USDT', $5, $6, $7, $8, $9, $10)
         RETURNING id, slug, name, status`,
        [
          slug,
          input.name,
          input.description ?? null,
          input.riskLevel ?? null,
          input.benchmark ?? null,
          input.rebalanceMode ?? 'manual',
          input.rebalanceFrequency ?? 'weekly',
          input.minimumSubscriptionUsd ?? null,
          input.minimumRedemptionUsd ?? null,
          input.cashBufferTargetPct ?? null,
        ],
      )) as Array<Record<string, unknown>>
      return row
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.STRATEGY_NOT_FOUND, message: `Strategy slug "${slug}" is already taken.` })
      }
      throw error
    }
  }

  async createVersion(strategyId: string, input: CreateVersionInput) {
    const [strategy] = (await this.ds.query(`SELECT id FROM app.basket_strategies WHERE id = $1`, [strategyId])) as Array<{ id: string }>
    if (!strategy) throw new NotFoundException({ code: BASKET_ERROR_CODES.STRATEGY_NOT_FOUND, message: 'Basket strategy was not found.' })
    const [row] = (await this.ds.query(
      `INSERT INTO app.basket_strategy_versions (strategy_id, version, status, methodology, scoring_weights, risk_rules)
       SELECT $1, COALESCE(MAX(version), 0) + 1, 'draft', $2::jsonb, $3::jsonb, $4::jsonb
       FROM app.basket_strategy_versions WHERE strategy_id = $1
       RETURNING id, version, status`,
      [
        strategyId,
        JSON.stringify(input.methodology ?? {}),
        JSON.stringify(input.scoringWeights ?? {}),
        JSON.stringify(input.riskRules ?? {}),
      ],
    )) as Array<Record<string, unknown>>
    return row
  }

  /**
   * 生成 Target Allocation（规格 §44-47）：
   * 候选 = 活跃 + 有行情 + 评分 ≥ 阈值 + 类别白名单（+ 排除受限合约）；
   * 权重 ∝ overall_score，总和 = 100 - cashBuffer；单资产上限迭代截断；过小权重剔除后归一。
   */
  async generateTargetAllocation(versionId: string, params: TargetAllocationParams = {}) {
    const [version] = (await this.ds.query(
      `SELECT v.id, v.strategy_id, v.status FROM app.basket_strategy_versions v WHERE v.id = $1`,
      [versionId],
    )) as Array<{ id: string; strategy_id: string; status: string }>
    if (!version) throw new NotFoundException({ code: BASKET_ERROR_CODES.STRATEGY_VERSION_NOT_FOUND, message: 'Strategy version was not found.' })

    const classes = params.assetClasses?.length ? params.assetClasses : DEFAULT_CLASSES
    const minScore = params.minScore ?? 60
    const maxAssets = Math.min(Math.max(Math.trunc(params.maxAssets ?? 12), 1), 30)
    const cashBufferPct = Math.min(Math.max(params.cashBufferPct ?? BASKET_DEFAULTS.cashBufferPct, 0), 40)
    const maxWeightPct = Math.min(Math.max(params.maxWeightPct ?? BASKET_DEFAULTS.maxAssetWeightPct, 5), 100)
    const excludeRestricted = params.excludeRestricted !== false

    const candidates = (await this.ds.query(
      `SELECT a.id, a.slug, a.name, a.asset_class, trim_scale(s.overall_score)::text AS score, s.risk_level
       FROM app.rwa_assets a
       JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = 'v1'
       JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       WHERE a.status = 'active'
         AND m.price_usd IS NOT NULL
         AND s.overall_score >= $1
         AND a.asset_class = ANY($2)
         AND ($3 = false OR NOT EXISTS (
           SELECT 1 FROM app.rwa_asset_contracts c
           WHERE c.asset_id = a.id AND (c.transfer_restricted OR c.whitelist_required)
         ))
       ORDER BY s.overall_score DESC, a.slug ASC
       LIMIT $4`,
      [minScore, classes, excludeRestricted, maxAssets],
    )) as Array<{ id: string; slug: string; name: string; asset_class: string; score: string; risk_level: string }>

    if (!candidates.length) {
      const facets = await this.getCandidateFacets({ minScore })
      const available = facets.classes
        .filter((row) => row.aboveMinScore > 0)
        .slice(0, 8)
        .map((row) => `${row.assetClass} (${row.aboveMinScore})`)
        .join(', ')
      throw new ConflictException({
        code: BASKET_ERROR_CODES.ALLOCATION_EMPTY,
        message:
          `No candidate assets matched the allocation criteria (classes=${classes.join('/')}, minScore=${minScore}). `
          + (available
            ? `The catalog currently has candidates in: ${available}. Lower minScore or widen assetClasses.`
            : `No active catalog assets satisfy minScore=${minScore} with live prices. Lower minScore or wait for the next market sync.`),
        facets,
      })
    }

    const investable = 100 - cashBufferPct
    const weights = allocateWeights(candidates.map((c) => Number(c.score)), investable, maxWeightPct)

    await this.ds.transaction(async (manager) => {
      await manager.query(`DELETE FROM app.basket_strategy_assets WHERE strategy_version_id = $1`, [versionId])
      const values: unknown[] = []
      const tuples = candidates.map((candidate, index) => {
        const base = values.length
        values.push(
          versionId,
          candidate.id,
          weights[index].toFixed(4),
          candidate.score,
          `score ${candidate.score} · ${candidate.asset_class} · ${candidate.risk_level}`,
        )
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
      })
      await manager.query(
        `INSERT INTO app.basket_strategy_assets (strategy_version_id, asset_id, target_weight_pct, score, inclusion_reason)
         VALUES ${tuples.join(', ')}`,
        values,
      )
      const allocation = JSON.stringify({
        cashBufferPct,
        investablePct: investable,
        assets: candidates.map((candidate, index) => ({
          slug: candidate.slug,
          weightPct: weights[index],
          score: Number(candidate.score),
        })),
        generatedAt: new Date().toISOString(),
      })
      await manager.query(
        `UPDATE app.basket_strategy_versions SET methodology = methodology || jsonb_build_object('targetAllocation', $2::jsonb) WHERE id = $1`,
        [versionId, allocation],
      )
    })

    return {
      versionId,
      cashBufferPct,
      assets: candidates.map((candidate, index) => ({
        assetId: candidate.id,
        slug: candidate.slug,
        name: candidate.name,
        assetClass: candidate.asset_class,
        score: Number(candidate.score),
        targetWeightPct: weights[index],
      })),
    }
  }

  async activateVersion(strategyId: string, versionId: string) {
    return this.ds.transaction(async (manager) => {
      const [target] = (await manager.query(
        `SELECT id FROM app.basket_strategy_versions WHERE id = $1 AND strategy_id = $2`,
        [versionId, strategyId],
      )) as Array<{ id: string }>
      if (!target) throw new NotFoundException({ code: BASKET_ERROR_CODES.STRATEGY_VERSION_NOT_FOUND, message: 'Strategy version was not found for this strategy.' })
      await manager.query(
        `UPDATE app.basket_strategy_versions
         SET status = 'retired', effective_to = COALESCE(effective_to, now())
         WHERE strategy_id = $1 AND status = 'active' AND id <> $2`,
        [strategyId, versionId],
      )
      const [activated] = (await manager.query(
        `UPDATE app.basket_strategy_versions
         SET status = 'active', effective_from = now(), effective_to = NULL
         WHERE id = $1 RETURNING id, version, status, effective_from AS "effectiveFrom"`,
        [versionId],
      )) as Array<Record<string, unknown>>
      await manager.query(`UPDATE app.basket_strategies SET status = 'active', updated_at = now() WHERE id = $1`, [strategyId])
      return activated
    })
  }

  async getActiveVersion(strategyId: string) {
    const [row] = (await this.ds.query(
      `SELECT id, strategy_id AS "strategyId", version, status, methodology, risk_rules AS "riskRules", scoring_weights AS "scoringWeights"
       FROM app.basket_strategy_versions WHERE strategy_id = $1 AND status = 'active' LIMIT 1`,
      [strategyId],
    )) as Array<Record<string, unknown>>
    return row ?? null
  }

  async getVersionAssets(versionId: string) {
    return this.ds.query(
      `SELECT sa.asset_id AS "assetId", a.slug, a.name, a.asset_class AS "assetClass",
              trim_scale(sa.target_weight_pct)::text AS "targetWeightPct",
              trim_scale(sa.score)::text AS score, sa.inclusion_reason AS "inclusionReason"
       FROM app.basket_strategy_assets sa
       JOIN app.rwa_assets a ON a.id = sa.asset_id
       WHERE sa.strategy_version_id = $1
       ORDER BY sa.target_weight_pct DESC`,
      [versionId],
    )
  }

  /**
   * 候选面（供管理台生成配置选择器）：按类别汇总「总量 / 有行情 / 达到评分线」的数量与最高分，
   * 让运营在生成目标配置前看清哪些类别与分数线能出候选，避免 ALLOCATION_EMPTY 盲猜。
   */
  async getCandidateFacets(params: { minScore?: number } = {}) {
    const minScore = Math.min(Math.max(Math.trunc(params.minScore ?? 60), 0), 100)
    const classes = (await this.ds.query(
      `SELECT a.asset_class AS "assetClass",
              count(*)::int AS total,
              count(*) FILTER (WHERE m.price_usd IS NOT NULL)::int AS priced,
              count(*) FILTER (WHERE s.asset_id IS NOT NULL)::int AS scored,
              count(*) FILTER (WHERE m.price_usd IS NOT NULL AND s.overall_score >= $1)::int AS "aboveMinScore",
              round(max(s.overall_score))::int AS "maxScore"
       FROM app.rwa_assets a
       LEFT JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = 'v1'
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       WHERE a.status = 'active'
       GROUP BY a.asset_class
       ORDER BY "aboveMinScore" DESC, total DESC`,
      [minScore],
    )) as Array<{ assetClass: string; total: number; priced: number; aboveMinScore: number; maxScore: number | null }>
    return {
      minScore,
      scoreVersion: 'v1',
      defaultClasses: DEFAULT_CLASSES,
      totalCandidates: classes.reduce((sum, row) => sum + row.aboveMinScore, 0),
      classes: classes.map((row) => ({ ...row, inDefaultSet: DEFAULT_CLASSES.includes(row.assetClass) })),
      generatedAt: new Date().toISOString(),
    }
  }

  async listStrategies() {
    return this.ds.query(
      `SELECT s.id, s.slug, s.name, s.status, s.risk_level AS "riskLevel", s.rebalance_mode AS "rebalanceMode",
              s.rebalance_frequency AS "rebalanceFrequency", s.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM app.basket_strategy_versions v WHERE v.strategy_id = s.id) AS "versionCount",
              (SELECT COUNT(*)::int FROM app.basket_portfolios p WHERE p.strategy_id = s.id) AS "portfolioCount"
       FROM app.basket_strategies s ORDER BY s.created_at DESC`,
    )
  }

  async getStrategyDetail(slug: string) {
    const [strategy] = (await this.ds.query(
      `SELECT id, slug, name, description, status, risk_level AS "riskLevel", benchmark,
              rebalance_mode AS "rebalanceMode", rebalance_frequency AS "rebalanceFrequency",
              trim_scale(minimum_subscription_usd)::text AS "minimumSubscriptionUsd",
              trim_scale(minimum_redemption_usd)::text AS "minimumRedemptionUsd",
              trim_scale(cash_buffer_target_pct)::text AS "cashBufferTargetPct"
       FROM app.basket_strategies WHERE slug = $1`,
      [slug],
    )) as Array<Record<string, any>>
    if (!strategy) throw new NotFoundException({ code: BASKET_ERROR_CODES.STRATEGY_NOT_FOUND, message: 'Basket strategy was not found.' })
    const versions = (await this.ds.query(
      `SELECT id, version, status, effective_from AS "effectiveFrom", effective_to AS "effectiveTo", methodology
       FROM app.basket_strategy_versions WHERE strategy_id = $1 ORDER BY version DESC`,
      [strategy.id],
    )) as Array<Record<string, any>>
    const active = versions.find((v) => v.status === 'active')
    const assets = active ? await this.getVersionAssets(active.id as string) : []
    return { ...strategy, versions, activeVersion: active ?? null, targetAllocation: assets }
  }
}

/**
 * 权重分配（确定性）：
 * 1) w_i ∝ score_i，总和 = investable
 * 2) 超过 maxWeightPct 的权重截断，超额按比例回填（迭代 ≤ 6 轮）
 * 3) 剔除 < 0.5% 的尾项并对剩余归一
 * 4) 余数修正到最大权重项，保证总和精确 = investable（4 位小数）
 */
export function allocateWeights(scores: number[], investable: number, maxWeightPct: number): number[] {
  const total = scores.reduce((sum, score) => sum + score, 0)
  if (total <= 0) throw new Error('allocateWeights: scores must be positive')
  let weights = scores.map((score) => (score / total) * investable)

  for (let round = 0; round < 6; round += 1) {
    const capped = weights.map((weight) => Math.min(weight, maxWeightPct))
    const excess = investable - capped.reduce((sum, weight) => sum + weight, 0)
    if (excess <= 1e-9) {
      weights = capped
      break
    }
    const uncapped = weights.map((weight, index) => (weight >= maxWeightPct ? 0 : scores[index])).reduce((a, b) => a + b, 0)
    if (uncapped <= 0) {
      weights = capped
      break
    }
    weights = weights.map((weight, index) =>
      weight >= maxWeightPct ? maxWeightPct : weight + (excess * (scores[index] / uncapped)),
    )
  }

  // 剔除尾项并归一
  const filtered = weights.map((weight) => (weight < 0.5 ? 0 : weight))
  const filteredTotal = filtered.reduce((sum, weight) => sum + weight, 0)
  let final = filtered.map((weight) => (weight === 0 ? 0 : (weight / filteredTotal) * investable))
  final = final.map((weight) => Math.min(weight, maxWeightPct))

  // 余数修正（保证 4 位小数时总和精确）
  const rounded = final.map((weight) => Math.round(weight * 10_000) / 10_000)
  const drift = Math.round((investable - rounded.reduce((sum, weight) => sum + weight, 0)) * 10_000) / 10_000
  if (Math.abs(drift) > 0) {
    const maxIndex = rounded.indexOf(Math.max(...rounded))
    rounded[maxIndex] = Math.round((rounded[maxIndex] + drift) * 10_000) / 10_000
  }
  return rounded
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505'
}
