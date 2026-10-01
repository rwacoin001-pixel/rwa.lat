# Prediction events implementation plan

> Use superpowers:executing-plans to implement this approved scope inline.

**Goal:** Correct quotes and show grouped events, real probability history and separate public/local discussions.
**Architecture:** Public Gamma events contain binary child markets. CLOB books remain token-specific. Local discussions reuse community identities, moderation, reports and idempotent replies.
**Tech Stack:** Next.js, React, NestJS, PostgreSQL, existing community schema.
**Spec:** User approved event aggregation, candidate/date options, real multi-line curves/time filters, Polymarket read-only and RWA.LAT discussion, existing theme. No invented election seats/maps.

## Constraints and review focus
- No real production bets or manufactured balances during verification.
- Fail closed on empty/stale books, insufficient best-price depth and >10 percentage point deviation.
- Do not derive No execution prices from the Yes book or Gamma probabilities.
- Do not flatten child markets into unrelated event cards; preserve real market/token IDs.
- A delayed response must not replace a newly selected event/period.
- Replies stay event-bound; hidden content stays hidden; repeated requests stay idempotent.
- Upstream failure is different from an empty discussion/history.

## Tasks
- [x] 1. Quote regression tests, independently fetched/sorted books, frontend/backend pause guards, profit/loss labels.
- [x] 2. Event normalization tests, grouped feed, candidate/date selector and timestamp-scaled multi-line charts with period filters.
- [x] 3. External comments proxy and authenticated local replies/likes/reports through community moderation.
- [x] 4a. Typecheck, targeted financial/community tests, full builds, backup and deployment.
- [ ] 4b. Mobile rendered acceptance: native browser navigation remains unavailable; HTTP verification does not establish visual acceptance.
- [ ] 4c. Explicit-file commit/push.

## Execution ledger
User already approved the design and continued execution; no additional approval interview. Shared checkout remains untouched; work takes place in the existing isolated release checkout.

## Review and validation
- One independent review completed; all three Important findings fixed: community stats SQL scope, provider timestamp freshness, and unavailable versus empty history. Regression coverage passed.
- Minor findings fixed: local older-page ordering and authenticated comment like-state restoration. Tested with an owned temporary database.
- Declined live settlement/appearance judgment: production funds were not used; financial/community invariants have isolated database evidence only. Mobile visuals remain unverified.
- Frontend/API TypeScript passed; 6 pure quote/event checks, 4 API unit checks, and 17 isolated financial/community checks passed.
- Next.js webpack, OpenNext Worker, and API Docker builds passed. Native OpenNext deploy attempted a pnpm install against junctioned dependencies; deployment used the already-built Worker with direct Wrangler and OPEN_NEXT_DEPLOY=true, --no-autoconfig.
- Both production databases backed up and dump archives validated before API switch. Rollback restores the prior compose API image. No migration required, other services preserved.
- API image: rwa-lat-api:20261002-prediction-events. Cloudflare version: 5f1932c0-4815-4ee8-b7ec-b68de59a6684.
- Live public reads passed: grouped feed includes real midterm event IDs 32224/32225; Brazil event 45915 has 32 child options and 1154 history points; independently fetched outcome books carry source timestamps; original discussion returned 38 comments; public API health/local discussion responded 200.
- No invented election seats/maps. History is probability history, not fabricated OHLC candlesticks.
