import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Prospective only. This migration creates no rewards, claims or ledger transfers. */
export class ReferralTeamSettlement1792700010000 implements MigrationInterface {
  name = 'ReferralTeamSettlement1792700010000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.referral_team_activation (
        singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
        activated_at timestamptz NOT NULL DEFAULT now(),
        settings_version integer NOT NULL REFERENCES app.referral_settings(version)
      );
      INSERT INTO app.referral_team_activation(settings_version) SELECT version FROM app.referral_settings
        WHERE team_effective_at<=now() ORDER BY team_effective_at DESC,version DESC LIMIT 1;
      CREATE TRIGGER referral_team_activation_immutable BEFORE UPDATE OR DELETE ON app.referral_team_activation
        FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();
      CREATE TABLE app.referral_team_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), month text NOT NULL CHECK(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
        starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
        settings_version integer NOT NULL REFERENCES app.referral_settings(version),
        source_hash text NOT NULL, total_atomic app.atomic_unit_amount NOT NULL CHECK(total_atomic>=0),
        status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','cancelled')),
        approved_by uuid, approved_at timestamptz, paid_by uuid, paid_at timestamptz,
        ledger_transaction_id uuid UNIQUE REFERENCES app.ledger_transactions(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX referral_team_current_month ON app.referral_team_batches(month) WHERE status<>'cancelled';
      CREATE TABLE app.referral_team_awards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES app.referral_team_batches(id),
        user_id uuid NOT NULL REFERENCES app.users(id), base_atomic app.atomic_unit_amount NOT NULL CHECK(base_atomic>0),
        amount_atomic app.atomic_unit_amount NOT NULL CHECK(amount_atomic>0), UNIQUE(batch_id,user_id)
      );
      CREATE INDEX referral_team_awards_user ON app.referral_team_awards(user_id,batch_id);

      CREATE FUNCTION app.referral_team_amount(base numeric,tiers jsonb) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
      DECLARE t jsonb; result numeric:=0; lo numeric; hi numeric;
      BEGIN
        IF base<=0 THEN RETURN 0; END IF;
        FOR t IN SELECT * FROM jsonb_array_elements(tiers) LOOP
          lo:=(t->>'fromAtomic')::numeric; hi:=coalesce((t->>'toAtomic')::numeric,base);
          result:=result+floor(greatest(0,least(base,hi)-lo)*(t->>'rateBps')::numeric/10000);
        END LOOP;
        RETURN result;
      END $$;

      CREATE FUNCTION app.referral_team_basis(starts timestamptz,ends timestamptz,cfg jsonb)
        RETURNS TABLE(user_id uuid,base_atomic numeric,active boolean) LANGUAGE plpgsql STABLE AS $$
      BEGIN
        IF (cfg->>'teamEnabled') IS DISTINCT FROM 'true' THEN RETURN; END IF;
        -- Never silently ignore a fee correction that cannot be attributed to a source customer.
        IF EXISTS(SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
          JOIN app.ledger_transactions t ON t.id=e.transaction_id
          WHERE a.owner_type='platform' AND a.owner_reference='prediction_fee' AND a.purpose='fee_revenue'
            AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL
            AND e.side='debit' AND t.transaction_type<>'referral_reward' AND t.effective_at>=starts AND t.effective_at<ends
            AND NOT EXISTS(SELECT 1 FROM app.ledger_transactions original JOIN app.users u ON u.id=original.actor_id
              WHERE original.id=t.reverses_transaction_id AND original.transaction_type IN ('prediction_stake','prediction_payout'))) THEN
          RAISE EXCEPTION 'Team fee correction requires attributable source user' USING ERRCODE='23514';
        END IF;
        RETURN QUERY WITH RECURSIVE fees AS (
          SELECT e.id,CASE WHEN e.side='debit' THEN original.actor_id ELSE t.actor_id END AS source_user,
            CASE WHEN e.side='debit' THEN original.effective_at ELSE t.effective_at END AS occurred_at,
            CASE WHEN e.side='credit' THEN e.atomic_amount ELSE -e.atomic_amount END AS amount
          FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id JOIN app.ledger_transactions t ON t.id=e.transaction_id
            LEFT JOIN app.ledger_transactions original ON original.id=t.reverses_transaction_id
          WHERE a.owner_type='platform' AND a.owner_reference='prediction_fee' AND a.purpose='fee_revenue'
            AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL
            AND t.effective_at>=starts AND t.effective_at<ends
            AND EXISTS(SELECT 1 FROM app.users u WHERE u.id=CASE WHEN e.side='debit' THEN original.actor_id ELSE t.actor_id END)
            AND ((e.side='credit' AND ((t.transaction_type='prediction_stake' AND cfg->'feeComponents' ? 'prediction_place')
              OR (t.transaction_type='prediction_payout' AND cfg->'feeComponents' ? 'prediction_payout')))
              OR (e.side='debit' AND t.transaction_type<>'referral_reward'
                AND original.effective_at>=(SELECT activated_at FROM app.referral_team_activation)
                AND ((original.transaction_type='prediction_stake' AND cfg->'feeComponents' ? 'prediction_place')
                  OR (original.transaction_type='prediction_payout' AND cfg->'feeComponents' ? 'prediction_payout'))))
        ), up AS (
          SELECT f.id,f.source_user,f.occurred_at,f.amount,e.inviter_user_id AS beneficiary,1 AS depth,ARRAY[f.source_user,e.inviter_user_id] AS path
            FROM fees f JOIN app.referral_edges e ON e.invitee_user_id=f.source_user AND e.bound_at<=f.occurred_at
          UNION ALL
          SELECT u.id,u.source_user,u.occurred_at,u.amount,e.inviter_user_id,u.depth+1,u.path||e.inviter_user_id
            FROM up u JOIN app.referral_edges e ON e.invitee_user_id=u.beneficiary AND e.bound_at<=u.occurred_at
            WHERE u.depth<least(3,(cfg->>'teamDepth')::integer) AND NOT e.inviter_user_id=ANY(u.path)
        ), net AS (SELECT beneficiary,source_user,depth,sum(amount) AS amount FROM up GROUP BY beneficiary,source_user,depth)
        SELECT beneficiary,greatest(0,sum(amount)),bool_or(depth=1 AND amount>0) FROM net GROUP BY beneficiary;
      END $$;

      CREATE FUNCTION app.referral_team_award_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE b app.referral_team_batches; cfg jsonb; basis record;
      BEGIN
        SELECT * INTO b FROM app.referral_team_batches WHERE id=NEW.batch_id FOR SHARE;
        SELECT config INTO cfg FROM app.referral_settings WHERE version=b.settings_version;
        SELECT * INTO basis FROM app.referral_team_basis(b.starts_at,b.ends_at,cfg) WHERE user_id=NEW.user_id;
        IF b.status<>'pending' OR NOT coalesce(basis.active,false) OR basis.base_atomic<>NEW.base_atomic
          OR app.referral_team_amount(NEW.base_atomic,cfg->'teamTiers')<>NEW.amount_atomic THEN
          RAISE EXCEPTION 'Team award must match eligible net fees and progressive policy' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_team_award_valid BEFORE INSERT ON app.referral_team_awards FOR EACH ROW EXECUTE FUNCTION app.referral_team_award_guard();
      CREATE TRIGGER referral_team_award_immutable BEFORE UPDATE OR DELETE ON app.referral_team_awards FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();
      CREATE TRIGGER referral_team_batch_no_delete BEFORE DELETE ON app.referral_team_batches FOR EACH ROW EXECUTE FUNCTION app.referral_no_mutation();

      CREATE FUNCTION app.referral_team_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE activation timestamptz; expected_start timestamptz; expected_end timestamptz;
      BEGIN
        SELECT activated_at INTO activation FROM app.referral_team_activation;
        expected_start:=to_date(NEW.month||'-01','YYYY-MM-DD')::timestamp AT TIME ZONE 'Asia/Shanghai';
        expected_end:=(to_date(NEW.month||'-01','YYYY-MM-DD')+interval '1 month')::timestamp AT TIME ZONE 'Asia/Shanghai';
        IF NEW.starts_at<>greatest(expected_start,activation) OR NEW.ends_at<>expected_end OR expected_end>now() OR expected_end<=activation THEN
          RAISE EXCEPTION 'Team month must be closed and within prospective activation' USING ERRCODE='23514';
        END IF;
        IF TG_OP='INSERT' THEN
          IF NEW.status<>'pending' OR NEW.approved_by IS NOT NULL OR NEW.paid_by IS NOT NULL OR NEW.ledger_transaction_id IS NOT NULL THEN
            RAISE EXCEPTION 'Team batch starts pending review' USING ERRCODE='23514';
          END IF;
        ELSE
          IF (to_jsonb(NEW)-ARRAY['status','approved_by','approved_at','paid_by','paid_at','ledger_transaction_id']) IS DISTINCT FROM
            (to_jsonb(OLD)-ARRAY['status','approved_by','approved_at','paid_by','paid_at','ledger_transaction_id']) OR NOT
            ((OLD.status='pending' AND NEW.status IN ('approved','cancelled')) OR (OLD.status='approved' AND NEW.status IN ('paid','cancelled'))) THEN
            RAISE EXCEPTION 'Illegal or immutable team batch transition' USING ERRCODE='55000';
          END IF;
          IF NEW.status='approved' AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL OR NEW.paid_by IS NOT NULL) THEN
            RAISE EXCEPTION 'Team batch approval requires an identified reviewer' USING ERRCODE='23514';
          END IF;
          IF OLD.status='approved' AND (NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
            RAISE EXCEPTION 'Team approval facts are immutable' USING ERRCODE='55000';
          END IF;
          IF NEW.status='paid' AND (NEW.paid_by IS NULL OR NEW.paid_at IS NULL OR (NEW.total_atomic>0 AND NEW.ledger_transaction_id IS NULL)) THEN
            RAISE EXCEPTION 'Team payout requires a funded ledger transaction' USING ERRCODE='23514';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER referral_team_batch_valid BEFORE INSERT OR UPDATE ON app.referral_team_batches FOR EACH ROW EXECUTE FUNCTION app.referral_team_batch_guard();

      CREATE FUNCTION app.referral_team_batch_consistent() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE actual numeric; cfg jsonb; expected numeric;
      BEGIN
        SELECT coalesce(sum(amount_atomic),0) INTO actual FROM app.referral_team_awards WHERE batch_id=NEW.id;
        IF actual<>NEW.total_atomic THEN RAISE EXCEPTION 'Team batch total differs from its awards' USING ERRCODE='23514'; END IF;
        IF NEW.status IN ('approved','paid') THEN
          SELECT config INTO cfg FROM app.referral_settings WHERE version=NEW.settings_version;
          SELECT coalesce(sum(app.referral_team_amount(base_atomic,cfg->'teamTiers')),0) INTO expected
            FROM app.referral_team_basis(NEW.starts_at,NEW.ends_at,cfg) WHERE active;
          IF expected<>NEW.total_atomic OR EXISTS(SELECT 1 FROM app.referral_team_awards a LEFT JOIN app.referral_team_basis(NEW.starts_at,NEW.ends_at,cfg) b ON a.user_id=b.user_id
            WHERE a.batch_id=NEW.id AND (b.user_id IS NULL OR NOT b.active OR b.base_atomic<>a.base_atomic OR app.referral_team_amount(b.base_atomic,cfg->'teamTiers')<>a.amount_atomic)) THEN
            RAISE EXCEPTION 'Team fees changed; regenerate and review the batch' USING ERRCODE='23514';
          END IF;
        END IF;
        IF NEW.status='paid' AND NEW.total_atomic>0 THEN
          IF NOT EXISTS(SELECT 1 FROM app.ledger_transactions t JOIN app.ledger_entries e ON e.transaction_id=t.id JOIN app.ledger_accounts a ON a.id=e.account_id
            WHERE t.id=NEW.ledger_transaction_id AND t.transaction_type='referral_reward' AND t.reference_type='referral_team_batch' AND t.reference_id=NEW.id
              AND e.side='debit' AND e.atomic_amount=NEW.total_atomic AND a.owner_type='platform' AND a.owner_reference='prediction_fee'
              AND a.purpose='fee_revenue' AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL AND NOT a.allow_negative)
            OR EXISTS(SELECT 1 FROM app.referral_team_awards r WHERE r.batch_id=NEW.id AND NOT EXISTS(
              SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
                WHERE e.transaction_id=NEW.ledger_transaction_id AND e.side='credit' AND e.atomic_amount=r.amount_atomic
                  AND a.owner_type='user' AND a.user_id=r.user_id AND a.purpose='available' AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.network IS NULL)) THEN
            RAISE EXCEPTION 'Team payout must match its funded budget and each user credit' USING ERRCODE='23514';
          END IF;
        END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER referral_team_batch_matches AFTER INSERT OR UPDATE ON app.referral_team_batches
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.referral_team_batch_consistent();
    `)
  }
  async down(): Promise<void> { throw new Error('Forward-only: team activation and financial audit records must be preserved') }
}
