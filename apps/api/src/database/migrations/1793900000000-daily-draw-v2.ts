import type { MigrationInterface, QueryRunner } from 'typeorm'

export class DailyDrawV21793900000000 implements MigrationInterface {
  name = 'DailyDrawV21793900000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.reward_campaigns ADD COLUMN IF NOT EXISTS exchange_coupon_kind text NOT NULL DEFAULT 'prediction_stake'
        CHECK(exchange_coupon_kind IN ('prediction_place_fee','prediction_stake'));
      ALTER TABLE app.reward_prizes ADD COLUMN IF NOT EXISTS pool text NOT NULL DEFAULT 'single' CHECK(pool IN ('single','points','voucher'));
      ALTER TABLE app.reward_prizes DROP CONSTRAINT IF EXISTS reward_prizes_kind_check,
        DROP CONSTRAINT IF EXISTS reward_prizes_coupon_kind_check, DROP CONSTRAINT IF EXISTS reward_prizes_check;
      ALTER TABLE app.reward_prizes ADD CONSTRAINT reward_prizes_kind_check CHECK(kind IN ('points','coupon','voucher')),
        ADD CONSTRAINT reward_prizes_coupon_kind_check CHECK(coupon_kind IN ('prediction_place_fee','withdrawal_fee','prediction_stake')),
        ADD CONSTRAINT reward_prizes_check CHECK(
          (kind='points' AND points>0 AND points IS NOT NULL AND coupon_kind IS NULL AND coupon_max_atomic IS NULL)
          OR (kind='coupon' AND points IS NULL AND coupon_kind IN ('prediction_place_fee','withdrawal_fee') AND
            (coupon_max_atomic>0 OR (coupon_kind='withdrawal_fee' AND coupon_max_atomic IS NULL)))
          OR (kind='voucher' AND points IS NULL AND coupon_kind='prediction_stake' AND coupon_max_atomic IS NOT NULL AND coupon_max_atomic>500000));
      ALTER TABLE app.user_coupons DROP CONSTRAINT IF EXISTS user_coupons_kind_check;
      ALTER TABLE app.user_coupons ADD CONSTRAINT user_coupons_kind_check CHECK(kind IN ('prediction_place_fee','withdrawal_fee','prediction_stake'));
      ALTER TABLE app.reward_draws ADD COLUMN IF NOT EXISTS points_code text;
      ALTER TABLE app.reward_draws DROP CONSTRAINT IF EXISTS reward_draws_check;
      ALTER TABLE app.reward_draws ADD CONSTRAINT reward_draws_check CHECK(points IS NOT NULL OR coupon_id IS NOT NULL);
      ALTER TABLE app.reward_draws DROP CONSTRAINT IF EXISTS reward_draws_points_prize_fk;
      ALTER TABLE app.reward_draws ADD CONSTRAINT reward_draws_points_prize_fk FOREIGN KEY(campaign_id,prize_version,points_code)
        REFERENCES app.reward_prizes(campaign_id,version,code);
      ALTER TABLE app.prediction_bets ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES app.user_coupons(id);
      ALTER TABLE app.prediction_bets DROP CONSTRAINT IF EXISTS prediction_bets_reward_funding_check;
      ALTER TABLE app.prediction_bets ADD CONSTRAINT prediction_bets_reward_funding_check CHECK(voucher_id IS NULL OR
        (coupon_id IS NULL AND fee_atomic=0 AND COALESCE(fee_discount_atomic,0)=0));
      -- A restored voucher can be redeemed on a later bet. Retain every receipt, unique per order.
      -- v1's table-level check is auto-named coupon_redemptions_check (verified on production 2026-11-02).
      ALTER TABLE app.coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_coupon_id_key,
        DROP CONSTRAINT IF EXISTS coupon_redemptions_check,
        DROP CONSTRAINT IF EXISTS coupon_redemptions_discount_atomic_check;
      CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_coupon_order ON app.coupon_redemptions(coupon_id,order_kind,order_id);
      ALTER TABLE app.coupon_redemptions ADD CONSTRAINT coupon_redemptions_discount_atomic_check CHECK(discount_atomic>=0 AND
        (discount_atomic<=fee_before_atomic OR (order_kind='prediction_bet' AND fee_before_atomic=0)));
      ALTER TABLE app.ledger_accounts DROP CONSTRAINT IF EXISTS ledger_accounts_purpose_check;
      ALTER TABLE app.ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check CHECK(purpose IN (
        'available','locked','pending','settlement','fee_revenue','reward_payable','invested_cost','custody_difference','basket_settlement','promo_expense'));
      INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES('platform','prediction_promo','promo_expense','USDT',6,'debit') ON CONFLICT DO NOTHING;
      INSERT INTO app.reward_prizes(campaign_id,version,code,pool,kind,points,coupon_kind,coupon_max_atomic,weight,daily_cap) VALUES
        ('daily_card_draw',2,'points_10','points','points',10,NULL,NULL,4500,NULL),
        ('daily_card_draw',2,'points_20','points','points',20,NULL,NULL,3000,NULL),
        ('daily_card_draw',2,'points_50','points','points',50,NULL,NULL,1700,NULL),
        ('daily_card_draw',2,'points_100','points','points',100,NULL,NULL,600,NULL),
        ('daily_card_draw',2,'points_500','points','points',500,NULL,NULL,200,NULL),
        ('daily_card_draw',2,'voucher_1','voucher','voucher',NULL,'prediction_stake',1000000,6200,NULL),
        ('daily_card_draw',2,'voucher_2','voucher','voucher',NULL,'prediction_stake',2000000,2200,NULL),
        ('daily_card_draw',2,'voucher_5','voucher','voucher',NULL,'prediction_stake',5000000,1000,NULL),
        ('daily_card_draw',2,'voucher_10','voucher','voucher',NULL,'prediction_stake',10000000,400,NULL),
        ('daily_card_draw',2,'voucher_20','voucher','voucher',NULL,'prediction_stake',20000000,150,6),
        ('daily_card_draw',2,'voucher_50','voucher','voucher',NULL,'prediction_stake',50000000,40,2),
        ('daily_card_draw',2,'voucher_100','voucher','voucher',NULL,'prediction_stake',100000000,10,1) ON CONFLICT DO NOTHING;
      UPDATE app.reward_campaigns SET prize_version=2,daily_coupon_budget_atomic=300000000,points_per_coupon=100,
        exchange_coupon_kind='prediction_stake',exchange_coupon_max_atomic=1000000,coupon_ttl_days=14,updated_at=now()
        WHERE id='daily_card_draw';
    `)
  }
  async down(q: QueryRunner): Promise<void> {
    // Logical rollback: keep additive columns, prize versions and receipts so issued rewards and ledger history survive.
    // Outstanding voucher bets must still be settled by the v2 money path before rolling application code back.
    await q.query(`UPDATE app.reward_campaigns SET prize_version=1,daily_coupon_budget_atomic=50000000,
      exchange_coupon_kind='prediction_place_fee',exchange_coupon_max_atomic=500000,updated_at=now() WHERE id='daily_card_draw';`)
  }
}
