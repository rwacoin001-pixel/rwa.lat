import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { EntityManager } from 'typeorm'

type Db = Pick<EntityManager, 'query'>
export const CARD_FIELDS = {
  quant_day: ['product', 'pnl', 'returnPct', 'date'],
  quant_product: ['product', 'pnl', 'returnPct', 'settledDays', 'status'],
  quant_total: ['pnl', 'returnPct', 'settledDays', 'bestMonth'],
  holdings: ['totalPrincipal', 'products', 'pending'],
  prediction_bet: ['question', 'side', 'stake', 'result', 'payout', 'pnl', 'returnPct'],
  prediction_record: ['total', 'won', 'lost', 'void', 'open', 'winRate', 'closedPnl', 'last10'],
  deposit: ['amount', 'asset', 'time', 'status'],
  withdrawal: ['amount', 'asset', 'time', 'status'],
} as const
export type CardKind = keyof typeof CARD_FIELDS
export type CardRequest = { kind: CardKind; sourceId?: string }
export type CardAttachment = CardRequest & { visibleFields: string[] }
export type CardSnapshot = Record<string, unknown> & {
  capturedAt: string; period: { from: string | null; to: string | null }; asset: string; decimals: number
  provenance: 'ledger_verified'; disclaimer: 'v1'
}
export type CardView = { kind: CardKind; snapshot: CardSnapshot; visibleFields: string[]; capturedAt: string }
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
export const CARD_GROUPS = {
  quant: ['quant_day', 'quant_product', 'quant_total', 'holdings'],
  prediction: ['prediction_bet', 'prediction_record'],
  funds: ['deposit', 'withdrawal'],
}
const sourceKinds = new Set<CardKind>(['quant_day', 'quant_product', 'prediction_bet', 'deposit', 'withdrawal'])
export function parseCardRequest(input: unknown, attachment = false): CardRequest | CardAttachment {
  const v = input as Record<string, unknown> | null
  if (!v || typeof v !== 'object' || typeof v.kind !== 'string' || !Object.hasOwn(CARD_FIELDS, v.kind)) throw new BadRequestException('CARD_KIND_INVALID')
  const kind = v.kind as CardKind
  const allowed = attachment ? ['kind', 'sourceId', 'visibleFields'] : ['kind', 'sourceId']
  if (Object.keys(v).some(k => !allowed.includes(k))) throw new BadRequestException('CARD_FIELD_INVALID')
  if (sourceKinds.has(kind) ? typeof v.sourceId !== 'string' || !UUID.test(v.sourceId) : v.sourceId !== undefined) throw new BadRequestException('CARD_SOURCE_INVALID')
  const request: CardRequest = { kind, ...(v.sourceId ? { sourceId: v.sourceId as string } : {}) }
  if (!attachment) return request
  if (!Array.isArray(v.visibleFields) || v.visibleFields.some(f => typeof f !== 'string' || !(CARD_FIELDS[kind] as readonly string[]).includes(f))) throw new BadRequestException('CARD_FIELD_INVALID')
  return { ...request, visibleFields: [...new Set(v.visibleFields as string[])] }
}

/** Decimal strings, truncated at 8 fractional places. Never convert money to JS Number. */
export function cardRatio(numerator: bigint, denominator: bigint, multiplier = 100n): string | null {
  if (denominator === 0n) return null
  const scaled = numerator * multiplier * 100000000n / denominator
  const absolute = scaled < 0n ? -scaled : scaled
  const fraction = (absolute % 100000000n).toString().padStart(8, '0').replace(/0+$/, '')
  return `${scaled < 0n ? '-' : ''}${absolute / 100000000n}${fraction ? '.' + fraction : ''}`
}
const atomic = (value: string | null | undefined) => value == null ? null : BigInt(value).toString()
const product = (r: { slug: string; name: string }) => ({ slug: r.slug, name: r.name })
const base = (from: string | null, to: string | null, asset = 'USDT', decimals = 6): CardSnapshot => ({
  capturedAt: new Date().toISOString(), period: { from, to }, asset, decimals, provenance: 'ledger_verified', disclaimer: 'v1',
})

