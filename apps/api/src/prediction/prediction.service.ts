import { Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { OperationalCapabilityService } from '../operations/operational-capability.service'
import { PolymarketService } from '../polymarket/polymarket.service'
import {
  PREDICTION_SWITCH_KEY,
  predictionBetNotFound,
  predictionBettingDisabled,
  predictionDailyLimitExceeded,
  predictionInsufficientBalance,
  predictionMarketExposureLimit,
  predictionMarketNotTradeable,
  predictionPriceUnavailable,
  predictionSlippageExceeded,
  predictionStakeLimitExceeded,
} from './prediction.errors'

/** 默认限额（路线 A 方案默认值；P2 可迁配置） */
export const PREDICTION_LIMITS = {
  maxStakeAtomic: '100000000', // 100 USDT
  maxDailyStakeAtomic: '500000000', // 500 USDT / 24h
  maxMarketExposureAtomic: '500000000', // 500 USDT 单市场未结算敞口
  slippageBps: 200n, // 2%
} as const

const SHARES_SCALE = 10n ** 18n
const ATOMIC_PER_UNIT = 10n ** 6n // USDT 6 位小数

/** "0.62" → 620000000000000000n；"1" → 1000000000000000000n（18 位定标） */
export function parseDecimal18(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid decimal: ${value}`)
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18)
  return BigInt(whole) * SHARES_SCALE + BigInt(fracPadded || '0')
}

/** 620000000000000000n → "0.62"（用于 numeric(38,18) 插入） */
export function formatDecimal18(value: bigint): string {
  const whole = value / SHARES_SCALE
  const frac = (value % SHARES_SCALE).toString().padStart(18, '0').replace(/0+$/, '')
  return frac.length ? `${whole}.${frac}` : whole.toString()
}

@Injectable()
export class PredictionService {
  private readonly log = new Logger(PredictionService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly capability: OperationalCapabilityService,
    private readonly polymarket: PolymarketService,
  ) {}

  // ---------------------------------------------------------------- 用户侧

  async status() {
    const enabled = await this.capability.isEnabled(PREDICTION_SWITCH_KEY)
    return {
      enabled,
      mode: 'internal_a',
      limits: {
        maxStakeAtomic: PREDICTION_LIMITS.maxStakeAtomic,
        maxDailyStakeAtomic: PREDICTION_LIMITS.maxDailyStakeAtomic,
        maxMarketExposureAtomic: PREDICTION_LIMITS.maxMarketExposureAtomic,
        slippageBps: PREDICTION_LIMITS.slippageBps.toString(),
        assetDecimals: 6,
      },
    }
  }

  async placeBet(
    userId: string,
    requestId: string,
    input: { tokenId: string; stakeAtomic: string; expectedPrice?: string; idempotencyKey: string },
  ) {
    await this.capability.assertEnabled(PREDICTION_SWITCH_KEY, 'Prediction betting is disabled.')

    const stake = BigInt(input.stakeAtomic)
    if (stake <= 0n) throw predictionStakeLimitExceeded(PREDICTION_LIMITS.maxStakeAtomic)
    if (stake > BigInt(PREDICTION_LIMITS.maxStakeAtomic)) {
      throw predictionStakeLimitExceeded(PREDICTION_LIMITS.maxStakeAtomic)
    }

    // 市场与代币校验（要求市场 active 且 token 未结算）
    const [tokenRow] = await this.dataSource.query(
      `SELECT t.id, t.token_id, t.outcome, t.outcome_index, t.state, t.market_mapping_id,
              m.enable_order_book, m.restricted, m.state AS market_state
       FROM app.polymarket_token_mappings t
       JOIN app.polymarket_market_mappings m ON m.id = t.market_mapping_id
       WHERE t.token_id = $1`,
      [input.tokenId],
    )
    if (!tokenRow) throw predictionMarketNotTradeable(input.tokenId)
    if (
      tokenRow.state !== 'active'
      || tokenRow.market_state !== 'active'
      || tokenRow.enable_order_book !== true
    ) {
      throw predictionMarketNotTradeable(tokenRow.market_mapping_id)
    }
    // 注：market.restricted 是 Polymarket 的地区显示策略（对真实 CLOB 下单有意义）；
    // 内部盘仅消费开奖数据 + 内部记账，不受其约束。

    // 取价（CLOB 订单簿最优卖价；无卖盘用最新成交价兜底）
    const book = await this.polymarket.getOrderBook(input.tokenId)
    const askPrices = (book.asks ?? [])
      .map((level: { price: string }) => level.price)
      .filter((p: unknown): p is string => typeof p === 'string')
      .map((p: string) => parseDecimal18(p))
    const price18 = askPrices.length
      ? askPrices.reduce((min: bigint, p: bigint) => (p < min ? p : min))
      : book.lastTradePrice
        ? parseDecimal18(book.lastTradePrice)
        : null
    if (price18 === null || price18 <= 0n || price18 > SHARES_SCALE) {
      throw predictionPriceUnavailable(input.tokenId)
    }

    // 滑点保护
    if (input.expectedPrice) {
      const expected = parseDecimal18(input.expectedPrice)
      const delta = price18 > expected ? price18 - expected : expected - price18
      if (expected > 0n && delta * 10000n > expected * PREDICTION_LIMITS.slippageBps) {
        throw predictionSlippageExceeded(input.expectedPrice, formatDecimal18(price18))
      }
    }

    // 份额（18 位定标）= 投注(6位原子) × 1e36 / (价格(18位) × 1e6)
    const shares18 = (stake * SHARES_SCALE * SHARES_SCALE) / (price18 * ATOMIC_PER_UNIT)
    if (shares18 <= 0n) throw predictionPriceUnavailable(input.tokenId)

    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`prediction-bet:${userId}`])

      // 幂等：同 key 直接返回
      const [existing] = await runner.query(
        `SELECT * FROM app.prediction_bets WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, input.idempotencyKey],
      )
      if (existing) {
        await runner.commitTransaction()
        return this.toBetView(existing, true)
      }

      // 日累计限额
      const [daily] = await runner.query(
        `SELECT COALESCE(SUM(stake_atomic), 0)::text AS total FROM app.prediction_bets
         WHERE user_id = $1 AND created_at >= now() - interval '24 hours'`,
        [userId],
      )
      if (BigInt(daily.total) + stake > BigInt(PREDICTION_LIMITS.maxDailyStakeAtomic)) {
        throw predictionDailyLimitExceeded(PREDICTION_LIMITS.maxDailyStakeAtomic)
      }

      // 单市场敞口限额
      const [exposure] = await runner.query(
        `SELECT COALESCE(SUM(stake_atomic), 0)::text AS total FROM app.prediction_bets
         WHERE market_mapping_id = $1 AND status = 'placed'`,
        [tokenRow.market_mapping_id],
      )
      if (BigInt(exposure.total) + stake > BigInt(PREDICTION_LIMITS.maxMarketExposureAtomic)) {
        throw predictionMarketExposureLimit(PREDICTION_LIMITS.maxMarketExposureAtomic)
      }

      // 用户可用余额账户 + 平台池账户
      const available = await this.ensureUserAccount(runner, userId)
      const pool = await this.poolAccount(runner)
      const [balance] = await runner.query(
        `SELECT COALESCE(current_atomic_balance, 0)::text AS amount FROM app.ledger_account_balances WHERE account_id = $1`,
        [available],
      )
      if (BigInt(balance?.amount ?? '0') < stake) throw predictionInsufficientBalance()

      // 投注单
      const betId = randomUUID()
      const [bet] = await runner.query(
        `INSERT INTO app.prediction_bets
          (id, user_id, market_mapping_id, token_id, side, stake_atomic, shares, price, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'placed', $9)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [
          betId, userId, tokenRow.market_mapping_id, tokenRow.token_id, String(tokenRow.outcome ?? 'YES').toUpperCase(),
          stake.toString(), formatDecimal18(shares18), formatDecimal18(price18), input.idempotencyKey,
        ],
      )
      if (!bet) {
        const [raced] = await runner.query(
          `SELECT * FROM app.prediction_bets WHERE user_id = $1 AND idempotency_key = $2`,
          [userId, input.idempotencyKey],
        )
        await runner.commitTransaction()
        return this.toBetView(raced, true)
      }

      // 记账：user.available --(debit)--> pool(credit)
      const transactionId = await this.createLedgerTransaction(
        runner, 'prediction_stake', `prediction_stake:${betId}`, requestId, betId, userId,
      )
      if (transactionId) {
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, available, pool, stake.toString()],
        )
      }

      await this.audit(runner, userId, requestId, 'prediction.bet.placed', betId, {
        marketMappingId: tokenRow.market_mapping_id,
        tokenId: tokenRow.token_id,
        stakeAtomic: stake.toString(),
        price: formatDecimal18(price18),
        shares: formatDecimal18(shares18),
      })

      await runner.commitTransaction()
      return this.toBetView(bet, false)
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async listBets(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit
    const rows = await this.dataSource.query(
      `SELECT * FROM app.prediction_bets WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    )
    const [count] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM app.prediction_bets WHERE user_id = $1`,
      [userId],
    )
    return { items: rows.map((r: Record<string, unknown>) => this.toBetView(r, false)), total: count.total, page, limit }
  }

  async getBet(userId: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM app.prediction_bets WHERE id = $1 AND user_id = $2`,
      [id, userId],
    )
    if (!row) throw predictionBetNotFound(id)
    return this.toBetView(row, false)
  }

  // ---------------------------------------------------------------- 结算（worker 调用）

  async findSettleableMarkets(limit: number): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT m.id
       FROM app.polymarket_market_mappings m
       JOIN app.polymarket_token_mappings t ON t.market_mapping_id = m.id AND t.state = 'resolved'
       JOIN app.prediction_bets b ON b.market_mapping_id = m.id AND b.status = 'placed'
       LEFT JOIN app.prediction_settlement_runs r ON r.market_mapping_id = m.id
       WHERE r.id IS NULL
       LIMIT $1`,
      [limit],
    )
    return rows.map((r: { id: string }) => r.id)
  }

  async settleMarket(marketMappingId: string): Promise<{ settled: boolean; outcome?: string; betsSettled: number; totalPaidAtomic: string }> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`prediction-settle:${marketMappingId}`])

      const [already] = await runner.query(
        `SELECT id FROM app.prediction_settlement_runs WHERE market_mapping_id = $1`,
        [marketMappingId],
      )
      if (already) {
        await runner.commitTransaction()
        return { settled: false, betsSettled: 0, totalPaidAtomic: '0' }
      }

      const tokens = await runner.query(
        `SELECT token_id, state FROM app.polymarket_token_mappings WHERE market_mapping_id = $1`,
        [marketMappingId],
      )
      const resolved = (tokens as Array<{ token_id: string; state: string }>).filter((t) => t.state === 'resolved')
      if (resolved.length === 0) {
        await runner.commitTransaction()
        return { settled: false, betsSettled: 0, totalPaidAtomic: '0' }
      }
      const voided = resolved.length > 1
      const winnerTokenId = voided ? null : resolved[0].token_id

      const bets = await runner.query(
        `SELECT * FROM app.prediction_bets WHERE market_mapping_id = $1 AND status = 'placed' FOR UPDATE`,
        [marketMappingId],
      )
      const pool = await this.poolAccount(runner)
      let betsSettled = 0
      let totalStake = 0n
      let totalPaid = 0n

      for (const bet of bets as Array<Record<string, unknown>>) {
        const betId = bet.id as string
        const userId = bet.user_id as string
        const stakeAtomic = BigInt(bet.stake_atomic as string)
        totalStake += stakeAtomic
        const available = await this.ensureUserAccount(runner, userId)

        if (voided) {
          // 退款：pool --(debit)--> user(credit)
          const txId = await this.createLedgerTransaction(
            runner, 'prediction_void_refund', `prediction_void_refund:${betId}`, `settle:${marketMappingId}`, betId, userId,
          )
          if (txId) {
            await runner.query(
              `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
               VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
              [txId, pool, available, stakeAtomic.toString()],
            )
            totalPaid += stakeAtomic
          }
          await runner.query(
            `UPDATE app.prediction_bets SET status = 'void', settled_at = now() WHERE id = $1 AND status = 'placed'`,
            [betId],
          )
        } else if ((bet.token_id as string) === winnerTokenId) {
          // 派彩：shares(18 位小数字符串) → atomic(6)，pool --> user
          const payout = parseDecimal18(String(bet.shares)) / 10n ** 12n
          if (payout > 0n) {
            const txId = await this.createLedgerTransaction(
              runner, 'prediction_payout', `prediction_payout:${betId}`, `settle:${marketMappingId}`, betId, userId,
            )
            if (txId) {
              await runner.query(
                `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
                 VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
                [txId, pool, available, payout.toString()],
              )
              totalPaid += payout
            }
          }
          await runner.query(
            `UPDATE app.prediction_bets SET status = 'won', settled_at = now() WHERE id = $1 AND status = 'placed'`,
            [betId],
          )
        } else {
          await runner.query(
            `UPDATE app.prediction_bets SET status = 'lost', settled_at = now() WHERE id = $1 AND status = 'placed'`,
            [betId],
          )
        }
        betsSettled += 1
      }

      await runner.query(
        `INSERT INTO app.prediction_settlement_runs
          (market_mapping_id, winning_token_id, outcome, bets_settled, total_stake_atomic, total_paid_atomic)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (market_mapping_id) DO NOTHING`,
        [marketMappingId, winnerTokenId, voided ? 'void' : 'resolved', betsSettled, totalStake.toString(), totalPaid.toString()],
      )

      await runner.commitTransaction()
      this.log.log(`prediction settle market=${marketMappingId} outcome=${voided ? 'void' : 'resolved'} bets=${betsSettled} paid=${totalPaid.toString()}`)
      return { settled: true, outcome: voided ? 'void' : 'resolved', betsSettled, totalPaidAtomic: totalPaid.toString() }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  // ---------------------------------------------------------------- 内部工具

  private toBetView(row: Record<string, unknown>, duplicate: boolean) {
    return {
      id: row.id,
      marketMappingId: row.market_mapping_id,
      tokenId: row.token_id,
      side: row.side,
      stakeAtomic: String(row.stake_atomic),
      shares: String(row.shares),
      price: String(row.price),
      status: row.status,
      settledAt: row.settled_at ?? null,
      createdAt: row.created_at,
      duplicate,
    }
  }

  private async ensureUserAccount(runner: ReturnType<DataSource['createQueryRunner']>, userId: string) {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
      [userId],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'user' AND user_id = $1 AND purpose = 'available' AND asset_code = 'USDT' AND network IS NULL`,
      [userId],
    )
    if (!account) throw new Error('Failed to resolve user ledger account')
    return account.id as string
  }

  private async poolAccount(runner: ReturnType<DataSource['createQueryRunner']>) {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('platform', 'prediction_pool', 'settlement', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'platform' AND owner_reference = 'prediction_pool' AND purpose = 'settlement' AND asset_code = 'USDT'`,
    )
    if (!account) throw new Error('Failed to resolve prediction pool account')
    return account.id as string
  }

  private async createLedgerTransaction(
    runner: ReturnType<DataSource['createQueryRunner']>,
    transactionType: string,
    idempotencyKey: string,
    requestId: string,
    referenceId: string,
    actorId: string,
  ): Promise<string | null> {
    const rows = await runner.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, actor_id, effective_at)
       VALUES ($1, $2, $3, 'prediction_bet', $4, 'user', $5, now())
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [transactionType, idempotencyKey, requestId, referenceId, actorId],
    )
    return (rows[0]?.id as string | undefined) ?? null
  }

  private async audit(
    runner: ReturnType<DataSource['createQueryRunner']>,
    userId: string,
    requestId: string,
    action: string,
    objectId: string,
    metadata: Record<string, unknown>,
  ) {
    await runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, actor_id, user_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'user', $2, $2, $3, 'prediction_bet', $4, $5, $6)`,
      [randomUUID(), userId, action, objectId, requestId, JSON.stringify(metadata)],
    )
  }

  // ---------- 管理台查询 ----------

  async adminStats() {
    const [totals] = await this.dataSource.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'placed')::int AS placed,
         count(*) FILTER (WHERE status = 'won')::int AS won,
         count(*) FILTER (WHERE status = 'lost')::int AS lost,
         count(*) FILTER (WHERE status = 'void')::int AS void,
         COALESCE(SUM(stake_atomic) FILTER (WHERE status = 'placed'), 0)::text AS "openStakeAtomic",
         COALESCE(SUM(stake_atomic), 0)::text AS "totalStakeAtomic",
         COALESCE(SUM(CASE WHEN status = 'won' THEN shares * 1000000 / 1000000000000000000 ELSE 0 END), 0)::text AS "paidOutAtomic"
       FROM app.prediction_bets`,
    )
    const [runs] = await this.dataSource.query(`SELECT count(*)::int AS n FROM app.prediction_settlement_runs`)
    const exposureTop = await this.dataSource.query(
      `SELECT b.market_mapping_id::text AS "marketId", m.question, m.slug,
              COALESCE(SUM(b.stake_atomic), 0)::text AS "openStakeAtomic", count(*)::int AS bets
       FROM app.prediction_bets b
       JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
       WHERE b.status = 'placed'
       GROUP BY 1, 2, 3
       ORDER BY SUM(b.stake_atomic) DESC
       LIMIT 10`,
    )
    return { totals, settlementRuns: runs?.n ?? 0, exposureTop, limits: PREDICTION_LIMITS }
  }

  async adminListBets(input: { page: number; limit: number; status?: string; marketId?: string }) {
    const where: string[] = []
    const params: unknown[] = []
    if (input.status) {
      params.push(input.status)
      where.push(`b.status = $${params.length}`)
    }
    if (input.marketId) {
      params.push(input.marketId)
      where.push(`b.market_mapping_id = $${params.length}`)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const offset = (input.page - 1) * input.limit
    const items = await this.dataSource.query(
      `SELECT b.id::text, b.user_id::text AS "userId", b.status, b.side,
              b.stake_atomic::text AS "stakeAtomic", b.shares::text, b.price::text,
              b.created_at AS "createdAt", b.settled_at AS "settledAt",
              m.question, m.slug, t.outcome
       FROM app.prediction_bets b
       JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
       LEFT JOIN app.polymarket_token_mappings t ON t.token_id = b.token_id
       ${clause}
       ORDER BY b.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, input.limit, offset],
    )
    const [count] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM app.prediction_bets b ${clause}`,
      params,
    )
    return { total: count?.n ?? 0, page: input.page, limit: input.limit, items }
  }

  async adminListSettlements(input: { page: number; limit: number }) {
    const offset = (input.page - 1) * input.limit
    const items = await this.dataSource.query(
      `SELECT r.id::text, r.market_mapping_id::text AS "marketId", m.question, m.slug,
              r.winning_token_id AS "winningTokenId", r.outcome, r.bets_settled AS "betsSettled",
              r.total_stake_atomic::text AS "totalStakeAtomic", r.total_paid_atomic::text AS "totalPaidAtomic",
              r.executed_at AS "executedAt"
       FROM app.prediction_settlement_runs r
       JOIN app.polymarket_market_mappings m ON m.id = r.market_mapping_id
       ORDER BY r.executed_at DESC
       LIMIT $1 OFFSET $2`,
      [input.limit, offset],
    )
    const [count] = await this.dataSource.query(`SELECT count(*)::int AS n FROM app.prediction_settlement_runs`)
    return { total: count?.n ?? 0, page: input.page, limit: input.limit, items }
  }
}
