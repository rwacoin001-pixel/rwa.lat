import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'

const REQUEST_KEY = /^[A-Za-z0-9_-]{8,128}$/
/** Platform account that funds referral rewards (debit-normal expense; may run negative like a cost centre). */
export const REFERRAL_REWARD_ACCOUNT_REFERENCE = 'referral_rewards'

type ClaimRow = { id: string; amount_atomic: string; reward_count: number; ledger_transaction_id: string; created_at: string }

/**
 * Claims every earned referral reward of a user into their available USDT in one balanced ledger transaction.
 * Product decision 2026-10-13: rewards are claimable immediately and land in the withdrawable balance.
 */
@Injectable()
export class ReferralClaimService {
  constructor(private readonly db: DataSource) {}

  async claim(userId: string, requestKey: string | undefined) {
    if (!requestKey || !REQUEST_KEY.test(requestKey)) {
      throw new BadRequestException({ code: 'REFERRAL_CLAIM_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' })
    }
    const [installed] = await this.db.query("SELECT to_regclass('app.referral_rewards') IS NOT NULL AS ok")
    if (!installed?.ok) throw new ServiceUnavailableException({ code: 'REFERRAL_UNAVAILABLE', message: 'Referral rewards are being prepared.' })
    return this.db.transaction(async m => {
      // Serialises one user's claims; reward rows are additionally row-locked below.
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`referral-claim:${userId}`])
      const [previous] = await m.query('SELECT * FROM app.referral_reward_claims WHERE user_id = $1 AND request_key = $2', [userId, requestKey]) as ClaimRow[]
      if (previous) return this.view(previous, true)
      const [user] = await m.query('SELECT status FROM app.users WHERE id = $1 FOR SHARE', [userId])
      if (!user || user.status !== 'active') {
        throw new ConflictException({ code: 'REFERRAL_CLAIM_UNAVAILABLE', message: 'This account cannot claim rewards right now.' })
      }
      const rewards = await m.query(`SELECT id, amount_atomic::text AS amount FROM app.referral_rewards
        WHERE user_id = $1 AND state = 'earned' ORDER BY earned_at, id FOR UPDATE`, [userId]) as Array<{ id: string; amount: string }>
      if (!rewards.length) throw new ConflictException({ code: 'REFERRAL_NOTHING_TO_CLAIM', message: 'There are no rewards to claim.' })
      const total = rewards.reduce((sum, row) => sum + BigInt(row.amount), 0n)
      const available = await this.userAvailableAccount(m, userId)
      const expense = await this.rewardAccount(m)
      const claimId = randomUUID()
      const [tx] = await m.query(`INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id, reason_code, actor_type, actor_id, effective_at, metadata)
        VALUES ('referral_reward', $1, $2, 'referral_reward_claim', $3, 'referral_reward', 'user', $4, now(), $5) RETURNING id`,
      [`referral-claim:${claimId}`, requestKey, claimId, userId, JSON.stringify({ rewardCount: rewards.length })])
      await m.query(`INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount) VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
        [tx.id, expense, available, total.toString()])
      const [claim] = await m.query(`INSERT INTO app.referral_reward_claims (id, user_id, request_key, amount_atomic, reward_count, ledger_transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [claimId, userId, requestKey, total.toString(), rewards.length, tx.id]) as ClaimRow[]
      await m.query(`UPDATE app.referral_rewards SET state = 'claimed', claim_id = $1, claimed_at = now() WHERE id = ANY($2::uuid[])`,
        [claimId, rewards.map(row => row.id)])
      await m.query(`INSERT INTO app.referral_audit(request_key, actor_id, action, object_id, metadata) VALUES ($1, $2, 'reward.claimed', $3, $4)`,
        [`reward-claim:${claimId}`, userId, claimId, JSON.stringify({ amountAtomic: total.toString(), rewardCount: rewards.length, ledgerTransactionId: tx.id })])
      return this.view(claim, false)
    })
  }

  private view(claim: ClaimRow, replay: boolean) {
    return { claimId: claim.id, amountAtomic: String(claim.amount_atomic), rewardCount: Number(claim.reward_count), currency: 'USDT', decimals: 6,
      ledgerTransactionId: claim.ledger_transaction_id, claimedAt: claim.created_at, replay }
  }

  private async userAvailableAccount(m: EntityManager, userId: string): Promise<string> {
    await m.query(`INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
      VALUES ('user', $1, 'available', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`, [userId])
    const [account] = await m.query(`SELECT id, state, normal_side FROM app.ledger_accounts
      WHERE owner_type = 'user' AND user_id = $1 AND purpose = 'available' AND asset_code = 'USDT' AND network IS NULL FOR SHARE`, [userId])
    if (!account || account.state !== 'active' || account.normal_side !== 'credit') {
      throw new ConflictException({ code: 'REFERRAL_CLAIM_UNAVAILABLE', message: 'Your USDT balance cannot receive rewards right now.' })
    }
    return account.id
  }

  private async rewardAccount(m: EntityManager): Promise<string> {
    await m.query(`INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
      VALUES ('platform', $1, 'reward_payable', 'USDT', 6, 'debit', true) ON CONFLICT DO NOTHING`, [REFERRAL_REWARD_ACCOUNT_REFERENCE])
    const [account] = await m.query(`SELECT id, state, normal_side FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = $1
      AND purpose = 'reward_payable' AND asset_code = 'USDT' AND network IS NULL`, [REFERRAL_REWARD_ACCOUNT_REFERENCE])
    if (!account || account.state !== 'active' || account.normal_side !== 'debit') {
      throw new ServiceUnavailableException({ code: 'REFERRAL_UNAVAILABLE', message: 'Referral reward funding is unavailable.' })
    }
    return account.id
  }
}
