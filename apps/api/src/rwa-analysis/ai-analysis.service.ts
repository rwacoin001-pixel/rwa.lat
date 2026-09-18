import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { AiAnalysisProvider, type AiAnalysisPayload } from './ai-analysis.provider'

export const AI_ANALYSIS_VERSION = 'v1'
const ANALYSIS_FRESH_DAYS = 7

export const RWA_ANALYSIS_ERROR_CODES = {
  AI_NOT_CONFIGURED: 'RWA_AI_NOT_CONFIGURED',
} as const

/** AI 研究分析服务（规格 §29-37）：批量生成 → rwa_ai_analysis；AI 仅产出研究文本，不控制交易 */
@Injectable()
export class AiAnalysisService {
  private readonly log = new Logger(AiAnalysisService.name)

  constructor(
    private readonly ds: DataSource,
    private readonly provider: AiAnalysisProvider,
  ) {}

  /** 批量分析（优先高分/高排名且 7 天内无新分析的资产） */
  async runBatch(limit = 10): Promise<{ analyzed: number; failed: number; skipped: number }> {
    if (!this.provider.isConfigured()) {
      throw new BadRequestException({
        code: RWA_ANALYSIS_ERROR_CODES.AI_NOT_CONFIGURED,
        message: 'RWA AI provider is not configured.',
      })
    }
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50)
    const rows = (await this.ds.query(
      `SELECT a.id AS asset_id, a.slug, a.name, a.symbol, a.asset_class, a.description,
              i.name AS issuer_name,
              trim_scale(m.price_usd)::text AS price_usd,
              trim_scale(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd))::text AS market_cap_usd,
              trim_scale(m.volume_24h_usd)::text AS volume_24h_usd,
              trim_scale(m.apy)::text AS apy,
              trim_scale(m.change_30d_pct)::text AS change_30d_pct,
              s.overall_score::text AS overall_score, s.risk_level,
              s.yield_score::text AS yield_score, s.liquidity_score::text AS liquidity_score
       FROM app.rwa_assets a
       JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       LEFT JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = 'v1'
       LEFT JOIN LATERAL (
         SELECT 1 FROM app.rwa_ai_analysis ai
         WHERE ai.asset_id = a.id AND ai.generated_at > now() - make_interval(days => $2::int)
         LIMIT 1
       ) fresh ON true
       WHERE a.status = 'active' AND fresh IS NULL
         AND trim_scale(m.price_usd) IS NOT NULL
       ORDER BY a.rwa_rank ASC NULLS LAST
       LIMIT $1`,
      [boundedLimit, ANALYSIS_FRESH_DAYS],
    )) as Array<Record<string, any>>

    let analyzed = 0
    let failed = 0
    for (const row of rows) {
      try {
        const payload = await this.provider.analyze({
          name: row.name as string,
          symbol: (row.symbol as string) ?? null,
          assetClass: row.asset_class as string,
          issuerName: (row.issuer_name as string) ?? null,
          description: (row.description as string) ?? null,
          metrics: {
            price_usd: row.price_usd,
            market_cap_usd: row.market_cap_usd,
            volume_24h_usd: row.volume_24h_usd,
            apy: row.apy,
            change_30d_pct: row.change_30d_pct,
          },
          score: row.overall_score
            ? { overall: row.overall_score, risk_level: row.risk_level, yield: row.yield_score, liquidity: row.liquidity_score }
            : null,
        })
        await this.store(row.asset_id as string, payload)
        analyzed += 1
      } catch (error) {
        failed += 1
        this.log.warn(`AI analysis failed for ${row.slug}: ${(error as Error).message}`)
      }
    }
    return { analyzed, failed, skipped: 0 }
  }

  async analyzeAssetBySlug(slug: string): Promise<{ analyzed: boolean }> {
    if (!this.provider.isConfigured()) {
      throw new BadRequestException({
        code: RWA_ANALYSIS_ERROR_CODES.AI_NOT_CONFIGURED,
        message: 'RWA AI provider is not configured.',
      })
    }
    const rows = (await this.ds.query(
      `SELECT a.id AS asset_id, a.name, a.symbol, a.asset_class, a.description, i.name AS issuer_name,
              trim_scale(m.price_usd)::text AS price_usd,
              trim_scale(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd))::text AS market_cap_usd,
              trim_scale(m.volume_24h_usd)::text AS volume_24h_usd,
              trim_scale(m.apy)::text AS apy,
              trim_scale(m.change_30d_pct)::text AS change_30d_pct,
              s.overall_score::text AS overall_score, s.risk_level,
              s.yield_score::text AS yield_score, s.liquidity_score::text AS liquidity_score
       FROM app.rwa_assets a
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       LEFT JOIN app.rwa_asset_scores s ON s.asset_id = a.id AND s.score_version = 'v1'
       WHERE a.slug = $1`,
      [slug],
    )) as Array<Record<string, any>>
    const row = rows[0]
    if (!row) throw new BadRequestException({ code: 'RWA_ASSET_NOT_FOUND', message: 'RWA asset was not found.' })
    const payload = await this.provider.analyze({
      name: row.name as string,
      symbol: (row.symbol as string) ?? null,
      assetClass: row.asset_class as string,
      issuerName: (row.issuer_name as string) ?? null,
      description: (row.description as string) ?? null,
      metrics: {
        price_usd: row.price_usd,
        market_cap_usd: row.market_cap_usd,
        volume_24h_usd: row.volume_24h_usd,
        apy: row.apy,
        change_30d_pct: row.change_30d_pct,
      },
      score: row.overall_score
        ? { overall: row.overall_score, risk_level: row.risk_level, yield: row.yield_score, liquidity: row.liquidity_score }
        : null,
    })
    await this.store(row.asset_id as string, payload)
    return { analyzed: true }
  }

  private async store(assetId: string, payload: AiAnalysisPayload): Promise<void> {
    await this.ds.query(
      `INSERT INTO app.rwa_ai_analysis
         (asset_id, model, analysis_version, summary, bull_case, bear_case, risk_summary,
          liquidity_analysis, issuer_analysis, redemption_analysis, contract_analysis,
          structured_signals, input_data_timestamp, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
               (SELECT data_timestamp FROM app.rwa_asset_metrics WHERE asset_id = $1), now())`,
      [
        assetId,
        this.provider.model,
        AI_ANALYSIS_VERSION,
        payload.summary,
        payload.bull_case,
        payload.bear_case,
        payload.risk_summary,
        payload.liquidity_analysis,
        payload.issuer_analysis,
        payload.redemption_analysis,
        payload.contract_analysis,
        JSON.stringify(payload.structured_signals ?? {}),
      ],
    )
  }

  async getLatestForAsset(assetId: string) {
    const rows = await this.ds.query(
      `SELECT model, analysis_version AS "analysisVersion", summary, bull_case AS "bullCase",
              bear_case AS "bearCase", risk_summary AS "riskSummary", structured_signals AS "structuredSignals",
              generated_at AS "generatedAt"
       FROM app.rwa_ai_analysis WHERE asset_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [assetId],
    )
    return rows[0] ?? null
  }

  async listRecent(limit = 20) {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 100)
    return this.ds.query(
      `SELECT ai.id, a.slug, a.name, ai.model, ai.summary, ai.structured_signals AS "structuredSignals",
              ai.generated_at AS "generatedAt"
       FROM app.rwa_ai_analysis ai JOIN app.rwa_assets a ON a.id = ai.asset_id
       ORDER BY ai.generated_at DESC LIMIT $1`,
      [bounded],
    )
  }
}
