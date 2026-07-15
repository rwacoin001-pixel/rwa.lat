import type { MigrationInterface, QueryRunner } from 'typeorm'

// DB-006: Polymarket market/token mapping, cursor watermarks, external order
// lifecycle, immutable inbound events, settlement evidence and reconciliation.
export class CreatePolymarketIntegrationModel1783791000000 implements MigrationInterface {
  name = 'CreatePolymarketIntegrationModel1783791000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.polymarket_market_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid UNIQUE REFERENCES app.products(id) ON DELETE RESTRICT,
        gamma_market_id text NOT NULL UNIQUE,
        condition_id text UNIQUE,
        slug text NOT NULL,
        question text NOT NULL,
        state text NOT NULL DEFAULT 'discovered'
          CHECK (state IN ('discovered', 'active', 'closed', 'resolved', 'archived', 'suspended')),
        restricted boolean NOT NULL DEFAULT false,
        enable_order_book boolean NOT NULL DEFAULT false,
        resolution_source text,
        market_start_at timestamptz,
        market_end_at timestamptz,
        provider_updated_at timestamptz,
        last_synced_at timestamptz NOT NULL,
        raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
          CHECK (jsonb_typeof(raw_payload) = 'object'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (market_start_at IS NULL OR market_end_at IS NULL OR market_end_at >= market_start_at),
        CHECK (state <> 'active' OR condition_id IS NOT NULL)
      );

      CREATE INDEX polymarket_market_state_sync_idx
        ON app.polymarket_market_mappings(state, last_synced_at DESC);
      CREATE INDEX polymarket_market_condition_idx
        ON app.polymarket_market_mappings(condition_id) WHERE condition_id IS NOT NULL;

