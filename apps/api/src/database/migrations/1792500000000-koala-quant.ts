import type { MigrationInterface, QueryRunner } from 'typeorm'

const TYPES_BEFORE = [
  'deposit', 'withdrawal_lock', 'withdrawal_settlement', 'withdrawal_refund', 'internal_transfer',
  'order_lock', 'order_release', 'investment', 'fee', 'yield_accrual', 'settlement', 'adjustment', 'reversal',
  'basket_subscription', 'basket_redemption', 'basket_rebalance',
  'prediction_stake', 'prediction_payout', 'prediction_void_refund', 'referral_reward',
]
const QUANT_TYPES = ['quant_subscription', 'quant_redemption', 'quant_daily_settlement']
const typeCheck = (types: string[]) => `CHECK (transaction_type = ANY (ARRAY[${types.map((t) => `'${t}'`).join(', ')}]::text[]))`

/**
 * Koala Quant (考拉量化): a manually-settled strategy product.
 *
 * Money model: a subscription moves USDT from the user's available balance into the product's principal pool and
 * opens a lot. Each trade date the operator enters the strategy's real gross return; after a second person approves
 * it, one posting applies it to every lot: a profit (after fees) is paid to the user's available balance the same day,
 * a loss reduces the lot's principal. Redemptions pay principal back out of the pool minus a holding-period fee.
 * The platform treasury account funds profits and absorbs losses, so the pool always equals the sum of lot principals.
 *
 * Everything here is additive and ships switched off: the two operator switches are seeded disabled and the product
 * row is seeded as a draft, so nothing is visible or purchasable until an operator opens it.
 */
