# Koala first-subscription rewards and prospective team monthly settlement

Status: implemented and verified in an isolated worktree; NOT merged, pushed or deployed. No customer funds or production records were changed.

## Accepted behavior

- Each user's first successfully settled Koala subscription is eligible for purchase referral rewards at the effective purchase policy. A retry, later top-up, another Koala product or re-entry after redemption cannot earn a second first-subscription award. Failed/pending orders do not consume eligibility.
- Historical successful Koala subscriptions consume first-success eligibility without generating historical rewards. This decision is persisted and immutable.
- Team monthly settlement starts at the migration activation timestamp. Only that effective portion of the first month is included; no historical month backfill. The current effective team policy is captured without activating a pending future version early.
- Asia/Shanghai calendar months; max three referral levels; net eligible prediction platform fees; at least one direct invitee with positive eligible net fees. Existing progressive tiers and configured component filters apply.
- Closed months automatically generate pending batches. A platform administrator inspects recipients, individual bases and rewards, approves, then explicitly funds the batch from collected platform fee revenue. No automatic payment. Credits go directly to user available USDT; no separate reward claim.
- Corrections resolve the original transaction's customer and fee component. Excluded components and pre-activation originals are excluded consistently. Unattributable fee debits stop generation for review instead of silently inflating the basis.
- Batch payment is idempotent. Insufficient funding keeps the batch approved; busy recipient/funding balances return a retriable conflict without debiting funds. NOWAIT prelocks avoid a new deadlock cycle with customer betting.

## Delivery scope

Core API, database migrations, admin gateway, admin browser proxy, admin review/funding panel, and user monthly record section. Existing purchase and fee claims continue separately. No withdrawal/security gates or unrelated product access rules were changed.

Two forward-only migrations: `1792700000000-referral-quant-first.ts` and `1792700010000-referral-team-settlement.ts`. They create eligibility, activation and batch structures; they do not move any funds.

## Verified

- 123 focused API tests: PostgreSQL first-subscription and team settlement; reward policy/math; authorization. Covers concurrent first subscriptions, repeated payment, real balanced local ledger transfers, insufficient funding, busy balances, component reversals and stale batch review.
- 2 deployment rehearsal tests: historical first success, no historical award, future scheduled policy preserved, immutable activation and no backfill.
- 17 referral registration/schema integration checks, including updated Nest dependency injection.
- 9 quant flow/math/performance checks: subscribe, daily gain/loss, redeem, disclosure and ledger invariants remain valid.
- 23 admin forwarding and route contract checks; 2 browser proxy tests preserve Idempotency-Key and CSRF rejection.
- API, admin and admin frontend TypeScript checks passed. Client TypeScript passed with a temporary validation config pointing missing third-party dependencies to the current main checkout; shared node_modules were not modified.
- Migration ordering contract: 94 ordered migrations, demo data production-gated. Reviewer follow-up found no additional actionable findings after corrections. Review did not independently rerun tests.

All financial tests used the owned local PostgreSQL container `areit-referral-team-test-20261022`, port 55438, named disposable test databases. No production database was used.

## Release order for the final approved batch

1. Recheck origin/main and other AI work; merge only this batch after user release confirmation. Preserve main checkout changes.
2. Build the core API/admin/admin frontend and application from the final merged revision using the current deployment handoff. Do not deploy from the old D:\rwa-lat snapshot.
3. Apply migrations before starting new core code. Verify the activation timestamp and current effective team policy, including teamEnabled=true. No manual backdating or historical award generation.
4. Deploy core API, admin gateway and admin frontend, then the application UI. Check authenticated team records, admin list/detail permissions and proxy headers. No real user reward payment is part of deployment verification.
5. Update the independent knowledge center's pending-rule wording only after activation is confirmed; rebuild handbooks/cards and publish to its own hosting project/domain.

Rollback must preserve first-success eligibility, immutable financial sources and activation/batch audit records. Do not execute migration down or delete history. A service rollback needs an explicit compatibility review.
