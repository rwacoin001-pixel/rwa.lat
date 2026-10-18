# A-REIT · Source and deployment reference

Updated: 2026-10-16, Asia/Singapore. This is the current entry document. Dated snapshots below are evidence from that time, not a permanent declaration of the latest version. Recheck GitHub and the running service before every release.

## Source of truth and workspaces

- Repository: `https://github.com/rwacoin001-pixel/rwa.lat`; formal branch: `main`. The repository's legacy technical name is intentional and is not a second public brand.
- This cleanup started from `origin/main` **9edf70e** (resolve the full SHA with Git; the branch's base is recorded in the cleanup report). It includes the later prediction-history fix, art-led referral page and Android 1.1.3. Never release the earlier `abdee7d` or `e278556` snapshot over later changes.
- The isolated cleanup worktree is `D:\rwa-lat-worktrees\areit-copy-docs-20261016`, branch `chore/areit-copy-docs-20261016`. It is an implementation workspace, not a fixed universal production entry.
- A main checkout also exists at `D:\rwa-lat-worktrees\desktop-offsite-release-20261013`. Its local HEAD was behind remote main during this audit. A familiar directory name is not proof that it is current or safe to deploy.
- Old `E:\rwa-lat-current`/recovery paths and dated handoff documents are not current-entry instructions. Do not reset, clean, move or delete another agent's checkout or shared dependencies to make a release work.

Before changes, record the repository root, branch, full HEAD, worktree list, uncommitted diff and current remote main. Preserve unrelated work and use a new branch from the latest remote main. A filename, cached build or historical status report is not release evidence.

## Public origins and service boundaries

| Surface | Current public origin | Source/configuration reference |
| --- | --- | --- |
| User application/PWA | `https://a-reit.com` | Root `app`, `components`, `lib`, `styles`, `public` |
| User API | `https://api.a-reit.com` | `apps/api` |
| Admin frontend | `https://admin.a-reit.com` | `apps/admin-frontend` |
| Admin API | `https://admin-api.a-reit.com` | `apps/admin` |
| Cloudflare frontend | Worker `rwa-lat` | `wrangler.jsonc`, `workers/frontend/index.mjs` |

`www.a-reit.com` is configured on the same frontend and redirects to the primary hostname. The wide-window redirect to the CapitaLand website is a separate existing UI policy, not a change to the app's canonical origin.

Oracle configuration in the repository describes separate core API, admin API, admin frontend and PDF services. The bot also has state of its own. Exact live images, Compose project/path, database hosts, storage mappings, feature switches and scheduled jobs were **not re-audited in this cleanup**. Check live read-only evidence before changing any of them. Root `render.yaml` and old Render runbooks are not proof of the current production topology.

## Observed frontend release — snapshot only

- Observation date: **2026-10-16**.
- Worker: `rwa-lat`; version **d1bbade0-82fa-4c6a-97f2-b6b182e6a35e**, 100% traffic.
- Deployment annotation: `prediction-history-links-9edf70e`.
- The annotation matches the cleanup source base's short revision. It does not independently prove byte-for-byte reproducibility of every running backend or complete user-flow acceptance.
- This copy/documentation branch has **not** been merged, pushed or deployed as part of this observation.

`deploy/production-baseline.json` and older handoff records describe historical releases. Do not use their versions, mutable image tags, database names or backup claims as current facts without checking them again.

## Checks and release procedure

1. Review the scoped diff against the latest main and identify whether the batch changes runtime output. Pure Markdown changes do not require restarting services. Display-copy changes require the affected frontend to be built and released; neither implies an API or database deployment.
2. Use installed, verified dependencies or an isolated install. Never approve deletion/reinstallation of shared `node_modules` merely to get past a package-manager prompt.
3. Run appropriate syntax, type, lint and browser checks. For frontend production packaging, the current wrapper is `node scripts/build-production.mjs frontend`: it compiles the API client and Next app, packages the result with OpenNext, and regenerates the Android app-pack manifest. Do not package an old `.next` as a new release.
4. Obtain the user's separate approval to merge, push and deploy this batch. Then integrate the latest main, rerun checks required by conflicts/new changes, and push. Run `node scripts/require-merged-release.mjs`; it requires clean, pushed `main` matching the remote.
5. Capture the **then-current** Worker version/configuration or relevant immutable service images before release. The supported local Wrangler entry is `node node_modules/wrangler/bin/wrangler.js`; use the existing OpenNext deployment environment when invoking it directly (`OPEN_NEXT_DEPLOY=true`, `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`). Do not let an implicit package reinstall remove shared dependencies. Do not deploy an unbuilt or stale worktree.
6. Verify the deployed version, current build manifest and affected real pages/assets. Separate simulated tests from real-device or financial-flow acceptance; do not create real transfers, withdrawals or orders for a copy cleanup.
7. Record the source revision, checks, deployment identifiers and rollback target. Before any rollback, recheck production for another agent's later release; do not overwrite it with an earlier saved version.

## Preserved technical and historical identities

This batch does not rename repository/package names, Worker/container names, Android `applicationId`/signing identity/UA, storage keys, cookies, ticket audiences, API paths, queue names, database objects, bucket names, migration files or idempotency keys. Their names are not user-facing branding.

Production secrets and credentials belong in their existing protected configuration, never in this document, source control, screenshots or handoff text. Existing financial, privacy and authentication controls remain in force.

## Document authority

- [Current design rules](../DESIGN.md) preserve the implemented logo, themes and navigation; they do not request a redesign.
- [Documentation index](README.md) separates current entrypoints, reference templates and historical implementation evidence.
- Historical task boards, prototypes, migration narratives and dated QA results retain their original bodies. Their success claims apply only to the recorded date and scope.
- Database-published copy, mail-provider configuration, legal publications and operational records are not inferred from source text; changes require their own reviewed data/configuration task.
