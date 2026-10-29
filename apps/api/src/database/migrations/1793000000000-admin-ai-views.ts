import type { MigrationInterface, QueryRunner } from 'typeorm'

// Explicit projections only. Never add SELECT *, decryption, free-form user text, or JSON payloads here.
export const AI_VIEWS: Record<string, { source: string; columns: string; meaning: string; units?: string }> = {
  users: { source: 'app.users', columns: 'id, status, locale, created_at, updated_at, closed_at', meaning: 'User accounts. Contact and legal identity are encrypted in separate tables and intentionally unavailable.' },
  community_profiles: { source: 'app.community_profiles', columns: 'id, user_id, left(display_name, 1) AS name_initial, kind, is_active, created_at', meaning: 'Community identity with names reduced to one initial; no handles, biographies or locations.' },
  ledger_accounts: { source: 'app.ledger_accounts', columns: 'id, user_id, owner_type, purpose, asset_code, asset_decimals, normal_side, state, created_at', meaning: 'Ledger accounts; join balances and entries by account id.' },
  ledger_balances: { source: 'app.ledger_account_balances b JOIN app.ledger_accounts a ON a.id = b.account_id', columns: 'b.account_id, a.user_id, a.purpose, a.asset_code, a.asset_decimals, b.current_atomic_balance, b.updated_at', meaning: 'Current ledger balance projection; immutable entries remain the source of truth.', units: 'Atomic integer units of asset_code; divide by 10^asset_decimals.' },
  ledger_transactions: { source: 'app.ledger_transactions', columns: 'id, transaction_type, reference_type, reference_id, reverses_transaction_id, effective_at, created_at', meaning: 'Immutable ledger transaction headers; join entries by transaction_id. No metadata.' },
  ledger_entries: { source: 'app.ledger_entries e JOIN app.ledger_accounts a ON a.id = e.account_id', columns: 'e.id, e.transaction_id, e.account_id, a.asset_code, a.asset_decimals, e.side, e.atomic_amount, e.created_at', meaning: 'Immutable debit and credit postings; do not sum both sides as business volume.', units: 'Atomic integer units of asset_code; divide by 10^asset_decimals.' },
  deposits: { source: 'app.deposits', columns: 'id, user_id, asset_code, asset_decimals, atomic_amount, state, detected_at, credited_at', meaning: 'Deposits; credited_at and state=credited identify booked inflows. No wallet addresses.', units: 'Atomic integer units of asset_code; divide by 10^asset_decimals.' },
  withdrawals: { source: 'app.withdrawals', columns: 'id, user_id, network, asset_code, asset_decimals, atomic_amount, fee_atomic_amount, state, requested_at, completed_at', meaning: 'Withdrawals; state=completed identifies completed outflows. No destinations.', units: 'Atomic integer units of asset_code; divide by 10^asset_decimals.' },
  orders: { source: 'app.orders', columns: 'id, user_id, product_id, side, outcome_key, settlement_asset_code, settlement_asset_decimals, requested_atomic_amount, fee_atomic_amount, filled_atomic_amount, state, submitted_at, processed_at, completed_at', meaning: 'Primary product orders and settlement cash amounts; no receipts.', units: 'USDT atomic units, 1000000 atomic = 1 USDT.' },
  positions: { source: 'app.positions', columns: 'id, user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount, cumulative_yield_atomic_amount, state, opened_at, updated_at, settled_at', meaning: 'Product holdings. Quantity uses asset_decimals; cost and cumulative yield are USDT atomic units.', units: 'Quantity: asset atomic units / 10^asset_decimals. Cost and yield: 1000000 atomic = 1 USDT.' },
  products: { source: 'app.products', columns: 'id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at, retired_at, created_at', meaning: 'Business product catalog; display_name is a product name, not a person.' },
  quant_products: { source: 'app.quant_products', columns: 'id, slug, name, status, timezone, cutoff_time, mgmt_fee_bps, perf_fee_bps, min_subscription_atomic, min_redemption_atomic, target_annual_min_pct, target_annual_max_pct, index_value, hwm_index, first_trade_date, last_settled_date, created_at', meaning: 'Koala Quant strategy configuration; targets are not guaranteed returns.', units: 'Money: USDT atomic (1e6 per USDT). bps: 10000 = 100 percent. pct: percentage points. Index: dimensionless.' },
  quant_orders: { source: 'app.quant_orders', columns: 'id, product_id, user_id, kind, amount_atomic, status, effective_date, principal_atomic, fee_atomic, payout_atomic, created_at, settled_at', meaning: 'Koala subscriptions and redemptions; settled orders are booked.', units: 'USDT atomic units, 1000000 atomic = 1 USDT.' },
  quant_lots: { source: 'app.quant_lots', columns: 'id, product_id, user_id, order_id, original_atomic, principal_atomic, effective_date, created_at, updated_at', meaning: 'Koala current principal lots; sum principal_atomic, count distinct user_id with principal_atomic > 0 for holders.', units: 'USDT atomic units, 1000000 atomic = 1 USDT.' },
  quant_daily_settlements: { source: 'app.quant_daily_settlements', columns: 'id, product_id, trade_date, gross_return_pct, status, index_before, index_after, hwm_after, net_return_pct, users_count, principal_atomic, gross_atomic, mgmt_fee_atomic, perf_fee_atomic, paid_atomic, principal_loss_atomic, redemption_principal_atomic, redemption_fee_atomic, posted_at, created_at', meaning: 'Koala daily settlement aggregates; only status=posted is booked.', units: 'Money: USDT atomic (1e6 per USDT). pct: percentage points. Index: dimensionless. users_count: people.' },
  quant_payouts: { source: 'app.quant_payouts', columns: 'id, settlement_id, product_id, user_id, trade_date, principal_before_atomic, gross_atomic, mgmt_fee_atomic, perf_fee_atomic, net_atomic, paid_atomic, created_at', meaning: 'Koala user daily results; negative net reduces principal, paid is cash distributed.', units: 'USDT atomic units, 1000000 atomic = 1 USDT.' },
  prediction_bets: { source: 'app.prediction_bets', columns: 'id, user_id, market_mapping_id, side, stake_atomic, shares, price, status, settled_at, created_at', meaning: 'Prediction bets; join prediction_markets by market_mapping_id.', units: 'stake_atomic: USDT atomic (1e6 per USDT). shares: decimal outcome shares. price: USDT per share.' },
  prediction_markets: { source: 'app.polymarket_market_mappings', columns: 'id, product_id, slug, question, state, restricted, market_start_at, market_end_at, created_at, updated_at', meaning: 'Public prediction market questions and lifecycle; no provider payloads.' },
  referral_edges: { source: 'app.referral_edges', columns: 'invitee_user_id, inviter_user_id, bound_at', meaning: 'Immutable direct referral relationship; no attribution tokens.' },
  referral_rewards: { source: 'app.referral_rewards', columns: 'id, user_id, source_user_id, kind, source_type, level, rate_bps, base_atomic, amount_atomic, asset_code, asset_decimals, state, earned_at, claimed_at', meaning: 'Referral earned and claimed rewards, one row per reward.', units: 'USDT atomic units (1e6 per USDT); rate_bps: 10000 = 100 percent; level: referral depth.' },
  referral_team_awards: { source: 'app.referral_team_awards a JOIN app.referral_team_batches b ON b.id=a.batch_id', columns: 'a.id, a.batch_id, a.user_id, a.base_atomic, a.amount_atomic, b.month, b.status, b.created_at, b.paid_at', meaning: 'Monthly referral team awards with batch status.', units: 'USDT atomic units, 1000000 atomic = 1 USDT.' },
  community_post_counts: { source: 'app.community_posts GROUP BY state, (created_at AT TIME ZONE \'Asia/Singapore\')::date', columns: "state, (created_at AT TIME ZONE 'Asia/Singapore')::date AS day, count(*) AS post_count", meaning: 'Daily post counts by state in Singapore time; no post bodies.', units: 'post_count: number of posts.' },
  community_comment_counts: { source: 'app.community_comments GROUP BY state, (created_at AT TIME ZONE \'Asia/Singapore\')::date', columns: "state, (created_at AT TIME ZONE 'Asia/Singapore')::date AS day, count(*) AS comment_count", meaning: 'Daily comment counts by state in Singapore time; no comment bodies.', units: 'comment_count: number of comments.' },
  notifications: { source: 'app.notifications', columns: 'id, recipient_user_id, kind, created_at, read_at', meaning: 'Notification kind and creation/read timestamps only; no title, body or payload.' },
  tickets: { source: 'app.tickets', columns: 'id, author_user_id, status, category, created_at, updated_at, closed_at', meaning: 'Support ticket status, category and timestamps only; no subject, body or assignee.' },
  platform_configuration: { source: 'app.platform_configuration WHERE published IS NOT NULL', columns: "published_revision, published_at, published->>'legalName' AS legal_name, published->>'jurisdiction' AS jurisdiction, left(published->>'supportEmail',1) || '***@' || split_part(published->>'supportEmail','@',2) AS support_email_masked", meaning: 'Allow-listed published platform configuration only; no draft, addresses, documents or arbitrary JSON.' },
}

