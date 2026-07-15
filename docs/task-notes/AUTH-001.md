# AUTH-001 — User identity and OAuth/email remediation

- Status: blocked on local database availability and external identity-provider configuration
- Implementer: Codex
- Date: 2026-07-15

## Implemented local hardening

- Added `app.identity_one_time_tokens` migration (`1783790000000-add-identity-one-time-tokens`). Verification and recovery tokens are server-side HMAC hashes, expire after 15 minutes, are atomically single-use, and are superseded when a replacement token is sent.
- Email registration and recovery APIs now return only `{ accepted: true }`; they do not expose raw verification/recovery tokens or whether an account exists.
- `verify-email` and `recover/confirm` consume the one-time token and only then issue a controlled session.
- Added an explicit `AUTH_ADAPTER=demo` delivery path for local tests. In every other configuration, email delivery fails closed rather than returning a token to the browser.
- Removed the OAuth `provider + subject` API contract. The endpoint now accepts only `code` and `state`, and rejects when a verified provider adapter is not configured. The H5 provider controls no longer create a fake authenticated session.
- Production validation rejects `AUTH_ADAPTER=demo`.

## Verification completed

- Core API production build passed.
- H5 production build passed.
- Shared API-client TypeScript build passed.
- Identity unit tests passed: 1 suite, 9 tests.
- The isolated test database accepted migration 23 before local PostgreSQL became unavailable.

## Blocking requirements

1. Local PostgreSQL is unavailable: `127.0.0.1:5432` refuses connections and `wsl.exe` reports no available distribution. This prevents the final identity integration/full-suite regression.
2. Real Google/X authorization-code exchange requires product-owned client IDs/secrets, registered redirect URIs, issuer/audience/JWKS policy, and an email delivery provider. The current implementation rejects unconfigured OAuth instead of accepting an untrusted browser subject.

## Required follow-up

- Restore the local PostgreSQL/WSL environment, then rerun the identity integration tests and full Core regression.
- Supply the approved Google/X and email-provider configuration through server-side secrets. Implement provider token exchange, state/nonce/PKCE persistence, JWT/JWKS validation, and provider callback tests before marking AUTH-001 complete.
