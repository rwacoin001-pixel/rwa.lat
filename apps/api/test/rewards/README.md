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
