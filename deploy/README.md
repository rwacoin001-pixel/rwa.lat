# Production deployment assets

- `Dockerfile.api`: Core API production image and readiness health check.
- `Dockerfile.admin`: Admin API production image and health check.
- `compose.production.yml`: hardened, resource-bounded Core/Admin services plus one-shot migration service.
- `production.env.example`: variable names and safe locked-mode defaults; never commit the populated `production.env`.
- `release-production.ps1`: serial low-memory `Locked`/`Live` release workflow.

Use the Chinese runbook at `docs/operations/Financial-Production-Deployment.md`. The current repository contains only stub KYC/sanctions/custody implementations, so the only currently authorized mode is `Locked`.

`Live` also runs a compiled capability preflight before migrations. Environment variables cannot relabel a stub adapter as production-capable. After reviewed live adapters are installed, a first `Live` release still leaves the database withdrawal-execution switch paused; two different authorized administrators must request and approve its resumption.