// All accounting aggregates execute in SQL in one statement, without list endpoint limits or join multiplication.
const QUANT_CTES = `orders AS (SELECT * FROM app.quant_orders WHERE user_id=$1 AND ($2::uuid IS NULL OR product_id=$2)),
  lots AS (SELECT * FROM app.quant_lots WHERE user_id=$1 AND ($2::uuid IS NULL OR product_id=$2)),
  payouts AS (SELECT * FROM app.quant_payouts WHERE user_id=$1 AND ($2::uuid IS NULL OR product_id=$2)),
  monthly AS (SELECT month, sum(net) AS net FROM (
    SELECT to_char(trade_date,'YYYY-MM') AS month, net_atomic AS net FROM payouts
    UNION ALL SELECT to_char(effective_date,'YYYY-MM'), -fee_atomic FROM orders WHERE kind='redemption' AND status='settled'
  ) entries GROUP BY month)`

export async function resolveCard(db: Db, userId: string, request: CardRequest): Promise<CardSnapshot> {
  const { kind, sourceId } = request
  if (kind === 'quant_day') {
    const [r] = await db.query(`SELECT p.net_atomic::text AS net, p.principal_before_atomic::text AS principal,
      p.trade_date::text AS date,q.slug,q.name FROM app.quant_payouts p JOIN app.quant_products q ON q.id=p.product_id
      WHERE p.user_id=$1 AND p.id=$2`, [userId, sourceId])
    if (!r) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
    return { ...base(r.date, r.date), product: product(r), pnl: atomic(r.net), returnPct: cardRatio(BigInt(r.net), BigInt(r.principal)), date: r.date }
  }
  if (kind === 'quant_product' || kind === 'quant_total') {
    const [r] = await db.query(`WITH ${QUANT_CTES}
      SELECT (SELECT count(*)::int FROM orders WHERE kind='subscription' AND status='settled') AS subscriptions,
        COALESCE((SELECT sum(principal_atomic) FROM orders WHERE kind='subscription' AND status='settled'),0)::text AS c,
        COALESCE((SELECT sum(principal_atomic) FROM lots),0)::text AS v,
        COALESCE((SELECT sum(paid_atomic) FROM payouts),0)::text AS d,
        (SELECT sum(payout_atomic)::text FROM orders WHERE kind='redemption' AND status='settled') AS r,
        EXISTS(SELECT 1 FROM orders WHERE kind='redemption' AND status='settled' AND payout_atomic IS NULL) AS missing_redemption,
        EXISTS(SELECT 1 FROM orders WHERE kind='subscription' AND status='settled' AND principal_atomic IS NULL) AS missing_subscription,
        EXISTS(SELECT 1 FROM orders WHERE kind='redemption' AND status='settled' AND fee_atomic IS NULL) AS missing_fee,
        (SELECT count(DISTINCT trade_date)::int FROM payouts) AS days,
        (SELECT min(effective_date)::text FROM orders WHERE kind='subscription' AND status='settled') AS first,
        (SELECT max(day)::text FROM (SELECT trade_date AS day FROM payouts UNION ALL SELECT effective_date FROM orders WHERE status='settled') dates) AS last,
        (SELECT jsonb_build_object('month',month,'pnl',net::text) FROM monthly ORDER BY net DESC,month DESC LIMIT 1) AS best,
        EXISTS(SELECT 1 FROM orders WHERE kind='redemption' AND status IN ('pending','accepted')) AS redeeming,
        (SELECT jsonb_build_object('slug',slug,'name',name) FROM app.quant_products WHERE id=$2) AS product`, [userId, sourceId ?? null])
    if (!r.subscriptions) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
    const pnl = r.missing_redemption || r.missing_subscription ? null : BigInt(r.v) + BigInt(r.d) + BigInt(r.r ?? '0') - BigInt(r.c)
    return { ...base(r.first, r.last), pnl: pnl?.toString() ?? null, returnPct: pnl === null ? null : cardRatio(pnl, BigInt(r.c)), settledDays: r.days,
      ...(kind === 'quant_product' ? { product: r.product, status: r.redeeming ? 'redeeming' : BigInt(r.v) > 0n ? 'holding' : 'closed' }
        : { bestMonth: r.best && !r.missing_fee ? { month: r.best.month, pnl: atomic(r.best.pnl) } : null }) }
  }
  if (kind === 'holdings') {
    const [r] = await db.query(`WITH held AS (
        SELECT product_id,sum(principal_atomic) AS principal FROM app.quant_lots WHERE user_id=$1 AND principal_atomic>0 GROUP BY product_id
      ), pending AS (
        SELECT COALESCE(sum(l.principal_atomic),0) AS amount FROM app.quant_lots l JOIN app.quant_products q ON q.id=l.product_id
        WHERE l.user_id=$1 AND l.principal_atomic>0 AND l.effective_date>COALESCE(q.last_settled_date,q.first_trade_date-1,(now() AT TIME ZONE q.timezone)::date-1)+1
      ), queued AS (
        SELECT COALESCE(sum(amount_atomic),0) AS amount FROM app.quant_orders WHERE user_id=$1 AND kind='subscription' AND status IN ('pending','accepted')
      ) SELECT COALESCE((SELECT sum(principal) FROM held),0)::text AS total,
        ((SELECT amount FROM pending)+(SELECT amount FROM queued))::text AS pending,
        EXISTS(SELECT 1 FROM app.quant_orders WHERE user_id=$1 AND kind='subscription' AND status<>'rejected') AS available,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('slug',q.slug,'name',q.name,'principal',h.principal::text,
          'net',p.net_atomic::text,'before',p.principal_before_atomic::text,'date',p.trade_date::text) ORDER BY h.principal DESC,q.id)
        FROM held h JOIN app.quant_products q ON q.id=h.product_id LEFT JOIN LATERAL
          (SELECT * FROM app.quant_payouts WHERE user_id=$1 AND product_id=h.product_id ORDER BY trade_date DESC,id DESC LIMIT 1) p ON true),'[]') AS products`, [userId])
    if (!r.available) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
    return { ...base(null, null), totalPrincipal: atomic(r.total), pending: atomic(r.pending),
      products: r.products.map((p: { slug: string; name: string; principal: string; net: string | null; before: string | null; date: string | null }) => ({
        product: product(p), weight: cardRatio(BigInt(p.principal), BigInt(r.total), 1n),
        lastDayReturnPct: p.net === null || p.before === null ? null : cardRatio(BigInt(p.net), BigInt(p.before)), date: p.date,
      })) }
  }
  if (kind === 'prediction_bet') {
    const [r] = await db.query(`SELECT m.question,b.side,b.status,b.stake_atomic::text AS stake,
      CASE b.status WHEN 'won' THEN floor(b.shares*1000000)-b.payout_fee_atomic WHEN 'lost' THEN 0
        WHEN 'void' THEN b.stake_atomic-b.fee_atomic ELSE NULL END::text AS payout,
      (b.created_at AT TIME ZONE 'UTC')::date::text AS first,(b.settled_at AT TIME ZONE 'UTC')::date::text AS last
      FROM app.prediction_bets b JOIN app.polymarket_market_mappings m ON m.id=b.market_mapping_id WHERE b.user_id=$1 AND b.id=$2`, [userId, sourceId])
    if (!r) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
    const pnl = r.payout === null ? null : BigInt(r.payout) - BigInt(r.stake)
    return { ...base(r.first, r.last), question: r.question, side: r.side, stake: atomic(r.stake), result: r.status === 'placed' ? 'open' : r.status,
      payout: atomic(r.payout), pnl: pnl?.toString() ?? null, returnPct: pnl === null ? null : cardRatio(pnl, BigInt(r.stake)) }
  }
  if (kind === 'prediction_record') {
    const [r] = await db.query(`WITH bets AS (SELECT * FROM app.prediction_bets WHERE user_id=$1)
      SELECT count(*)::int AS total,count(*) FILTER(WHERE status='won')::int AS won,count(*) FILTER(WHERE status='lost')::int AS lost,
        count(*) FILTER(WHERE status='void')::int AS void,count(*) FILTER(WHERE status='placed')::int AS open,
        sum(CASE status WHEN 'won' THEN floor(shares*1000000)-payout_fee_atomic-stake_atomic WHEN 'lost' THEN -stake_atomic
          WHEN 'void' THEN -fee_atomic ELSE NULL END)::text AS pnl,
        (min(created_at) AT TIME ZONE 'UTC')::date::text AS first,(max(settled_at) AT TIME ZONE 'UTC')::date::text AS last,
        (SELECT COALESCE(jsonb_agg(status ORDER BY settled_at DESC NULLS LAST,id DESC),'[]') FROM
          (SELECT status,settled_at,id FROM bets WHERE status IN ('won','lost','void') ORDER BY settled_at DESC NULLS LAST,id DESC LIMIT 10) recent) AS recent FROM bets`, [userId])
    if (r.won + r.lost + r.void === 0) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
    return { ...base(r.first, r.last), total: r.total, won: r.won, lost: r.lost, void: r.void, open: r.open,
      winRate: cardRatio(BigInt(r.won), BigInt(r.won + r.lost), 1n), closedPnl: atomic(r.pnl), last10: r.recent }
  }
  const deposit = kind === 'deposit'
  const [r] = await db.query(`SELECT atomic_amount::text AS amount,asset_code AS asset,asset_decimals AS decimals,state AS status,
    COALESCE(${deposit ? 'credited_at,detected_at' : 'completed_at,requested_at'}) AS time
    FROM app.${deposit ? 'deposits' : 'withdrawals'} WHERE user_id=$1 AND id=$2`, [userId, sourceId])
  if (!r) throw new NotFoundException('CARD_SOURCE_NOT_FOUND')
  const time = new Date(r.time).toISOString()
  return { ...base(time, time, r.asset, r.decimals), amount: atomic(r.amount), time, status: r.status, fundsRecord: true }
}

