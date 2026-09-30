import type { MigrationInterface, QueryRunner } from 'typeorm'
import { REFERRAL_DEFAULT_SETTINGS } from '../../referral/referral-policy'

export class ReferralStageZero1790760000000 implements MigrationInterface {
  name = 'ReferralStageZero1790760000000'

  async up(q: QueryRunner): Promise<void> {
    // No alteration of invitations, rewards, ledger entries, account purposes or existing balances.
    await q.query(`
      CREATE TABLE app.referral_runtime (
        singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
        payouts_enabled boolean NOT NULL DEFAULT false CHECK (payouts_enabled = false)
      );
      INSERT INTO app.referral_runtime DEFAULT VALUES;
      CREATE TABLE app.referral_settings (
        version serial PRIMARY KEY, config jsonb NOT NULL CHECK (jsonb_typeof(config)='object'),
        fee_effective_at timestamptz NOT NULL, holding_effective_at timestamptz NOT NULL,
        team_effective_at timestamptz NOT NULL, created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (config @> '{"claimExclusive":true,"idempotencyRequired":true,"maxDepth":3,"budgetEnforcementEnabled":false,"existingAccountBinding":false,"autoApprove":false,"pendingCountsForRisk":true}'::jsonb),
        CHECK (jsonb_typeof(config->'teamDepth')='number' AND (config->>'teamDepth')::int BETWEEN 1 AND 3)
      );
      CREATE INDEX referral_settings_fee_time ON app.referral_settings(fee_effective_at,version);
      CREATE TABLE app.referral_codes (
        user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
        code varchar(16) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]{6,16}$' AND code NOT IN ('admin','signup','signin','system','support','referral')),
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_code_aliases (
        code varchar(16) PRIMARY KEY CHECK (code ~ '^[a-z0-9]{6,16}$'),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_edges (
        invitee_user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
        inviter_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        code varchar(16) NOT NULL REFERENCES app.referral_code_aliases(code) ON DELETE RESTRICT,
        bound_at timestamptz NOT NULL DEFAULT now(), CHECK (invitee_user_id<>inviter_user_id)
      );
      CREATE INDEX referral_edges_down ON app.referral_edges(inviter_user_id,bound_at,invitee_user_id);
      CREATE TABLE app.referral_attributions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inviter_user_id uuid NOT NULL REFERENCES app.users(id),
        code varchar(16) NOT NULL REFERENCES app.referral_code_aliases(code),
        clicked_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
        CHECK (expires_at > clicked_at AND expires_at <= clicked_at + interval '30 days')
      );
      CREATE TABLE app.referral_registration_decisions (
        user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
        attribution_id uuid REFERENCES app.referral_attributions(id),
        decided_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_oauth_attributions (
        state_hash bytea PRIMARY KEY REFERENCES app.oauth_authorization_flows(state_hash) ON DELETE CASCADE,
        signed_attribution text NOT NULL CHECK (length(signed_attribution)<=256)
      );
      CREATE TABLE app.referral_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fee_entry_id uuid NOT NULL UNIQUE REFERENCES app.ledger_entries(id),
        ledger_transaction_id uuid NOT NULL REFERENCES app.ledger_transactions(id),
        fee_component text NOT NULL CHECK (fee_component IN ('prediction_place','prediction_payout')),
        source_user_id uuid NOT NULL REFERENCES app.users(id), business_reference_id uuid NOT NULL,
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic>0),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code='USDT'),
        asset_decimals smallint NOT NULL DEFAULT 6 CHECK (asset_decimals=6),
        occurred_at timestamptz NOT NULL, rate_at timestamptz NOT NULL,
        settings_version integer NOT NULL REFERENCES app.referral_settings(version),
        ancestors jsonb NOT NULL CHECK (jsonb_typeof(ancestors)='array' AND jsonb_array_length(ancestors)<=3),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_awards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES app.referral_events(id),
        user_id uuid NOT NULL REFERENCES app.users(id), level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
        settings_version integer NOT NULL REFERENCES app.referral_settings(version),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic>=0),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code='USDT'), asset_decimals smallint NOT NULL DEFAULT 6 CHECK(asset_decimals=6),
        state text NOT NULL DEFAULT 'candidate' CHECK(state IN ('candidate','pending_review','rejected','approved','available','frozen','claimed_credit','claimed_cash','revoked')),
        reservation_ledger_transaction_id uuid REFERENCES app.ledger_transactions(id),
        claim_ledger_transaction_id uuid UNIQUE REFERENCES app.ledger_transactions(id),
        claim_request_key text UNIQUE,
        occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(event_id,user_id,level),
        CHECK(state NOT IN ('approved','available','frozen','claimed_credit','claimed_cash') OR reservation_ledger_transaction_id IS NOT NULL),
        CHECK((state IN ('claimed_credit','claimed_cash')) = (claim_ledger_transaction_id IS NOT NULL)),
        CHECK((state IN ('claimed_credit','claimed_cash')) = (claim_request_key IS NOT NULL))
      );
      CREATE INDEX referral_awards_user_time ON app.referral_awards(user_id,occurred_at,id);
      CREATE TABLE app.referral_award_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), award_id uuid NOT NULL REFERENCES app.referral_awards(id),
        request_key text NOT NULL UNIQUE, action text NOT NULL, actor_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_debts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), award_id uuid NOT NULL REFERENCES app.referral_awards(id),
        user_id uuid NOT NULL REFERENCES app.users(id), request_key text NOT NULL UNIQUE,
        amount_atomic app.atomic_unit_amount NOT NULL CHECK(amount_atomic>0),
        recovered_atomic app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK(recovered_atomic>=0 AND recovered_atomic<=amount_atomic),
        reason text NOT NULL CHECK(length(reason)>0), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_risk_evidence (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id),
        event_id uuid REFERENCES app.referral_events(id), request_key text NOT NULL UNIQUE,
        signal text NOT NULL, metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object'),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_risk_counters (
        scope_key text NOT NULL, bucket text NOT NULL, amount_atomic app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK(amount_atomic>=0),
        PRIMARY KEY(scope_key,bucket)
      );
      CREATE TABLE app.referral_audit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key text NOT NULL UNIQUE,
        actor_id uuid, action text NOT NULL, object_id uuid, metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.referral_credit_accounts (
        user_id uuid NOT NULL REFERENCES app.users(id), asset_code text NOT NULL CHECK(asset_code='USDT'),
        ledger_account_id uuid NOT NULL UNIQUE REFERENCES app.ledger_accounts(id), PRIMARY KEY(user_id,asset_code)
      );
      CREATE TABLE app.credit_balances (
        user_id uuid NOT NULL, asset_code text NOT NULL CHECK(asset_code='USDT'), asset_decimals smallint NOT NULL DEFAULT 6 CHECK(asset_decimals=6),
        amount_atomic app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK(amount_atomic>=0), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(user_id,asset_code), FOREIGN KEY(user_id,asset_code) REFERENCES app.referral_credit_accounts(user_id,asset_code)
      );
      CREATE TABLE app.credit_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, asset_code text NOT NULL CHECK(asset_code='USDT'),
        delta_atomic app.atomic_unit_amount NOT NULL CHECK(delta_atomic<>0),
        source_key text NOT NULL UNIQUE, award_id uuid REFERENCES app.referral_awards(id),
        ledger_entry_id uuid NOT NULL UNIQUE REFERENCES app.ledger_entries(id),
        ledger_transaction_id uuid NOT NULL REFERENCES app.ledger_transactions(id),
        reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(user_id,asset_code) REFERENCES app.referral_credit_accounts(user_id,asset_code)
      );

      CREATE FUNCTION app.referral_no_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Referral facts are append-only' USING ERRCODE='55000'; END $$;
      CREATE FUNCTION app.referral_settings_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE rate jsonb; key text;
      BEGIN
        FOREACH key IN ARRAY ARRAY['feeRatesBps','holdingRatesBps'] LOOP
          IF jsonb_typeof(NEW.config->key) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.config->key)<>3 THEN
            RAISE EXCEPTION 'Exactly three integer rates required' USING ERRCODE='23514';
          END IF;
          FOR rate IN SELECT value FROM jsonb_array_elements(NEW.config->key) LOOP
            IF jsonb_typeof(rate)<>'number' OR rate::text::numeric<>trunc(rate::text::numeric)
              OR rate::text::numeric NOT BETWEEN 0 AND 10000 THEN
              RAISE EXCEPTION 'Integer basis points required' USING ERRCODE='23514';
            END IF;
          END LOOP;
        END LOOP;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_settings_rates BEFORE INSERT ON app.referral_settings FOR EACH ROW EXECUTE FUNCTION app.referral_settings_guard();
      CREATE FUNCTION app.referral_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE fee record; item jsonb; expected_level integer:=1;
      BEGIN
        SELECT e.transaction_id,e.atomic_amount,t.actor_id,t.reference_id,t.effective_at,t.transaction_type,e.created_at INTO fee
          FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
          JOIN app.ledger_transactions t ON t.id=e.transaction_id
          WHERE e.id=NEW.fee_entry_id AND e.side='credit' AND a.owner_type='platform'
          AND a.owner_reference='prediction_fee' AND a.purpose='fee_revenue' AND a.asset_code='USDT' AND a.asset_decimals=6;
        IF fee.transaction_id IS NULL OR fee.transaction_id<>NEW.ledger_transaction_id OR fee.atomic_amount<>NEW.amount_atomic
          OR fee.actor_id IS DISTINCT FROM NEW.source_user_id OR fee.reference_id<>NEW.business_reference_id
          OR fee.effective_at<>NEW.rate_at OR fee.created_at<>NEW.occurred_at
          OR fee.transaction_type<>(CASE WHEN NEW.fee_component='prediction_place' THEN 'prediction_stake' ELSE 'prediction_payout' END) THEN
          RAISE EXCEPTION 'Referral event must match actual platform fee' USING ERRCODE='23514';
        END IF;
        FOR item IN SELECT value FROM jsonb_array_elements(NEW.ancestors) LOOP
          IF (item->>'level')::integer IS DISTINCT FROM expected_level OR item->>'user_id' IS NULL THEN
            RAISE EXCEPTION 'Ordered three-level beneficiary snapshot required' USING ERRCODE='23514';
          END IF;
          expected_level:=expected_level+1;
        END LOOP;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_event_match BEFORE INSERT ON app.referral_events FOR EACH ROW EXECUTE FUNCTION app.referral_event_guard();
      CREATE FUNCTION app.referral_credit_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS(SELECT 1 FROM app.ledger_accounts WHERE id=NEW.ledger_account_id AND owner_type='user'
          AND user_id=NEW.user_id AND asset_code=NEW.asset_code AND asset_decimals=6 AND normal_side='credit'
          AND network IS NULL AND purpose='pending') THEN
          RAISE EXCEPTION 'Stage-zero credit mapping requires a separate user pending account' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_credit_account_match BEFORE INSERT ON app.referral_credit_accounts FOR EACH ROW EXECUTE FUNCTION app.referral_credit_account_guard();
      CREATE FUNCTION app.referral_edge_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(1790760000);
        IF NOT EXISTS(SELECT 1 FROM app.referral_code_aliases WHERE code=NEW.code AND user_id=NEW.inviter_user_id) THEN
          RAISE EXCEPTION 'Referral code owner mismatch' USING ERRCODE='23514';
        END IF;
        IF EXISTS (WITH RECURSIVE chain(uid,path) AS (
          SELECT NEW.inviter_user_id,ARRAY[NEW.inviter_user_id]
          UNION ALL SELECT e.inviter_user_id,path||e.inviter_user_id FROM chain c
          JOIN app.referral_edges e ON e.invitee_user_id=c.uid WHERE NOT e.inviter_user_id=ANY(path)
        ) SELECT 1 FROM chain WHERE uid=NEW.invitee_user_id) THEN
          RAISE EXCEPTION 'Referral cycle' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_edge_insert BEFORE INSERT ON app.referral_edges FOR EACH ROW EXECUTE FUNCTION app.referral_edge_guard();
      CREATE TRIGGER referral_edge_immutable BEFORE UPDATE OR DELETE ON app.referral_edges FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();

      CREATE FUNCTION app.referral_award_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='INSERT' AND NEW.state<>'candidate' THEN RAISE EXCEPTION 'Award starts as candidate' USING ERRCODE='23514'; END IF;
        IF NOT EXISTS(SELECT 1 FROM app.referral_events WHERE id=NEW.event_id AND settings_version=NEW.settings_version) THEN
          RAISE EXCEPTION 'Award must retain event settings version' USING ERRCODE='23514';
        END IF;
        IF TG_OP='UPDATE' THEN
          IF (to_jsonb(NEW)-ARRAY['state','updated_at','reservation_ledger_transaction_id','claim_ledger_transaction_id','claim_request_key'])
            IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','updated_at','reservation_ledger_transaction_id','claim_ledger_transaction_id','claim_request_key']) THEN
            RAISE EXCEPTION 'Award financial facts immutable' USING ERRCODE='55000';
          END IF;
          IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
            (OLD.state='candidate' AND NEW.state IN ('pending_review','rejected')) OR
            (OLD.state='pending_review' AND NEW.state IN ('approved','rejected')) OR
            (OLD.state='approved' AND NEW.state IN ('available','revoked')) OR
            (OLD.state='available' AND NEW.state IN ('frozen','claimed_credit','claimed_cash','revoked')) OR
            (OLD.state='frozen' AND NEW.state IN ('available','revoked'))
          ) THEN RAISE EXCEPTION 'Illegal award transition' USING ERRCODE='23514'; END IF;
        END IF;
        IF NEW.state IN ('approved','available','frozen','claimed_credit','claimed_cash') THEN
          RAISE EXCEPTION 'Referral payouts disabled in stage zero' USING ERRCODE='55000';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_award_state BEFORE INSERT OR UPDATE ON app.referral_awards FOR EACH ROW EXECUTE FUNCTION app.referral_award_guard();
      CREATE TRIGGER referral_award_no_delete BEFORE DELETE ON app.referral_awards FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();

      CREATE FUNCTION app.referral_credit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE aid uuid; side_sign integer; amt numeric; txn uuid;
      BEGIN
        SELECT ledger_account_id INTO aid FROM app.referral_credit_accounts WHERE user_id=NEW.user_id AND asset_code=NEW.asset_code;
        SELECT CASE WHEN e.side=a.normal_side THEN 1 ELSE -1 END,e.atomic_amount,e.transaction_id
          INTO side_sign,amt,txn FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
          WHERE e.id=NEW.ledger_entry_id AND e.account_id=aid AND a.asset_code=NEW.asset_code AND a.asset_decimals=6;
        IF amt IS NULL OR NEW.delta_atomic<>amt*side_sign OR txn<>NEW.ledger_transaction_id THEN
          RAISE EXCEPTION 'Credit entry does not match ledger' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_credit_match BEFORE INSERT ON app.credit_entries FOR EACH ROW EXECUTE FUNCTION app.referral_credit_guard();
      CREATE FUNCTION app.referral_projection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM app.referral_credit_accounts a
          LEFT JOIN app.credit_balances b USING(user_id,asset_code)
          LEFT JOIN app.ledger_account_balances l ON l.account_id=a.ledger_account_id
          LEFT JOIN (SELECT user_id,asset_code,sum(delta_atomic) AS total FROM app.credit_entries GROUP BY user_id,asset_code) e USING(user_id,asset_code)
          WHERE b.amount_atomic IS NULL OR b.amount_atomic<>coalesce(l.current_atomic_balance,0) OR b.amount_atomic<>coalesce(e.total,0)) THEN
          RAISE EXCEPTION 'Referral credit projection mismatch' USING ERRCODE='23514';
        END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER referral_projection_balance AFTER INSERT OR UPDATE OR DELETE ON app.credit_balances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_projection_guard();
      CREATE CONSTRAINT TRIGGER referral_projection_entry AFTER INSERT ON app.credit_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_projection_guard();
      CREATE CONSTRAINT TRIGGER referral_projection_mapping AFTER INSERT ON app.referral_credit_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_projection_guard();
      CREATE CONSTRAINT TRIGGER referral_projection_ledger AFTER INSERT OR UPDATE ON app.ledger_account_balances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_projection_guard();
    `)
    for (const table of ['referral_settings','referral_events','referral_attributions','referral_registration_decisions','referral_audit','referral_risk_evidence','referral_award_actions','credit_entries','referral_code_aliases','referral_credit_accounts']) {
      await q.query(`CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON app.${table} FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation()`)
    }
    await q.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,'1970-01-01','1970-01-01','1970-01-01')`, [JSON.stringify(REFERRAL_DEFAULT_SETTINGS)])
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM app.referral_events) OR EXISTS(SELECT 1 FROM app.referral_awards)
        OR EXISTS(SELECT 1 FROM app.credit_entries) OR EXISTS(SELECT 1 FROM app.credit_balances WHERE amount_atomic<>0)
        OR EXISTS(SELECT 1 FROM app.referral_edges) OR EXISTS(SELECT 1 FROM app.referral_debts)
        OR EXISTS(SELECT 1 FROM app.referral_registration_decisions) THEN
        RAISE EXCEPTION 'Refuse destructive referral rollback with business or financial records' USING ERRCODE='55000';
      END IF;
    END $$;
    DROP TRIGGER referral_projection_ledger ON app.ledger_account_balances;
    DROP TABLE app.credit_entries,app.credit_balances,app.referral_credit_accounts,app.referral_risk_counters,
      app.referral_debts,app.referral_award_actions,app.referral_risk_evidence,app.referral_audit,
      app.referral_awards,app.referral_events,app.referral_oauth_attributions,app.referral_registration_decisions,
      app.referral_attributions,app.referral_edges,app.referral_codes,app.referral_code_aliases,app.referral_settings,app.referral_runtime;
    DROP FUNCTION app.referral_projection_guard(),app.referral_credit_guard(),app.referral_credit_account_guard(),app.referral_event_guard(),app.referral_settings_guard(),app.referral_award_guard(),app.referral_edge_guard(),app.referral_no_mutation();`)
  }
}
