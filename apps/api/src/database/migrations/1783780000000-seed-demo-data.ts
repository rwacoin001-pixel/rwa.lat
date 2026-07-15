import type { MigrationInterface, QueryRunner } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { shouldApplyDemoSeed } from '../demo-seed-policy'

/**
 * Demo seed data migration for Batch 2.
 * Creates:
 * - 1 fixed Demo Admin user (demo-admin-001)
 * - 1 fixed Demo User (demo-user-001) with KYC approved
 * - 4 demo products (Compute, RWA, Stocks, Prediction)
 * - 3 wallet networks (TRON, Ethereum, Arbitrum)
 * - USDT ledger accounts for demo user
 * - Prices/quotes for products
 * - Eligibility profile for demo user (ALL regions)
 */
export class SeedDemoData1783780000000 implements MigrationInterface {
  name = 'SeedDemoData1783780000000'

  // Fixed UUIDs for deterministic demo data
  private readonly DEMO_ADMIN_ID = '11111111-1111-1111-1111-111111111111'
  private readonly DEMO_USER_ID = '22222222-2222-2222-2222-222222222222'
  
  // Product IDs (these are the actual product.id values)
  private readonly PRODUCT_COMPUTE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  private readonly PRODUCT_RWA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  private readonly PRODUCT_STOCKS = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  private readonly PRODUCT_PREDICTION = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

  // Helper: hash identifier (SHA256 -> hex string)
  private hashIdentifier(identifier: string): string {
    const crypto = require('node:crypto')
    return crypto.createHash('sha256').update(identifier).digest('hex')
  }

  // Helper: encrypt (demo: just return the identifier as hex buffer)
  private encrypt(identifier: string): string {
    return Buffer.from(identifier).toString('hex')
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!shouldApplyDemoSeed(process.env)) return
    const now = new Date()
    // Valid until: 7 days from now (ensures valid_until > captured_at even with clock skew)
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    // Captured at: now minus 1 hour (ensures captured_at < valid_until)
    const capturedAt = new Date(now.getTime() - 60 * 60 * 1000)

    // ─── 1. Demo Admin User ───
    await queryRunner.query(`
      INSERT INTO app.users (id, status, locale, created_at, updated_at)
      VALUES ($1, 'active', 'en', $2, $2)
      ON CONFLICT (id) DO NOTHING
    `, [this.DEMO_ADMIN_ID, now])

    // Admin login identity (email verified)
    await queryRunner.query(`
      INSERT INTO app.login_identities (id, user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at, created_at)
      VALUES ($1, $2, 'email', 'verified', decode($3, 'hex'), decode($4, 'hex'), 1, $5, $5)
      ON CONFLICT (kind, identifier_hash) DO NOTHING
    `, [randomUUID(), this.DEMO_ADMIN_ID, this.hashIdentifier('demo@admin.rwa.lat'), this.encrypt('demo@admin.rwa.lat'), now])

