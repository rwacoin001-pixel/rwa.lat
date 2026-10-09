import type { DataSource, QueryRunner } from 'typeorm'

/** Historical real external credit, not today's balance or a client-supplied eligibility flag. */
export async function hasQualifyingDeposit(db: Pick<DataSource | QueryRunner, 'query'>, userId: string, lock = false): Promise<boolean> {
  const candidates = await db.query(`SELECT d.id, t.id AS "transactionId"
    FROM app.deposits d
    JOIN app.wallet_addresses a ON a.id=d.wallet_address_id AND a.user_id=d.user_id
    JOIN app.custody_wallets w ON w.id=a.wallet_id AND w.user_id=d.user_id
    JOIN app.chain_transactions c ON c.id=d.chain_transaction_id AND c.network=a.network
    JOIN app.ledger_transactions t ON t.reference_id=d.id AND t.reference_type='deposit'
      AND t.transaction_type='deposit' AND t.idempotency_key='deposit:' || d.id::text AND t.actor_type='partner'
    WHERE d.user_id=$1 AND d.state='credited' AND d.credited_at IS NOT NULL
      AND d.asset_code='USDT' AND d.asset_decimals=6 AND d.atomic_amount > 300000000
      AND a.asset_code='USDT' AND a.asset_decimals=6 AND w.provider='manual-custody'
      AND c.state='confirmed' AND c.confirmation_count>=d.required_confirmations AND c.confirmed_at IS NOT NULL
      AND c.transaction_hash ~ '^(0x)?[0-9a-fA-F]{64}$'
      AND EXISTS (SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts l ON l.id=e.account_id
        WHERE e.transaction_id=t.id AND e.side='credit' AND e.atomic_amount=d.atomic_amount
          AND l.owner_type='user' AND l.user_id=d.user_id AND l.purpose='available' AND l.asset_code='USDT' AND l.asset_decimals=6)
      AND EXISTS (SELECT 1 FROM app.ledger_entries e JOIN app.ledger_accounts l ON l.id=e.account_id
        WHERE e.transaction_id=t.id AND e.side='debit' AND e.atomic_amount=d.atomic_amount
          AND l.owner_type='custody_provider' AND l.owner_reference='custody:' || c.network AND l.purpose='settlement'
          AND l.network=c.network AND l.asset_code='USDT' AND l.asset_decimals=6)
      AND NOT EXISTS (SELECT 1 FROM app.ledger_transactions r WHERE r.reverses_transaction_id=t.id)
    ORDER BY d.id LIMIT 1 ${lock ? 'FOR UPDATE OF d,c,t,w,a' : ''}`, [userId]) as Array<{ id: string; transactionId: string }>
  if (!candidates.length) return false
  if (!lock) return true
  // A concurrent reversal may have committed while acquiring the parent-row lock.
  // Re-read on a fresh READ COMMITTED snapshot; later reversal FK checks block until this transfer commits.
  const reversals = await db.query('SELECT id FROM app.ledger_transactions WHERE reverses_transaction_id=$1', [candidates[0].transactionId])
  return !reversals.length
}
