import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { RwaMarketQueryService, type ListAssetsParams } from '../rwa-market/rwa-market.query.service'

function clampLimit(value: number | undefined, fallback = 100): number {
  const n = value === undefined || !Number.isFinite(value) ? fallback : Math.trunc(value)
  return Math.min(Math.max(n, 1), 200)
}

/**
 * 管理台运营数据域（只读列表查询）：
 * 订单 / KYC / 风控标记 / 适当性 / 收益批次 / 预测结算 / 资产目录 / AI 分析 / 预测市场 / 网络 / 充值归集。
 * 由 admin 控制台经服务通道（AdminSessionGuard + x-actor-admin-id）调用；本服务全部只读、参数化查询。
 */
@Injectable()
export class AdminConsoleService {
  constructor(
    private readonly ds: DataSource,
    private readonly market: RwaMarketQueryService,
  ) {}

  async listOrders(params: { state?: string; limit?: number }) {
    return this.ds.query(
      `SELECT o.id, o.user_id AS "userId", o.product_id AS "productId", p.display_name AS "productName",
              o.side, o.state, o.outcome_key AS "outcomeKey", o.settlement_asset_code AS "settlementAssetCode",
              trim_scale(o.requested_atomic_amount)::text AS "requestedAtomicAmount",
              trim_scale(o.filled_atomic_amount)::text AS "filledAtomicAmount",
              trim_scale(o.unit_price_atomic_amount)::text AS "unitPriceAtomicAmount",
              o.failure_reason AS "failureReason",
              o.submitted_at AS "submittedAt", o.completed_at AS "completedAt"
       FROM app.orders o
       LEFT JOIN app.products p ON p.id = o.product_id
       WHERE ($1::text IS NULL OR o.state = $1)
       ORDER BY o.submitted_at DESC
       LIMIT $2`,
      [params.state?.trim() || null, clampLimit(params.limit)],
    )
  }

  async listKycCases(params: { state?: string; limit?: number }) {
    return this.ds.query(
      `SELECT k.id, k.user_id AS "userId", k.state, k.provider, k.reason_code AS "reasonCode",
              k.submitted_at AS "submittedAt", k.decided_at AS "decidedAt", k.expires_at AS "expiresAt",
              k.created_at AS "createdAt"
       FROM app.kyc_cases k
       WHERE ($1::text IS NULL OR k.state = $1)
       ORDER BY k.created_at DESC
       LIMIT $2`,
      [params.state?.trim() || null, clampLimit(params.limit)],
    )
  }

  async listRiskFlags(params: { state?: string; limit?: number }) {
    return this.ds.query(
      `SELECT r.id, r.user_id AS "userId", r.category, r.severity, r.state, r.source,
              r.reason_code AS "reasonCode", r.opened_at AS "openedAt", r.resolved_at AS "resolvedAt"
       FROM app.risk_flags r
       WHERE ($1::text IS NULL OR r.state = $1)
       ORDER BY r.opened_at DESC
       LIMIT $2`,
      [params.state?.trim() || null, clampLimit(params.limit)],
    )
  }

  async listEligibility(params: { limit?: number }) {
    return this.ds.query(
      `SELECT e.id, e.user_id AS "userId", e.policy_version AS "policyVersion", e.product_scope AS "productScope",
              e.decision, e.reason_codes AS "reasonCodes", e.decided_at AS "decidedAt", e.expires_at AS "expiresAt"
       FROM app.eligibility_profiles e
       ORDER BY e.decided_at DESC
       LIMIT $1`,
      [clampLimit(params.limit)],
    )
  }