    // Admin RBAC role
    await queryRunner.query(`
      INSERT INTO app.admin_roles (id, name, description, created_at)
      VALUES ($1, 'super_admin', 'Full system access', $2)
      ON CONFLICT (id) DO NOTHING
    `, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now])

    await queryRunner.query(`
      INSERT INTO app.admin_users (id, email, role_id, disabled_at, created_at)
      VALUES ($1, 'demo@admin.rwa.lat', $2, NULL, $3)
      ON CONFLICT (id) DO NOTHING
    `, [this.DEMO_ADMIN_ID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now])

    await queryRunner.query(`
      INSERT INTO app.admin_role_permissions (role_id, permission)
      VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'approvals.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'audit.read'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'catalog.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'compliance.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'data-governance.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'notifications.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'observability.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'operations.jobs.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'storage.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'support.tickets.manage'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'users.read'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'redemptions.read')
      ON CONFLICT DO NOTHING
    `)

    // ─── 2. Demo User ───
    await queryRunner.query(`
      INSERT INTO app.users (id, status, locale, created_at, updated_at)
      VALUES ($1, 'active', 'zh-CN', $2, $2)
      ON CONFLICT (id) DO NOTHING
    `, [this.DEMO_USER_ID, now])

    // Demo user login identity (email verified)
    await queryRunner.query(`
      INSERT INTO app.login_identities (id, user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at, created_at)
      VALUES ($1, $2, 'email', 'verified', decode($3, 'hex'), decode($4, 'hex'), 1, $5, $5)
      ON CONFLICT (kind, identifier_hash) DO NOTHING
    `, [randomUUID(), this.DEMO_USER_ID, this.hashIdentifier('demo@user.rwa.lat'), this.encrypt('demo@user.rwa.lat'), now])

    // Legal identity (minimal PII for demo)
    await queryRunner.query(`
      INSERT INTO app.legal_identities (user_id, pii_ciphertext, encryption_key_version, created_at, updated_at)
      VALUES ($1, decode($2, 'hex'), 1, $3, $3)
      ON CONFLICT (user_id) DO NOTHING
    `, [this.DEMO_USER_ID, this.encrypt(JSON.stringify({ name: 'Demo User', idNumber: 'DEMO123456', nationality: 'CN' })), now])

    // KYC Case - approved
    await queryRunner.query(`
      INSERT INTO app.kyc_cases (id, user_id, state, provider, provider_case_hash, provider_case_ciphertext, encryption_key_version, submitted_at, decided_at, created_at, updated_at)
      VALUES ($1, $2, 'approved', 'stub', decode($3, 'hex'), decode($4, 'hex'), 1, $5, $5, $5, $5)
      ON CONFLICT (provider, provider_case_hash) DO NOTHING
    `, [randomUUID(), this.DEMO_USER_ID, this.hashIdentifier('kyc-demo-user'), this.encrypt(JSON.stringify({ level: 'full', documents: ['id_card'] })), now])

    // Eligibility profile - ALL regions approved (matching actual schema)
    await queryRunner.query(`
      INSERT INTO app.eligibility_profiles (id, user_id, policy_version, product_scope, decision, reason_codes, evidence_references, decided_at)
      VALUES ($1, $2, '2026.1', 'all', 'eligible', ARRAY[]::text[], '{}'::jsonb, $3)
      ON CONFLICT (user_id, policy_version, product_scope) DO UPDATE SET 
        decision = EXCLUDED.decision,
        decided_at = EXCLUDED.decided_at
    `, [randomUUID(), this.DEMO_USER_ID, now])

    // ─── 3. Asset Classes ───
    await queryRunner.query(`
      INSERT INTO app.asset_classes (id, display_name, description, state, created_at)
      VALUES 
        ('compute', 'AI Compute', 'GPU compute capacity and infrastructure', 'active', $1),
        ('rwa', 'Real World Assets', 'Tokenized real-world asset cash flows', 'active', $1),
        ('stocks', 'Global Stocks', 'Traditional equity market access', 'active', $1),
        ('prediction', 'Prediction Markets', 'Event outcome markets', 'active', $1)
      ON CONFLICT (id) DO NOTHING
    `, [now])

    // ─── 4. Demo Products ───
    // Compute: H100 inference pool
    await queryRunner.query(`
      INSERT INTO app.products (id, asset_class_id, version, external_ref, display_name, summary, asset_code, asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount, state, published_at, created_at)
      VALUES ($1, 'compute', 1, 'h100-inference-pool', 'H100 Inference Pool', 'Enterprise inference capacity across Tier III sites', 'USD', 6, 'arbitrum', '100000000', '5000000000', 'published', $2, $2)
      ON CONFLICT (id) DO UPDATE SET state = 'published'
    `, [this.PRODUCT_COMPUTE, now])

    // RWA: Solar income 2027
    await queryRunner.query(`
      INSERT INTO app.products (id, asset_class_id, version, external_ref, display_name, summary, asset_code, asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount, state, published_at, created_at)
      VALUES ($1, 'rwa', 1, 'solar-income-2027', 'Solar Income 2027', 'Contracted operating solar assets in the United States', 'USD', 6, 'ethereum', '500000000', '20000000000', 'published', $2, $2)
      ON CONFLICT (id) DO UPDATE SET state = 'published'
    `, [this.PRODUCT_RWA, now])

    // Stocks: Tech Growth ETF
    await queryRunner.query(`
      INSERT INTO app.products (id, asset_class_id, version, external_ref, display_name, summary, asset_code, asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount, state, published_at, created_at)
      VALUES ($1, 'stocks', 1, 'tech-growth-etf', 'Tech Growth ETF', 'Diversified exposure to high-growth technology companies', 'USD', 6, 'ethereum', '50000000', '5000000000', 'published', $2, $2)
      ON CONFLICT (id) DO UPDATE SET state = 'published'
    `, [this.PRODUCT_STOCKS, now])

    // Prediction: Fed Rate Cut
    await queryRunner.query(`
      INSERT INTO app.products (id, asset_class_id, version, external_ref, display_name, summary, asset_code, asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount, state, published_at, created_at)
      VALUES ($1, 'prediction', 1, 'demo-fed-rate-cut', 'Fed Rate Cut Q3 2026', 'Will the Federal Reserve cut rates at the next meeting?', 'USD', 6, 'ethereum', '1000000', '1000000000', 'published', $2, $2)
      ON CONFLICT (id) DO UPDATE SET state = 'published'
    `, [this.PRODUCT_PREDICTION, now])

    // ─── 5. Price Quotes (asset_code is required, valid_until > captured_at) ───
    // Compute: 1 USDT = 1 unit
    await queryRunner.query(`
      INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until, captured_at)
      VALUES ($1, $2, 'USD', '1000000', 'USD', 'demo', $3, $4)
      ON CONFLICT (id) DO UPDATE SET unit_price_atomic_amount = '1000000', valid_until = $3, captured_at = $4
    `, [randomUUID(), this.PRODUCT_COMPUTE, validUntil, capturedAt])

    // RWA: 1 USDT = 1 unit
    await queryRunner.query(`
      INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until, captured_at)
      VALUES ($1, $2, 'USD', '1000000', 'USD', 'demo', $3, $4)
      ON CONFLICT (id) DO UPDATE SET unit_price_atomic_amount = '1000000', valid_until = $3, captured_at = $4
    `, [randomUUID(), this.PRODUCT_RWA, validUntil, capturedAt])

    // Stocks: 100 USDT per unit
    await queryRunner.query(`
      INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until, captured_at)
      VALUES ($1, $2, 'USD', '100000000', 'USD', 'demo', $3, $4)
      ON CONFLICT (id) DO UPDATE SET unit_price_atomic_amount = '100000000', valid_until = $3, captured_at = $4
    `, [randomUUID(), this.PRODUCT_STOCKS, validUntil, capturedAt])

    // Prediction: 50 USDT per share (YES/NO)
    await queryRunner.query(`
      INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until, captured_at)
      VALUES ($1, $2, 'USD', '50000000', 'USD', 'demo', $3, $4)
      ON CONFLICT (id) DO UPDATE SET unit_price_atomic_amount = '50000000', valid_until = $3, captured_at = $4
    `, [randomUUID(), this.PRODUCT_PREDICTION, validUntil, capturedAt])

    // ─── 6. Ledger Accounts for Demo User ───
    // Wallet custody records and addresses are provisioned at runtime because
    // they must be encrypted with the deployment-specific application key.
    // Available balance account
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, allow_negative, state, created_at)
      SELECT $1, 'user', $2, 'available', 'USDT', 6, 'credit', false, 'active', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM app.ledger_accounts 
        WHERE user_id = $2 AND purpose = 'available' AND asset_code = 'USDT'
      )
    `, [randomUUID(), this.DEMO_USER_ID, now])

    // Locked balance account
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, allow_negative, state, created_at)
      SELECT $1, 'user', $2, 'locked', 'USDT', 6, 'credit', false, 'active', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM app.ledger_accounts 
        WHERE user_id = $2 AND purpose = 'locked' AND asset_code = 'USDT'
      )
    `, [randomUUID(), this.DEMO_USER_ID, now])

    // Pending balance account
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, allow_negative, state, created_at)
      SELECT $1, 'user', $2, 'pending', 'USDT', 6, 'credit', false, 'active', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM app.ledger_accounts 
        WHERE user_id = $2 AND purpose = 'pending' AND asset_code = 'USDT'
      )
    `, [randomUUID(), this.DEMO_USER_ID, now])

    // Invested cost account
    await queryRunner.query(`
      INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, allow_negative, state, created_at)
      SELECT $1, 'user', $2, 'invested_cost', 'USDT', 6, 'debit', false, 'active', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM app.ledger_accounts 
        WHERE user_id = $2 AND purpose = 'invested_cost' AND asset_code = 'USDT'
      )
    `, [randomUUID(), this.DEMO_USER_ID, now])

    // ─── 7. Disclosure Files (minimal) ───
    await queryRunner.query(`
      INSERT INTO app.disclosure_files (id, product_id, kind, locale, title, storage_ref, content_hash, state, published_at)
      VALUES 
        ($1, $2, 'prospectus', 'en', 'Product Memorandum', '/demo/disclosures/compute-memo.pdf', decode($3, 'hex'), 'active', $4),
        ($5, $6, 'prospectus', 'en', 'Project Memorandum', '/demo/disclosures/rwa-memo.pdf', decode($7, 'hex'), 'active', $4),
        ($8, $9, 'prospectus', 'en', 'Fund Factsheet', '/demo/disclosures/stocks-factsheet.pdf', decode($10, 'hex'), 'active', $4),
        ($11, $12, 'prospectus', 'en', 'Market Rules', '/demo/disclosures/prediction-rules.pdf', decode($13, 'hex'), 'active', $4)
      ON CONFLICT (id) DO NOTHING
    `, [
      randomUUID(), this.PRODUCT_COMPUTE, this.encrypt('compute-memo-hash'), now,
      randomUUID(), this.PRODUCT_RWA, this.encrypt('rwa-memo-hash'),
      randomUUID(), this.PRODUCT_STOCKS, this.encrypt('stocks-factsheet-hash'),
      randomUUID(), this.PRODUCT_PREDICTION, this.encrypt('prediction-rules-hash')
    ])
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!shouldApplyDemoSeed(process.env)) return
    // Delete in reverse order of dependencies
    await queryRunner.query(`DELETE FROM app.disclosure_files WHERE product_id IN ($1, $2, $3, $4)`, [
      this.PRODUCT_COMPUTE, this.PRODUCT_RWA, this.PRODUCT_STOCKS, this.PRODUCT_PREDICTION
    ])
    await queryRunner.query(`DELETE FROM app.wallet_addresses WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.custody_wallets WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.ledger_accounts WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.price_quotes WHERE product_id IN ($1, $2, $3, $4)`, [
      this.PRODUCT_COMPUTE, this.PRODUCT_RWA, this.PRODUCT_STOCKS, this.PRODUCT_PREDICTION
    ])
    await queryRunner.query(`DELETE FROM app.products WHERE id IN ($1, $2, $3, $4)`, [
      this.PRODUCT_COMPUTE, this.PRODUCT_RWA, this.PRODUCT_STOCKS, this.PRODUCT_PREDICTION
    ])
    await queryRunner.query(`DELETE FROM app.asset_classes WHERE id IN ('compute', 'rwa', 'stocks', 'prediction')`)
    await queryRunner.query(`DELETE FROM app.eligibility_profiles WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.kyc_cases WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.legal_identities WHERE user_id = $1`, [this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.login_identities WHERE user_id IN ($1, $2)`, [this.DEMO_ADMIN_ID, this.DEMO_USER_ID])
    await queryRunner.query(`DELETE FROM app.admin_users WHERE id = $1`, [this.DEMO_ADMIN_ID])
    await queryRunner.query(`DELETE FROM app.admin_roles WHERE id = $1`, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
    await queryRunner.query(`DELETE FROM app.users WHERE id IN ($1, $2)`, [this.DEMO_ADMIN_ID, this.DEMO_USER_ID])
  }
}
