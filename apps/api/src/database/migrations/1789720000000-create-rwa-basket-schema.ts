import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * RWA 资产目录 + AI Basket —— Phase 1 Schema
 * 22 张表：目录 8 / 分析 2 / 策略 3 / 组合 2 / NAV 1 / 申赎 2 / 调仓 2 / 披露 2
 * 约定：app schema、uuid 默认 gen_random_uuid()、timestamptz UTC、金额/价格/份额 numeric(36,18)。
 */
export class CreateRwaBasketSchema1789720000000 implements MigrationInterface {
  name = 'CreateRwaBasketSchema1789720000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- ============ 目录：发行商 ============
      CREATE TABLE app.rwa_issuers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(200) NOT NULL,
        slug varchar(120) NOT NULL UNIQUE,
        description text,
        country_code varchar(8),
        website_url varchar(500),
        logo_url varchar(500),
        verified boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- ============ 目录：网络 ============
      CREATE TABLE app.rwa_networks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        slug varchar(80) NOT NULL UNIQUE,
        chain_id varchar(64),
        native_symbol varchar(32),
        explorer_url varchar(500),
        logo_url varchar(500),
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- ============ 目录：资产 ============
      CREATE TABLE app.rwa_assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(160) NOT NULL UNIQUE,
        name varchar(200) NOT NULL,
        symbol varchar(32),
        asset_class varchar(32) NOT NULL CHECK (asset_class IN (
          'treasury','money_market','private_credit','real_estate','commodity',
          'equity','bond','fund','currency','stable_value','other')),
        description text,
        issuer_id uuid REFERENCES app.rwa_issuers(id) ON DELETE SET NULL,
        country_code varchar(8),
        region varchar(64),
        website_url varchar(500),
        logo_url varchar(500),
        status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','delisted')),
        rwa_rank int,
        is_tokenized boolean NOT NULL DEFAULT false,
        is_verified boolean NOT NULL DEFAULT false,
        is_featured boolean NOT NULL DEFAULT false,
        eligibility_type varchar(32) NOT NULL DEFAULT 'unknown'
          CHECK (eligibility_type IN ('public','accredited','restricted','unknown')),
        redemption_type varchar(32) NOT NULL DEFAULT 'unknown'
          CHECK (redemption_type IN ('instant','daily','periodic','restricted','unknown')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX rwa_assets_class_idx ON app.rwa_assets (asset_class);
      CREATE INDEX rwa_assets_rank_idx ON app.rwa_assets (rwa_rank);
      CREATE INDEX rwa_assets_issuer_idx ON app.rwa_assets (issuer_id);

      -- ============ 目录：合约 ============
      CREATE TABLE app.rwa_asset_contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        network_id uuid NOT NULL REFERENCES app.rwa_networks(id) ON DELETE RESTRICT,
        contract_address varchar(200) NOT NULL,
        token_name varchar(200),
        token_symbol varchar(64),
        decimals int,
        token_standard varchar(32),
        verified boolean NOT NULL DEFAULT false,
        transfer_restricted boolean NOT NULL DEFAULT false,
        whitelist_required boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rwa_asset_contracts_network_addr_unique UNIQUE (network_id, contract_address)
      );
      CREATE INDEX rwa_asset_contracts_asset_idx ON app.rwa_asset_contracts (asset_id);

