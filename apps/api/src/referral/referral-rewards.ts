import { Logger } from '@nestjs/common'

/** Anything that runs SQL inside the caller's transaction (QueryRunner or EntityManager). */
export type RewardQueryable = { query(sql: string, parameters?: unknown[]): Promise<any> }
export type RewardAncestor = { user_id: string; level: number }
export type RewardPlan = { userId: string; level: number; rateBps: number; amountAtomic: bigint }
export type RewardSource =
  | { kind: 'purchase'; sourceType: 'order' | 'basket_subscription' | 'quant_subscription'; sourceId: string; sourceUserId: string; baseAtomic: bigint | string }
  | { kind: 'fee'; sourceType: 'prediction_fee'; component: 'prediction_place' | 'prediction_payout'; sourceId: string; sourceUserId: string; baseAtomic: bigint | string }

const logger = new Logger('ReferralRewards')

/** floor(base × bps / 10000); the database enforces the same formula. */
export function rewardAmount(baseAtomic: bigint, rateBps: number): bigint {
  if (baseAtomic <= 0n || !Number.isInteger(rateBps) || rateBps <= 0 || rateBps > 10000) return 0n
  return baseAtomic * BigInt(rateBps) / 10000n
}

/** Levels 1..3 in order, one reward per level, never to the source user, zero amounts skipped. */
export function planRewards(baseAtomic: bigint, ratesBps: readonly unknown[], ancestors: RewardAncestor[], sourceUserId: string): RewardPlan[] {
  const seen = new Set<string>([sourceUserId])
  const plan: RewardPlan[] = []
  for (const ancestor of [...ancestors].sort((a, b) => Number(a.level) - Number(b.level))) {
    const level = Number(ancestor.level)
    if (!Number.isInteger(level) || level < 1 || level > 3 || seen.has(ancestor.user_id)) continue
    if (plan.some(row => row.level === level)) continue
    seen.add(ancestor.user_id)
    const rateBps = Number(ratesBps[level - 1])
    const amountAtomic = rewardAmount(baseAtomic, rateBps)
    if (amountAtomic > 0n) plan.push({ userId: ancestor.user_id, level, rateBps, amountAtomic })
  }
  return plan
}

const ANCESTORS_SQL = `WITH RECURSIVE up(user_id, level, path) AS (
    SELECT inviter_user_id, 1, ARRAY[$1::uuid, inviter_user_id] FROM app.referral_edges WHERE invitee_user_id = $1
    UNION ALL SELECT e.inviter_user_id, u.level + 1, u.path || e.inviter_user_id FROM up u
    JOIN app.referral_edges e ON e.invitee_user_id = u.user_id WHERE u.level < 3 AND NOT e.inviter_user_id = ANY(u.path)
  ) SELECT user_id, level FROM up ORDER BY level`

/**
 * Records the referral rewards for one purchase or platform fee. Must run inside the source's transaction, after
 * the source row is final (the database guard re-verifies it). Idempotent per (source, level). Isolated in a
 * savepoint: a reward fault is logged and never rolls back or blocks the customer's purchase, bet or payout.
 */
export async function recordReferralRewards(q: RewardQueryable, source: RewardSource): Promise<Array<{ userId: string; level: number; amountAtomic: string }>> {
  const base = BigInt(source.baseAtomic)
  if (base <= 0n) return []
  const [installed] = await q.query("SELECT to_regclass('app.referral_rewards') IS NOT NULL AS ok")
  if (!installed?.ok) return []
  const [edge] = await q.query('SELECT 1 FROM app.referral_edges WHERE invitee_user_id = $1', [source.sourceUserId])
  if (!edge) return []
  await q.query('SAVEPOINT referral_reward')
  try {
    if (source.sourceType === 'quant_subscription') {
      const [ready] = await q.query("SELECT to_regclass('app.referral_quant_first_subscriptions') IS NOT NULL AS ok")
      if (!ready?.ok) { await q.query('RELEASE SAVEPOINT referral_reward'); return [] }
      const [first] = await q.query(`SELECT 1 FROM app.referral_quant_first_subscriptions
        WHERE user_id=$1 AND order_id=$2 AND reward_eligible`, [source.sourceUserId, source.sourceId])
      if (!first) { await q.query('RELEASE SAVEPOINT referral_reward'); return [] }
    }
    const effective = source.kind === 'purchase' ? 'holding_effective_at' : 'fee_effective_at'
    const [settings] = await q.query(`SELECT version, config FROM app.referral_settings
      WHERE ${effective} <= now() ORDER BY ${effective} DESC, version DESC LIMIT 1`)
    const config = settings?.config ?? {}
    const enabled = source.kind === 'purchase'
      ? config.holdingEnabled === true
      : config.feeEnabled === true && Array.isArray(config.feeComponents) && config.feeComponents.includes(source.component)
    const rates = source.kind === 'purchase' ? config.holdingRatesBps : config.feeRatesBps
    const created: Array<{ userId: string; level: number; amountAtomic: string }> = []
    if (settings && enabled && Array.isArray(rates)) {
      const ancestors = await q.query(ANCESTORS_SQL, [source.sourceUserId]) as RewardAncestor[]
      for (const row of planRewards(base, rates, ancestors, source.sourceUserId)) {
        const inserted = await q.query(`INSERT INTO app.referral_rewards
          (user_id, source_user_id, kind, source_type, source_id, level, settings_version, rate_bps, base_atomic, amount_atomic)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (source_type, source_id, level) DO NOTHING RETURNING id`,
        [row.userId, source.sourceUserId, source.kind, source.sourceType, source.sourceId, row.level, settings.version, row.rateBps,
          base.toString(), row.amountAtomic.toString()])
        if (inserted.length) created.push({ userId: row.userId, level: row.level, amountAtomic: row.amountAtomic.toString() })
      }
    }
    await q.query('RELEASE SAVEPOINT referral_reward')
    return created
  } catch (error) {
    await q.query('ROLLBACK TO SAVEPOINT referral_reward')
    await q.query('RELEASE SAVEPOINT referral_reward')
    logger.error(`Referral reward skipped for ${source.sourceType} ${source.sourceId}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
