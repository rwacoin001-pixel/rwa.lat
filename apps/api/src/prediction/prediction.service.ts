import { Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { OperationalCapabilityService } from '../operations/operational-capability.service'
import { PolymarketService } from '../polymarket/polymarket.service'
import { ComplianceService } from '../compliance/compliance.service'
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
import { validatedPredictionPrice } from './prediction-quote'
import { bpsToRate, feeOn, predictionFeeConfig } from './prediction-fees'
import { ATOMIC_PER_UNIT, SHARES_SCALE, formatDecimal18, parseDecimal18 } from './prediction-hedge-math'
import { recordReferralRewards } from '../referral/referral-rewards'

// 18 位定标换算已抽到 prediction-hedge-math（纯函数模块，可独立测试）；此处 re-export 保持既有引用不变。
export { formatDecimal18, parseDecimal18 }

/** 默认限额（路线 A 方案默认值；P2 可迁配置） */
export const PREDICTION_LIMITS = {
  maxStakeAtomic: null, // No per-bet cap; balance, daily and exposure gates still apply.
  maxDailyStakeAtomic: '500000000', // 500 USDT / 24h
  maxMarketExposureAtomic: '500000000', // 500 USDT 单市场未结算敞口
  slippageBps: 200n, // 2%
} as const

// 定标换算（SHARES_SCALE / ATOMIC_PER_UNIT / parseDecimal18 / formatDecimal18）
// 已移至 prediction-hedge-math.ts 并在文件顶部导入。

/** Row shape of the token+market mapping lookup in placeBet. */
type PredictionTokenRow = {
  id: string
  token_id: string
  outcome: string | null
  outcome_index: number | null
  state: string
  market_mapping_id: string
  enable_order_book: boolean
  restricted: boolean | null
  market_state: string
  market_end_at: Date | null
}

@Injectable()
export class PredictionService {
  private readonly log = new Logger(PredictionService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly capability: OperationalCapabilityService,
    private readonly polymarket: PolymarketService,
    private readonly compliance: ComplianceService,
  ) {}

  // ---------------------------------------------------------------- 用户侧

  async status() {
    const enabled = await this.capability.isEnabled(PREDICTION_SWITCH_KEY)
    const fees = predictionFeeConfig()
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
      /** A+C 混合收费：下注费 + 派彩费。前端确认页与费率页必须读这里的值。 */
      fees: {
        placeFeeBps: fees.placeFeeBps,
        payoutFeeBps: fees.payoutFeeBps,
        placeFeeRate: bpsToRate(fees.placeFeeBps),
        payoutFeeRate: bpsToRate(fees.payoutFeeBps),
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

    // A 段收费：下注时先抽下注费，只有净额进入风险池（费收即时确认，不承担赔付风险）
    const feeConfig = predictionFeeConfig()
    const placeFee = feeOn(stake, feeConfig.placeFeeBps)
    const riskStake = stake - placeFee
    if (riskStake <= 0n) throw predictionStakeLimitExceeded(PREDICTION_LIMITS.maxStakeAtomic)

    // 市场与代币校验（要求市场 active 且 token 未结算）
    let tokenRow = await this.tokenMapping(input.tokenId)
    if (!tokenRow) {
      // 映射表原来只有人工 SQL 塞进去的 150 条，没有入库管线；而界面展示的是上游全量
      // 市场（活跃事件 2100+），所以约 93% 的市场点"下注"会被拒。这里按 tokenId 反查
      // 上游、按需补映射（只新增不覆盖状态），补完再查一次；仍不可用则维持原来的拒绝。
      await this.polymarket.ensureTokenMapped(input.tokenId)
      tokenRow = await this.tokenMapping(input.tokenId)
    }
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

    const [book, probability] = await Promise.all([
      this.polymarket.getOrderBook(input.tokenId),
      this.polymarket.getOutcomeProbability(input.tokenId),
    ])
    const price18 = validatedPredictionPrice(book, input.tokenId, riskStake, probability)
    if (price18 === null) throw predictionPriceUnavailable(input.tokenId)

    // 滑点保护
    if (input.expectedPrice) {
      const expected = parseDecimal18(input.expectedPrice)
      const delta = price18 > expected ? price18 - expected : expected - price18
      if (expected > 0n && delta * 10000n > expected * PREDICTION_LIMITS.slippageBps) {
        throw predictionSlippageExceeded(input.expectedPrice, formatDecimal18(price18))
      }
    }

    // 份额（18 位定标）= 净本金(riskStake, 6位原子) × 1e36 / (价格(18位) × 1e6)
    const shares18 = (riskStake * SHARES_SCALE * SHARES_SCALE) / (price18 * ATOMIC_PER_UNIT)
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

      // Serialize all users on the same market with result sync/settlement.
      // Quotes were fetched outside this transaction; they may already be obsolete.
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`prediction-settle:${tokenRow.market_mapping_id}`])
      const current = await this.tokenMapping(input.tokenId, runner)
      const [settled] = await runner.query('SELECT id FROM app.prediction_settlement_runs WHERE market_mapping_id=$1', [tokenRow.market_mapping_id])
      if (!current || current.market_mapping_id !== tokenRow.market_mapping_id || settled
        || current.state !== 'active' || current.market_state !== 'active' || !current.enable_order_book
        || (current.market_end_at && new Date(current.market_end_at).getTime() <= Date.now())) {
        throw predictionMarketNotTradeable(tokenRow.market_mapping_id)
      }
      tokenRow = current

      await this.compliance.requireInvestmentEligibility(userId, 'prediction')

      // 日累计限额
      const [daily] = await runner.query(
        `SELECT COALESCE(SUM(stake_atomic), 0)::text AS total FROM app.prediction_bets
         WHERE user_id = $1 AND created_at >= now() - interval '24 hours'`,
        [userId],
      )
      if (BigInt(daily.total) + stake > BigInt(PREDICTION_LIMITS.maxDailyStakeAtomic)) {
        throw predictionDailyLimitExceeded(PREDICTION_LIMITS.maxDailyStakeAtomic)
      }

      // 单市场敞口限额（口径 = 平台真实承担的风险本金，不含下注费）
      const [exposure] = await runner.query(
        `SELECT COALESCE(SUM(stake_atomic - fee_atomic), 0)::text AS total FROM app.prediction_bets
         WHERE market_mapping_id = $1 AND status = 'placed'`,
        [tokenRow.market_mapping_id],
      )
      if (BigInt(exposure.total) + riskStake > BigInt(PREDICTION_LIMITS.maxMarketExposureAtomic)) {
        throw predictionMarketExposureLimit(PREDICTION_LIMITS.maxMarketExposureAtomic)
      }

      // 用户可用余额账户 + 平台池账户 + 平台手续费收入账户
      const available = await this.ensureUserAccount(runner, userId)
      const pool = await this.poolAccount(runner)
      const feeAccount = await this.feeAccount(runner)
      const [balance] = await runner.query(
        `SELECT COALESCE(current_atomic_balance, 0)::text AS amount FROM app.ledger_account_balances WHERE account_id = $1`,
        [available],
      )
      if (BigInt(balance?.amount ?? '0') < stake) throw predictionInsufficientBalance()

      // 投注单
      const betId = randomUUID()
      const [bet] = await runner.query(
        `INSERT INTO app.prediction_bets
          (id, user_id, market_mapping_id, token_id, side, stake_atomic, fee_atomic, payout_fee_atomic, shares, price, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, 'placed', $10)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [
          betId, userId, tokenRow.market_mapping_id, tokenRow.token_id, String(tokenRow.outcome ?? 'YES').toUpperCase(),
          stake.toString(), placeFee.toString(), formatDecimal18(shares18), formatDecimal18(price18), input.idempotencyKey,
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

      // 记账：user.available --(debit stake)--> pool(credit riskStake) + fee_revenue(credit placeFee)
      // 三笔分录同属一笔交易，借贷净额为 0（账本平衡触发器要求）。
      const transactionId = await this.createLedgerTransaction(
        runner, 'prediction_stake', `prediction_stake:${betId}`, requestId, betId, userId,
      )
      if (transactionId) {
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $3), ($1, $4, 'credit', $5)`,
          [transactionId, available, stake.toString(), pool, riskStake.toString()],
        )
        if (placeFee > 0n) {
          const [feeEntry] = await runner.query(
            `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
             VALUES ($1, $2, 'credit', $3) RETURNING id`,
            [transactionId, feeAccount, placeFee.toString()],
          )
          await recordReferralRewards(runner, { kind: 'fee', sourceType: 'prediction_fee', component: 'prediction_place', sourceId: feeEntry.id, sourceUserId: userId, baseAtomic: placeFee })
        }
      }

      await this.audit(runner, userId, requestId, 'prediction.bet.placed', betId, {
        marketMappingId: tokenRow.market_mapping_id,
        tokenId: tokenRow.token_id,
        stakeAtomic: stake.toString(),
        placeFeeAtomic: placeFee.toString(),
        riskStakeAtomic: riskStake.toString(),
        placeFeeBps: feeConfig.placeFeeBps,
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
      `SELECT b.*, m.question AS market_question, m.slug AS market_slug, m.gamma_market_id AS market_gamma_id, t.outcome AS token_outcome
       FROM app.prediction_bets b
       LEFT JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
       LEFT JOIN app.polymarket_token_mappings t ON t.token_id = b.token_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
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
       LEFT JOIN app.polymarket_settlement_mappings s ON s.market_mapping_id = m.id
       WHERE r.id IS NULL AND m.state <> 'suspended'
         AND (s.id IS NULL OR (s.state='confirmed' AND s.provider='polymarket' AND s.payout_value=1
           AND s.winning_token_mapping_id=t.id AND s.outcome=t.outcome
           AND NOT EXISTS (SELECT 1 FROM app.polymarket_token_mappings other
             WHERE other.market_mapping_id=m.id AND other.state='resolved' AND other.id<>t.id)))
       ORDER BY m.id
       LIMIT $1`,
      [limit],
    )
    return rows.map((r: { id: string }) => r.id)
  }

  async settleMarket(marketMappingId: string): Promise<{ settled: boolean; outcome?: string; betsSettled: number; totalPaidAtomic: string; totalFeeAtomic: string }> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`prediction-settle:${marketMappingId}`])

      const [market] = await runner.query('SELECT state FROM app.polymarket_market_mappings WHERE id=$1 FOR UPDATE', [marketMappingId])
      if (!market || market.state === 'suspended') {
        await runner.commitTransaction()
        return { settled: false, betsSettled: 0, totalPaidAtomic: '0', totalFeeAtomic: '0' }
      }

      const [already] = await runner.query(
        `SELECT id FROM app.prediction_settlement_runs WHERE market_mapping_id = $1`,
        [marketMappingId],
      )
      if (already) {
        await runner.commitTransaction()
        return { settled: false, betsSettled: 0, totalPaidAtomic: '0', totalFeeAtomic: '0' }
      }

      const tokens = await runner.query(
        `SELECT token_id, state, outcome FROM app.polymarket_token_mappings WHERE market_mapping_id = $1 FOR UPDATE`,
        [marketMappingId],
      )
      const resolved = (tokens as Array<{ token_id: string; state: string; outcome: string }>).filter((t) => t.state === 'resolved')
      if (resolved.length === 0) {
        await runner.commitTransaction()
        return { settled: false, betsSettled: 0, totalPaidAtomic: '0', totalFeeAtomic: '0' }
      }
      const voided = resolved.length > 1
      const winnerTokenId = voided ? null : resolved[0].token_id

      // Result evidence may have been disputed/reversed since sync. Check under lock
      // again at the money boundary. Legacy manual resolutions without a mapping
      // retain their existing winner/void semantics.
      const [evidence] = await runner.query(`SELECT s.*, t.token_id AS winner_token_id
        FROM app.polymarket_settlement_mappings s
        LEFT JOIN app.polymarket_token_mappings t ON t.id=s.winning_token_mapping_id AND t.market_mapping_id=s.market_mapping_id
        WHERE s.market_mapping_id=$1 FOR UPDATE OF s`, [marketMappingId])
      if (evidence && (voided || evidence.state !== 'confirmed' || evidence.provider !== 'polymarket'
        || !/^1(?:\.0+)?$/.test(String(evidence.payout_value))
        || evidence.winner_token_id !== winnerTokenId || evidence.outcome !== resolved[0].outcome)) {
        this.log.warn(`prediction settlement evidence requires review market=${marketMappingId}`)
        await runner.commitTransaction()
        return { settled:false, betsSettled:0, totalPaidAtomic:'0', totalFeeAtomic:'0' }
      }

      const bets = await runner.query(
        `SELECT * FROM app.prediction_bets WHERE market_mapping_id = $1 AND status = 'placed' FOR UPDATE`,
        [marketMappingId],
      )
      await runner.query(`UPDATE app.polymarket_market_mappings SET state='resolved',enable_order_book=false,updated_at=now() WHERE id=$1`, [marketMappingId])
      const pool = await this.poolAccount(runner)
      const feeAccount = await this.feeAccount(runner)
      const feeConfig = predictionFeeConfig()
      let betsSettled = 0
      let totalStake = 0n
      let totalPaid = 0n
      let totalFee = 0n

      for (const bet of bets as Array<Record<string, unknown>>) {
        const betId = bet.id as string
        const userId = bet.user_id as string
        const stakeAtomic = BigInt(bet.stake_atomic as string)
        const betPlaceFee = BigInt(String(bet.fee_atomic ?? '0'))
        totalStake += stakeAtomic
        const available = await this.ensureUserAccount(runner, userId)

        if (voided) {
          // 退款：退回净本金（stake − 下注费）。下注费是已提供服务的对价，不作退回。
          const refund = stakeAtomic - betPlaceFee
          if (refund > 0n) {
            const txId = await this.createLedgerTransaction(
              runner, 'prediction_void_refund', `prediction_void_refund:${betId}`, `settle:${marketMappingId}`, betId, userId,
            )
            if (txId) {
              await runner.query(
                `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
                 VALUES ($1, $2, 'debit', $3), ($1, $4, 'credit', $3)`,
                [txId, pool, refund.toString(), available],
              )
              totalPaid += refund
            }
          }
          await runner.query(
            `UPDATE app.prediction_bets SET status = 'void', settled_at = now() WHERE id = $1 AND status = 'placed'`,
            [betId],
          )
        } else if ((bet.token_id as string) === winnerTokenId) {
          // 派彩：毛额 = shares(18 位小数) → atomic(6)；再抽派彩费
          const grossPayout = parseDecimal18(String(bet.shares)) / 10n ** 12n
          const payoutFee = feeOn(grossPayout, feeConfig.payoutFeeBps)
          const netPayout = grossPayout - payoutFee
          if (netPayout > 0n) {
            const txId = await this.createLedgerTransaction(
              runner, 'prediction_payout', `prediction_payout:${betId}`, `settle:${marketMappingId}`, betId, userId,
            )
            if (txId) {
              // pool --(debit 毛额)--> user(credit 净额) + fee_revenue(credit 派彩费)
              await runner.query(
                `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
                 VALUES ($1, $2, 'debit', $3), ($1, $4, 'credit', $5)`,
                [txId, pool, grossPayout.toString(), available, netPayout.toString()],
              )
              if (payoutFee > 0n) {
                const [feeEntry] = await runner.query(
                  `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
                   VALUES ($1, $2, 'credit', $3) RETURNING id`,
                  [txId, feeAccount, payoutFee.toString()],
                )
                await recordReferralRewards(runner, { kind: 'fee', sourceType: 'prediction_fee', component: 'prediction_payout', sourceId: feeEntry.id, sourceUserId: userId, baseAtomic: payoutFee })
              }
              totalPaid += netPayout
              totalFee += payoutFee
            }
          }
          await runner.query(
            `UPDATE app.prediction_bets SET status = 'won', payout_fee_atomic = $2, settled_at = now() WHERE id = $1 AND status = 'placed'`,
            [betId, payoutFee.toString()],
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
          (market_mapping_id, winning_token_id, outcome, bets_settled, total_stake_atomic, total_paid_atomic, total_fee_atomic)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (market_mapping_id) DO NOTHING`,
        [marketMappingId, winnerTokenId, voided ? 'void' : 'resolved', betsSettled, totalStake.toString(), totalPaid.toString(), totalFee.toString()],
      )

      await runner.commitTransaction()
      this.log.log(`prediction settle market=${marketMappingId} outcome=${voided ? 'void' : 'resolved'} bets=${betsSettled} paid=${totalPaid.toString()} fee=${totalFee.toString()}`)
      return { settled: true, outcome: voided ? 'void' : 'resolved', betsSettled, totalPaidAtomic: totalPaid.toString(), totalFeeAtomic: totalFee.toString() }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  // ---------------------------------------------------------------- 内部工具

  /** Look up a token's mapping together with its market's tradeable flags. */
  private async tokenMapping(tokenId: string, runner?: ReturnType<DataSource['createQueryRunner']>): Promise<PredictionTokenRow | null> {
    const [row] = (await (runner ?? this.dataSource).query(
      `SELECT t.id, t.token_id, t.outcome, t.outcome_index, t.state, t.market_mapping_id,
              m.enable_order_book, m.restricted, m.state AS market_state, m.market_end_at
       FROM app.polymarket_token_mappings t
       JOIN app.polymarket_market_mappings m ON m.id = t.market_mapping_id
       WHERE t.token_id = $1${runner ? ' FOR UPDATE OF m, t' : ''}`,
      [tokenId],
    )) as Array<PredictionTokenRow>
    return row ?? null
  }

  private toBetView(row: Record<string, unknown>, duplicate: boolean) {
    return {
      id: row.id,
      marketMappingId: row.market_mapping_id,
      tokenId: row.token_id,
      side: row.side,
      stakeAtomic: String(row.stake_atomic),
      feeAtomic: String(row.fee_atomic ?? '0'),
      payoutFeeAtomic: String(row.payout_fee_atomic ?? '0'),
      /** 实际进入风险池的本金 = stake − 下注费 */
      riskStakeAtomic: (BigInt(String(row.stake_atomic ?? '0')) - BigInt(String(row.fee_atomic ?? '0'))).toString(),
      shares: String(row.shares),
      price: String(row.price),
      status: row.status,
      marketQuestion: row.market_question ?? null,
      marketSlug: row.market_slug ?? null,
      /** The id GET /v1/polymarket/markets/:id accepts (the slug is not one). */
      marketId: row.market_gamma_id ?? null,
      tokenOutcome: row.token_outcome ?? null,
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

  /**
   * 平台手续费收入账户（predict_fee）。
   * 下注费与派彩费都进这里；它是收入账户，永不参与赔付，因此不需要跟着池子承担风险。
   */
  private async feeAccount(runner: ReturnType<DataSource['createQueryRunner']>) {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('platform', 'prediction_fee', 'fee_revenue', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'platform' AND owner_reference = 'prediction_fee' AND purpose = 'fee_revenue' AND asset_code = 'USDT'`,
    )
    if (!account) throw new Error('Failed to resolve prediction fee revenue account')
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
         COALESCE(SUM(stake_atomic - fee_atomic) FILTER (WHERE status = 'placed'), 0)::text AS "openStakeAtomic",
         COALESCE(SUM(stake_atomic), 0)::text AS "totalStakeAtomic",
         COALESCE(SUM(fee_atomic), 0)::text AS "placeFeeAtomic",
         COALESCE(SUM(payout_fee_atomic), 0)::text AS "payoutFeeAtomic",
         COALESCE(SUM(fee_atomic + payout_fee_atomic), 0)::text AS "totalFeeAtomic",
         COALESCE(SUM(CASE WHEN status = 'won' THEN shares * 1000000 / 1000000000000000000 ELSE 0 END), 0)::text AS "paidOutAtomic"
       FROM app.prediction_bets`,
    )
    const [runs] = await this.dataSource.query(`SELECT count(*)::int AS n FROM app.prediction_settlement_runs`)
    const [feeLedger] = await this.dataSource.query(
      `SELECT COALESCE(b.current_atomic_balance, 0)::text AS "feeRevenueAtomic"
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.owner_type = 'platform' AND a.owner_reference = 'prediction_fee' AND a.purpose = 'fee_revenue'
         AND a.asset_code = 'USDT'`,
    )
    const [poolLedger] = await this.dataSource.query(
      `SELECT COALESCE(b.current_atomic_balance, 0)::text AS "poolAtomic"
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.owner_type = 'platform' AND a.owner_reference = 'prediction_pool' AND a.purpose = 'settlement'
         AND a.asset_code = 'USDT'`,
    )
    const exposureTop = await this.dataSource.query(
      `SELECT b.market_mapping_id::text AS "marketId", m.question, m.slug,
              COALESCE(SUM(b.stake_atomic - b.fee_atomic), 0)::text AS "openStakeAtomic", count(*)::int AS bets
       FROM app.prediction_bets b
       JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
       WHERE b.status = 'placed'
       GROUP BY 1, 2, 3
       ORDER BY SUM(b.stake_atomic - b.fee_atomic) DESC
       LIMIT 10`,
    )
    return {
      totals,
      settlementRuns: runs?.n ?? 0,
      exposureTop,
      /** 平台手续费收入账户余额（累计已确认收入，USDT atomic） */
      feeRevenueAtomic: feeLedger?.feeRevenueAtomic ?? '0',
      /** 投注池余额；为负表示庄家已赔穿、需要资金账户补足 */
      poolAtomic: poolLedger?.poolAtomic ?? '0',
      // slippageBps 内部是 BigInt（滑点计算用）——JSON 序列化前转 number
      limits: { ...PREDICTION_LIMITS, slippageBps: Number(PREDICTION_LIMITS.slippageBps) },
      fees: predictionFeeConfig(),
    }
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
              b.stake_atomic::text AS "stakeAtomic", b.fee_atomic::text AS "feeAtomic",
              b.payout_fee_atomic::text AS "payoutFeeAtomic",
              b.shares::text, b.price::text,
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
