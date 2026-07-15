# RWA.LAT API

NestJS API boundary for RWA.LAT. It currently provides versioned routes, request IDs, consistent errors, input validation, security headers, CORS, OpenAPI, the PostgreSQL/migration baseline, and the identity/security foundation. Domain modules are added by the numbered tasks in `docs/Task-Board.md`.

## Local use

1. Copy `.env.example` to `.env` and adjust local values if needed.
2. Start PostgreSQL with `docker compose up -d postgres`. The first initialization creates physically separate `rwa_lat_dev` and `rwa_lat_test` databases.
3. Run `npm install`.
4. Run `npm run db:migration:run`.
5. Run `npm run start:dev`.

Database commands:

- `npm run db:migration:show` lists pending and applied migrations.
- `npm run db:migration:run` applies pending migrations to `DATABASE_URL`.
- `npm run db:migration:revert` reverts the latest applied migration.
- Set `NODE_ENV=test` when running migrations against `TEST_DATABASE_URL`; the configuration refuses to reuse `DATABASE_URL` for tests.
- Deployments set `APP_ENV` to `demo`, `staging`, or `production` and provide the matching environment-specific URL. Database names must carry the matching environment suffix.
- Passkey endpoints require exact `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` values for the deployed web origin. These values must be reviewed per environment and must not be inferred from request headers.

For low-memory Windows environments, use `npm run test:unit:low-memory` to run database-free Jest suites in five isolated serial batches and `npm run build:low-memory` for a 1GB-bounded Nest build. Database-backed suites remain under `npm run test:integration` and require `TEST_DATABASE_URL`.

Schema synchronization is permanently disabled. Every schema change must use a reviewed migration that supports both `up` and `down`.

Endpoints:

- `GET /v1/health`
- `GET /v1/health/ready`
- `GET /v1/docs`
- `GET /v1/docs-json`
- `POST /v1/auth/*` for email, OAuth and wallet-signature identity flows
- `GET|POST|DELETE /v1/security/*` for session/device management, TOTP, Passkey, step-up reauthentication and immutable security-event history
- `GET /v1/wallet/networks` for public network policy and integration mode
- `GET|POST /v1/wallet/*` for authenticated balances, deposit addresses, withdrawal quotes/requests and internal transfers
- `POST /v1/wallet/callbacks/custody/deposits` for timestamped HMAC-verified, idempotent custody deposit observations
- `GET /v1/ledger/balances` and `GET /v1/ledger/transactions` for authenticated exact balance and immutable voucher history
- `GET /v1/polymarket/status`, `/markets`, `/markets/:id` and `/tokens/:tokenId/order-book` for persisted Gamma discovery and public CLOB V2 read data
- `POST /v1/admin/polymarket/sync/markets` for an admin-session and `catalog.manage` protected keyset sync page
- `GET /v1/portfolio/*`, `/v1/notifications/*` and user-operations routes for session-derived end-user data; request parameters cannot select a different user
- `POST /v1/job-queue/callbacks` for timestamped, HMAC-SHA256 authenticated partner callbacks
- `GET|POST|PUT /v1/admin/job-queue/*` for admin-session and `operations.jobs.manage` protected queue operations
- `POST /v1/admin/notifications` for admin-session and `notifications.manage` protected notification creation
- `POST /v1/storage/presigned/*`, `GET /v1/storage/objects/meta` and `DELETE /v1/storage/objects` for admin-session and `storage.manage` protected object operations
- `POST /v1/storage/callbacks/scan` for timestamped, HMAC-authenticated malware-scan results
- `POST /v1/user-storage/attachments/presigned/*` and `GET /v1/user-storage/attachments/:objectId/status` for session-owned ticket attachments
- `GET|POST /v1/admin/tickets/*` for admin-session and `support.tickets.manage` protected support operations

All responses include an `x-request-id` header; successful health responses also include `requestId` in the response body. `GET /v1/health/ready` probes PostgreSQL and returns `503` with `DATABASE_UNAVAILABLE` when the dependency is unavailable. Error responses use the common `error`, `requestId`, `path` and `timestamp` envelope.

Security endpoints require `Authorization: Bearer <session-token>`. TOTP secrets and WebAuthn challenges are encrypted at rest, recovery codes are stored only as HMAC values, passkey challenges are single-use and expire after five minutes, and all security changes create immutable `app.audit_logs` records. A step-up token is tied to one session and expires after five minutes; future withdrawal, address-book and other sensitive routes must require it rather than treating a login session as sufficient proof.

Wallet mutation endpoints also require the session-bound step-up token and an `Idempotency-Key`. Amounts use USDT smallest-unit integer strings. The bundled `StubCustodyAdapter` can provision deterministic demo addresses but cannot broadcast withdrawals; `WALLET_EXECUTION_ENABLED=true` is effective only when a separately reviewed live adapter is installed. Custody callbacks require `WALLET_WEBHOOK_SECRET`, a five-minute timestamp window and a canonical HMAC signature.

Generic partner callbacks use `PARTNER_CALLBACK_SECRETS_JSON`, a JSON map from partner name to a secret of at least 32 characters. Send `x-rwa-event-id`, `x-rwa-timestamp` and `x-rwa-signature: sha256=<hex>`. Compute the HMAC over deterministic, recursively key-sorted JSON for `{ eventId, eventType, partner, payload, timestamp }`; requests outside the five-minute window are rejected. An empty or malformed secret map rejects every generic callback.

The API has a bounded, in-process per-IP safety limit: 1,000 requests/minute globally, with stricter limits for registration, authentication proof, recovery, step-up and partner-callback routes. A trusted reverse proxy hop count must be configured through `TRUST_PROXY_HOPS`; it must match the real network path. This limiter is a single-instance backstop, not a substitute for a shared gateway/Redis limit in a multi-replica deployment.

`GET /v1/metrics` requires `Authorization: Bearer <METRICS_BEARER_TOKEN>` whenever the token is configured and always in production. The production token must contain at least 32 characters and be delivered through Secret Manager.

Object storage is disabled unless `OBJECT_STORAGE_ENABLED=true`. Upload authorization binds bucket, key, MIME type, byte length and SHA-256 for at most 15 minutes. A completed upload remains unavailable until the configured malware scanner returns a signed `clean` result with the same SHA-256; pending, failed, infected or checksum-mismatched objects cannot receive a download URL. Production enablement also requires KMS encryption, an approved scan provider and its HMAC callback secret.

Ticket requests accept at most five `attachmentObjectIds`, never arbitrary attachment metadata. Each referenced object must belong to the authenticated user, be stored in `rwa-attachments`, have a completed upload and be malware-cleared before the ticket/message transaction begins.

When `APP_ENV=production`, startup validation requires explicit HTTPS API/CORS/Passkey origins, a production database URL, non-placeholder identity keys, metrics authentication and an explicit trusted-proxy topology. `PRODUCTION_FINANCIAL_FEATURES_ENABLED=true` adds strict live-provider, region allowlist, wallet execution and webhook-secret gates. See `docs/Production-Readiness-Inputs.md` and the step-by-step `docs/Production-External-Setup-Guide.md` before configuring production.

The Polymarket adapter is intentionally public/read-only. It persists market/token mappings and synchronization watermarks, and every response reports `tradingEnabled: false`. `POLYMARKET_TRADING_ENABLED=true` is rejected during production startup because user-signed CLOB V2 submission, geographic approval and external reconciliation are not installed.
