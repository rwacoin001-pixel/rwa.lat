# Daily draw v2 (2026-11-02)

Current migration: `1793900000000-daily-draw-v2.ts` (`DailyDrawV21793900000000`). v1 prize rows and draw history remain. The campaign's enabled flag and pilot ids are preserved. `down` is a logical rollback to v1 campaign/exchange settings: additive schema and historical v2 records stay, and `up` can safely run again. Settle outstanding voucher bets with v2 code before rolling application code back.

- Each v2 draw picks points and a stake voucher independently using two 10000-ticket pools. `prize_code` records the final voucher after fallback; `points_code` records the independent points pick. Both sit in one draw row. Frozen draws retain both prizes, freeze the voucher, and have no points credit.
- Voucher faces are 1/2/5/10/20/50/100 USDT. Caps are 20 x6, 50 x2, 100 x1 per SG day. The 300 USDT face budget counts only drawn vouchers >=5, including frozen draws, regardless of later use or expiry. Exchange vouchers and 1/2 USDT draws do not consume it. Cap/budget failures always fall back to 1 USDT.
- Exchange: 100 points -> 1 USDT `prediction_stake`, 14 days, once per SG day. No draw budget check. Existing user/campaign locks, keys, SG-day semantics, signed edge IP freeze and live gating stay.
- `POST /v1/predictions/bets`: optional `voucherId`, exclusive with `couponId` (400 `REWARD_VOUCHER_CONFLICT`). Owned, available, unexpired voucher is locked inside the bet transaction. Exact face required (400 `REWARD_VOUCHER_STAKE`). Uses existing `hasQualifyingDeposit` evidence (>300 USDT external credited deposit), price <=0.90 and no placed voucher position on another outcome of the same market (409 `REWARD_VOUCHER_DEPOSIT_REQUIRED` / `REWARD_VOUCHER_PRICE` / `REWARD_VOUCHER_HEDGE`).
- Full face is risk stake, fee is zero, user funds stay unchanged. Debit platform `prediction_promo` / `promo_expense` (debit-normal expense); credit prediction pool. Wins credit the full normal net payout to the user. Voids credit promo, restore the voucher and extend expiry to at least 3 days. Losses keep the voucher used. Every use has a separate redemption receipt, including reuse after a void; receipt fee-before is zero, discount is face. Existing fee-coupon receipt behavior remains.
- Bet views add `voucherId` and `funding`. Draws add deterministic `AR-` + 8 base32 `serial` and voucher-derived `tier`. v2 `prize` is `{points,voucher,coupon:null}`; v1 keeps `kind` and adds the nullable fields. `GET /v1/rewards/odds` is authenticated/live-gated and returns stored pool weights and voucher caps.
- Local mock only: `D:/rwa-lat-builds/circles-mock/rewards.cjs`; starts with 40 points, available 5 USDT stake voucher and 0.50 USDT fee coupon. `GET /v1/rewards/today?mock=reset` resets today's draw slot and makes it eligible. `mock.cjs` is unchanged.

Verification (run from `apps/api`):

Local results: TypeScript exit 0 (zero errors); rewards/prediction/wallet: 22 suites passed, 7 skipped; 175 tests passed, 83 skipped, zero failed (69.147 s). Mock: 20 assertions passed; syntax check passed. `git diff --check` passed. `TEST_DATABASE_URL` was unset, so database integration/actual migration execution remains unverified. No commit or deployment was made.