      CREATE TABLE app.polymarket_token_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        market_mapping_id uuid NOT NULL
          REFERENCES app.polymarket_market_mappings(id) ON DELETE CASCADE,
        token_id text NOT NULL UNIQUE,
        outcome text NOT NULL,
        outcome_index smallint NOT NULL CHECK (outcome_index >= 0),
        state text NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'inactive', 'resolved')),
        tick_size numeric(38, 18) CHECK (tick_size > 0 AND tick_size <= 1),
        min_order_size numeric(38, 18) CHECK (min_order_size > 0),
        last_book_hash text,
        last_book_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (market_mapping_id, outcome_index),
        UNIQUE (market_mapping_id, outcome)
      );

      CREATE INDEX polymarket_token_market_state_idx
        ON app.polymarket_token_mappings(market_mapping_id, state);

      CREATE TABLE app.polymarket_sync_watermarks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL DEFAULT 'polymarket',
        stream text NOT NULL
          CHECK (stream IN ('gamma_markets', 'clob_market', 'clob_user', 'data_positions', 'settlements')),
        cursor text,
        state text NOT NULL DEFAULT 'idle'
          CHECK (state IN ('idle', 'running', 'degraded', 'paused')),
        last_event_at timestamptz,
        last_success_at timestamptz,
        consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
        last_error_code text,
        last_error_at timestamptz,
        lease_owner text,
        lease_expires_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, stream),
        CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
      );

      CREATE TABLE app.polymarket_order_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        local_order_id uuid NOT NULL UNIQUE REFERENCES app.orders(id) ON DELETE RESTRICT,
        market_mapping_id uuid NOT NULL
          REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        token_mapping_id uuid NOT NULL
          REFERENCES app.polymarket_token_mappings(id) ON DELETE RESTRICT,
        provider text NOT NULL DEFAULT 'polymarket',
        external_order_id text,
        client_order_key text NOT NULL UNIQUE,
        side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
        order_type text NOT NULL CHECK (order_type IN ('GTC', 'GTD', 'FOK', 'FAK')),
        state text NOT NULL DEFAULT 'awaiting_user_signature'
          CHECK (state IN (
            'awaiting_user_signature', 'signed', 'submitting', 'live',
            'partially_filled', 'filled', 'cancelled', 'rejected', 'failed'
          )),
        original_size numeric(38, 18) NOT NULL CHECK (original_size > 0),
        matched_size numeric(38, 18) NOT NULL DEFAULT 0
          CHECK (matched_size >= 0 AND matched_size <= original_size),
        limit_price numeric(38, 18) NOT NULL CHECK (limit_price > 0 AND limit_price < 1),
        revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
        submitted_at timestamptz,
        provider_updated_at timestamptz,
        last_reconciled_at timestamptz,
        raw_response jsonb CHECK (raw_response IS NULL OR jsonb_typeof(raw_response) = 'object'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, external_order_id),
        CHECK (state IN ('awaiting_user_signature', 'signed', 'submitting') OR external_order_id IS NOT NULL),
        CHECK (state <> 'filled' OR matched_size = original_size)
      );

      CREATE INDEX polymarket_order_state_updated_idx
        ON app.polymarket_order_mappings(state, updated_at DESC);
      CREATE INDEX polymarket_order_market_idx
        ON app.polymarket_order_mappings(market_mapping_id, created_at DESC);

      CREATE TABLE app.polymarket_external_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL DEFAULT 'polymarket',
        channel text NOT NULL CHECK (channel IN ('market', 'user', 'rest_reconciliation')),
        external_event_key text NOT NULL,
        event_type text NOT NULL,
        market_condition_id text,
        external_order_id text,
        occurred_at timestamptz NOT NULL,
        payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
        payload_sha256 bytea NOT NULL CHECK (octet_length(payload_sha256) = 32),
        processing_state text NOT NULL DEFAULT 'received'
          CHECK (processing_state IN ('received', 'processing', 'processed', 'ignored', 'failed')),
        processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
        last_error_code text,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        UNIQUE (provider, channel, external_event_key),
        CHECK ((processing_state IN ('processed', 'ignored')) = (processed_at IS NOT NULL))
      );

      CREATE INDEX polymarket_event_processing_idx
        ON app.polymarket_external_events(processing_state, received_at);
      CREATE INDEX polymarket_event_order_idx
        ON app.polymarket_external_events(external_order_id, occurred_at)
        WHERE external_order_id IS NOT NULL;

      CREATE OR REPLACE FUNCTION app.protect_polymarket_event_payload()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.provider IS DISTINCT FROM OLD.provider
          OR NEW.channel IS DISTINCT FROM OLD.channel
          OR NEW.external_event_key IS DISTINCT FROM OLD.external_event_key
          OR NEW.event_type IS DISTINCT FROM OLD.event_type
          OR NEW.market_condition_id IS DISTINCT FROM OLD.market_condition_id
          OR NEW.external_order_id IS DISTINCT FROM OLD.external_order_id
          OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
          OR NEW.payload IS DISTINCT FROM OLD.payload
          OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
          OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
          RAISE EXCEPTION 'polymarket external event evidence is immutable';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER polymarket_external_events_payload_immutable
        BEFORE UPDATE ON app.polymarket_external_events
        FOR EACH ROW EXECUTE FUNCTION app.protect_polymarket_event_payload();

      CREATE TRIGGER polymarket_external_events_no_delete
        BEFORE DELETE ON app.polymarket_external_events
        FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TABLE app.polymarket_settlement_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        market_mapping_id uuid NOT NULL
          REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        provider text NOT NULL DEFAULT 'polymarket',
        external_settlement_id text NOT NULL,
        winning_token_mapping_id uuid
          REFERENCES app.polymarket_token_mappings(id) ON DELETE RESTRICT,
        outcome text NOT NULL,
        state text NOT NULL DEFAULT 'observed'
          CHECK (state IN ('observed', 'confirmed', 'disputed', 'reversed')),
        payout_value numeric(38, 18) NOT NULL CHECK (payout_value >= 0 AND payout_value <= 1),
        resolved_at timestamptz NOT NULL,
        confirmed_at timestamptz,
        raw_payload jsonb NOT NULL CHECK (jsonb_typeof(raw_payload) = 'object'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, external_settlement_id),
        UNIQUE (market_mapping_id),
        CHECK (state <> 'confirmed' OR confirmed_at IS NOT NULL)
      );

      CREATE TABLE app.polymarket_reconciliation_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        market_mapping_id uuid
          REFERENCES app.polymarket_market_mappings(id) ON DELETE RESTRICT,
        local_order_id uuid REFERENCES app.orders(id) ON DELETE RESTRICT,
        order_mapping_id uuid
          REFERENCES app.polymarket_order_mappings(id) ON DELETE RESTRICT,
        case_type text NOT NULL
          CHECK (case_type IN (
            'missing_local_order', 'missing_external_order', 'order_state_mismatch',
            'matched_size_mismatch', 'settlement_mismatch', 'payout_mismatch'
          )),
        severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        state text NOT NULL DEFAULT 'open'
          CHECK (state IN ('open', 'investigating', 'resolved', 'ignored')),
        external_reference text,
        expected jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(expected) = 'object'),
        actual jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(actual) = 'object'),
        detected_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        resolution_code text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((state IN ('resolved', 'ignored')) = (resolved_at IS NOT NULL)),
        CHECK (state NOT IN ('resolved', 'ignored') OR resolution_code IS NOT NULL)
      );

      CREATE INDEX polymarket_reconciliation_state_idx
        ON app.polymarket_reconciliation_cases(state, severity, detected_at);
      CREATE UNIQUE INDEX polymarket_reconciliation_open_unique_idx
        ON app.polymarket_reconciliation_cases(case_type, external_reference)
        WHERE state IN ('open', 'investigating') AND external_reference IS NOT NULL;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.polymarket_reconciliation_cases;
      DROP TABLE IF EXISTS app.polymarket_settlement_mappings;
      DROP TABLE IF EXISTS app.polymarket_external_events;
      DROP FUNCTION IF EXISTS app.protect_polymarket_event_payload();
      DROP TABLE IF EXISTS app.polymarket_order_mappings;
      DROP TABLE IF EXISTS app.polymarket_sync_watermarks;
      DROP TABLE IF EXISTS app.polymarket_token_mappings;
      DROP TABLE IF EXISTS app.polymarket_market_mappings;
    `)
  }
}
