import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { ManualCustodyAdapter } from './manual/manual-custody.adapter'
import { TronClientService } from './manual/tron-client.service'

/** Days are bucketed in the operator's timezone; "today" starts at local midnight. */
export const FUNDS_TIMEZONE = 'Asia/Shanghai'
export const FUNDS_RANGES = [7, 30, 90] as const
const HOT_WALLET_CACHE_MS = 60_000
// Cash the platform owes users; invested cost and payable rewards are reported separately.
const CASH_PURPOSES = ['available', 'locked', 'pending']
const REVIEW_STATES = ['requested', '2fa_verified', 'risk_review', 'approved']
const IN_FLIGHT_STATES = ['signing', 'broadcast', 'confirming']

type Amount = { count: number; atomic: string }

export interface FundsDay {
  day: string
  depositsAtomic: string
  depositsCount: number
  withdrawalsAtomic: string
  withdrawalsCount: number
  netAtomic: string
  /** User cash (available + locked + pending) at the end of the day. */
  cashBalanceAtomic: string
}

export interface FundsSummary {
  asOf: string
  timezone: string
  asset: { code: 'USDT'; decimals: 6 }
  balances: {
    cashAtomic: string
    availableAtomic: string
    lockedAtomic: string
    pendingAtomic: string
    investedAtomic: string
    rewardPayableAtomic: string
    fundedUsers: number
  }
  today: { deposits: Amount; withdrawals: Amount & { feeAtomic: string }; withdrawalRequests: Amount }
  allTime: { deposits: Amount; withdrawals: Amount }
  pending: { review: Amount; inFlight: Amount; deposits: Amount; manualReview: Amount }
  hotWallet: { address: string | null; usdtAtomic: string | null; trxSun: string | null; checkedAt: string | null; error: string | null }
  pool: { available: number; current: number; retired: number }
  series: FundsDay[]
}

/**
 * Read-only funds overview for the admin console: user liabilities from the ledger, deposit and
 * withdrawal flows from the wallet tables, and the hot wallet's on-chain balance (cached).
 */
@Injectable()
export class FundsSummaryService {
  private readonly log = new Logger(FundsSummaryService.name)
  private hotWalletCache: { at: number; value: FundsSummary['hotWallet'] } | null = null

  constructor(
    private readonly dataSource: DataSource,
    private readonly manual: ManualCustodyAdapter,
    private readonly tron: TronClientService,
    private readonly config: ConfigService,
  ) {}

  async summary(days: number): Promise<FundsSummary> {
    const range = (FUNDS_RANGES as readonly number[]).includes(days) ? days : 30
    const [balances, today, allTime, pending, pool, series, hotWallet] = await Promise.all([
      this.balances(),
      this.today(),
      this.allTime(),
      this.pending(),
      this.pool(),
      this.series(range),
      this.hotWallet(),
    ])
    return {
      asOf: new Date().toISOString(),
      timezone: FUNDS_TIMEZONE,
      asset: { code: 'USDT', decimals: 6 },
      balances,
      today,
      allTime,
      pending,
      hotWallet,
      pool,
      series,
    }
  }

