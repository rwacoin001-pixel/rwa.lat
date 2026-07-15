import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateWalletLedgerModel1783753800000 implements MigrationInterface {
  name = 'CreateWalletLedgerModel1783753800000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE DOMAIN app.atomic_unit_amount AS numeric
        CHECK (VALUE = trunc(VALUE) AND abs(VALUE) < power(10::numeric, 78));

      CREATE TABLE app.custody_wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        provider text NOT NULL,
        provider_wallet_hash bytea NOT NULL,
        provider_wallet_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        state text NOT NULL DEFAULT 'provisioning'
          CHECK (state IN ('provisioning', 'active', 'restricted', 'closed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz,
        closed_at timestamptz,
        UNIQUE (provider, provider_wallet_hash),
        UNIQUE (id, user_id),
        CHECK (state <> 'active' OR activated_at IS NOT NULL),
        CHECK ((state = 'closed') = (closed_at IS NOT NULL))
      );

      CREATE TABLE app.wallet_addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id uuid NOT NULL,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        address_hash bytea NOT NULL,
        address_ciphertext bytea NOT NULL,
        memo_ciphertext bytea,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled', 'quarantined')),
        created_at timestamptz NOT NULL DEFAULT now(),
        disabled_at timestamptz,
        FOREIGN KEY (wallet_id, user_id) REFERENCES app.custody_wallets(id, user_id) ON DELETE RESTRICT,
        UNIQUE (network, address_hash),
        UNIQUE (id, user_id),
        CHECK ((state = 'disabled') = (disabled_at IS NOT NULL))
      );

      CREATE TABLE app.chain_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        transaction_hash text NOT NULL,
        state text NOT NULL DEFAULT 'detected'
          CHECK (state IN ('detected', 'confirming', 'confirmed', 'failed', 'reorged')),
        block_number numeric(30, 0) CHECK (block_number IS NULL OR block_number >= 0),
        confirmation_count integer NOT NULL DEFAULT 0 CHECK (confirmation_count >= 0),
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        confirmed_at timestamptz,
        raw_reference jsonb NOT NULL DEFAULT '{}',
        UNIQUE (network, transaction_hash),
        CHECK (jsonb_typeof(raw_reference) = 'object'),
        CHECK (state <> 'confirmed' OR confirmed_at IS NOT NULL)
      );

      CREATE TABLE app.ledger_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_type text NOT NULL CHECK (owner_type IN ('user', 'platform', 'custody_provider')),
        user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
        owner_reference text,
        purpose text NOT NULL CHECK (purpose IN (
          'available', 'locked', 'pending', 'settlement', 'fee_revenue',
          'reward_payable', 'invested_cost', 'custody_difference'
        )),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        network text CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        normal_side text NOT NULL CHECK (normal_side IN ('debit', 'credit')),
        allow_negative boolean NOT NULL DEFAULT false,
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'frozen', 'closed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        closed_at timestamptz,
        CHECK ((owner_type = 'user') = (user_id IS NOT NULL)),
        CHECK (owner_type = 'user' OR owner_reference IS NOT NULL),
        CHECK (owner_type <> 'user' OR allow_negative = false),
        CHECK ((state = 'closed') = (closed_at IS NOT NULL))
      );

      CREATE UNIQUE INDEX ledger_accounts_user_purpose_asset_idx
        ON app.ledger_accounts(user_id, purpose, asset_code, COALESCE(network, ''))
        WHERE owner_type = 'user';
      CREATE UNIQUE INDEX ledger_accounts_system_purpose_asset_idx
        ON app.ledger_accounts(owner_type, owner_reference, purpose, asset_code, COALESCE(network, ''))
        WHERE owner_type <> 'user';

      CREATE TABLE app.ledger_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_type text NOT NULL CHECK (transaction_type IN (
          'deposit', 'withdrawal_lock', 'withdrawal_settlement', 'withdrawal_refund',
          'internal_transfer', 'order_lock', 'order_release', 'investment', 'fee',
          'yield_accrual', 'settlement', 'adjustment', 'reversal'
        )),
        idempotency_key text NOT NULL UNIQUE,
        request_id text NOT NULL,
        reference_type text NOT NULL,
        reference_id uuid NOT NULL,
        reverses_transaction_id uuid UNIQUE REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        reason_code text,
        actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'service', 'partner')),
        actor_id uuid,
        effective_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        metadata jsonb NOT NULL DEFAULT '{}',
        CHECK (jsonb_typeof(metadata) = 'object'),
        CHECK ((transaction_type = 'reversal') = (reverses_transaction_id IS NOT NULL)),
        CHECK (transaction_type <> 'adjustment' OR reason_code IS NOT NULL)
      );

      CREATE INDEX ledger_transactions_reference_idx
        ON app.ledger_transactions(reference_type, reference_id, created_at);

      CREATE TABLE app.ledger_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id uuid NOT NULL REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        account_id uuid NOT NULL REFERENCES app.ledger_accounts(id) ON DELETE RESTRICT,
        side text NOT NULL CHECK (side IN ('debit', 'credit')),
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (transaction_id, account_id, side)
      );

      CREATE INDEX ledger_entries_account_created_idx
        ON app.ledger_entries(account_id, created_at, id);

      CREATE TABLE app.ledger_account_balances (
        account_id uuid PRIMARY KEY REFERENCES app.ledger_accounts(id) ON DELETE RESTRICT,
        current_atomic_balance app.atomic_unit_amount NOT NULL DEFAULT 0,
        last_entry_id uuid UNIQUE REFERENCES app.ledger_entries(id) ON DELETE RESTRICT,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE app.balance_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES app.ledger_accounts(id) ON DELETE RESTRICT,
        entry_id uuid NOT NULL UNIQUE REFERENCES app.ledger_entries(id) ON DELETE RESTRICT,
        transaction_id uuid NOT NULL REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        atomic_balance app.atomic_unit_amount NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX balance_snapshots_account_recorded_idx
        ON app.balance_snapshots(account_id, recorded_at, id);

      CREATE TABLE app.deposits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        wallet_address_id uuid NOT NULL,
        chain_transaction_id uuid NOT NULL REFERENCES app.chain_transactions(id) ON DELETE RESTRICT,
        output_index integer NOT NULL DEFAULT 0 CHECK (output_index >= 0),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount > 0),
        required_confirmations integer NOT NULL CHECK (required_confirmations > 0),
        state text NOT NULL DEFAULT 'detected'
          CHECK (state IN ('detected', 'confirming', 'credited', 'rejected', 'manual_review')),
        reason_code text,
        detected_at timestamptz NOT NULL DEFAULT now(),
        credited_at timestamptz,
        FOREIGN KEY (wallet_address_id, user_id) REFERENCES app.wallet_addresses(id, user_id) ON DELETE RESTRICT,
        UNIQUE (chain_transaction_id, output_index, asset_code),
        CHECK ((state = 'credited') = (credited_at IS NOT NULL)),
        CHECK (state NOT IN ('rejected', 'manual_review') OR reason_code IS NOT NULL)
      );

      CREATE TABLE app.withdrawals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        wallet_id uuid NOT NULL,
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount > 0),
        fee_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (fee_atomic_amount >= 0),
        destination_hash bytea NOT NULL,
        destination_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        state text NOT NULL DEFAULT 'requested' CHECK (state IN (
          'requested', '2fa_verified', 'risk_review', 'approved', 'signing',
          'broadcast', 'confirming', 'completed', 'rejected', 'failed', 'cancelled'
        )),
        idempotency_key text NOT NULL,
        chain_transaction_id uuid REFERENCES app.chain_transactions(id) ON DELETE RESTRICT,
        reason_code text,
        requested_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        FOREIGN KEY (wallet_id, user_id) REFERENCES app.custody_wallets(id, user_id) ON DELETE RESTRICT,
        UNIQUE (user_id, idempotency_key),
        CHECK ((state = 'completed') = (completed_at IS NOT NULL)),
        CHECK (state NOT IN ('rejected', 'failed', 'cancelled') OR reason_code IS NOT NULL),
        CHECK (state NOT IN ('broadcast', 'confirming', 'completed') OR chain_transaction_id IS NOT NULL)
      );

      CREATE TABLE app.internal_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        recipient_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount > 0),
        state text NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'risk_review', 'posted', 'rejected', 'reversed')),
        idempotency_key text NOT NULL,
        reason_code text,
        requested_at timestamptz NOT NULL DEFAULT now(),
        posted_at timestamptz,
        UNIQUE (sender_user_id, idempotency_key),
        CHECK (sender_user_id <> recipient_user_id),
        CHECK ((state IN ('posted', 'reversed')) = (posted_at IS NOT NULL)),
        CHECK (state <> 'rejected' OR reason_code IS NOT NULL)
      );

      COMMENT ON COLUMN app.ledger_entries.atomic_amount IS
        'Exact integer amount in the account asset smallest unit; floating-point values are forbidden';
      COMMENT ON TABLE app.ledger_account_balances IS
        'Transactional projection only; immutable ledger entries remain the source of truth';
      COMMENT ON COLUMN app.chain_transactions.raw_reference IS
        'Redacted provider evidence and cursor references only; never credentials';

      CREATE FUNCTION app.apply_ledger_entry_balance() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        account_normal_side text;
        account_allows_negative boolean;
        account_state text;
        previous_balance numeric(78, 0);
        next_balance numeric(78, 0);
      BEGIN
        INSERT INTO app.ledger_account_balances (account_id)
        VALUES (NEW.account_id)
        ON CONFLICT (account_id) DO NOTHING;

        SELECT a.normal_side, a.allow_negative, a.state, b.current_atomic_balance
          INTO account_normal_side, account_allows_negative, account_state, previous_balance
        FROM app.ledger_accounts a
        JOIN app.ledger_account_balances b ON b.account_id = a.id
        WHERE a.id = NEW.account_id
        FOR UPDATE OF b;

        IF account_state <> 'active' THEN
          RAISE EXCEPTION 'ledger account % is not active', NEW.account_id
            USING ERRCODE = '55000';
        END IF;

        next_balance := previous_balance + CASE
          WHEN NEW.side = account_normal_side THEN NEW.atomic_amount
          ELSE -NEW.atomic_amount
        END;

        IF NOT account_allows_negative AND next_balance < 0 THEN
          RAISE EXCEPTION 'ledger account % has insufficient balance', NEW.account_id
            USING ERRCODE = '23514';
        END IF;

        UPDATE app.ledger_account_balances
        SET current_atomic_balance = next_balance,
            last_entry_id = NEW.id,
            updated_at = now()
        WHERE account_id = NEW.account_id;

        INSERT INTO app.balance_snapshots
          (account_id, entry_id, transaction_id, atomic_balance)
        VALUES
          (NEW.account_id, NEW.id, NEW.transaction_id, next_balance);

        RETURN NEW;
      END;
      $$;

      CREATE FUNCTION app.assert_ledger_transaction_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        entry_count integer;
        asset_count integer;
        net_amount numeric(78, 0);
      BEGIN
        SELECT COUNT(*),
               COUNT(DISTINCT (a.asset_code, a.asset_decimals)),
               COALESCE(SUM(CASE WHEN e.side = 'debit' THEN e.atomic_amount ELSE -e.atomic_amount END), 0)
          INTO entry_count, asset_count, net_amount
        FROM app.ledger_entries e
        JOIN app.ledger_accounts a ON a.id = e.account_id
        WHERE e.transaction_id = NEW.transaction_id;

        IF entry_count < 2 OR asset_count <> 1 OR net_amount <> 0 THEN
          RAISE EXCEPTION 'ledger transaction % is not balanced', NEW.transaction_id
            USING ERRCODE = '23514';
        END IF;

        RETURN NULL;
      END;
      $$;

      CREATE TRIGGER ledger_entries_apply_balance
      AFTER INSERT ON app.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION app.apply_ledger_entry_balance();

      CREATE CONSTRAINT TRIGGER ledger_entries_balanced
      AFTER INSERT ON app.ledger_entries
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION app.assert_ledger_transaction_balanced();

      CREATE TRIGGER ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON app.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER ledger_entries_no_truncate
      BEFORE TRUNCATE ON app.ledger_entries
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TRIGGER ledger_transactions_immutable
      BEFORE UPDATE OR DELETE ON app.ledger_transactions
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER ledger_transactions_no_truncate
      BEFORE TRUNCATE ON app.ledger_transactions
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TRIGGER balance_snapshots_immutable
      BEFORE UPDATE OR DELETE ON app.balance_snapshots
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER balance_snapshots_no_truncate
      BEFORE TRUNCATE ON app.balance_snapshots
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS balance_snapshots_immutable ON app.balance_snapshots;
      DROP TRIGGER IF EXISTS balance_snapshots_no_truncate ON app.balance_snapshots;
      DROP TRIGGER IF EXISTS ledger_transactions_immutable ON app.ledger_transactions;
      DROP TRIGGER IF EXISTS ledger_transactions_no_truncate ON app.ledger_transactions;
      DROP TRIGGER IF EXISTS ledger_entries_immutable ON app.ledger_entries;
      DROP TRIGGER IF EXISTS ledger_entries_no_truncate ON app.ledger_entries;
      DROP TRIGGER IF EXISTS ledger_entries_balanced ON app.ledger_entries;
      DROP TRIGGER IF EXISTS ledger_entries_apply_balance ON app.ledger_entries;
      DROP FUNCTION IF EXISTS app.assert_ledger_transaction_balanced();
      DROP FUNCTION IF EXISTS app.apply_ledger_entry_balance();
      DROP TABLE IF EXISTS app.internal_transfers;
      DROP TABLE IF EXISTS app.withdrawals;
      DROP TABLE IF EXISTS app.deposits;
      DROP TABLE IF EXISTS app.balance_snapshots;
      DROP TABLE IF EXISTS app.ledger_account_balances;
      DROP TABLE IF EXISTS app.ledger_entries;
      DROP TABLE IF EXISTS app.ledger_transactions;
      DROP TABLE IF EXISTS app.ledger_accounts;
      DROP TABLE IF EXISTS app.chain_transactions;
      DROP TABLE IF EXISTS app.wallet_addresses;
      DROP TABLE IF EXISTS app.custody_wallets;
      DROP DOMAIN IF EXISTS app.atomic_unit_amount;
    `)
  }
}
