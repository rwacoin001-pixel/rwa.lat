# Prediction UI and quote refresh — 2026-10-02

- Replace discovery heading and help action with search and five provider-side sorts. Gamma events title_search is live-verified; search pagination retains the selected order and category.
- Featured title/image card, live public Up/Down trade amounts, seven-locale manual translation controls. Event period changes update only the chart and retain the previous chart while loading.
- Remove the 100 USDT single-bet cap in API and UI; quick additions: 1, 5, 10, 100. Daily 500 USDT, market exposure 500 USDT, balance, fees, freshness, liquidity, slippage and idempotency checks remain.
- Split unavailable, expired, insufficient liquidity and anomalous-price messages. Refresh bypasses the 15-second upstream cache and preserves the ticket inputs; no refreshed timestamp is substituted for an old provider timestamp.

## Verification

- Frontend TypeScript and Next/OpenNext production build passed.
- 11 frontend regression tests and 5 backend quote/limit tests passed. Backend amount above 100 reaches market validation in isolated mocks, without a ledger transaction.
- Production browser at 390 × 844: search and sort fetch only; 1-month chart request without Document navigation and unchanged heading position; all four amount buttons accumulate to 116; quote refresh issues refresh=1 and retains amount/side. Balance rejection remains effective.
- Live example Philadelphia/Atlanta at investigation time: Atlanta had no effective asks despite a fresh book timestamp; by recheck the main market had stopped accepting orders. This was not evidence of stale quotes being the dominant cause.

## Release

- Cloudflare Worker version: 4c458395-4705-4666-8131-ad920976d738.
- Oracle API image: rwa-lat-api:20261002-prediction-limit, healthy. Status confirms maxStakeAtomic=null and the existing daily/exposure limits.
- API image overlays only compiled prediction service/errors (including declarations/maps) on the running production image. The compiled diff against production was exactly the cap removal and positive-amount error text; all other production services stay intact.
- API rollback compose backup: /opt/rwa-lat/deploy/compose.before-prediction-limit-20261002.yml. No database schema change.
- No real stake/order was submitted during this release verification.
