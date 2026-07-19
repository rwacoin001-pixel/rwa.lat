# Render cardless preview deployment

This runbook deploys the API from the repository root `render.yaml` using a
Render Free web service and the existing Neon PostgreSQL database.

## Safety boundary

The free service is only for integration and acceptance testing. It can sleep,
restart, and take time to wake. Keep all real-funds switches disabled:

- `PRODUCTION_FINANCIAL_FEATURES_ENABLED=false`
- `WALLET_EXECUTION_ENABLED=false`
- `WALLET_EXECUTION_WORKER_ENABLED=false`
- `POLYMARKET_TRADING_ENABLED=false`
- `DEMO_OPERATIONS_ENABLED=false`
- `DEMO_WALLET_CREDIT_ENABLED=false`

Do not use the Render Free service for real-money production traffic.

## Create the service

1. Sign in to Render and choose **New > Blueprint**.
2. Connect `rwacoin001-pixel/rwa.lat` and select the `main` branch.
3. Render detects `/render.yaml` and proposes the `rwa-lat-api` Free web service.
4. Enter the secret values described below. Do not commit or paste them into
   chat, screenshots, tickets, or deployment logs.
5. Apply the Blueprint and wait for `/v1/health/ready` to become healthy.

The Blueprint disables automatic deployments so a reviewed commit must be
deployed deliberately.

## Required secret values

- `PRODUCTION_DATABASE_URL`: Neon pooled production connection string with TLS.
- `IDENTITY_HMAC_KEY`: an independent random 32-byte value encoded as 64 hex
  characters.
- `IDENTITY_ENC_KEY`: a different independent random 32-byte value encoded as
  64 hex characters.
- `METRICS_BEARER_TOKEN`: an independent high-entropy token of at least 32
  characters.
- `RESEND_API_KEY`: a restricted Resend key for the verified `rwa.lat` sender
  domain.

Generate identity and metrics secrets in a trusted password manager or secret
manager. Never reuse one value for another variable.

## Email delivery

Render Free blocks common outbound SMTP ports, so this deployment uses Resend's
HTTPS API. Verify `rwa.lat` in Resend, add the requested DNS records through
Cloudflare, and keep `EMAIL_FROM=no-reply@rwa.lat`. SMTP remains available for a
future host that permits it.

## Before binding `api.rwa.lat`

1. Confirm the Render-generated URL returns HTTP 200 from `/v1/health/ready`.
2. Verify email registration and password recovery end to end.
3. Confirm financial routes remain unavailable while all switches above are
   false.
4. Add `api.rwa.lat` as a Render custom domain, then create only the DNS record
   Render requests.
5. Recheck CORS from `https://rwa.lat` and `https://www.rwa.lat`.

For real-money launch, move the same reviewed image and environment contract to
an always-on paid service, configure live KYC/sanctions/custody adapters, and
complete the release and database rehearsal runbooks.
