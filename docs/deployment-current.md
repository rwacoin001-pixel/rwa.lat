# Current source and production services

The only development entry is `E:\rwa-lat-current`. It is a junction to the existing verified worktree, not a second source copy. Repository: `rwacoin001-pixel/rwa.lat`. Formal branch: `main`. Consolidation was prepared on `codex/consolidation-20261004` from `7015a18`; the user authorized verification followed by merge and push on 2026-10-04.

After source changes, explicitly ask the user whether to merge. Only merge after their confirmation; then execute the approved merge directly. Do not release an unmerged worktree. `pnpm deploy:cloudflare` checks that the source is clean, on main and already pushed to origin/main.

## Source reconstruction

The source includes the 15 preserved prediction/translation/style/service-worker fixes, plus two yield-calendar changes recovered from the current live client. After normalizing CRLF/LF line endings, Core rebuilds match all 446 live JS files and Admin rebuilds match all 40 live JS files. There are no code differences. All 139 captured user frontend assets match byte-for-byte (four malformed capture paths returning HTML are excluded). Linux Docker builds of the admin frontend match all 62 captured live JS/CSS assets. The independent PDF server entrypoint is byte-identical to the live renderer; it imports no API application or database modules.

The main production frontend is Cloudflare Worker `rwa-lat`; the admin frontend is on Oracle, not Cloudflare or Render. See `deploy/production-baseline.json` for current versions, image IDs and formal origins. The optional legacy admin Cloudflare configuration points to the correct Admin API, but must not be used to create a second production admin frontend.

## Build and release

1. Use `pnpm install --frozen-lockfile`. Do not refresh dependency versions during source consolidation.
2. Run `pnpm build:production` for frontend, API, Admin and admin frontend. It explicitly supplies production frontend origins so local development settings cannot override them.
3. After the user's approved merge and push, build Oracle images with `--build-arg SOURCE_REVISION=<full Git SHA>`. Use immutable image IDs/digests in the private release environment for `deploy/oracle.compose.yml`; record those IDs, Cloudflare version and backup location in the release record.
4. Run schema migrations only as a separately reviewed release step. The Compose API command intentionally preserves the current direct Node start. Consolidation introduces no migration.
5. Before a production switch, verify health/readiness and authenticated flows, then keep the previous release available for rollback. Never restart the old Admin using its `20261002-free-quotes` tag: its image metadata was pruned and that tag now resolves to another image. Its running filesystem is saved and verified outside Oracle.

## Service boundaries

- Formal entries: `rwa.lat`, `admin.rwa.lat`, `api.rwa.lat`, `admin-api.rwa.lat`.
- Oracle: business API, Admin API, admin frontend, isolated PDF renderer, community bot. The bot has its own state and Compose project; preserve them.
- Neon: separate business and admin production databases. Do not merge or delete these databases merely to reduce the number of names.
- Backblaze B2: assets, attachments and KYC files. Keep existing bucket mappings.
- VPN: separate Oracle server; outside this consolidation.
- Private credentials remain under `/opt/rwa-lat/config`; never commit them. Compose keeps the PDF network internal, drops capabilities, uses read-only filesystems and binds external service ports to loopback.

## Backups and legacy workspaces

`E:\rwa-lat-backups\consolidation-20261004` contains repository bundles and preserved working files from five workspaces, current runtime configuration/artifacts, database dumps and the Admin filesystem snapshot. New dumps restored successfully in a disposable PostgreSQL 18 container: Core app tables 177, Admin app tables 109. These are recovery copies; they do not change live balances.

Other D:/E: source workspaces are preserved drafts/archives and must not be used for publication. Do not reset, clean, recursively delete, or blindly merge them. Source-only or unverified work remains in those backups instead of being mixed into the live release.

The two old Render admin frontends and their auto-deployment must be retired after the approved consolidation switch and final callback/dependency check. Until then, their presence is recorded explicitly. The keepalive source now targets only formal Oracle endpoints; publishing it is a separate release action. No service is stopped by committing this document.

## Verification of the consolidation source

- The production build wrapper completed all four builds. The frontend was rebuilt after excluding deployment configuration from Tailwind source scanning.
- All eight configured API unit batches passed: 67 suites, 497 tests. One investment eligibility fixture was brought up to date with the current quote API without changing its rejection and rollback assertions.
- Admin route/security unit tests: 10 passed. Frontend refresh/AI regression tests: 6 passed. Frontend prediction quote tests: 4 passed.
- A fresh disposable PostgreSQL 18 database accepted all 78 current migrations. Ten integration suites passed, totaling 54 tests: identity and wallet schemas, transfers and reconciliation, prediction schema, catalog quotes, identity sessions, email verification codes, community profiles, and manual order settlement. Production databases and balances were not used. Two timestamp fixtures now use the application's clock so a remote database clock offset cannot change their expected expiry or freshness result; production guards and assertions are unchanged.
- Live read-only checks covered the five prediction sort modes, rejection of an invalid mode, history for 1h/1d/1w/1m/max, discussions, asset data, community feed and service status. Browser checks covered search retained after returning, chart-only period loading, both discussion tabs, the +1/+5/+10/+100 stake controls (116 USDT preview), authenticated homepage rendering, and Arabic-to-English community translation with original/cached toggling. No real order, withdrawal or transfer was submitted.
- The proposed Oracle Compose file passes `docker compose config --quiet` against the existing private configuration. It has not been started.
- The release guard rejects unmerged branches; on main it additionally requires a clean source tree and a matching remote main revision. The formal frontend, API health/readiness, Admin health and admin login URL returned HTTP 200; all four Oracle services remain healthy with their original start times and image IDs.
- These checks confirm source reconstruction, builds, unit/integration behavior, sampled browser flows and recovery backups. They do not replace real-device biometrics, all-language visual acceptance or real-money business acceptance. This consolidation merges and pushes source only; it does not replace production containers or frontend releases.
