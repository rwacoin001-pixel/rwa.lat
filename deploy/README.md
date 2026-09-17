# Production deployment assets

- `Dockerfile.api`: Core API production image and readiness health check.
- `Dockerfile.admin`: Admin API production image and health check.
- `compose.production.yml`: hardened, resource-bounded Core/Admin services plus one-shot migration service.
- `production.env.example`: variable names and safe locked-mode defaults; never commit the populated `production.env`.
- `release-production.ps1`: serial low-memory `Locked`/`Live` release workflow.

Use the Chinese runbook at `docs/operations/Financial-Production-Deployment.md`. Custody now ships a reviewed **manual mode** (operator-held keys, deposit address pool, TronGrid watcher, locally-signed withdrawals) and sanctions screening runs in the audited `disabled` mode (2026-09-18 operator decision). Financial features remain off by default; the only default deployment mode is still `Locked` until the operator explicitly enables the money switches documented in `docs/task-notes/MANUAL-CUSTODY-2026-09-18.md`.

`Live` also runs a compiled capability preflight before migrations. Environment variables cannot relabel a stub adapter as production-capable. After reviewed live adapters are installed, a first `Live` release still leaves the database withdrawal-execution switch paused; two different authorized administrators must request and approve its resumption.
