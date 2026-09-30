import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 预测市场内部盘 · 第 1+2 期：
 *
 * 1. 收费（A+C 混合）：prediction_bets 增加下注费 / 派彩费留痕字段，
 *    prediction_settlement_runs 增加结算抽费合计。
 * 2. 新建平台手续费收入账户（platform / prediction_fee / fee_revenue）。
 * 3. 放开投注池账户的负余额限制 —— 庄家盘必须能记录赔穿（净负 = 平台亏损），
 *    否则"冷门赢"时派彩分录会被账本触发器拒绝、整个结算回滚卡死。
 * 4. 新建对冲决策表（第 2 期干跑用），记录每个市场应下的对冲单及敞口前后快照。
 */
export class PredictionFeesAndHedging1790000000026 implements MigrationInterface {
  name = 'PredictionFeesAndHedging1790000000026'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. 费用留痕字段 -------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE app.prediction_bets
        ADD COLUMN fee_atomic numeric(78, 0) NOT NULL DEFAULT 0
          CHECK (fee_atomic >= 0),
        ADD COLUMN payout_fee_atomic numeric(78, 0) NOT NULL DEFAULT 0
          CHECK (payout_fee_atomic >= 0)
    `)
    await queryRunner.query(`
      COMMENT ON COLUMN app.prediction_bets.fee_atomic IS
        '下注费（USDT atomic）：下注时从本金扣除、即时计入平台收入的部分'
    `)
    await queryRunner.query(`
      COMMENT ON COLUMN app.prediction_bets.payout_fee_atomic IS
        '派彩费（USDT atomic）：赢家派彩时从毛派彩扣除的部分；非赢家恒为 0'
    `)
    await queryRunner.query(`
      ALTER TABLE app.prediction_settlement_runs
        ADD COLUMN total_fee_atomic numeric(78, 0) NOT NULL DEFAULT 0
          CHECK (total_fee_atomic >= 0)
    `)

    // ---- 2. 平台手续费收入账户 -------------------------------------------
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side, allow_negative)
      VALUES ('platform', 'prediction_fee', 'fee_revenue', 'USDT', 6, NULL, 'credit', false)
      ON CONFLICT DO NOTHING
    `)

    // ---- 3. 投注池允许负余额（庄家亏损要能落账，否则结算会被触发器拒绝）----
    await queryRunner.query(`
      UPDATE app.ledger_accounts
      SET allow_negative = true
      WHERE owner_type = 'platform' AND owner_reference = 'prediction_pool' AND purpose = 'settlement'
        AND allow_negative = false
    `)
    await queryRunner.query(`
      COMMENT ON COLUMN app.ledger_accounts.allow_negative IS
        '允许余额为负。用户账户恒为 false；平台账户可设 true —— 预测市场投注池为庄家盘，赔穿时记负数（平台亏损），由资金账户补足'
    `)

    // ---- 4. 对冲决策表（第 2 期）-----------------------------------------
    await queryRunner.query(`
      CREATE TABLE app.prediction_hedge_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        market_mapping_id uuid NOT NULL REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        token_mapping_id uuid REFERENCES app.polymarket_token_mappings(id) ON DELETE RESTRICT,
        token_id text NOT NULL,
        outcome text NOT NULL,
        side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
        target_shares numeric(38, 18) NOT NULL CHECK (target_shares >= 0),
        limit_price numeric(38, 18) NOT NULL CHECK (limit_price > 0 AND limit_price <= 1),
        est_cost_atomic numeric(78, 0) NOT NULL DEFAULT 0 CHECK (est_cost_atomic >= 0),
        min_order_size numeric(38, 18),
        hedge_ratio_bps integer NOT NULL DEFAULT 10000 CHECK (hedge_ratio_bps BETWEEN 0 AND 10000),
        mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run', 'live')),
        state text NOT NULL DEFAULT 'planned'
          CHECK (state IN ('planned', 'skipped', 'submitted', 'filled', 'failed', 'cancelled')),
        skip_reason text,
        exposure_before jsonb NOT NULL DEFAULT '{}'::jsonb,
        exposure_after jsonb NOT NULL DEFAULT '{}'::jsonb,
        provider_order_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (jsonb_typeof(exposure_before) = 'object'),
        CHECK (jsonb_typeof(exposure_after) = 'object')
      )
    `)
    await queryRunner.query(`
      CREATE INDEX prediction_hedge_decisions_market_created_idx
        ON app.prediction_hedge_decisions (market_mapping_id, created_at DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX prediction_hedge_decisions_state_created_idx
        ON app.prediction_hedge_decisions (state, created_at DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.prediction_hedge_decisions`)
    await queryRunner.query(`
      UPDATE app.ledger_accounts
      SET allow_negative = false
      WHERE owner_type = 'platform' AND owner_reference = 'prediction_pool' AND purpose = 'settlement'
    `)
    await queryRunner.query(`
      DELETE FROM app.ledger_accounts
      WHERE owner_type = 'platform' AND owner_reference = 'prediction_fee' AND purpose = 'fee_revenue'
    `)
    await queryRunner.query(`ALTER TABLE app.prediction_settlement_runs DROP COLUMN total_fee_atomic`)
    await queryRunner.query(`
      ALTER TABLE app.prediction_bets DROP COLUMN payout_fee_atomic, DROP COLUMN fee_atomic
    `)
  }
}
