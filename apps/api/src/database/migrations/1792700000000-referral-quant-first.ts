import type { MigrationInterface, QueryRunner } from 'typeorm'

/** A user's first successful Koala subscription is lifetime-wide. Historical successes consume eligibility. */
export class ReferralQuantFirst1792700000000 implements MigrationInterface {
  name = 'ReferralQuantFirst1792700000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.referral_quant_first_subscriptions (
        user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
        order_id uuid NOT NULL UNIQUE REFERENCES app.quant_orders(id) ON DELETE RESTRICT,
        reward_eligible boolean NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now()
      );
      -- No rewards are generated for history. A settled historical order still blocks a later reward.
      INSERT INTO app.referral_quant_first_subscriptions(user_id,order_id,reward_eligible)
        SELECT DISTINCT ON (user_id) user_id,id,false FROM app.quant_orders
        WHERE kind='subscription' AND status='settled' ORDER BY user_id,coalesce(settled_at,created_at),created_at,id;
      CREATE TRIGGER referral_quant_first_immutable BEFORE UPDATE OR DELETE ON app.referral_quant_first_subscriptions
        FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();
      CREATE FUNCTION app.referral_quant_source_valid(oid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM app.quant_orders o JOIN app.quant_lots l ON l.order_id=o.id
          JOIN app.ledger_transactions t ON t.id=o.ledger_reference
          WHERE o.id=oid AND o.kind='subscription' AND o.status='settled' AND o.settled_at IS NOT NULL
            AND o.principal_atomic=o.amount_atomic AND l.user_id=o.user_id AND l.product_id=o.product_id AND l.original_atomic=o.amount_atomic
            AND t.transaction_type='quant_subscription' AND t.reference_type='quant_subscription' AND t.reference_id=o.id
            AND EXISTS (SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
              WHERE e.transaction_id=t.id AND e.side='debit' AND e.atomic_amount=o.amount_atomic AND a.owner_type='user'
                AND a.user_id=o.user_id AND a.purpose='available' AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL)
            AND EXISTS (SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
              WHERE e.transaction_id=t.id AND e.side='credit' AND e.atomic_amount=o.amount_atomic AND a.owner_type='platform'
                AND a.owner_reference='quant:'||o.product_id::text AND a.purpose='basket_settlement'
                AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL))
      $$;
      CREATE FUNCTION app.referral_quant_success_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='UPDATE' AND OLD.kind='subscription' AND OLD.status='settled' AND NEW IS DISTINCT FROM OLD THEN
          RAISE EXCEPTION 'A settled subscription is an immutable financial source' USING ERRCODE='55000';
        END IF;
        IF NEW.kind='subscription' AND NEW.status='settled' THEN
          PERFORM pg_advisory_xact_lock(hashtextextended('referral-quant-first:'||NEW.user_id::text,0));
          IF NOT app.referral_quant_source_valid(NEW.id) THEN
            RAISE EXCEPTION 'Settled subscription must match its lot and funded ledger transfer' USING ERRCODE='23514';
          END IF;
          INSERT INTO app.referral_quant_first_subscriptions(user_id,order_id,reward_eligible)
            VALUES(NEW.user_id,NEW.id,true) ON CONFLICT(user_id) DO NOTHING;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_quant_success AFTER INSERT OR UPDATE ON app.quant_orders
        FOR EACH ROW EXECUTE FUNCTION app.referral_quant_success_guard();
      CREATE INDEX quant_orders_successful_subscription ON app.quant_orders(user_id,settled_at,id)
        WHERE kind='subscription' AND status='settled';
      ALTER TABLE app.referral_rewards DROP CONSTRAINT referral_rewards_source_type_check;
      ALTER TABLE app.referral_rewards DROP CONSTRAINT referral_rewards_check;
      ALTER TABLE app.referral_rewards ADD CONSTRAINT referral_rewards_source_type_check
        CHECK (source_type IN ('order','basket_subscription','prediction_fee','quant_subscription'));
      ALTER TABLE app.referral_rewards ADD CONSTRAINT referral_rewards_purchase_source_check
        CHECK ((kind='purchase')=(source_type IN ('order','basket_subscription','quant_subscription')));
      CREATE OR REPLACE FUNCTION app.referral_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE cfg jsonb; component text;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.state <> 'earned' OR NEW.claim_id IS NOT NULL OR NEW.claimed_at IS NOT NULL THEN
            RAISE EXCEPTION 'Referral reward starts as earned' USING ERRCODE = '23514';
          END IF;
          IF NEW.source_type = 'order' THEN
            IF NOT EXISTS (SELECT 1 FROM app.orders o WHERE o.id = NEW.source_id AND o.user_id = NEW.source_user_id
              AND o.side = 'buy' AND o.state IN ('filled', 'partially_filled') AND o.filled_atomic_amount = NEW.base_atomic
              AND o.settlement_asset_code = 'USDT' AND o.settlement_asset_decimals = 6) THEN
              RAISE EXCEPTION 'Purchase reward must match a filled buy order' USING ERRCODE = '23514';
            END IF;
          ELSIF NEW.source_type = 'basket_subscription' THEN
            IF NOT EXISTS (SELECT 1 FROM app.basket_subscriptions s WHERE s.id = NEW.source_id AND s.user_id = NEW.source_user_id
              AND s.status = 'settled' AND s.amount_usd * 1000000 = NEW.base_atomic) THEN
              RAISE EXCEPTION 'Purchase reward must match a settled portfolio subscription' USING ERRCODE = '23514';
            END IF;
          ELSIF NEW.source_type = 'quant_subscription' THEN
            IF NOT app.referral_quant_source_valid(NEW.source_id) OR NOT EXISTS (
              SELECT 1 FROM app.referral_quant_first_subscriptions f JOIN app.quant_orders o ON o.id=f.order_id
              WHERE f.user_id=NEW.source_user_id AND f.order_id=NEW.source_id AND f.reward_eligible
                AND o.user_id=NEW.source_user_id AND o.amount_atomic=NEW.base_atomic) THEN
              RAISE EXCEPTION 'Quant reward must match the first funded successful subscription' USING ERRCODE = '23514';
            END IF;
          ELSE
            SELECT CASE t.transaction_type WHEN 'prediction_stake' THEN 'prediction_place' WHEN 'prediction_payout' THEN 'prediction_payout' END
              INTO component
              FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id = e.account_id JOIN app.ledger_transactions t ON t.id = e.transaction_id
             WHERE e.id = NEW.source_id AND e.side = 'credit' AND e.atomic_amount = NEW.base_atomic
               AND a.owner_type = 'platform' AND a.owner_reference = 'prediction_fee' AND a.purpose = 'fee_revenue'
               AND a.asset_code = 'USDT' AND a.asset_decimals = 6 AND t.actor_id = NEW.source_user_id;
            IF component IS NULL THEN
              RAISE EXCEPTION 'Fee reward must match a platform prediction fee paid by the source user' USING ERRCODE = '23514';
            END IF;
          END IF;
          IF NOT EXISTS (WITH RECURSIVE up(uid, lvl, path) AS (
              SELECT inviter_user_id, 1, ARRAY[NEW.source_user_id, inviter_user_id] FROM app.referral_edges WHERE invitee_user_id = NEW.source_user_id
              UNION ALL SELECT e.inviter_user_id, u.lvl + 1, u.path || e.inviter_user_id FROM up u
                JOIN app.referral_edges e ON e.invitee_user_id = u.uid WHERE u.lvl < 3 AND NOT e.inviter_user_id = ANY(u.path)
            ) SELECT 1 FROM up WHERE uid = NEW.user_id AND lvl = NEW.level) THEN
            RAISE EXCEPTION 'Referral reward beneficiary is not the ancestor at that level' USING ERRCODE = '23514';
          END IF;
          SELECT config INTO cfg FROM app.referral_settings WHERE version = NEW.settings_version;
          IF cfg IS NULL THEN RAISE EXCEPTION 'Unknown referral settings version' USING ERRCODE = '23514'; END IF;
          IF NEW.kind = 'purchase' AND ((cfg->>'holdingEnabled') IS DISTINCT FROM 'true'
              OR (cfg->'holdingRatesBps'->>(NEW.level - 1))::integer IS DISTINCT FROM NEW.rate_bps) THEN
            RAISE EXCEPTION 'Purchase reward rate must match its settings version' USING ERRCODE = '23514';
          END IF;
          IF NEW.kind = 'fee' AND ((cfg->>'feeEnabled') IS DISTINCT FROM 'true' OR NOT (cfg->'feeComponents') ? component
              OR (cfg->'feeRatesBps'->>(NEW.level - 1))::integer IS DISTINCT FROM NEW.rate_bps) THEN
            RAISE EXCEPTION 'Fee reward rate must match its settings version' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        IF (to_jsonb(NEW) - ARRAY['state', 'claim_id', 'claimed_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state', 'claim_id', 'claimed_at'])
          OR OLD.state <> 'earned' OR NEW.state <> 'claimed' THEN
          RAISE EXCEPTION 'Referral reward facts are immutable; only earned -> claimed is allowed' USING ERRCODE = '55000';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM app.referral_reward_claims c WHERE c.id = NEW.claim_id AND c.user_id = NEW.user_id) THEN
          RAISE EXCEPTION 'Referral reward claim belongs to another user' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
    `)
  }
  async down(): Promise<void> {
    throw new Error('Forward-only: lifetime subscription eligibility and immutable reward facts must be preserved')
  }
}
