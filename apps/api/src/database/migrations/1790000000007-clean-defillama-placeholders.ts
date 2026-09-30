import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * The S1 DefiLlama import stored two placeholders as if they were data:
 *  · symbol '-' for protocols without a ticker (upstream sends '-').
 *  · volume_24h_usd = market_cap_usd × 0.01 — DefiLlama /protocols has no volume field.
 * Both become NULL so the UI and liquidity scoring treat them as unknown.
 */
export class CleanDefillamaPlaceholders1790000000007 implements MigrationInterface {
  name = 'CleanDefillamaPlaceholders1790000000007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE app.rwa_assets SET symbol = NULL WHERE btrim(symbol) ~ '^[-–—]*$'`)
    await queryRunner.query(`
      UPDATE app.rwa_asset_metrics
      SET volume_24h_usd = NULL, updated_at = now()
      WHERE source = 'defillama'
        AND volume_24h_usd IS NOT NULL
        AND market_cap_usd > 0
        AND volume_24h_usd = market_cap_usd * 0.01
    `)
    await queryRunner.query(`
      UPDATE app.rwa_asset_metric_history h
      SET volume_24h_usd = NULL
      FROM app.rwa_asset_metrics m
      WHERE m.asset_id = h.asset_id
        AND m.source = 'defillama'
        AND h.volume_24h_usd IS NOT NULL
        AND COALESCE(h.market_cap_usd, h.tvl_usd) > 0
        AND h.volume_24h_usd = COALESCE(h.market_cap_usd, h.tvl_usd) * 0.01
    `)
  }

  public async down(): Promise<void> {
    // Data cleanup only: the removed values were synthetic and are not restored.
  }
}