  private async balances(): Promise<FundsSummary['balances']> {
    const rows = await this.dataSource.query(
      `SELECT a.purpose, COALESCE(SUM(b.current_atomic_balance), 0)::text AS atomic
         FROM app.ledger_accounts a
         LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
        WHERE a.owner_type = 'user' AND a.asset_code = 'USDT'
        GROUP BY a.purpose`,
    ) as Array<{ purpose: string; atomic: string }>
    const [{ funded }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT a.user_id)::int AS funded
         FROM app.ledger_accounts a
         JOIN app.ledger_account_balances b ON b.account_id = a.id
        WHERE a.owner_type = 'user' AND a.asset_code = 'USDT' AND a.purpose = ANY($1::text[]) AND b.current_atomic_balance > 0`,
      [CASH_PURPOSES],
    ) as Array<{ funded: number }>
    const by = new Map(rows.map((row) => [row.purpose, BigInt(row.atomic)]))
    const pick = (purpose: string) => by.get(purpose) ?? 0n
    return {
      cashAtomic: CASH_PURPOSES.reduce((sum, purpose) => sum + pick(purpose), 0n).toString(),
      availableAtomic: pick('available').toString(),
      lockedAtomic: pick('locked').toString(),
      pendingAtomic: pick('pending').toString(),
      investedAtomic: pick('invested_cost').toString(),
      rewardPayableAtomic: pick('reward_payable').toString(),
      fundedUsers: Number(funded ?? 0),
    }
  }

  private async today(): Promise<FundsSummary['today']> {
    const [row] = await this.dataSource.query(
      `WITH day_start AS (SELECT (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1) AS t)
       SELECT
         (SELECT COUNT(*)::int FROM app.deposits, day_start WHERE state = 'credited' AND credited_at >= day_start.t) AS dep_count,
         (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.deposits, day_start WHERE state = 'credited' AND credited_at >= day_start.t) AS dep_atomic,
         (SELECT COUNT(*)::int FROM app.withdrawals, day_start WHERE state = 'completed' AND completed_at >= day_start.t) AS wd_count,
         (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.withdrawals, day_start WHERE state = 'completed' AND completed_at >= day_start.t) AS wd_atomic,
         (SELECT COALESCE(SUM(fee_atomic_amount), 0)::text FROM app.withdrawals, day_start WHERE state = 'completed' AND completed_at >= day_start.t) AS wd_fee,
         (SELECT COUNT(*)::int FROM app.withdrawals, day_start WHERE requested_at >= day_start.t) AS req_count,
         (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.withdrawals, day_start WHERE requested_at >= day_start.t) AS req_atomic`,
      [FUNDS_TIMEZONE],
    ) as Array<Record<string, string | number>>
    return {
      deposits: { count: Number(row.dep_count), atomic: String(row.dep_atomic) },
      withdrawals: { count: Number(row.wd_count), atomic: String(row.wd_atomic), feeAtomic: String(row.wd_fee) },
      withdrawalRequests: { count: Number(row.req_count), atomic: String(row.req_atomic) },
    }
  }

  private async allTime(): Promise<FundsSummary['allTime']> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM app.deposits WHERE state = 'credited') AS dep_count,
         (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.deposits WHERE state = 'credited') AS dep_atomic,
         (SELECT COUNT(*)::int FROM app.withdrawals WHERE state = 'completed') AS wd_count,
         (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.withdrawals WHERE state = 'completed') AS wd_atomic`,
    ) as Array<Record<string, string | number>>
    return {
      deposits: { count: Number(row.dep_count), atomic: String(row.dep_atomic) },
      withdrawals: { count: Number(row.wd_count), atomic: String(row.wd_atomic) },
    }
  }

  private async pending(): Promise<FundsSummary['pending']> {
    const amount = async (table: 'deposits' | 'withdrawals', states: string[]): Promise<Amount> => {
      const [row] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(atomic_amount), 0)::text AS atomic FROM app.${table} WHERE state = ANY($1::text[])`,
        [states],
      ) as Array<{ count: number; atomic: string }>
      return { count: Number(row.count), atomic: String(row.atomic) }
    }
    const [review, inFlight, deposits, manualReview] = await Promise.all([
      amount('withdrawals', REVIEW_STATES),
      amount('withdrawals', IN_FLIGHT_STATES),
      amount('deposits', ['detected', 'confirming']),
      amount('deposits', ['manual_review']),
    ])
    return { review, inFlight, deposits, manualReview }
  }

  private async pool(): Promise<FundsSummary['pool']> {
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE state = 'available')::int AS available,
              COUNT(*) FILTER (WHERE state = 'assigned')::int AS current,
              COUNT(*) FILTER (WHERE state = 'retired')::int AS retired
         FROM app.deposit_pool_addresses WHERE network = 'tron'`,
    ) as Array<{ available: number; current: number; retired: number }>
    return { available: Number(row.available), current: Number(row.current), retired: Number(row.retired) }
  }

  /**
   * Daily credited deposits, completed withdrawals and end-of-day user cash. The balance line is
   * walked back from today's ledger balance using each day's signed ledger movements, so it always
   * ends exactly at the current total.
   */
  async series(days: number): Promise<FundsDay[]> {
    const rows = await this.dataSource.query(
      `WITH days AS (
         SELECT generate_series(
           (now() AT TIME ZONE $1)::date - ($2::int - 1),
           (now() AT TIME ZONE $1)::date,
           interval '1 day'
         )::date AS day
       ),
       dep AS (
         SELECT (credited_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n, SUM(atomic_amount) AS amt
           FROM app.deposits WHERE state = 'credited' AND credited_at IS NOT NULL GROUP BY 1
       ),
       wd AS (
         SELECT (completed_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n, SUM(atomic_amount) AS amt
           FROM app.withdrawals WHERE state = 'completed' AND completed_at IS NOT NULL GROUP BY 1
       ),
       moves AS (
         SELECT (e.created_at AT TIME ZONE $1)::date AS day,
                SUM(CASE WHEN e.side = a.normal_side THEN e.atomic_amount ELSE -e.atomic_amount END) AS delta
           FROM app.ledger_entries e
           JOIN app.ledger_accounts a ON a.id = e.account_id
          WHERE a.owner_type = 'user' AND a.asset_code = 'USDT' AND a.purpose = ANY($3::text[])
            AND e.created_at >= ((now() AT TIME ZONE $1)::date - ($2::int - 1)) AT TIME ZONE $1
          GROUP BY 1
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
              COALESCE(dep.amt, 0)::text AS dep_atomic, COALESCE(dep.n, 0) AS dep_count,
              COALESCE(wd.amt, 0)::text AS wd_atomic, COALESCE(wd.n, 0) AS wd_count,
              COALESCE(moves.delta, 0)::text AS delta
         FROM days
         LEFT JOIN dep ON dep.day = days.day
         LEFT JOIN wd ON wd.day = days.day
         LEFT JOIN moves ON moves.day = days.day
        ORDER BY days.day`,
      [FUNDS_TIMEZONE, days, CASH_PURPOSES],
    ) as Array<{ day: string; dep_atomic: string; dep_count: number; wd_atomic: string; wd_count: number; delta: string }>
    const current = BigInt((await this.balances()).cashAtomic)
    // End-of-day balance for day i = current - sum(delta of days after i).
    let after = 0n
    const balances: bigint[] = new Array(rows.length)
    for (let index = rows.length - 1; index >= 0; index--) {
      balances[index] = current - after
      after += BigInt(rows[index].delta)
    }
    return rows.map((row, index) => ({
      day: row.day,
      depositsAtomic: row.dep_atomic,
      depositsCount: Number(row.dep_count),
      withdrawalsAtomic: row.wd_atomic,
      withdrawalsCount: Number(row.wd_count),
      netAtomic: (BigInt(row.dep_atomic) - BigInt(row.wd_atomic)).toString(),
      cashBalanceAtomic: balances[index].toString(),
    }))
  }

  private async hotWallet(): Promise<FundsSummary['hotWallet']> {
    const mode = (this.config.get<string>('WALLET_CUSTODY_ADAPTER') ?? 'stub').trim().toLowerCase()
    const address = mode === 'manual' ? this.manual.getHotWalletAddress() : null
    if (!address) return { address: null, usdtAtomic: null, trxSun: null, checkedAt: null, error: null }
    if (this.hotWalletCache && Date.now() - this.hotWalletCache.at < HOT_WALLET_CACHE_MS) return this.hotWalletCache.value
    let value: FundsSummary['hotWallet']
    try {
      const [usdt, trx] = await Promise.all([this.tron.getTrc20Balance(address), this.tron.getTrxBalance(address)])
      value = { address, usdtAtomic: usdt.toString(), trxSun: trx.toString(), checkedAt: new Date().toISOString(), error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 160) : 'TRON node unavailable'
      this.log.warn(`Hot wallet balance unavailable: ${message}`)
      // Keep showing the last good reading (marked stale by its checkedAt) rather than blanking the card.
      const last = this.hotWalletCache?.value
      value = last?.usdtAtomic ? { ...last, error: message } : { address, usdtAtomic: null, trxSun: null, checkedAt: null, error: message }
    }
    this.hotWalletCache = { at: Date.now(), value }
    return value
  }
}