function columnComment(viewName: string, column: string): string {
  const label = column.replace(/_/g, ' ')
  if (column === 'id' || column.endsWith('_id')) return `${label}: stable record identifier; no units.`
  if (column.endsWith('_at')) return `${label}: timestamp with time zone; display in Asia/Singapore unless requested otherwise. NULL means not recorded.`
  if (column.endsWith('_date') || column === 'day') return `${label}: calendar date; day boundaries use the documented business timezone.`
  if (column === 'month') return 'Settlement calendar month, YYYY-MM, in Asia/Shanghai; no monetary units.'
  if (column.endsWith('_decimals')) return `${label}: base-10 decimal exponent; divide atomic quantities by 10^this value.`
  if (column.includes('atomic')) {
    if (viewName === 'positions') return column === 'quantity_atomic_amount'
      ? 'Position quantity in atomic units of asset_code; divide by 10^asset_decimals.'
      : `${label}: USDT atomic units; 1000000 atomic = 1 USDT.`
    return `${label}. ${AI_VIEWS[viewName].units}`
  }
  if (column.endsWith('_bps')) return `${label}: basis points; 10000 = 100 percent. Quant management fee is annualized; performance fee applies to eligible profit.`
  if (column.endsWith('_pct')) return `${label}: percentage points; 1 = 1 percent, not a fraction.`
  if (column.includes('index')) return `${label}: dimensionless strategy index, initially 1; high-water marks track prior peaks.`
  if (column.endsWith('_count')) return `${label}: number of records, or people for users_count; integer count.`
  if (column === 'shares') return 'Decimal prediction outcome shares; not atomic currency units.'
  if (column === 'price') return 'Prediction entry price in USDT per outcome share.'
  if (column === 'name_initial') return 'First character of community display name; remaining characters omitted.'
  if (column === 'support_email_masked') return 'Published support email masked as first character plus *** plus @domain; never a user login identifier.'
  if (column === 'cutoff_time') return 'Daily subscription/redemption cutoff as local time in the product timezone.'
  if (column === 'timezone') return 'IANA business timezone used for settlement dates and cutoff time.'
  return `${label}: business attribute, category or flag; no monetary units. ${AI_VIEWS[viewName].meaning}`
}

export class AdminAiViews1793000000000 implements MigrationInterface {
  name = 'AdminAiViews1793000000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE SCHEMA ai_ro; REVOKE ALL ON SCHEMA ai_ro FROM PUBLIC')
    for (const [name, view] of Object.entries(AI_VIEWS)) {
      await q.query(`CREATE VIEW ai_ro.${name} WITH (security_barrier=true) AS SELECT ${view.columns} FROM ${view.source}`)
      const comment = `${view.meaning} ${view.units ?? 'Identifiers and categories have no units; timestamps are timestamptz unless a date or time is specified.'}`
      await q.query(`COMMENT ON VIEW ai_ro.${name} IS '${comment.replace(/'/g, "''")}'`)
      const columns: { column_name: string }[] = await q.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2', ['ai_ro', name])
      for (const { column_name: column } of columns) {
        const meaning = columnComment(name, column)
        await q.query(`COMMENT ON COLUMN ai_ro.${name}."${column}" IS '${meaning.replace(/'/g, "''")}'`)
      }
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const name of Object.keys(AI_VIEWS).reverse()) await q.query(`DROP VIEW ai_ro.${name}`)
    await q.query('DROP SCHEMA ai_ro')
  }
}
