# Community result cards, calculation version 1

Backend only. Migration: `1793700000000-community-post-cards.ts`.
Existing positive-only `community_post_proofs` and its API remain unchanged. New cards
use a separate table without the old `pct > 0` constraint. A post cannot attach both.

The migration also relaxes the parent post's body CHECK to the existing 4000-character
limit, so an attachment-only post can be inserted before its card/proof in the same
transaction. The publication service still rejects ordinary empty posts and still
requires location for every non-card post. Existing image constraints stay in place.
Rollback removes only card shares and the new card table, preserving posts and old
proofs. It restores the previous body-or-images CHECK as `NOT VALID`: PostgreSQL
enforces it for subsequent writes while retaining existing attachment-only posts.

All amounts below are signed integer strings in atomic units. Their denomination is
the snapshot's mandatory `asset` and `decimals`. Percentages are decimal strings,
truncated toward zero at 8 fractional places; a zero denominator returns null.
`weight` and `winRate` are fractions between 0 and 1, also decimal strings.

```ts
type Kind = 'quant_day' | 'quant_product' | 'quant_total' | 'holdings'
  | 'prediction_bet' | 'prediction_record' | 'deposit' | 'withdrawal'
type Product = { slug: string; name: string }
type Atomic = string
type Decimal = string
type Fixed = {
  capturedAt: string // ISO timestamp, generated at capture
  period: { from: string | null; to: string | null }
  asset: string
  decimals: number
  provenance: 'ledger_verified'
  disclaimer: 'v1'
  fundsRecord?: true // always present for deposit/withdrawal
}
type Metrics = {
  quant_day: { product: Product; pnl: Atomic | null; returnPct: Decimal | null; date: string }
  quant_product: { product: Product; pnl: Atomic | null; returnPct: Decimal | null;
    settledDays: number; status: 'holding' | 'redeeming' | 'closed' }
  quant_total: { pnl: Atomic | null; returnPct: Decimal | null; settledDays: number;
    bestMonth: { month: string; pnl: Atomic | null } | null }
  holdings: { totalPrincipal: Atomic; pending: Atomic;
    products: { product: Product; weight: Decimal | null; lastDayReturnPct: Decimal | null; date: string | null }[] }
  prediction_bet: { question: string; side: string; stake: Atomic;
    result: 'won' | 'lost' | 'void' | 'open'; payout: Atomic | null;
    pnl: Atomic | null; returnPct: Decimal | null }
  prediction_record: { total: number; won: number; lost: number; void: number;
    open: number; winRate: Decimal | null; closedPnl: Atomic | null;
    last10: ('won' | 'lost' | 'void')[] }
  deposit: { amount: Atomic; asset: string; time: string; status: string }
  withdrawal: { amount: Atomic; asset: string; time: string; status: string }
}
type Card<K extends Kind = Kind> = {
  kind: K
  snapshot: Fixed & Partial<Metrics[K]> // only selected metric keys are stored/returned
  visibleFields: string[]
  capturedAt: string // same timestamp as snapshot.capturedAt
}
```

`period` uses trade dates for quant, UTC dates for prediction, and record timestamps
for funds. Holdings use `{from:null,to:null}` for the current capture. Unavailable
period endpoints are null. Post-level `author` is mandatory identity context; shares
also return it separately. All fixed metadata survives field selection.
The brief lists `asset` among funds fields and also makes it mandatory: mandatory
denomination takes precedence. It is always returned, preview marks it non-hideable,
and `visibleFields:['asset']` alone fails `CARD_NOTHING_VISIBLE`.

## Authenticated community endpoints

`GET /v1/community/me/cards/kinds`

```ts
{ items: { kind: Kind; available: boolean;
  reason: 'NO_QUANT' | 'NO_SETTLED_DAY' | 'NO_PREDICTION' | 'NO_SETTLED_PREDICTION'
    | 'NO_DEPOSIT' | 'NO_WITHDRAWAL' | null;
  needsSource: boolean; defaultHidden: string[] }[] }
```

`defaultHidden` is `['amount']` for funds, otherwise `[]`. Quant product/total require
a settled subscription; holdings accept any non-rejected subscription. Prediction
record requires at least one won/lost/void bet; single-bet cards also accept open bets.

`GET /v1/community/me/cards/sources?kind=<Kind>&cursor=<optional opaque cursor>`

```ts
{ items: { id: string; label: string; sublabel: string; at: string }[];
  nextCursor: string | null }
```

