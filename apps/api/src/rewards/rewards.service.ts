import { BadRequestException, Injectable } from '@nestjs/common'
import { randomInt, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { WalletNetworkRegistry } from '../wallet/wallet-network.registry'
import type { Coupon, Draw, Today } from './rewards.dto'
import { REWARD_ERROR_CODES, requireRewardKey, rewardConflict, rewardNotLive } from './rewards.errors'

const CAMPAIGN = 'daily_card_draw'
const SG_DAY = "(now() AT TIME ZONE 'Asia/Singapore')::date"
type Db = Pick<EntityManager, 'query'>
export type Prize = {
  code: string; kind: 'points' | 'coupon'; points: number | null; weight: number; active: boolean
  coupon_kind: Coupon['kind'] | null; coupon_max_atomic: string | null; daily_cap: number | null
}
type Campaign = { daily_coupon_budget_atomic: string; exchange_coupon_max_atomic: string; points_per_coupon: number; coupon_ttl_days: number; prize_version: number }
type Row = Record<string, any>
const iso = (v: string | Date) => new Date(v).toISOString()

/** Draw first using the published weights. An unavailable coupon falls back, without reweighting other prizes. */
export function pickPrize(prizes: Prize[], issued: Record<string, number>, faceIssued: bigint, budget: bigint, withdrawalFace: bigint,
  random: (max: number) => number = randomInt): { prize: Prize; face: bigint } {
  const active = prizes.filter(p => p.active)
  const fallback = active.find(p => p.kind === 'points' && p.points === 10)
  const total = active.reduce((n, p) => n + p.weight, 0)
  if (!fallback || !Number.isSafeInteger(total) || total <= 0 || total >= 2 ** 48) throw new Error('Invalid reward prize configuration')
  let ticket = random(total)
  let prize = active[active.length - 1]
  for (const p of active) { ticket -= p.weight; if (ticket < 0) { prize = p; break } }
  const face = prize.kind === 'coupon' ? BigInt(prize.coupon_max_atomic ?? withdrawalFace) : 0n
  if (prize.kind === 'coupon' && (face <= 0n || faceIssued + face > budget || (prize.daily_cap !== null && (issued[prize.code] ?? 0) >= prize.daily_cap))) {
    return { prize: fallback, face: 0n }
  }
  return { prize, face }
}
export function eligibilityReason(draw: Draw | null, oldEnough: boolean, hasCard: boolean): Today['reason'] {
  if (draw) return draw.state === 'frozen' ? 'frozen' : 'drawn'
  if (!oldEnough) return 'too_new'
  return hasCard ? 'ok' : 'no_card_today'
}

@Injectable()
export class RewardsService {
  constructor(private readonly db: DataSource, private readonly networks: WalletNetworkRegistry) {}
  async assertLive(userId: string) { await this.live(this.db, userId) }

  private async live(db: Db, userId: string, lock = false): Promise<Campaign> {
    const [c] = await db.query(`SELECT c.*, (c.enabled OR $1::uuid=ANY(c.pilot_user_ids)
      OR COALESCE((SELECT sum(delta) FROM app.user_points_ledger WHERE user_id=$1),0)>0
      OR EXISTS(SELECT 1 FROM app.user_coupons WHERE user_id=$1)) AS live
      FROM app.reward_campaigns c WHERE c.id=$2${lock ? ' FOR UPDATE OF c' : ''}`, [userId, CAMPAIGN])
    if (!c?.live) throw rewardNotLive()
    return c
  }
  private async userLock(db: Db, userId: string) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`rewards:${userId}`])
  }
  private async balance(db: Db, userId: string): Promise<number> {
    const [r] = await db.query('SELECT COALESCE(sum(delta),0)::text AS points FROM app.user_points_ledger WHERE user_id=$1', [userId])
    const points = Number(r.points)
    if (!Number.isSafeInteger(points)) throw new Error('Reward points exceed safe integer range')
    return points
  }
  private async issuedFace(db: Db): Promise<bigint> {
    const [r] = await db.query(`SELECT COALESCE(sum(max_discount_atomic),0)::text AS face FROM app.user_coupons
      WHERE (created_at AT TIME ZONE 'Asia/Singapore')::date=${SG_DAY}`)
    return BigInt(r.face)
  }
  private coupon(row: Row): Coupon {
    return { id: row.id, kind: row.kind, maxDiscountAtomic: String(row.max_discount_atomic), assetCode: 'USDT', assetDecimals: 6,
      state: row.expired && row.state === 'available' ? 'expired' : row.state, source: row.source,
      expiresAt: iso(row.expires_at), createdAt: iso(row.created_at), usedAt: row.used_at ? iso(row.used_at) : null }
  }
  private async couponById(db: Db, id: string): Promise<Coupon> {
    const [row] = await db.query('SELECT *,expires_at<now() AS expired FROM app.user_coupons WHERE id=$1', [id])
    return this.coupon(row)
  }
  private async drawView(db: Db, row: Row): Promise<Draw> {
    return { id: row.id, sgDate: row.sg_date, state: row.state, createdAt: iso(row.created_at),
      prize: row.coupon_id ? { kind: 'coupon', coupon: await this.couponById(db, row.coupon_id) } : { kind: 'points', points: row.points } }
  }
  private async todayIn(db: Db, userId: string, lock = false): Promise<Today & { postId: string | null }> {
    const [r] = await db.query(`SELECT ${SG_DAY}::text AS day,created_at<=now()-interval '24 hours' AS old_enough FROM app.users WHERE id=$1`, [userId])
    const [existing] = await db.query(`SELECT *,sg_date::text AS sg_date FROM app.reward_draws WHERE campaign_id=$1 AND user_id=$2 AND sg_date=${SG_DAY}`, [CAMPAIGN, userId])
    const draw = existing ? await this.drawView(db, existing) : null
    const [card] = await db.query(`SELECT p.id FROM app.community_post_cards c JOIN app.community_posts p ON p.id=c.post_id
      WHERE c.user_id=$1 AND c.revoked_at IS NULL AND p.state='published'
      AND (p.created_at AT TIME ZONE 'Asia/Singapore')::date=${SG_DAY}
      ORDER BY p.created_at,p.id LIMIT 1${lock ? ' FOR SHARE OF p,c' : ''}`, [userId])
    const reason = eligibilityReason(draw, r.old_enough, !!card)
    return { sgDate: r.day, eligible: reason === 'ok', reason, draw, postId: card?.id ?? null }
  }
  async today(userId: string): Promise<Today> {
    return this.db.transaction(async db => {
      await this.live(db, userId)
      const { postId: _, ...today } = await this.todayIn(db, userId)
      return today
    })
  }
  async draw(userId: string, key: string, ip: string | null): Promise<Draw> {
    return this.db.transaction(async db => {
      await this.userLock(db, userId)
      // The campaign row serializes the global daily budget, caps and shared-IP check across users.
      const c = await this.live(db, userId, true)
      requireRewardKey(key)
      const [replay] = await db.query('SELECT *,sg_date::text AS sg_date FROM app.reward_draws WHERE campaign_id=$1 AND user_id=$2 AND idempotency_key=$3', [CAMPAIGN, userId, key])
      if (replay) return this.drawView(db, replay)
      const today = await this.todayIn(db, userId, true)
      if (today.draw) return today.draw
      if (!today.eligible) throw rewardConflict(REWARD_ERROR_CODES.NOT_ELIGIBLE, today.reason)
      const prizes: Prize[] = await db.query('SELECT * FROM app.reward_prizes WHERE campaign_id=$1 AND version=$2 ORDER BY code', [CAMPAIGN, c.prize_version])
      const counts: Array<{ prize_code: string; count: number }> = await db.query(`SELECT prize_code,count(*)::int AS count FROM app.reward_draws
        WHERE campaign_id=$1 AND sg_date=$2 GROUP BY prize_code`, [CAMPAIGN, today.sgDate])
      const faceIssued = await this.issuedFace(db)
      // The draw has no network input: snapshot the default TRON withdrawal fee, then cap any later network's discount by its actual fee.
      const { prize, face } = pickPrize(prizes, Object.fromEntries(counts.map(r => [r.prize_code, r.count])),
        faceIssued, BigInt(c.daily_coupon_budget_atomic), BigInt(this.networks.get('tron').withdrawalFeeAtomic))
      const [shared] = await db.query(`SELECT count(DISTINCT user_id)::int AS users FROM app.reward_draws WHERE sg_date=$1 AND ip=$2::inet`, [today.sgDate, ip])
      const frozen = ip !== null && shared.users >= 2
      const couponId = prize.kind === 'coupon' ? randomUUID() : null
      if (couponId) await this.issueCoupon(db, userId, couponId, prize.coupon_kind!, face.toString(), 'draw', c.coupon_ttl_days, frozen)
      const id = randomUUID()
      const [row] = await db.query(`INSERT INTO app.reward_draws(id,campaign_id,user_id,sg_date,post_id,prize_code,prize_version,points,coupon_id,state,frozen_reason,ip,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING *,sg_date::text AS sg_date`,
        [id, CAMPAIGN, userId, today.sgDate, today.postId, prize.code, c.prize_version, prize.points, couponId, frozen ? 'frozen' : 'granted', frozen ? 'shared_ip' : null, ip, key])
      if (!row) {
        if (couponId) await db.query('DELETE FROM app.user_coupons WHERE id=$1', [couponId])
        const [existing] = await db.query(`SELECT *,sg_date::text AS sg_date FROM app.reward_draws WHERE campaign_id=$1 AND user_id=$2
          AND (sg_date=$3 OR idempotency_key=$4)`, [CAMPAIGN, userId, today.sgDate, key])
        return this.drawView(db, existing)
      }
      if (prize.kind === 'points' && !frozen) await db.query(`INSERT INTO app.user_points_ledger(user_id,delta,reason,ref_id) VALUES($1,$2,'draw',$3)`, [userId, prize.points, id])
      return this.drawView(db, row)
    })
  }
  private async issueCoupon(db: Db, userId: string, id: string, kind: Coupon['kind'], face: string, source: Coupon['source'], days: number, frozen = false) {
    await db.query(`INSERT INTO app.user_coupons(id,user_id,kind,max_discount_atomic,source,state,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+make_interval(days=>$7))`, [id, userId, kind, face, source, frozen ? 'frozen' : 'available', days])
  }
  async wallet(userId: string) {
    return this.db.transaction(async db => {
      const c = await this.live(db, userId)
      const points = await this.balance(db, userId)
      const rows: Row[] = await db.query(`SELECT *,expires_at<now() AS expired FROM app.user_coupons WHERE user_id=$1 AND state<>'void'
        AND (state IN ('locked','frozen') OR (state='available' AND expires_at>=now()-interval '30 days')
          OR (state='used' AND used_at>=now()-interval '30 days'))
        ORDER BY CASE WHEN state='available' AND expires_at>=now() THEN 0 WHEN state='locked' THEN 1 ELSE 2 END,created_at DESC,id DESC`, [userId])
      const [spent] = await db.query(`SELECT EXISTS(SELECT 1 FROM app.user_points_ledger WHERE user_id=$1 AND reason='exchange'
        AND (created_at AT TIME ZONE 'Asia/Singapore')::date=${SG_DAY}) AS exchanged`, [userId])
      const { postId: _, ...today } = await this.todayIn(db, userId)
      return { points, coupons: rows.map(r => this.coupon(r)), exchange: { pointsPerCoupon: c.points_per_coupon,
        couponKind: 'prediction_place_fee' as const, maxDiscountAtomic: String(c.exchange_coupon_max_atomic), canExchange: points >= c.points_per_coupon && !spent.exchanged
          && await this.issuedFace(db) + BigInt(c.exchange_coupon_max_atomic) <= BigInt(c.daily_coupon_budget_atomic) }, today }
    })
  }
  async points(userId: string, cursor?: string) {
    return this.db.transaction(async db => {
      await this.live(db, userId)
      let after: { id: string; at: string } | null = null
      if (cursor) {
        try {
          const r = JSON.parse(Buffer.from(cursor, 'base64url').toString())
          if (cursor.length > 512 || !r || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))
            || typeof r.id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(r.id)) throw new Error()
          after = r
        } catch { throw new BadRequestException({ code: REWARD_ERROR_CODES.CURSOR_INVALID, message: 'Invalid points cursor.' }) }
      }
      const all: Row[] = await db.query(`SELECT id,delta,reason,created_at::text AS at FROM app.user_points_ledger WHERE user_id=$1
        AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT 51`, [userId, after?.at ?? null, after?.id ?? null])
      const rows = all.slice(0, 50), last = rows.at(-1)
      return { rows: rows.map(r => ({ id: r.id, delta: r.delta, reason: r.reason, createdAt: iso(r.at) })),
        nextCursor: all.length > 50 && last ? Buffer.from(JSON.stringify({ id: last.id, at: last.at })).toString('base64url') : null }
    })
  }
  async exchange(userId: string, key: string) {
    return this.db.transaction(async db => {
      await this.userLock(db, userId)
      const c = await this.live(db, userId, true)
      requireRewardKey(key)
      const [replay] = await db.query(`SELECT * FROM app.user_points_ledger WHERE user_id=$1 AND reason='exchange' AND idempotency_key=$2`, [userId, key])
      if (replay) return { points: Number(replay.balance_after), coupon: await this.couponById(db, replay.ref_id) }
      const [spent] = await db.query(`SELECT id FROM app.user_points_ledger WHERE user_id=$1 AND reason='exchange'
        AND (created_at AT TIME ZONE 'Asia/Singapore')::date=${SG_DAY}`, [userId])
      if (spent) throw rewardConflict(REWARD_ERROR_CODES.EXCHANGE_LIMIT)
      const points = await this.balance(db, userId)
      if (points < c.points_per_coupon) throw rewardConflict(REWARD_ERROR_CODES.POINTS_LOW)
      // Exchanges issue face value too. Share the campaign lock and budget; never debit points when no coupon can be issued.
      if (await this.issuedFace(db) + BigInt(c.exchange_coupon_max_atomic) > BigInt(c.daily_coupon_budget_atomic)) throw rewardConflict(REWARD_ERROR_CODES.BUDGET_EXHAUSTED)
      const id = randomUUID(), remaining = points - c.points_per_coupon
      await this.issueCoupon(db, userId, id, 'prediction_place_fee', c.exchange_coupon_max_atomic, 'exchange', c.coupon_ttl_days)
      await db.query(`INSERT INTO app.user_points_ledger(user_id,delta,reason,ref_id,idempotency_key,balance_after)
        VALUES($1,$2,'exchange',$3,$4,$5)`, [userId, -c.points_per_coupon, id, key, remaining])
      return { points: remaining, coupon: await this.couponById(db, id) }
    })
  }
}
