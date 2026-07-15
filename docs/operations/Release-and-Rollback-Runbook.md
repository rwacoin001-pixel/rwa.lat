# Release and rollback runbook

## Scope

This runbook gates code and database delivery. It does not authorize financial features, create provider credentials or replace environment-owner approval.

## Required branch gates

Protect the release branch and require these GitHub checks:

- Core API static and unit gates.
- PostgreSQL migration and integration gates.
- H5 and Admin frontend production builds.
- Dependency audit and SBOM.
- Dependency review for pull requests that change lockfiles.

The database job uses an isolated PostgreSQL 16 database whose name ends in `_test`. It applies every migration, reverts the latest migration, applies it again, then runs database suites in isolated low-memory processes.

## Environment promotion

1. Merge only after all required checks pass and the SBOM artifact is retained.
2. Build one immutable artifact for the approved commit; record commit SHA, lockfile hash, migration head and SBOM digest.
3. Deploy to staging with financial mutations disabled.
4. Run readiness, route, identity, catalog, ledger invariant and partner-degraded-state checks.
5. Obtain separate product, compliance, security and operations approval before production promotion.
6. Apply production migrations from a dedicated migration identity before application rollout. Application startup must not have schema-creation privileges.
7. Use a canary or blue/green rollout; keep the previous artifact available until post-deploy reconciliation completes.

## Rollback decision

- Application-only regression with backward-compatible schema: route traffic to the previous immutable artifact.
- Migration failure before commit: stop deployment and let the migration transaction roll back.
- Migration applied but application unhealthy: disable financial mutations, keep read-only access, and assess whether the reviewed `down` migration is data-safe.
- Any ledger, order, settlement or reconciliation invariant failure: activate the financial kill switch, preserve evidence, stop asynchronous consumers and page operations/security owners.

Never run an unreviewed destructive rollback on a production database. Forward-fix is preferred once a migration has transformed or deleted data. Restore from backup only under the approved disaster-recovery procedure and with reconciliation evidence.

## External configuration still required

- GitHub branch protection and environment approval rules.
- Hosting provider, registry, workload identity/IAM and deployment credentials.
- Production PostgreSQL migration identity, TLS policy, backup point and maintenance window.
- Alert recipients, incident owner and financial kill-switch operator.
