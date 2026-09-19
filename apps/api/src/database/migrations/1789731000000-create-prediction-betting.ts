import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 预测市场 · 路线 A（内部盘）：
 * - prediction_bets：用户余额投注单
 * - prediction_settlement_runs：结算批次（每市场一次，幂等）
 * - 预建平台投注池账户（platform / prediction_pool / settlement）
 * - 新增运营闸门 prediction.betting（默认关闭；开通需运营明确指令）
 */
export class CreatePredictionBetting1789731000000 implements MigrationInterface {
  name = 'CreatePredictionBetting1789731000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.prediction_bets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        market_mapping_id uuid NOT NULL REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        token_id text NOT NULL,
        side text NOT NULL,
        stake_atomic numeric(78, 0) NOT NULL CHECK (stake_atomic > 0),
        shares numeric(38, 18) NOT NULL CHECK (shares > 0),
        price numeric(38, 18) NOT NULL CHECK (price > 0),
        status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'won', 'lost', 'void')),
        idempotency_key text NOT NULL,
        settled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT prediction_bets_user_idempotency_key UNIQUE (user_id, idempotency_key)
      )
    `)
    await queryRunner.query(`CREATE INDEX prediction_bets_market_status_idx ON app.prediction_bets (market_mapping_id, status)`)
    await queryRunner.query(`CREATE INDEX prediction_bets_user_created_idx ON app.prediction_bets (user_id, created_at DESC)`)

    await queryRunner.query(`
      CREATE TABLE app.prediction_settlement_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        market_mapping_id uuid NOT NULL UNIQUE REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        winning_token_id text,
        outcome text NOT NULL CHECK (outcome IN ('resolved', 'void')),
        bets_settled integer NOT NULL DEFAULT 0,
        total_stake_atomic numeric(78, 0) NOT NULL DEFAULT 0,
        total_paid_atomic numeric(78, 0) NOT NULL DEFAULT 0,
        executed_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    // 平台投注池账户（幂等：不存在才建；credit-normal——对用户而言是代管负债账户）
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side)
      SELECT 'platform', 'prediction_pool', 'settlement', 'USDT', 6, NULL, 'credit'
      WHERE NOT EXISTS (
        SELECT 1 FROM app.ledger_accounts
        WHERE owner_type = 'platform' AND owner_reference = 'prediction_pool' AND purpose = 'settlement'
      )
    `)

    // 运营闸门（默认关闭）
    await queryRunner.query(`
      INSERT INTO app.operational_switches (switch_key, enabled, reason)
      VALUES ('prediction.betting', false, 'Prediction internal-market (route A) betting; opens only on explicit operations instruction')
      ON CONFLICT (switch_key) DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM app.operational_switches WHERE switch_key = 'prediction.betting'`)
    await queryRunner.query(`DROP TABLE app.prediction_settlement_runs`)
    await queryRunner.query(`DROP TABLE app.prediction_bets`)
    // 平台账户行保留（若已有账务引用则不应删除；无引用存在亦无害）
  }
}
