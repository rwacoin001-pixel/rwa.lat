# RWA.LAT Admin API

The Admin API is a separate NestJS boundary for privileged operations. Every route is protected by the global administrator session guard except `POST /v1/admin/auth/login`, which is explicitly public and separately rate limited.

## Low-memory verification

- `npm run lint` performs the TypeScript check.
- `npm run test:unit:low-memory` runs the database-free route and edge-security suites in one serial Jest process capped at 768MB.
- `npm run build:low-memory` runs the Nest production build with a 768MB heap cap.
- `npm test` includes PostgreSQL integration coverage and requires a real isolated test database.

## Production requirements

The complete database, domain/proxy, Secret Manager, provider and GitHub rehearsal procedure is documented in `docs/Production-External-Setup-Guide.md`.

Set `APP_ENV=production` and provide all of the following through the deployment platform:

- `ADMIN_DATABASE_URL`: a PostgreSQL URL whose database name ends in `_production`.
- `ADMIN_CORS_ORIGINS`: exact, non-local HTTPS Admin Frontend origins only.
- `PUBLIC_ADMIN_API_URL`: the externally visible HTTPS Admin API URL.
- `TRUST_PROXY_HOPS`: the exact reverse-proxy hop count from 0 to 10.
- `ADMIN_MFA_REQUIRED=true`.
- `ADMIN_MFA_ENCRYPTION_KEY`: a non-placeholder, 32-byte base64 key stored in Secret Manager.

Production login fails closed when the administrator does not have an enabled TOTP factor or cannot pass it. Login is limited to five attempts/minute/IP in addition to database account lockout; all Admin requests have a 300 requests/minute/IP in-process ceiling. Multi-replica deployments must also enforce a shared gateway or Redis limit.

Sensitive read endpoints also require method-level permissions on every request: `/v1/admin/users` requires `users.read`, while redemption list/stat/detail routes require `redemptions.read`. A valid administrator session without the named permission receives HTTP 403; permissions are reloaded during session authentication so revocation takes effect without another login.
