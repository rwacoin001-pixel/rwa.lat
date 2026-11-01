import type { MigrationInterface, QueryRunner } from 'typeorm'

export class DailyCardRewards1793800000000 implements MigrationInterface {
  name = 'DailyCardRewards1793800000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS app.reward_campaigns (
      id text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, pilot_user_ids uuid[] NOT NULL DEFAULT '{}',
      daily_coupon_budget_atomic numeric(78,0) NOT NULL CHECK(daily_coupon_budget_atomic>=0),
      coupon_ttl_days int NOT NULL DEFAULT 14 CHECK(coupon_ttl_days>0),
      points_per_coupon int NOT NULL DEFAULT 100 CHECK(points_per_coupon>0),
      exchange_coupon_max_atomic numeric(78,0) NOT NULL CHECK(exchange_coupon_max_atomic>0),
      prize_version int NOT NULL CHECK(prize_version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS app.reward_prizes (
      campaign_id text NOT NULL REFERENCES app.reward_campaigns(id), version int NOT NULL, code text NOT NULL,
      kind text NOT NULL CHECK(kind IN ('points','coupon')), points int, coupon_kind text CHECK(coupon_kind IN ('prediction_place_fee','withdrawal_fee')),
      coupon_max_atomic numeric(78,0), weight int NOT NULL CHECK(weight>0), daily_cap int CHECK(daily_cap>=0), active boolean NOT NULL DEFAULT true,
      PRIMARY KEY(campaign_id,version,code),
      CHECK((kind='points' AND points IS NOT NULL AND points>0 AND coupon_kind IS NULL AND coupon_max_atomic IS NULL)
        OR (kind='coupon' AND points IS NULL AND coupon_kind IS NOT NULL AND
          ((coupon_max_atomic IS NOT NULL AND coupon_max_atomic>0) OR (coupon_kind='withdrawal_fee' AND coupon_max_atomic IS NULL))))
    );
    CREATE TABLE IF NOT EXISTS app.user_coupons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id),
      kind text NOT NULL CHECK(kind IN ('prediction_place_fee','withdrawal_fee')),
      max_discount_atomic numeric(78,0) NOT NULL CHECK(max_discount_atomic>0), source text NOT NULL CHECK(source IN ('draw','exchange')),
      state text NOT NULL CHECK(state IN ('available','locked','used','frozen','void')), expires_at timestamptz NOT NULL,
      locked_ref text, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS user_coupons_user_created ON app.user_coupons(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS user_coupons_sg_issue_day ON app.user_coupons(((created_at AT TIME ZONE 'Asia/Singapore')::date));
    CREATE TABLE IF NOT EXISTS app.reward_draws (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id text NOT NULL REFERENCES app.reward_campaigns(id),
      user_id uuid NOT NULL REFERENCES app.users(id), sg_date date NOT NULL,
      -- Deliberately no post FK: moderation/deletion cannot erase an already issued reward.
      post_id uuid NOT NULL, prize_code text NOT NULL, prize_version int NOT NULL, points int CHECK(points>0),
      coupon_id uuid REFERENCES app.user_coupons(id), state text NOT NULL CHECK(state IN ('granted','frozen')),
      frozen_reason text, ip inet, idempotency_key text, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(campaign_id,user_id,sg_date), UNIQUE(campaign_id,user_id,idempotency_key),
      FOREIGN KEY(campaign_id,prize_version,prize_code) REFERENCES app.reward_prizes(campaign_id,version,code),
      CHECK((points IS NOT NULL AND coupon_id IS NULL) OR (points IS NULL AND coupon_id IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS reward_draws_day_ip ON app.reward_draws(sg_date,ip);
    CREATE TABLE IF NOT EXISTS app.user_points_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id), delta int NOT NULL CHECK(delta<>0),
      reason text NOT NULL CHECK(reason IN ('draw','exchange','admin')), ref_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
      -- Persist the exchange receipt so a key replay across SG midnight never spends points again.
      idempotency_key text, balance_after bigint CHECK(balance_after>=0), UNIQUE(user_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS user_points_ledger_page ON app.user_points_ledger(user_id,created_at DESC,id DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS user_points_one_exchange_day ON app.user_points_ledger
      (user_id,((created_at AT TIME ZONE 'Asia/Singapore')::date)) WHERE reason='exchange';
    CREATE TABLE IF NOT EXISTS app.coupon_redemptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL UNIQUE REFERENCES app.user_coupons(id),
      user_id uuid NOT NULL REFERENCES app.users(id), order_kind text NOT NULL CHECK(order_kind IN ('prediction_bet','withdrawal')),
      order_id uuid NOT NULL, fee_before_atomic numeric(78,0) NOT NULL CHECK(fee_before_atomic>=0),
      discount_atomic numeric(78,0) NOT NULL CHECK(discount_atomic>=0 AND discount_atomic<=fee_before_atomic), created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE app.prediction_bets ADD COLUMN IF NOT EXISTS fee_discount_atomic numeric(78,0) CHECK(fee_discount_atomic>=0);
    ALTER TABLE app.prediction_bets ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES app.user_coupons(id);
    ALTER TABLE app.withdrawals ADD COLUMN IF NOT EXISTS fee_discount_atomic numeric(78,0) CHECK(fee_discount_atomic>=0);
    ALTER TABLE app.withdrawals ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES app.user_coupons(id);
    INSERT INTO app.reward_campaigns(id,daily_coupon_budget_atomic,exchange_coupon_max_atomic,prize_version)
      VALUES('daily_card_draw',50000000,500000,1) ON CONFLICT DO NOTHING;
    INSERT INTO app.reward_prizes(campaign_id,version,code,kind,points,coupon_kind,coupon_max_atomic,weight) VALUES
      ('daily_card_draw',1,'points_10','points',10,NULL,NULL,60),
      ('daily_card_draw',1,'points_30','points',30,NULL,NULL,25),
      ('daily_card_draw',1,'prediction_fee','coupon',NULL,'prediction_place_fee',500000,10),
      ('daily_card_draw',1,'withdrawal_fee','coupon',NULL,'withdrawal_fee',NULL,5) ON CONFLICT DO NOTHING;
    CREATE OR REPLACE FUNCTION app.reward_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Reward history is append-only' USING ERRCODE='55000'; END $$;
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='app.user_points_ledger'::regclass AND tgname='points_append_only') THEN
        CREATE TRIGGER points_append_only BEFORE UPDATE OR DELETE ON app.user_points_ledger FOR EACH ROW EXECUTE FUNCTION app.reward_history_immutable();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='app.reward_draws'::regclass AND tgname='reward_draws_no_delete') THEN
        CREATE TRIGGER reward_draws_no_delete BEFORE DELETE ON app.reward_draws FOR EACH ROW EXECUTE FUNCTION app.reward_history_immutable();
      END IF;
    END $$;`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.withdrawals DROP COLUMN IF EXISTS coupon_id, DROP COLUMN IF EXISTS fee_discount_atomic;
      ALTER TABLE app.prediction_bets DROP COLUMN IF EXISTS coupon_id, DROP COLUMN IF EXISTS fee_discount_atomic;
      DROP TABLE IF EXISTS app.coupon_redemptions;
      DROP TABLE IF EXISTS app.user_points_ledger;
      DROP TABLE IF EXISTS app.reward_draws;
      DROP TABLE IF EXISTS app.user_coupons;
      DROP TABLE IF EXISTS app.reward_prizes;
      DROP TABLE IF EXISTS app.reward_campaigns;
      DROP FUNCTION IF EXISTS app.reward_history_immutable();`)
  }
}