export function publicCardSnapshot(kind: CardKind, snapshot: CardSnapshot, visibleFields: string[]): CardSnapshot {
  if (visibleFields.some(f => !(CARD_FIELDS[kind] as readonly string[]).includes(f))) throw new BadRequestException('CARD_FIELD_INVALID')
  if (!visibleFields.some(f => f !== 'asset' && snapshot[f] !== null && snapshot[f] !== undefined)) throw new BadRequestException('CARD_NOTHING_VISIBLE')
  const out: CardSnapshot = { capturedAt: snapshot.capturedAt, period: snapshot.period, asset: snapshot.asset, decimals: snapshot.decimals, provenance: snapshot.provenance, disclaimer: 'v1' }
  if (snapshot.fundsRecord) out.fundsRecord = true
  // Asset is mandatory even on funds cards; listing it as a hideable field never removes the fixed denomination.
  for (const key of visibleFields) out[key] = snapshot[key]
  return out
}

export async function cardPreview(db: Db, userId: string, request: CardRequest) {
  const snapshot = await resolveCard(db, userId, request)
  return { kind: request.kind, snapshot, fields: Object.entries(snapshot).map(([key, value]) => ({ key, hideable: key !== 'asset' && (CARD_FIELDS[request.kind] as readonly string[]).includes(key), value })) }
}