Source IDs are UUIDs: payout row, quant product, prediction bet, deposit or withdrawal.
No source is used for quant_total, holdings or prediction_record (these return empty
source lists). Pages contain up to 50 items, newest first with an ID tie-breaker.
Source lists contain no amounts. Cursors preserve PostgreSQL timestamp precision.

`POST /v1/community/me/cards/preview`

```ts
// Request
{ kind: Kind; sourceId?: string }
// Response: owner's full snapshot; never used as a client-supplied publication figure
{ kind: Kind; snapshot: Fixed & Metrics[Kind];
  fields: { key: string; hideable: boolean; value: unknown }[] }
```

`POST /v1/community/me/posts`

```ts
// Request: existing post body, plus card and optional body idempotency key
{ body: string; lang?: string; topics?: string[]; imageIds?: string[];
  location?: { city: string; countryCode: string; source: 'device' };
  circleId?: string; alsoPublic?: boolean;
  clientRequestId?: string; // UUID v4, alternative to Idempotency-Key header
  card?: { kind: Kind; sourceId?: string; visibleFields: string[] } }
// Response unchanged
{ id: string; duplicate: boolean }
```

The header and body idempotency keys must agree when both are sent. The existing
unique `(user_id,idempotency_key)` intent table serializes retries. An empty body is
allowed with a card. Only card posts may omit location; malformed supplied locations
still fail. Ordinary posts/proofs retain their existing location requirements.
Numbers and extra card properties are rejected. Unknown visible keys return 400
`CARD_FIELD_INVALID`; an empty list or a list whose hideable values are all null
returns 400 `CARD_NOTHING_VISIBLE`. Ownership failures return 404
`CARD_SOURCE_NOT_FOUND` and cannot publish. Snapshots and references are resolved and
inserted in the publication transaction. Only the selected public snapshot is stored.

All post views (feeds, detail, profile, circle and pinned views) gain:

```ts
{ /* existing post fields, including author */ card: Card | null }
```

`GET /v1/community/feed?hasCard=true&cardKind=quant|prediction|funds`
keeps the existing `{items: Post[], nextCursor: string|null}` shape and public-feed
visibility. `cardKind` is optional and itself implies cards-only. Cards always sort
newest first, even with `sort=hot`. `hasCard=false` leaves the existing feed unchanged.
Quant groups all four quant/holdings kinds; prediction groups both prediction kinds;
funds groups deposit/withdrawal. Revoked cards are excluded. Existing public reads
keep their current optional-session behavior.

## Off-site shares

```ts
// POST /v1/shares (session required)
{ kind: 'community_card'; resourceId: string } // resourceId is the post UUID
// Response
{ id: string; token: string }

// GET /v1/shares/:token (public, Cache-Control: no-store)
{ kind: 'community_card';
  author: { displayName: string; handle: string; avatarUrl: string | null; avatarSeed: string };
  card: Card; referralCode: string | null; path: string }
// path: /community/post/<post UUID>

// POST /v1/shares/:id/revoke (session required), unchanged
{ id: string; revoked: true }
```

Only the author may create a community_card link. The post must remain published,
the author active, and the card unrevoked. Circle-only posts fail; synced circle posts
qualify. Every resolve rechecks publication state. Removed/deleted posts and revoked
cards/shares resolve to 404. Hidden metric keys and `source_refs` are never returned,
including to the author through ordinary public post/share endpoints.
The shared card reader reapplies the visible-field allowlist to the stored snapshot,
so an unexpected extra stored key cannot leak through feeds, search, detail or shares.

## Validation

Jest coverage is in `test/community/community-card.spec.ts` and
`test/community/community-card.integration.spec.ts`. Integration tests follow the
existing local `TEST_DATABASE_URL` safety gate, apply migrations, and roll back every
fixture. They cover ownership, field selection, loss/partial-redemption/void math,
uncapped aggregates, frozen snapshots, public-view redaction, idempotency, circle
sharing, deletion/revocation, sources pagination, holdings and feed groups.
They also cover empty-account availability, ownership checks in both preview and
publication (including forged source cursors), re-resolution after preview, multiple
product weights, circle search redaction, and migration down/up with legacy proofs.

The current follow-up review is static only: no packages were installed, and neither
the API typecheck nor Jest/PostgreSQL tests were run. The commands below remain the
required executable validation when dependencies and the isolated test DB are ready.

```sh
cd apps/api
npm run lint
npm test -- test/community/community-card.spec.ts test/community/community-card.integration.spec.ts
```
