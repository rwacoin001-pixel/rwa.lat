import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { DataSource, EntityManager } from 'typeorm'

/**
 * Ledger-verified results for community posts (2026-10-28, docs/design-system.md §7.7).
 * The client names WHICH result (a quant day by product + date, or a prediction by bet id); the server finds the author's
 * own ledger row and computes the figure. Only gains within the last 30 days qualify. Percentages only, never amounts.
 */
export type ProofRequest = { kind: 'quant_day'; product: string; date: string } | { kind: 'prediction_win'; bet: string }
export type ResolvedProof = { kind: ProofRequest['kind']; refId: string; title: string; pct: number; tradeDate: string }
export type ProofView = { kind: ProofRequest['kind']; title: string; pct: number; tradeDate: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9-]{1,64}$/

/** Validates the shape of a client request; throws 400 on anything else. */
export function parseProofRequest(input: unknown): ProofRequest {
  const value = (input ?? {}) as Record<string, unknown>
  if (value.kind === 'quant_day' && typeof value.product === 'string' && SLUG.test(value.product) && typeof value.date === 'string' && DATE.test(value.date)) {
    return { kind: 'quant_day', product: value.product, date: value.date }
  }
  if (value.kind === 'prediction_win' && typeof value.bet === 'string' && UUID.test(value.bet)) return { kind: 'prediction_win', bet: value.bet }
  throw new BadRequestException('Invalid proof')
}

/** Finds the author's ledger row and computes the return; 404 when it is not theirs, not a gain, or older than 30 days. */
export async function resolveProof(db: DataSource | EntityManager, userId: string, request: ProofRequest): Promise<ResolvedProof> {
  if (request.kind === 'quant_day') {
    const [row] = await db.query(`SELECT p.id, q.name AS title, p.trade_date::text AS trade_date,
        round(p.net_atomic * 100.0 / p.principal_before_atomic, 2)::float8 AS pct
      FROM app.quant_payouts p JOIN app.quant_products q ON q.id = p.product_id
      WHERE p.user_id = $1 AND q.slug = $2 AND p.trade_date = $3::date
        AND p.net_atomic > 0 AND p.principal_before_atomic > 0 AND p.trade_date >= current_date - 30`, [userId, request.product, request.date])
    if (!row || !(Number(row.pct) > 0)) throw new NotFoundException('No qualifying result')
    return { kind: 'quant_day', refId: row.id, title: String(row.title).slice(0, 300), pct: Number(row.pct), tradeDate: row.trade_date }
  }
  // One share pays 1 USDT (6 decimals) on a win; the payout fee is taken from the payout.
  const [row] = await db.query(`SELECT b.id, m.question AS title, (b.settled_at AT TIME ZONE 'UTC')::date::text AS trade_date,
      round((floor(b.shares * 1000000) - b.payout_fee_atomic - b.stake_atomic) * 100.0 / b.stake_atomic, 2)::float8 AS pct
    FROM app.prediction_bets b JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
    WHERE b.user_id = $1 AND b.id = $2 AND b.status = 'won' AND b.settled_at >= now() - interval '30 days'`, [userId, request.bet])
  if (!row || !(Number(row.pct) > 0)) throw new NotFoundException('No qualifying result')
  return { kind: 'prediction_win', refId: row.id, title: String(row.title).slice(0, 300), pct: Number(row.pct), tradeDate: row.trade_date }
}

/** Proofs for a page of posts, keyed by post id. Returns an empty map until the table exists (before the migration). */
export async function proofsFor(db: DataSource, postIds: string[]): Promise<Map<string, ProofView>> {
  const out = new Map<string, ProofView>()
  if (!postIds.length) return out
  const [ready] = await db.query("SELECT to_regclass('app.community_post_proofs') IS NOT NULL AS ready")
  if (!ready?.ready) return out
  const rows = await db.query(`SELECT post_id, kind, title, pct::float8 AS pct, trade_date::text AS trade_date
    FROM app.community_post_proofs WHERE post_id = ANY($1::uuid[])`, [postIds])
  for (const row of rows) out.set(row.post_id, { kind: row.kind, title: row.title, pct: Number(row.pct), tradeDate: row.trade_date })
  return out
}