export async function cardsFor(db: Db, ids: string[]): Promise<Map<string, CardView>> {
  if (!ids.length) return new Map()
  const [ready] = await db.query("SELECT to_regclass('app.community_post_cards') IS NOT NULL AS ready")
  if (!ready?.ready) return new Map()
  const rows = await db.query(`SELECT post_id,kind,snapshot,visible_fields,created_at FROM app.community_post_cards WHERE post_id=ANY($1::uuid[]) AND revoked_at IS NULL`, [ids])
  return new Map(rows.map((r: { post_id: string; kind: CardKind; snapshot: CardSnapshot; visible_fields: string[]; created_at: Date }) =>
    [r.post_id, { kind: r.kind, snapshot: r.snapshot, visibleFields: r.visible_fields, capturedAt: r.snapshot.capturedAt }]))
}

export async function cardKinds(db: Db, userId: string) {
  const [r] = await db.query(`SELECT
    EXISTS(SELECT 1 FROM app.quant_orders WHERE user_id=$1 AND kind='subscription' AND status='settled') AS quant,
    EXISTS(SELECT 1 FROM app.quant_orders WHERE user_id=$1 AND kind='subscription' AND status<>'rejected') AS holdings,
    EXISTS(SELECT 1 FROM app.quant_payouts WHERE user_id=$1) AS day,
    EXISTS(SELECT 1 FROM app.prediction_bets WHERE user_id=$1) AS prediction,
    EXISTS(SELECT 1 FROM app.prediction_bets WHERE user_id=$1 AND status IN ('won','lost','void')) AS settled,
    EXISTS(SELECT 1 FROM app.deposits WHERE user_id=$1) AS deposit,
    EXISTS(SELECT 1 FROM app.withdrawals WHERE user_id=$1) AS withdrawal`, [userId])
  const flags: Record<CardKind, [boolean, string]> = { quant_day: [r.day, r.quant ? 'NO_SETTLED_DAY' : 'NO_QUANT'], quant_product: [r.quant, 'NO_QUANT'],
    quant_total: [r.quant, 'NO_QUANT'], holdings: [r.holdings, 'NO_QUANT'], prediction_bet: [r.prediction, 'NO_PREDICTION'],
    prediction_record: [r.settled, r.prediction ? 'NO_SETTLED_PREDICTION' : 'NO_PREDICTION'], deposit: [r.deposit, 'NO_DEPOSIT'], withdrawal: [r.withdrawal, 'NO_WITHDRAWAL'] }
  return { items: (Object.keys(CARD_FIELDS) as CardKind[]).map(kind => ({ kind, available: flags[kind][0], reason: flags[kind][0] ? null : flags[kind][1], needsSource: sourceKinds.has(kind), defaultHidden: kind === 'deposit' || kind === 'withdrawal' ? ['amount'] : [] })) }
}

