# A-REIT / KIMENG release notes

## Intended architecture

One repository, separate frontend builds and Workers, one API and account/asset database. Existing A-REIT hosting and domain bindings are preserved. KIMENG is the English mark; 金英 is the Chinese name. Sessions remain separate per origin. No second settlement, wallet watcher, reward worker or community bot is deployed.

## Current release boundary

The Kimeng candidate is a protected **interface/discovery preview**, not a public account or financial launch. Without its independently configured secret the Worker is closed. Only `closed` and `preview` are accepted by the deployment check. The user authorized the preview credential on 2026-11-05. Public launch is intentionally not implemented as a configuration shortcut.

In preview mode an independent high-entropy access password is required. Its SHA-256 digest is a Worker secret; never use an account/admin password or wallet key. The Worker removes preview authorization and cookies before forwarding. Every write request, private `/v1` request, Next `/api` request and authentication callback is rejected. Encoded API paths cannot bypass the allowlist. Only the existing explicitly enumerated anonymous market reads are permitted. The UI also marks login as unavailable; the Worker is the enforcement boundary.

All Kimeng responses are noindex and no-store. `run_worker_first` protects static assets as well as pages. `workers.dev` and version preview URLs remain disabled. Root/www are canonicalized to HTTPS kimengresearch.com; unrecognized hosts fail closed.

Preview does not register or deliver the offline service worker: its existing cache fallback would otherwise replay pages after closure. PWA identity/startup assets are prepared, but offline/PWA acceptance belongs to the later complete launch. Referral landing and native handoff routes are also blocked because even a GET can create attribution state.

## Brand assets and surfaces

- Build selection: `SITE_BRAND=areit|kimeng`, pinned into client/server bundles by Next configuration. Missing selection preserves A-REIT; unknown values fail.
- Metadata, manifest, browser/Apple/PWA icons, launch overlay and 24 iOS startup images use the selected brand.
- Auth/header marks share a normalized monochrome vector master. Authored interface translations, current share cards and referral links use the selected brand. User-generated content, protocol IDs, past files and published legal text are not rewritten.
- Kimeng desktop stays within the app. A-REIT retains its existing desktop policy.
- The A-REIT APK is not relabeled or offered as a Kimeng native app. Browser/PWA support remains in scope.
- Instrument Serif, Cormorant Garamond and Jost are self-hosted from their official Google Fonts source with OFL notices, avoiding build-time font-download failures.

## Operator information in the existing admin

Open **运营主体与资料 → 金英品牌与主体设置**. Maintain legal name, registration number, jurisdiction, contact address, support email and public description. Kimeng details are separate from the existing A-REIT fields. They live in the existing versioned `platform_configuration` JSON data and use `platform.manage`, optimistic revision checking, transactions, publication history and audit logging. No schema migration or new permission grant is required.

Incomplete Kimeng drafts can be saved. The ready checkbox requires complete legal/contact fields before publication. Drafts never appear in public responses. The public Kimeng profile is `/v1/platform/brands/kimeng`; the original `/v1/platform` response excludes brand drafts. Publishing operator details does not open registration, trading, withdrawals or change past agreements. Operator details are pending user input.

## Build and target verification

1. Freeze source and run brand/security/admin checks.
2. Build sequentially with `node scripts/build-production.mjs frontend areit` and `... frontend kimeng`. Never run both against shared output paths concurrently. Preserve the finished A-REIT `.next` and `.open-next` in an ignored immutable archive before starting Kimeng.
3. Each build verifies its real generated manifest and writes `.open-next/brand-build.json` containing source commit, brand, build ID, Worker hash and artifact tree digest. The already-bundled server handler is covered; OpenNext's copied build-only `node_modules` junction tree is excluded.
4. Run `node scripts/check-brand-deployment.mjs kimeng`; it rejects the wrong Worker, routes, source, API or mismatched compiled and runtime release modes.
5. The existing merged-release guard must pass from a clean source checkout matching remote main. Use a separate clean release clone if main is occupied in another worktree; do not reset or clean that worktree.
6. Deploy with `wrangler.kimeng.jsonc` only. Never deploy this artifact with `wrangler.jsonc`. Verify HTTPS, www redirect, anonymous gate, authenticated preview, private/write denials, identity assets and A-REIT health.

## Shared backend release and rollback

Read the current server handoff and re-check live image IDs first. Keep original image tags and compose/config backups. Build additive overlays from the exact live API/admin images, replacing only verified changed compiled modules; preserve other live features and dependencies. Do not apply repository migrations or update production secrets for this feature. Keep the original community bot, database, PDF renderer and old Oracle services untouched.

If a backend overlay regresses, restore the recorded image tag. Existing JSON fields and new profile snapshots can remain stored; an old application ignores them. Do not restore an old database over newer transactions. If Kimeng regresses, return it to closed mode or roll back only its Worker version. This does not remove accounts or alter balances.

## Opening account and financial access

Deploy the additive API overlay before either frontend. Deploy the A-REIT Worker before Kimeng: the original Google and GitHub provider callbacks first confirm the unconsumed server-side state and then return to Kimeng. Kimeng also requires the original browser state. X uses a direct Kimeng callback and needs a live provider allowlist check. Related Origin Requests at `https://a-reit.com/.well-known/webauthn` keep the existing passkey RP ID; clients without support can use another enrolled sign-in method.

Use `public` for both the Kimeng build and Worker and provision its signed edge binding before the switch. Without that binding the Worker fails closed. Verify same-origin email, wallet and authorization requests, rejected unsigned/cross-site requests, and that financial endpoints still enforce session, step-up and operational switches. Never submit a real deposit, investment or withdrawal as a smoke test. Roll Kimeng back to the previous preview version if production checks fail; then assess the API and A-REIT rollback separately.

## Remaining security work

The prior audit's database runtime superuser, public-API hot-wallet key, admin authentication, persistent origin firewall policy, attachment scanning, dependency and log-redaction work are not resolved by this frontend release. Production Swagger exposure is additionally disabled in source; the earlier Caddy documentation block remains defense in depth.

Notification/document snapshots, supplier allowlists, backup-restore evidence and real iPhone/Android acceptance remain separate work. No real-money acceptance is implied by visual checks or unit tests. No automatic cross-domain SSO is introduced.

## Release evidence

Append actual source commit, build stamps, previous/new image and Worker versions, tested device/browser, command results and remaining failures after execution. Never list a check as passed solely because its code exists.
