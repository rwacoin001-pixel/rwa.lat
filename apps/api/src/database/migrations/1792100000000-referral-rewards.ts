import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Ledger transaction types since 1789732000000, plus the referral reward claim. */
const PREVIOUS_TRANSACTION_TYPES = [
  'deposit', 'withdrawal_lock', 'withdrawal_settlement', 'withdrawal_refund', 'internal_transfer',
  'order_lock', 'order_release', 'investment', 'fee', 'yield_accrual', 'settlement', 'adjustment', 'reversal',
  'basket_subscription', 'basket_redemption', 'basket_rebalance',
  'prediction_stake', 'prediction_payout', 'prediction_void_refund',
]
const typeCheck = (types: string[]) => `CHECK (transaction_type = ANY (ARRAY[${types.map(t => `'${t}'`).join(', ')}]::text[]))`

/**
 * Referral rewards that are earned and claimable immediately (product decision 2026-10-13):
 *
 * - purchase: an invitee's filled product order or settled portfolio subscription pays each of up to three
 *   ancestors a one-time reward of the purchase USDT × holdingRatesBps[level].
 * - fee: every platform prediction fee (bet placement and payout) pays each ancestor fee × feeRatesBps[level].
 *
 * A claim moves every earned reward of the user into their available USDT through one balanced
 * 'referral_reward' ledger transaction funded by the platform referral expense account.
 *
 * The database re-verifies every reward on insert (source fact, base amount, ancestor at that level, rate in
 * the referenced settings version), so application code cannot create an unbacked or over-sized reward.
 * Reward facts are immutable; the only permitted change is earned -> claimed, and a claim must equal its
 * rewards and its ledger credit at commit.
 */
export class ReferralRewards1792100000000 implements MigrationInterface {
  name = 'ReferralRewards1792100000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check')
    await q.query(`ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check
      ${typeCheck([...PREVIOUS_TRANSACTION_TYPES, 'referral_reward'])}`)
    await q.query(`
      CREATE TABLE app.referral_reward_claims (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic > 0),
        reward_count integer NOT NULL CHECK (reward_count > 0),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code = 'USDT'),
        asset_decimals smallint NOT NULL DEFAULT 6 CHECK (asset_decimals = 6),
        ledger_transaction_id uuid NOT NULL UNIQUE REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, request_key)
      );
      CREATE TABLE app.referral_rewards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        source_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK (kind IN ('purchase', 'fee')),
        source_type text NOT NULL CHECK (source_type IN ('order', 'basket_subscription', 'prediction_fee')),
        source_id uuid NOT NULL,
        level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
        settings_version integer NOT NULL REFERENCES app.referral_settings(version),
        rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 1 AND 10000),
        base_atomic app.atomic_unit_amount NOT NULL CHECK (base_atomic > 0),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic > 0),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code = 'USDT'),
        asset_decimals smallint NOT NULL DEFAULT 6 CHECK (asset_decimals = 6),
        state text NOT NULL DEFAULT 'earned' CHECK (state IN ('earned', 'claimed')),
        claim_id uuid REFERENCES app.referral_reward_claims(id) ON DELETE RESTRICT,
        earned_at timestamptz NOT NULL DEFAULT now(),
        claimed_at timestamptz,
        UNIQUE (source_type, source_id, level),
        CHECK ((kind = 'purchase') = (source_type IN ('order', 'basket_subscription'))),
        CHECK (user_id <> source_user_id),
        CHECK (amount_atomic = floor(base_atomic * rate_bps / 10000)),
        CHECK ((state = 'claimed') = (claim_id IS NOT NULL)),
        CHECK ((state = 'claimed') = (claimed_at IS NOT NULL))
      );
      CREATE INDEX referral_rewards_user ON app.referral_rewards(user_id, state, earned_at DESC, id);
      CREATE INDEX referral_rewards_time ON app.referral_rewards(earned_at DESC, id);
      CREATE INDEX referral_rewards_claim ON app.referral_rewards(claim_id) WHERE claim_id IS NOT NULL;

      CREATE FUNCTION app.referral_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
      CREATE TRIGGER referral_reward_write BEFORE INSERT OR UPDATE ON app.referral_rewards
        FOR EACH ROW EXECUTE FUNCTION app.referral_reward_guard();
      CREATE TRIGGER referral_reward_no_delete BEFORE DELETE ON app.referral_rewards
        FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();
      CREATE TRIGGER referral_reward_claims_immutable BEFORE UPDATE OR DELETE ON app.referral_reward_claims
        FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();

      -- At commit: a claim equals the rewards it redeemed and the ledger credit to the user's available USDT.
      CREATE FUNCTION app.referral_reward_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE total numeric; cnt integer;
      BEGIN
        SELECT coalesce(sum(amount_atomic), 0), count(*) INTO total, cnt FROM app.referral_rewards
          WHERE claim_id = NEW.id AND user_id = NEW.user_id AND state = 'claimed';
        IF total <> NEW.amount_atomic OR cnt <> NEW.reward_count THEN
          RAISE EXCEPTION 'Referral claim does not match its rewards' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id = e.account_id
          JOIN app.ledger_transactions t ON t.id = e.transaction_id
          WHERE e.transaction_id = NEW.ledger_transaction_id AND t.transaction_type = 'referral_reward'
            AND a.owner_type = 'user' AND a.user_id = NEW.user_id AND a.purpose = 'available'
            AND a.asset_code = 'USDT' AND a.asset_decimals = 6 AND a.network IS NULL
            AND e.side = a.normal_side AND e.atomic_amount = NEW.amount_atomic) THEN
          RAISE EXCEPTION 'Referral claim does not match the ledger credit' USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER referral_reward_claim_matches AFTER INSERT ON app.referral_reward_claims
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_reward_claim_guard();
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.referral_rewards) OR EXISTS (SELECT 1 FROM app.referral_reward_claims)
        OR EXISTS (SELECT 1 FROM app.ledger_transactions WHERE transaction_type = 'referral_reward') THEN
        RAISE EXCEPTION 'Refuse destructive rollback with referral reward records' USING ERRCODE = '55000';
      END IF;
    END $$;`)
    await q.query(`DROP TABLE app.referral_rewards, app.referral_reward_claims;
      DROP FUNCTION app.referral_reward_claim_guard(), app.referral_reward_guard();`)
    await q.query('ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check')
    await q.query(`ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check
      ${typeCheck(PREVIOUS_TRANSACTION_TYPES)} NOT VALID`)
  }
}
