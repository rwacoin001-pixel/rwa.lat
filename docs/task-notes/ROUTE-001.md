# ROUTE-001 — Single API route contract

- Status: pending review
- Implementer: Codex
- Date: 2026-07-15
- Design review: `DESIGN.md` read. No visual surfaces were changed.

## Canonical routes

| Service | Public base | Examples |
|---|---|---|
| Core API | `http://localhost:4000/v1` | `/v1/health`, `/v1/auth/*`, `/v1/wallet/*`, `/v1/compliance/*`, `/v1/portfolio/*` |
| Admin API | `http://localhost:4100/v1` | `/v1/admin/health`, `/v1/admin/auth/login`, `/v1/admin/users` |
| Admin Frontend | same-origin BFF | `/api/auth/*` and `/api/admin/*`, with upstream `ADMIN_API_URL=http://localhost:4100/v1` |

## Changes

- Moved the fixed `v1` contract into source constants for Core and Admin bootstraps. The prefix no longer drifts with an environment value.
- Verified controller metadata for health, identity, wallet, compliance, portfolio, and Core RBAC: controller paths never include a second `v1` prefix.
- Verified the Admin controller and Admin auth controller resolve below the one `v1/admin` route.
- Removed obsolete `API_PREFIX` sample configuration from Core/Admin environment examples.
- Updated the shared admin API client to use the same-origin BFF route shape and removed its direct `/v1/admin/*` assumptions.

## Verification

- Core route-contract test passed (1 test): selected controller paths cannot form `/v1/v1/*` or `/admin/admin/*`.
- Core administrator HTTP test passed (4 tests), including canonical `/v1/admin/approvals` and 404 for `/v1/v1/admin/approvals`.
- Admin route-contract test passed (1 test).
- Admin integration test passed (9 tests), including 200 for `/v1/admin/health` and 404 for `/v1/admin/admin/health`.
- Core, Admin, Admin Frontend, and shared API client builds passed.

## Remaining work

- The Admin Frontend endpoint/data matrix and removal of its page-level mock fallback data are handled by ADMIN-DATA-001, not this route task.
- Existing user-owned services on ports 3030 and 3100 were not restarted.
