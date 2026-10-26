import type { EntityManager } from 'typeorm'

export interface PortfolioSummary {
  currency: 'USDT'
  decimals: 6
  totalAtomic: string
  today: null | {
    changeAtomic: string
    changePct: string | null
    since: string
    basis: 'ledger'
  }
  asOf: string
}

/**
 * Today's posted income, not a change in asset valuation. Entry created_at is
 * the posting clock; effective_at can be backdated. No snapshot baseline is used.
 *
 * quant_daily_settlement is signed net trading income; referral_reward is a
 * claimed/paid reward; yield_accrual credits a yield allocation to the wallet.
 * Their reversals undo income. Generic settlement includes principal redemptions
 * and legacy demo payouts, so it is deliberately not an income type.
 * Prediction stakes and net payouts share reference_type=prediction_bet and the
 * bet id. Recognise their sum only when that bet settles (won/lost), including
 * losses with no payout entry. Void refunds are returned principal, not income.
 */
export const PORTFOLIO_SUMMARY_SQL = `
WITH clock AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore' AS since
), wallet_accounts AS (
  SELECT a.id, a.normal_side, a.asset_decimals,
         COALESCE(b.current_atomic_balance, 0) AS balance
    FROM app.ledger_accounts a
    LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
   WHERE a.user_id = $1 AND a.owner_type = 'user'
     AND a.asset_code = 'USDT' AND a.state = 'active'
     AND a.purpose IN ('available', 'locked', 'pending', 'invested_cost', 'reward_payable')
), moves AS (
  SELECT CASE WHEN e.side = a.normal_side THEN e.atomic_amount ELSE -e.atomic_amount END AS delta,
         e.created_at, t.transaction_type AS type, t.reference_type, t.reference_id,
         original.transaction_type AS reversed_type
    FROM wallet_accounts a
    JOIN app.ledger_entries e ON e.account_id = a.id
    JOIN app.ledger_transactions t ON t.id = e.transaction_id
    LEFT JOIN app.ledger_transactions original ON original.id = t.reverses_transaction_id
   WHERE e.created_at <= now()
), income AS (
  SELECT delta FROM moves, clock
   WHERE created_at >= since
     AND (type IN ('quant_daily_settlement', 'referral_reward', 'yield_accrual')
          OR (type = 'reversal' AND reversed_type IN ('quant_daily_settlement', 'referral_reward', 'yield_accrual')))
  UNION ALL
  SELECT SUM(m.delta) AS delta
    FROM app.prediction_bets b
    JOIN moves m ON m.reference_type = 'prediction_bet' AND m.reference_id = b.id
      AND m.type IN ('prediction_stake', 'prediction_payout')
    CROSS JOIN clock
   WHERE b.user_id = $1 AND b.status IN ('won', 'lost')
     AND b.settled_at >= since AND b.settled_at <= now()
   GROUP BY b.id, b.stake_atomic
  -- Never count an orphan payout as profit; require the actual full stake debit.
  HAVING SUM(m.delta) FILTER (WHERE m.type = 'prediction_stake') = -b.stake_atomic
)
SELECT COALESCE((SELECT SUM(balance) FROM wallet_accounts), 0)::text AS "totalAtomic",
       (SELECT since FROM clock) AS since,
       COALESCE((SELECT SUM(delta) FROM income), 0)::text AS "changeAtomic",
       EXISTS (SELECT 1 FROM income) AS "hasIncome",
       now() AS "asOf"
`

interface SummaryRow {
  totalAtomic: string
  since: Date
  changeAtomic: string
  hasIncome: boolean
  asOf: Date
}

/** Round half away from zero, entirely in integer hundredths of a percent. */
function changePercent(change: bigint, baseline: bigint): string {
  const magnitude = change < 0n ? -change : change
  const hundredths = (magnitude * 10000n + baseline / 2n) / baseline
  const sign = change < 0n && hundredths !== 0n ? '-' : ''
  return `${sign}${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}`
}

export function readPortfolioSummary(manager: EntityManager, userId: string): Promise<PortfolioSummary> {
  return manager.transaction('REPEATABLE READ', async (tx) => {
    await tx.query('SET TRANSACTION READ ONLY')
    const [row] = await tx.query(PORTFOLIO_SUMMARY_SQL, [userId]) as SummaryRow[]
    const result: PortfolioSummary = {
      currency: 'USDT', decimals: 6, totalAtomic: row.totalAtomic,
      today: null, asOf: row.asOf.toISOString(),
    }
    if (!row.hasIncome) return result
    const change = BigInt(row.changeAtomic)
    const baseline = BigInt(row.totalAtomic) - change
    result.today = {
      changeAtomic: change.toString(),
      changePct: baseline <= 0n ? null : changePercent(change, baseline),
      since: row.since.toISOString(), basis: 'ledger',
    }
    return result
  })
}
