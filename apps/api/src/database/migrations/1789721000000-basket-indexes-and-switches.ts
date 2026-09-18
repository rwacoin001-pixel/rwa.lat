import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * RWA Basket Phase 5+ 支撑：
 * - 公开 API 排序/筛选所需索引（行情、评分、资产状态）
 * - basket.* 能力开关（默认关闭，沿用现有 operational_switches 体系，不新增资金总开关）
 */
export class BasketIndexesAndSwitches1789721000000 implements MigrationInterface {
  name = 'BasketIndexesAndSwitches1789721000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.rwa_issuers ADD COLUMN IF NOT EXISTS token_count int NOT NULL DEFAULT 0;
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS rwa_assets_status_class_idx
        ON app.rwa_assets (status, asset_class);
      CREATE INDEX IF NOT EXISTS rwa_assets_featured_idx
        ON app.rwa_assets (is_featured) WHERE is_featured = true;
      CREATE INDEX IF NOT EXISTS rwa_asset_metrics_mcap_idx
        ON app.rwa_asset_metrics (market_cap_usd DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS rwa_asset_metrics_tvl_idx
        ON app.rwa_asset_metrics (tvl_usd DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS rwa_asset_metrics_volume_idx
        ON app.rwa_asset_metrics (volume_24h_usd DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS rwa_asset_scores_asset_calc_idx
        ON app.rwa_asset_scores (asset_id, calculated_at DESC);
      CREATE INDEX IF NOT EXISTS basket_holdings_portfolio_idx
        ON app.basket_holdings (portfolio_id);
      CREATE INDEX IF NOT EXISTS basket_strategy_assets_version_idx
        ON app.basket_strategy_assets (strategy_version_id);
    `)

    await queryRunner.query(`
      INSERT INTO app.operational_switches (switch_key, enabled, reason)
      VALUES
        ('basket.subscriptions', false, 'AI Basket 申购（默认关闭；挂现有资金开关体系）'),
        ('basket.redemptions', false, 'AI Basket 赎回（默认关闭；挂现有资金开关体系）'),
        ('basket.rebalance.execution', false, 'AI Basket 调仓执行（默认关闭；计划生成不受限）')
      ON CONFLICT (switch_key) DO NOTHING
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.rwa_issuers DROP COLUMN IF EXISTS token_count;
    `)
    await queryRunner.query(`
      DELETE FROM app.operational_switches
      WHERE switch_key IN ('basket.subscriptions', 'basket.redemptions', 'basket.rebalance.execution')
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.basket_strategy_assets_version_idx;
      DROP INDEX IF EXISTS app.basket_holdings_portfolio_idx;
      DROP INDEX IF EXISTS app.rwa_asset_scores_asset_calc_idx;
      DROP INDEX IF EXISTS app.rwa_asset_metrics_volume_idx;
      DROP INDEX IF EXISTS app.rwa_asset_metrics_tvl_idx;
      DROP INDEX IF EXISTS app.rwa_asset_metrics_mcap_idx;
      DROP INDEX IF EXISTS app.rwa_assets_featured_idx;
      DROP INDEX IF EXISTS app.rwa_assets_status_class_idx;
    `)
  }
}