  async listYieldBatches(params: { state?: string; limit?: number }) {
    return this.ds.query(
      `SELECT yb.id, yb.product_id AS "productId", p.display_name AS "productName",
              yb.asset_code AS "assetCode", trim_scale(yb.total_atomic_amount)::text AS "totalAtomicAmount",
              yb.state, yb.period_start AS "periodStart", yb.period_end AS "periodEnd",
              yb.approved_at AS "approvedAt", yb.executed_at AS "executedAt", yb.created_at AS "createdAt",
              (SELECT count(*)::int FROM app.yield_allocations ya WHERE ya.batch_id = yb.id) AS "allocationCount",
              COALESCE((SELECT trim_scale(sum(ya.atomic_amount))::text FROM app.yield_allocations ya
                         WHERE ya.batch_id = yb.id AND ya.state = 'credited'), '0') AS "creditedAtomicAmount"
       FROM app.yield_batches yb
       LEFT JOIN app.products p ON p.id = yb.product_id
       WHERE ($1::text IS NULL OR yb.state = $1)
       ORDER BY yb.created_at DESC
       LIMIT $2`,
      [params.state?.trim() || null, clampLimit(params.limit)],
    )
  }

  async listSettlements(params: { limit?: number }) {
    return this.ds.query(
      `SELECT ps.id, ps.product_id AS "productId", p.display_name AS "productName",
              ps.outcome_key AS "outcomeKey", ps.request_id AS "requestId", ps.settled_at AS "settledAt"
       FROM app.prediction_settlements ps
       LEFT JOIN app.products p ON p.id = ps.product_id
       ORDER BY ps.settled_at DESC
       LIMIT $1`,
      [clampLimit(params.limit)],
    )
  }

  listAssets(params: ListAssetsParams) {
    return this.market.listAssets(params)
  }

  async listAiAnalysis(params: { limit?: number }) {
    return this.ds.query(
      `SELECT ai.id, ai.asset_id AS "assetId", a.slug AS "assetSlug", a.name AS "assetName",
              ai.model, ai.analysis_version AS "analysisVersion", left(ai.summary, 500) AS summary,
              ai.generated_at AS "generatedAt"
       FROM app.rwa_ai_analysis ai
       LEFT JOIN app.rwa_assets a ON a.id = ai.asset_id
       ORDER BY ai.generated_at DESC
       LIMIT $1`,
      [clampLimit(params.limit)],
    )
  }

  async polymarketStats() {
    const [counts] = (await this.ds.query(
      `SELECT
         (SELECT count(*)::int FROM app.polymarket_market_mappings) AS "markets",
         (SELECT count(*)::int FROM app.polymarket_token_mappings) AS "tokens",
         (SELECT count(*)::int FROM app.polymarket_order_mappings) AS "orders",
         (SELECT count(*)::int FROM app.polymarket_settlement_mappings) AS "settlements"`,
    )) as Array<Record<string, number>>
    const watermarks = await this.ds.query(
      `SELECT provider, stream, state, cursor, last_event_at AS "lastEventAt", last_success_at AS "lastSuccessAt",
              consecutive_failures AS "consecutiveFailures", last_error_code AS "lastErrorCode", updated_at AS "updatedAt"
       FROM app.polymarket_sync_watermarks
       ORDER BY provider, stream`,
    )
    return { counts, watermarks }
  }

  listNetworks() {
    return this.market.listNetworks()
  }

  async listCollections(params: { state?: string; limit?: number }) {
    const [stats] = (await this.ds.query(
      `SELECT
         count(*)::int AS "total",
         count(*) FILTER (WHERE state = 'credited')::int AS "credited",
         count(*) FILTER (WHERE state <> 'credited')::int AS "pending",
         COALESCE(SUM(atomic_amount) FILTER (WHERE state = 'credited'), 0)::text AS "creditedAtomicTotal"
       FROM app.deposits`,
    )) as Array<Record<string, unknown>>
    const recent = await this.ds.query(
      `SELECT d.id, d.user_id AS "userId", d.asset_code AS "assetCode",
              trim_scale(d.atomic_amount)::text AS "atomicAmount", d.state,
              d.detected_at AS "detectedAt", d.credited_at AS "creditedAt"
       FROM app.deposits d
       WHERE ($1::text IS NULL OR d.state = $1)
       ORDER BY d.detected_at DESC
       LIMIT $2`,
      [params.state?.trim() || null, clampLimit(params.limit)],
    )
    return { stats, recent }
  }
}