      -- ============ 目录：Provider 映射 ============
      CREATE TABLE app.rwa_asset_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        provider varchar(40) NOT NULL,
        external_id varchar(120) NOT NULL,
        external_slug varchar(160),
        source_url varchar(500),
        last_synced_at timestamptz,
        last_successful_sync_at timestamptz,
        sync_status varchar(24) NOT NULL DEFAULT 'pending'
          CHECK (sync_status IN ('pending','ok','partial','failed')),
        raw_metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rwa_asset_sources_provider_ext_unique UNIQUE (provider, external_id)
      );
      CREATE INDEX rwa_asset_sources_asset_idx ON app.rwa_asset_sources (asset_id);

      -- ============ 目录：最新指标（UPSERT） ============
      CREATE TABLE app.rwa_asset_metrics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL UNIQUE REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        price_usd numeric(36,18),
        market_cap_usd numeric(36,18),
        tokenized_market_cap_usd numeric(36,18),
        tvl_usd numeric(36,18),
        volume_24h_usd numeric(36,18),
        apy numeric(18,8),
        holders bigint,
        total_supply numeric(36,18),
        change_24h_pct numeric(18,8),
        change_7d_pct numeric(18,8),
        change_30d_pct numeric(18,8),
        liquidity_score numeric(18,8),
        data_timestamp timestamptz,
        source varchar(40),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- ============ 目录：日快照 ============
      CREATE TABLE app.rwa_asset_metric_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        date date NOT NULL,
        price_usd numeric(36,18),
        market_cap_usd numeric(36,18),
        tvl_usd numeric(36,18),
        volume_24h_usd numeric(36,18),
        apy numeric(18,8),
        holders bigint,
        total_supply numeric(36,18),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rwa_asset_metric_history_asset_date_unique UNIQUE (asset_id, date)
      );

      -- ============ 目录：同步运行记录 ============
      CREATE TABLE app.rwa_sync_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider varchar(40) NOT NULL,
        kind varchar(32) NOT NULL CHECK (kind IN ('assets','issuers','metrics','snapshot')),
        status varchar(16) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','running','success','partial','failed')),
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz,
        items_total int,
        items_upserted int,
        items_failed int,
        error text,
        meta jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX rwa_sync_runs_provider_idx ON app.rwa_sync_runs (provider, kind, started_at DESC);

      -- ============ 分析：量化评分 ============
      CREATE TABLE app.rwa_asset_scores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        score_version varchar(32) NOT NULL,
        yield_score numeric(8,2),
        liquidity_score numeric(8,2),
        issuer_score numeric(8,2),
        collateral_score numeric(8,2),
        redemption_score numeric(8,2),
        contract_risk_score numeric(8,2),
        concentration_score numeric(8,2),
        market_risk_score numeric(8,2),
        data_quality_score numeric(8,2),
        overall_score numeric(8,2),
        risk_level varchar(16) CHECK (risk_level IN ('low','medium','high','critical')),
        calculated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rwa_asset_scores_asset_version_unique UNIQUE (asset_id, score_version)
      );

      -- ============ 分析：AI 研究输出 ============
      CREATE TABLE app.rwa_ai_analysis (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE CASCADE,
        model varchar(80) NOT NULL,
        analysis_version varchar(32) NOT NULL,
        summary text,
        bull_case text,
        bear_case text,
        risk_summary text,
        liquidity_analysis text,
        issuer_analysis text,
        redemption_analysis text,
        contract_analysis text,
        structured_signals jsonb,
        input_data_timestamp timestamptz,
        generated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX rwa_ai_analysis_asset_idx ON app.rwa_ai_analysis (asset_id, generated_at DESC);

      -- ============ 策略 ============
      CREATE TABLE app.basket_strategies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(120) NOT NULL UNIQUE,
        name varchar(160) NOT NULL,
        description text,
        status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','retired')),
        risk_level varchar(16) CHECK (risk_level IN ('low','medium','high')),
        base_currency varchar(16) NOT NULL DEFAULT 'USDT',
        benchmark varchar(120),
        rebalance_mode varchar(16) NOT NULL DEFAULT 'manual' CHECK (rebalance_mode IN ('manual','auto')),
        rebalance_frequency varchar(24) NOT NULL DEFAULT 'weekly',
        minimum_subscription_usd numeric(36,18),
        minimum_redemption_usd numeric(36,18),
        cash_buffer_target_pct numeric(9,4),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE app.basket_strategy_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        strategy_id uuid NOT NULL REFERENCES app.basket_strategies(id) ON DELETE CASCADE,
        version int NOT NULL,
        effective_from timestamptz NOT NULL DEFAULT now(),
        effective_to timestamptz,
        status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
        methodology jsonb,
        risk_rules jsonb,
        scoring_weights jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT basket_strategy_versions_unique UNIQUE (strategy_id, version)
      );

      CREATE TABLE app.basket_strategy_assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        strategy_version_id uuid NOT NULL REFERENCES app.basket_strategy_versions(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE RESTRICT,
        target_weight_pct numeric(9,4) NOT NULL,
        min_weight_pct numeric(9,4),
        max_weight_pct numeric(9,4),
        score numeric(8,2),
        inclusion_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT basket_strategy_assets_unique UNIQUE (strategy_version_id, asset_id)
      );

      -- ============ 组合 ============
      CREATE TABLE app.basket_portfolios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        strategy_id uuid NOT NULL REFERENCES app.basket_strategies(id) ON DELETE RESTRICT,
        strategy_version_id uuid REFERENCES app.basket_strategy_versions(id) ON DELETE SET NULL,
        name varchar(160) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pilot','active','closed')),
        base_currency varchar(16) NOT NULL DEFAULT 'USDT',
        total_units numeric(36,18) NOT NULL DEFAULT 0,
        nav_per_unit numeric(36,18),
        aum_usd numeric(36,18),
        cash_balance_usd numeric(36,18) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_portfolios_strategy_idx ON app.basket_portfolios (strategy_id);

      CREATE TABLE app.basket_holdings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id uuid NOT NULL REFERENCES app.basket_portfolios(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE RESTRICT,
        network_id uuid REFERENCES app.rwa_networks(id) ON DELETE RESTRICT,
        quantity numeric(36,18) NOT NULL DEFAULT 0,
        cost_basis_usd numeric(36,18),
        market_value_usd numeric(36,18),
        target_weight_pct numeric(9,4),
        actual_weight_pct numeric(9,4),
        unrealized_pnl_usd numeric(36,18),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT basket_holdings_unique UNIQUE NULLS NOT DISTINCT (portfolio_id, asset_id, network_id)
      );

      -- ============ NAV ============
      CREATE TABLE app.basket_nav_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id uuid NOT NULL REFERENCES app.basket_portfolios(id) ON DELETE CASCADE,
        timestamp timestamptz NOT NULL DEFAULT now(),
        gross_asset_value_usd numeric(36,18),
        liabilities_usd numeric(36,18),
        net_asset_value_usd numeric(36,18),
        total_units numeric(36,18),
        nav_per_unit numeric(36,18),
        cash_usd numeric(36,18),
        data_quality varchar(16) NOT NULL DEFAULT 'ok' CHECK (data_quality IN ('ok','stale','partial')),
        pricing_timestamp timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_nav_snapshots_portfolio_idx ON app.basket_nav_snapshots (portfolio_id, timestamp DESC);

      -- ============ 申赎 ============
      CREATE TABLE app.basket_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        portfolio_id uuid NOT NULL REFERENCES app.basket_portfolios(id) ON DELETE RESTRICT,
        amount_usd numeric(36,18) NOT NULL,
        nav_per_unit numeric(36,18),
        units_issued numeric(36,18),
        status varchar(16) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','pricing','investing','settled','failed','cancelled')),
        requested_at timestamptz NOT NULL DEFAULT now(),
        priced_at timestamptz,
        settled_at timestamptz,
        ledger_reference varchar(120),
        idempotency_key varchar(160) UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_subscriptions_user_idx ON app.basket_subscriptions (user_id, requested_at DESC);
      CREATE INDEX basket_subscriptions_portfolio_idx ON app.basket_subscriptions (portfolio_id);

      CREATE TABLE app.basket_redemptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        portfolio_id uuid NOT NULL REFERENCES app.basket_portfolios(id) ON DELETE RESTRICT,
        units numeric(36,18) NOT NULL,
        nav_per_unit numeric(36,18),
        gross_amount_usd numeric(36,18),
        fees_usd numeric(36,18),
        net_amount_usd numeric(36,18),
        status varchar(16) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','pricing','investing','settled','failed','cancelled')),
        requested_at timestamptz NOT NULL DEFAULT now(),
        priced_at timestamptz,
        settled_at timestamptz,
        ledger_reference varchar(120),
        idempotency_key varchar(160) UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_redemptions_user_idx ON app.basket_redemptions (user_id, requested_at DESC);
      CREATE INDEX basket_redemptions_portfolio_idx ON app.basket_redemptions (portfolio_id);

      -- ============ 调仓 ============
      CREATE TABLE app.basket_rebalance_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id uuid NOT NULL REFERENCES app.basket_portfolios(id) ON DELETE RESTRICT,
        strategy_version_id uuid REFERENCES app.basket_strategy_versions(id) ON DELETE SET NULL,
        trigger_type varchar(16) NOT NULL CHECK (trigger_type IN ('scheduled','drift','risk','manual')),
        status varchar(16) NOT NULL DEFAULT 'planned'
          CHECK (status IN ('planned','running','completed','failed','cancelled')),
        pre_nav numeric(36,18),
        post_nav numeric(36,18),
        estimated_turnover_pct numeric(9,4),
        actual_turnover_pct numeric(9,4),
        reason text,
        ai_analysis_id uuid REFERENCES app.rwa_ai_analysis(id) ON DELETE SET NULL,
        risk_evaluation jsonb,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_rebalance_runs_portfolio_idx ON app.basket_rebalance_runs (portfolio_id, created_at DESC);

      CREATE TABLE app.basket_rebalance_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rebalance_run_id uuid NOT NULL REFERENCES app.basket_rebalance_runs(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES app.rwa_assets(id) ON DELETE RESTRICT,
        side varchar(8) NOT NULL CHECK (side IN ('buy','sell')),
        target_quantity numeric(36,18),
        executed_quantity numeric(36,18),
        estimated_price numeric(36,18),
        average_fill_price numeric(36,18),
        max_slippage_pct numeric(9,4),
        status varchar(16) NOT NULL DEFAULT 'planned'
          CHECK (status IN ('planned','quoted','executing','filled','partial','failed','cancelled')),
        execution_route varchar(32)
          CHECK (execution_route IN ('dex','cex','issuer_subscription','issuer_redemption','broker','otc','manual')),
        external_order_id varchar(120),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX basket_rebalance_orders_run_idx ON app.basket_rebalance_orders (rebalance_run_id);

      -- ============ 风险披露 ============
      CREATE TABLE app.risk_disclosures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_type varchar(32) NOT NULL DEFAULT 'basket',
        strategy_id uuid REFERENCES app.basket_strategies(id) ON DELETE SET NULL,
        version int NOT NULL,
        title varchar(200) NOT NULL,
        content text NOT NULL,
        effective_from timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT risk_disclosures_strategy_version_unique UNIQUE NULLS NOT DISTINCT (strategy_id, version)
      );

      CREATE TABLE app.user_risk_acknowledgements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        disclosure_id uuid NOT NULL REFERENCES app.risk_disclosures(id) ON DELETE CASCADE,
        accepted_at timestamptz NOT NULL DEFAULT now(),
        ip_hash varchar(128),
        user_agent varchar(300),
        version int NOT NULL,
        CONSTRAINT user_risk_acknowledgements_unique UNIQUE (user_id, disclosure_id)
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE app.user_risk_acknowledgements;
      DROP TABLE app.risk_disclosures;
      DROP TABLE app.basket_rebalance_orders;
      DROP TABLE app.basket_rebalance_runs;
      DROP TABLE app.basket_redemptions;
      DROP TABLE app.basket_subscriptions;
      DROP TABLE app.basket_nav_snapshots;
      DROP TABLE app.basket_holdings;
      DROP TABLE app.basket_portfolios;
      DROP TABLE app.basket_strategy_assets;
      DROP TABLE app.basket_strategy_versions;
      DROP TABLE app.basket_strategies;
      DROP TABLE app.rwa_ai_analysis;
      DROP TABLE app.rwa_asset_scores;
      DROP TABLE app.rwa_sync_runs;
      DROP TABLE app.rwa_asset_metric_history;
      DROP TABLE app.rwa_asset_metrics;
      DROP TABLE app.rwa_asset_sources;
      DROP TABLE app.rwa_asset_contracts;
      DROP TABLE app.rwa_assets;
      DROP TABLE app.rwa_networks;
      DROP TABLE app.rwa_issuers;
    `)
  }
}