Changed files: `src/rewards/{reward-coupons.ts,rewards.controller.ts,rewards.dto.ts,rewards.errors.ts,rewards.service.ts}`; `src/prediction/{prediction.dto.ts,prediction.entities.ts,prediction.service.ts}`; `src/database/migrations/1793900000000-daily-draw-v2.ts`; `test/rewards/{README.md,rewards-http.spec.ts,rewards.integration.spec.ts,rewards-v2.spec.ts,rewards-mock-v2.smoke.cjs}`; external local mock `D:/rwa-lat-builds/circles-mock/rewards.cjs`.

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
$rewardTestPaths = @(Get-ChildItem test/rewards,test/prediction,test/wallet -Filter '*.spec.ts' -File | ForEach-Object { $_.FullName })
node node_modules/jest/bin/jest.js --runInBand --config D:/rwa-lat-builds/jest.local.cjs --runTestsByPath @rewardTestPaths
node test/rewards/rewards-mock-v2.smoke.cjs
# After configuring isolated TEST_DATABASE_URL (local database ending in _test):
node node_modules/jest/bin/jest.js --runInBand --config D:/rwa-lat-builds/jest.local.cjs --runTestsByPath test/rewards/rewards.integration.spec.ts
```

Use explicit paths: the positional `rewards` filter also matches this worktree's `rewards-backend` name and selects unrelated API suites. v2 adds integration coverage for issuance/freezing, stake/deposit/price/hedge rules, balanced promo funding, full net payout, void restoration/reuse, competing bets, rollback and guarded migration up/up/down/up. Database cases are gated on `TEST_DATABASE_URL` and require real Postgres; they have not been run locally in this task.

The remainder below is the historical v1 implementation report; v2 rules above supersede its prize, budget, exchange and response-shape descriptions.

# Daily rewards backend handoff

Implementation is left uncommitted on `codex/rewards-backend`. No frontend files or production data were changed.

## Files

- `src/rewards/rewards.controller.ts`, `rewards-live.guard.ts`, `rewards.service.ts`, `rewards.dto.ts`, `rewards.errors.ts`, `rewards.module.ts`, `reward-coupons.ts` (relative to `apps/api/`).
- `src/database/migrations/1793800000000-daily-card-rewards.ts`: `DailyCardRewards1793800000000`. Guarded additive DDL; seeded disabled, empty pilot list, 50 USDT daily face budget, 14-day coupons, 100-point exchange, 0.50 USDT exchange face, version 1 with 60/25/10/5 weights.
- `src/app.module.ts`: module registration.
- `src/prediction/prediction.controller.ts`, `prediction.dto.ts`, `prediction.service.ts`: optional coupon ID, transactional consumption/redemption, reduced fee and increased risk stake/shares, original receipt replay before current market/quote validation. Status response unchanged.
- `src/wallet/dto/wallet.dto.ts`, `src/wallet/wallet.entities.ts`, `wallet.service.ts`, `wallet-ledger.bridge.ts`, `src/ledger/ledger.service.ts`: quote, locked creation, actual fee storage, settlement redemption and atomic refund/release. Admin rejection uses the bridge; demo rejection and chain failure use LedgerService refunds. There is no separate cancellation route in this checkout; refundWithdrawal also releases coupons when refunding a cancelled request.
- `src/common/http-exception.filter.ts`: public eligibility reason is retained as `error.details.reason`.
- `test/rewards/rewards.spec.ts`, `rewards-http.spec.ts`, `rewards.integration.spec.ts`; updated `test/prediction/prediction-limits.spec.ts`, `test/wallet/wallet-core.spec.ts`, `wallet-ledger-bridge.spec.ts`.
- Local preview module: `D:/rwa-lat-builds/circles-mock/rewards.cjs`. `mock.cjs` was not edited. Mount rewards before generic mock handlers; the card-post observer returns false so cards.cjs can send the post response. A concurrent local edit added an extra available withdrawal coupon to the originally requested two seed coupons; that edit was preserved.

## Explicit implementation choices

- The draw has no network parameter. Withdrawal coupon face snapshots the current default **TRON** fee at draw time (currently 1000000 atomic), and later redemption on any network is capped at that order's actual fee. Other networks can have different fees.
- The 50 USDT daily issued-face budget includes **both draws and point exchanges**, including frozen/already-used/void issued coupons. Redemption, expiration or refund does not recycle issuance budget. Exchange refuses with `409 REWARD_COUPON_BUDGET_EXHAUSTED` without debiting points if issuing it would exceed the budget; `canExchange` includes this gate.
- Draw and exchange take a per-user advisory transaction lock, then a campaign row lock for shared issuance checks. The campaign lock also serializes the third-distinct-user IP freeze check. Frozen point draws retain their prize but have no points credit. Frozen coupons reserve budget.
- Additional nullable receipt columns (`idempotency_key` on draw/points rows and `balance_after` on points rows) make keys safe across SG midnight. Daily exchange uniqueness has a database index. Replay returns the original draw/exchange reference, with the coupon's current derived state.
- Used coupons are retained in the wallet for 30 days from use; expired available coupons for 30 days from expiration. Locked/frozen and unexpired available coupons remain visible. Void coupons are excluded.
- No migration, deployment or real financial operation was run. Only local unit/type/mock checks were executed. Integration tests require an isolated local database ending in `_test`, preserve immutable fixture history, and restore campaign configuration after each test. Run the integration suite serially; it temporarily changes the campaign budget/pilots.

## Commands

Run in `apps/api`. On this machine Node is `D:/Program Files/nodejs/node.exe`; it is not in the inherited PATH.

```powershell
& 'D:/Program Files/nodejs/node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
$rewardTests = @(Get-ChildItem test/rewards,test/prediction,test/wallet,test/community -Filter '*.spec.ts' -File | ForEach-Object { $_.FullName })
& 'D:/Program Files/nodejs/node.exe' node_modules/jest/bin/jest.js --runInBand --config D:/rwa-lat-builds/jest.local.cjs --runTestsByPath @rewardTests
# After setting TEST_DATABASE_URL to the owner's isolated local PGlite server:
& 'D:/Program Files/nodejs/node.exe' node_modules/jest/bin/jest.js --runInBand --config D:/rwa-lat-builds/jest.local.cjs --runTestsByPath test/rewards/rewards.integration.spec.ts
```

Use explicit test paths: a positional `rewards` pattern also matches the worktree name `rewards-backend`, inadvertently selecting the entire API test tree.

## Local verification (2026-11-01)

- TypeScript: exit 0, zero errors.
- The four specified test directories: 34 suites passed, 10 database suites skipped; 307 tests passed, 101 skipped, zero failed (51.487 seconds). `TEST_DATABASE_URL` was not configured.
- Mock smoke: 16 assertions passed (card unlock, draw/replay, fee cap, bet consumption/replay/reuse rejection, withdrawal quote and low-points exchange).
- `git diff --check`: exit 0.