export class KoalaQuant1792500000000 implements MigrationInterface {
  name = 'KoalaQuant1792500000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check')
    await q.query(`ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check ${typeCheck([...TYPES_BEFORE, ...QUANT_TYPES])}`)
    await q.query(`
      CREATE TABLE app.quant_products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,64}$'),
        name text NOT NULL,
        summary text,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pilot', 'active', 'paused', 'closed')),
        timezone text NOT NULL DEFAULT 'Asia/Singapore',
        cutoff_time time NOT NULL DEFAULT '15:00',
        mgmt_fee_bps integer NOT NULL DEFAULT 150 CHECK (mgmt_fee_bps BETWEEN 0 AND 2000),
        perf_fee_bps integer NOT NULL DEFAULT 2000 CHECK (perf_fee_bps BETWEEN 0 AND 5000),
        redemption_fee_tiers jsonb NOT NULL DEFAULT '[{"maxDays":7,"bps":150},{"maxDays":30,"bps":50}]'::jsonb,
        min_subscription_atomic numeric(40,0) NOT NULL DEFAULT 10000000 CHECK (min_subscription_atomic > 0),
        min_redemption_atomic numeric(40,0) NOT NULL DEFAULT 10000000 CHECK (min_redemption_atomic > 0),
        max_daily_move_pct numeric(8,4) NOT NULL DEFAULT 5 CHECK (max_daily_move_pct > 0),
        target_annual_min_pct numeric(8,4),
        target_annual_max_pct numeric(8,4),
        index_value numeric(36,18) NOT NULL DEFAULT 1 CHECK (index_value > 0),
        hwm_index numeric(36,18) NOT NULL DEFAULT 1 CHECK (hwm_index > 0),
        first_trade_date date,
        last_settled_date date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (target_annual_min_pct IS NULL OR target_annual_max_pct IS NULL OR target_annual_min_pct <= target_annual_max_pct)
      );

      CREATE TABLE app.quant_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.quant_products(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK (kind IN ('subscription', 'redemption')),
        amount_atomic numeric(40,0) CHECK (amount_atomic IS NULL OR amount_atomic > 0),
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'settled', 'rejected')),
        effective_date date NOT NULL,
        idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
        principal_atomic numeric(40,0),
        fee_atomic numeric(40,0),
        payout_atomic numeric(40,0),
        ledger_reference uuid,
        reject_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        settled_at timestamptz,
        UNIQUE (user_id, idempotency_key),
        CHECK (kind = 'redemption' OR amount_atomic IS NOT NULL)
      );
      CREATE INDEX quant_orders_user ON app.quant_orders(user_id, created_at DESC);
      CREATE INDEX quant_orders_queue ON app.quant_orders(product_id, kind, effective_date) WHERE status IN ('pending', 'accepted');

      CREATE TABLE app.quant_lots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.quant_products(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        order_id uuid NOT NULL UNIQUE REFERENCES app.quant_orders(id) ON DELETE RESTRICT,
        original_atomic numeric(40,0) NOT NULL CHECK (original_atomic > 0),
        principal_atomic numeric(40,0) NOT NULL CHECK (principal_atomic >= 0),
        effective_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX quant_lots_user ON app.quant_lots(user_id, product_id) WHERE principal_atomic > 0;
      CREATE INDEX quant_lots_active ON app.quant_lots(product_id, effective_date) WHERE principal_atomic > 0;

      CREATE TABLE app.quant_daily_settlements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.quant_products(id) ON DELETE RESTRICT,
        trade_date date NOT NULL,
        gross_return_pct numeric(12,6) NOT NULL,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'voided')),
        note text,
        entered_by uuid NOT NULL,
        approved_by uuid,
        approved_at timestamptz,
        large_move_confirmed boolean NOT NULL DEFAULT false,
        index_before numeric(36,18),
        index_after numeric(36,18),
        hwm_after numeric(36,18),
        net_return_pct numeric(14,8),
        users_count integer,
        principal_atomic numeric(40,0),
        gross_atomic numeric(40,0),
        mgmt_fee_atomic numeric(40,0),
        perf_fee_atomic numeric(40,0),
        paid_atomic numeric(40,0),
        principal_loss_atomic numeric(40,0),
        redemption_principal_atomic numeric(40,0),
        redemption_fee_atomic numeric(40,0),
        posted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (approved_by IS NULL OR approved_by <> entered_by),
        CHECK (status NOT IN ('approved', 'posted') OR approved_by IS NOT NULL)
      );
      CREATE UNIQUE INDEX quant_daily_settlements_open ON app.quant_daily_settlements(product_id, trade_date) WHERE status <> 'voided';

      CREATE TABLE app.quant_payouts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_id uuid NOT NULL REFERENCES app.quant_daily_settlements(id) ON DELETE RESTRICT,
        product_id uuid NOT NULL REFERENCES app.quant_products(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        trade_date date NOT NULL,
        principal_before_atomic numeric(40,0) NOT NULL,
        gross_atomic numeric(40,0) NOT NULL,
        mgmt_fee_atomic numeric(40,0) NOT NULL,
        perf_fee_atomic numeric(40,0) NOT NULL,
        net_atomic numeric(40,0) NOT NULL,
        paid_atomic numeric(40,0) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (settlement_id, user_id)
      );
      CREATE INDEX quant_payouts_user ON app.quant_payouts(user_id, product_id, trade_date DESC);

      INSERT INTO app.operational_switches (switch_key, enabled, reason) VALUES
        ('quant.subscriptions', false, 'Koala Quant ships closed; an operator opens it after the first settlement dry run'),
        ('quant.redemptions', false, 'Koala Quant ships closed; an operator opens it after the first settlement dry run')
      ON CONFLICT (switch_key) DO NOTHING;

      INSERT INTO app.quant_products (slug, name, summary) VALUES
        ('koala', '考拉量化', '量化策略跟单产品:每个交易日结算,收益当日可提现,亏损计入本金。')
      ON CONFLICT (slug) DO NOTHING;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS app.quant_payouts;
      DROP TABLE IF EXISTS app.quant_daily_settlements;
      DROP TABLE IF EXISTS app.quant_lots;
      DROP TABLE IF EXISTS app.quant_orders;
      DROP TABLE IF EXISTS app.quant_products;
      DELETE FROM app.operational_switches WHERE switch_key IN ('quant.subscriptions', 'quant.redemptions');
      ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check;
      ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check ${typeCheck(TYPES_BEFORE)} NOT VALID;
    `)
  }
}