export async function cardSources(db: Db, userId: string, kindInput: unknown, cursor?: string) {
  if (typeof kindInput !== 'string' || !Object.hasOwn(CARD_FIELDS, kindInput)) throw new BadRequestException('CARD_KIND_INVALID')
  const kind = kindInput as CardKind
  let after: { id: string; at: string } | null = null
  if (cursor) {
    try { after = JSON.parse(Buffer.from(cursor, 'base64url').toString()); if (!after || !UUID.test(after.id) || typeof after.at !== 'string' || !Number.isFinite(Date.parse(after.at))) throw new Error() }
    catch { throw new BadRequestException('CARD_CURSOR_INVALID') }
  }
  if (!sourceKinds.has(kind)) return { items: [], nextCursor: null }
  const selects: Partial<Record<CardKind, string>> = {
    quant_day: `SELECT p.id,q.name AS label,p.trade_date::text AS sublabel,p.created_at AS at FROM app.quant_payouts p JOIN app.quant_products q ON q.id=p.product_id WHERE p.user_id=$1`,
    quant_product: `SELECT q.id,q.name AS label,q.status AS sublabel,max(o.created_at) AS at FROM app.quant_orders o JOIN app.quant_products q ON q.id=o.product_id WHERE o.user_id=$1 AND o.kind='subscription' AND o.status='settled' GROUP BY q.id`,
    prediction_bet: `SELECT b.id,m.question AS label,CASE b.status WHEN 'placed' THEN 'open' ELSE b.status END AS sublabel,b.created_at AS at FROM app.prediction_bets b JOIN app.polymarket_market_mappings m ON m.id=b.market_mapping_id WHERE b.user_id=$1`,
    deposit: `SELECT id,'充值 '||asset_code AS label,state AS sublabel,COALESCE(credited_at,detected_at) AS at FROM app.deposits WHERE user_id=$1`,
    withdrawal: `SELECT id,'提现 '||asset_code AS label,state AS sublabel,COALESCE(completed_at,requested_at) AS at FROM app.withdrawals WHERE user_id=$1`,
  }
  const rows = await db.query(`WITH sources AS (${selects[kind]}) SELECT id,label,sublabel,at::text AS at FROM sources
    WHERE ($2::timestamptz IS NULL OR (at,id)<($2::timestamptz,$3::uuid)) ORDER BY at DESC,id DESC LIMIT 51`, [userId, after?.at ?? null, after?.id ?? null])
  const items = rows.slice(0, 50)
  const last = items.at(-1)
  return { items, nextCursor: rows.length > 50 ? Buffer.from(JSON.stringify({ id: last.id, at: last.at })).toString('base64url') : null }
}
