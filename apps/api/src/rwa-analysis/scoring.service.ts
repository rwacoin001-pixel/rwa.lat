import { Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'

export const SCORE_VERSION = 'v1'

/**
 * 量化评分引擎（规格 §20-28；确定性规则，非 LLM 主观打分）：
 * - 8 个可计算维度 + 组合级 concentration（资产级留空，组合风控引擎计算）
 * - overall = 加权平均（权重 w1：yield 18 / liquidity 18 / issuer 14 / collateral 16 /
 *   redemption 10 / contract 8 / market 8 / data 8）
 * - risk_level：overall ≥75 low / ≥60 medium / ≥45 high / else critical
 * - 幂等：UNIQUE (asset_id, score_version) upsert，重算更新时间戳
 */
export const SCORE_WEIGHTS = {
  yield: 18,
  liquidity: 18,
  issuer: 14,
  collateral: 16,
  redemption: 10,
  contract: 8,
  market: 8,
  data: 8,
} as const

export type ScoreInput = {
  assetId: string
  assetClass: string
  isTokenized: boolean
  redemptionType: string
  hasIssuer: boolean
  issuerVerified: boolean
  issuerTokenCount: number
  issuerHasWebsite: boolean
  contractTransferRestricted: boolean | null
  contractWhitelistRequired: boolean | null
  hasContractRows: boolean
  priceUsd: string | null
  marketCapUsd: string | null
  volume24hUsd: string | null
  apy: string | null
  change24hPct: string | null
  change7dPct: string | null
  change30dPct: string | null
  dataTimestamp: Date | null
}

export type ScoreResult = {
  yieldScore: number
  liquidityScore: number
  issuerScore: number
  collateralScore: number
  redemptionScore: number
  contractRiskScore: number
  concentrationScore: null
  marketRiskScore: number
  dataQualityScore: number
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

const COLLATERAL_BY_CLASS: Record<string, number> = {
  treasury: 92,
  money_market: 88,
  stable_value: 80,
  bond: 72,
  currency: 70,
  commodity: 62,
  fund: 58,
  equity: 55,
  real_estate: 55,
  private_credit: 45,
  other: 40,
}

const REDEMPTION_SCORES: Record<string, number> = {
  instant: 95,
  daily: 80,
  periodic: 65,
  restricted: 30,
  unknown: 50,
}

function num(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampScore(value: number): number {
  return Math.min(Math.max(value, 0), 100)
}

export function scoreYield(apy: string | null): number {
  const value = num(apy)
  if (value === null) return 50
  if (value < 0) return 20
  if (value < 1) return 45
  if (value < 2) return 55
  if (value < 4) return 70
  if (value < 6) return 82
  if (value < 8) return 90
  return 95
}

export function scoreLiquidity(volume24hUsd: string | null): number {
  const value = num(volume24hUsd)
  if (value === null || value <= 0) return 40
  if (value < 100_000) return 25
  if (value < 1_000_000) return 45
  if (value < 5_000_000) return 60
  if (value < 20_000_000) return 75
  if (value < 100_000_000) return 88
  return 95
}

export function scoreIssuer(input: Pick<ScoreInput, 'hasIssuer' | 'issuerVerified' | 'issuerTokenCount' | 'issuerHasWebsite'>): number {
  if (!input.hasIssuer) return 35
  let score = 55
  if (input.issuerTokenCount >= 1) score += 10
  if (input.issuerTokenCount >= 20) score += 10
  if (input.issuerHasWebsite) score += 5
  if (input.issuerVerified) score += 10
  return clampScore(score)
}

export function scoreCollateral(assetClass: string): number {
  return COLLATERAL_BY_CLASS[assetClass] ?? 40
}

export function scoreRedemption(redemptionType: string): number {
  return REDEMPTION_SCORES[redemptionType] ?? 50
}

export function scoreContractRisk(input: Pick<ScoreInput, 'isTokenized' | 'hasContractRows' | 'contractTransferRestricted' | 'contractWhitelistRequired'>): number {
  if (!input.isTokenized) return 85 // 无代币敞口
  if (!input.hasContractRows) return 60 // 代币存在但合约信息未知
  let score = 70
  if (input.contractTransferRestricted === true) score = Math.min(score, 45)
  if (input.contractWhitelistRequired === true) score = Math.min(score, 40)
  return score
}

export function scoreMarketRisk(change30dPct: string | null, change7dPct: string | null, change24hPct: string | null): number {
  const c30 = num(change30dPct)
  const c7 = num(change7dPct)
  const c1 = num(change24hPct)
  const magnitude = Math.max(c30 === null ? -1 : Math.abs(c30), c7 === null ? -1 : Math.abs(c7), c1 === null ? -1 : Math.abs(c1))
  if (magnitude < 0) return 50 // 无波动数据
  if (magnitude < 1) return 95
  if (magnitude < 3) return 85
  if (magnitude < 7) return 70
  if (magnitude < 15) return 55
  if (magnitude < 30) return 40
  return 25
}

export function scoreDataQuality(input: ScoreInput, now = new Date()): number {
  let score = 0
  if (num(input.priceUsd) !== null) score += 20
  if (num(input.volume24hUsd) !== null) score += 15
  if (num(input.marketCapUsd) !== null) score += 15
  if (num(input.apy) !== null) score += 10
  if (num(input.change30dPct) !== null) score += 10
  if (input.dataTimestamp) {
    const ageMs = now.getTime() - input.dataTimestamp.getTime()
    const ageHours = ageMs / 3_600_000
    if (ageHours <= 24) score += 20
    else if (ageHours <= 72) score += 12
    else score += 5
  }
  score += 10 // 数据来源 ≥1（当前仅 coinmarketcap）
  return clampScore(score)
}

export function computeScore(input: ScoreInput, now = new Date()): ScoreResult {
  const yieldScore = scoreYield(input.apy)
  const liquidityScore = scoreLiquidity(input.volume24hUsd)
  const issuerScore = scoreIssuer(input)
  const collateralScore = scoreCollateral(input.assetClass)
  const redemptionScore = scoreRedemption(input.redemptionType)
  const contractRiskScore = scoreContractRisk(input)
  const marketRiskScore = scoreMarketRisk(input.change30dPct, input.change7dPct, input.change24hPct)
  const dataQualityScore = scoreDataQuality(input, now)

  const weighted =
    yieldScore * SCORE_WEIGHTS.yield +
    liquidityScore * SCORE_WEIGHTS.liquidity +
    issuerScore * SCORE_WEIGHTS.issuer +
    collateralScore * SCORE_WEIGHTS.collateral +
    redemptionScore * SCORE_WEIGHTS.redemption +
    contractRiskScore * SCORE_WEIGHTS.contract +
    marketRiskScore * SCORE_WEIGHTS.market +
    dataQualityScore * SCORE_WEIGHTS.data
  const overallScore = Math.round((weighted / 100) * 100) / 100
  const riskLevel = overallScore >= 75 ? 'low' : overallScore >= 60 ? 'medium' : overallScore >= 45 ? 'high' : 'critical'

  return {
    yieldScore,
    liquidityScore,
    issuerScore,
    collateralScore,
    redemptionScore,
    contractRiskScore,
    concentrationScore: null,
    marketRiskScore,
    dataQualityScore,
    overallScore,
    riskLevel,
  }
}

@Injectable()
export class ScoringService {
  private readonly log = new Logger(ScoringService.name)

  constructor(private readonly ds: DataSource) {}

  /** 批量评分（跳过 12h 内已算过的资产；幂等 upsert） */
  async runBatch(limit = 500): Promise<{ scored: number; scanned: number }> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 5000)
    const rows = (await this.ds.query(
      `SELECT a.id AS asset_id, a.asset_class, a.is_tokenized, a.redemption_type,
              i.id AS issuer_id, i.verified AS issuer_verified, i.token_count AS issuer_token_count,
              (i.website_url IS NOT NULL) AS issuer_has_website,
              c.contract_count, c.transfer_restricted, c.whitelist_required,
              trim_scale(m.price_usd)::text AS price_usd,
              trim_scale(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd))::text AS market_cap_usd,
              trim_scale(m.volume_24h_usd)::text AS volume_24h_usd,
              trim_scale(m.apy)::text AS apy,
              trim_scale(m.change_24h_pct)::text AS change_24h_pct,
              trim_scale(m.change_7d_pct)::text AS change_7d_pct,
              trim_scale(m.change_30d_pct)::text AS change_30d_pct,
              m.data_timestamp
       FROM app.rwa_assets a
       JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS contract_count,
                bool_or(ct.transfer_restricted) AS transfer_restricted,
                bool_or(ct.whitelist_required) AS whitelist_required
         FROM app.rwa_asset_contracts ct WHERE ct.asset_id = a.id
       ) c ON true
       LEFT JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = $1
       WHERE a.status = 'active'
         AND (s.id IS NULL OR s.calculated_at < now() - interval '12 hours')
       ORDER BY a.rwa_rank ASC NULLS LAST, a.slug ASC
       LIMIT $2`,
      [SCORE_VERSION, boundedLimit],
    )) as Array<Record<string, any>>

    if (!rows.length) return { scored: 0, scanned: 0 }

    const now = new Date()
    const results = rows.map((row) => ({
      assetId: row.asset_id as string,
      result: computeScore(
        {
          assetId: row.asset_id as string,
          assetClass: row.asset_class as string,
          isTokenized: row.is_tokenized === true,
          redemptionType: (row.redemption_type as string) ?? 'unknown',
          hasIssuer: !!row.issuer_id,
          issuerVerified: row.issuer_verified === true,
          issuerTokenCount: Number(row.issuer_token_count ?? 0),
          issuerHasWebsite: row.issuer_has_website === true,
          contractTransferRestricted: row.transfer_restricted ?? null,
          contractWhitelistRequired: row.whitelist_required ?? null,
          hasContractRows: Number(row.contract_count ?? 0) > 0,
          priceUsd: row.price_usd,
          marketCapUsd: row.market_cap_usd,
          volume24hUsd: row.volume_24h_usd,
          apy: row.apy,
          change24hPct: row.change_24h_pct,
          change7dPct: row.change_7d_pct,
          change30dPct: row.change_30d_pct,
          dataTimestamp: row.data_timestamp ? new Date(row.data_timestamp) : null,
        },
        now,
      ),
    }))

    // 分块 upsert（13 参数/行）
    const CHUNK = 200
    for (let i = 0; i < results.length; i += CHUNK) {
      const part = results.slice(i, i + CHUNK)
      const values: unknown[] = []
      const tuples = part.map(({ assetId, result }) => {
        const base = values.length
        values.push(
          assetId,
          SCORE_VERSION,
          result.yieldScore.toFixed(2),
          result.liquidityScore.toFixed(2),
          result.issuerScore.toFixed(2),
          result.collateralScore.toFixed(2),
          result.redemptionScore.toFixed(2),
          result.contractRiskScore.toFixed(2),
          null,
          result.marketRiskScore.toFixed(2),
          result.dataQualityScore.toFixed(2),
          result.overallScore.toFixed(2),
          result.riskLevel,
        )
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, now())`
      })
      await this.ds.query(
        `INSERT INTO app.rwa_asset_scores
           (asset_id, score_version, yield_score, liquidity_score, issuer_score, collateral_score,
            redemption_score, contract_risk_score, concentration_score, market_risk_score,
            data_quality_score, overall_score, risk_level, calculated_at)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (asset_id, score_version) DO UPDATE SET
           yield_score = EXCLUDED.yield_score,
           liquidity_score = EXCLUDED.liquidity_score,
           issuer_score = EXCLUDED.issuer_score,
           collateral_score = EXCLUDED.collateral_score,
           redemption_score = EXCLUDED.redemption_score,
           contract_risk_score = EXCLUDED.contract_risk_score,
           concentration_score = EXCLUDED.concentration_score,
           market_risk_score = EXCLUDED.market_risk_score,
           data_quality_score = EXCLUDED.data_quality_score,
           overall_score = EXCLUDED.overall_score,
           risk_level = EXCLUDED.risk_level,
           calculated_at = now()`,
        values,
      )
    }
    this.log.log(`Scoring batch: ${results.length}/${rows.length} assets scored (${SCORE_VERSION})`)
    return { scored: results.length, scanned: rows.length }
  }

  async getLatestForAsset(assetId: string) {
    const rows = await this.ds.query(
      `SELECT score_version AS "scoreVersion", yield_score AS "yieldScore", liquidity_score AS "liquidityScore",
              issuer_score AS "issuerScore", collateral_score AS "collateralScore", redemption_score AS "redemptionScore",
              contract_risk_score AS "contractRiskScore", concentration_score AS "concentrationScore",
              market_risk_score AS "marketRiskScore", data_quality_score AS "dataQualityScore",
              overall_score AS "overallScore", risk_level AS "riskLevel", calculated_at AS "calculatedAt"
       FROM app.rwa_asset_scores WHERE asset_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
      [assetId],
    )
    return rows[0] ?? null
  }

  /** 供组合/策略使用的按 slug 批量取分（含资产基本信息） */
  async getScoresBySlugs(slugs: string[]): Promise<Array<Record<string, any>>> {
    if (!slugs.length) return []
    return this.ds.query(
      `SELECT a.id AS "assetId", a.slug, a.name, a.asset_class AS "assetClass", a.issuer_id AS "issuerId",
              trim_scale(s.overall_score)::text AS "overallScore", s.risk_level AS "riskLevel",
              trim_scale(s.yield_score)::text AS "yieldScore", trim_scale(s.liquidity_score)::text AS "liquidityScore",
              trim_scale(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd))::text AS "marketCapUsd",
              trim_scale(m.volume_24h_usd)::text AS "volume24hUsd"
       FROM app.rwa_assets a
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = $2
       WHERE a.slug = ANY($1)`,
      [slugs, SCORE_VERSION],
    )
  }
}
