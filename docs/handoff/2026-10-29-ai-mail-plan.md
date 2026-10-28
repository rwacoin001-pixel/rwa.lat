# AI upgrade, support email and admin inbox — plan (2026-10-29)

Owner decisions (2026-10-29): support address = **support@a-reit.com**; a-reit.com mail moves to **Cloudflare Email Routing, into the admin inbox only** (no personal copy); the **user AI reads only the signed-in user's data + public data**; a separate **admin "data AI" may query the whole database read-only**; the admin inbox **can reply**.

Roles: Claude plans, owns UX/copy, reviews diffs; Codex writes the code. Production AI = DeepSeek `deepseek-flash`, OpenAI-style API (`apps/api/src/ai/ai-model.client.ts`).

## Root cause of the "考拉量化 is not official" answer
1. Retrieval never reads quant tables; the knowledge base has no quant article.
2. The AI navigation catalog lacks `/quant`.
3. "Explain this notice" (`components/maison/AiNoticeTray.tsx`) sends only title/body — no notification id, kind or payload — so the model cannot verify it.
4. The prompt let the model treat *missing evidence* as *evidence of fraud*.

## Stream A — user AI (branch `feat/ai-tools`)
A1. **Tool calling** (OpenAI `tools` + Anthropic `tool_use`, max 4 rounds, 8 calls per turn). Every tool is read-only, takes the user id from the session (never from the model), returns minimal projections, amounts as strings with units. Tools:
- `get_account_overview` (status, verification, risk band)
- `get_balances`, `list_transactions(limit, cursor, kind)`
- `list_deposits`, `list_withdrawals`, `get_withdrawal(id)`
- `list_orders`, `list_positions`
- `get_quant_position(slug)`, `list_quant_payouts(slug, limit)`, `list_quant_orders(limit)`
- `list_prediction_bets(limit, status)`, `get_prediction_bet(id)`
- `get_referral_summary`, `list_referral_rewards(limit)`
- `list_notifications(limit, unread)`, `get_notification(id)`
- `list_support_tickets`, `get_support_ticket(id)`
- Public: `list_products`, `get_quant_product(slug)` (rules, fees, performance as published), `list_prediction_markets(query)`, `get_fees`, `get_official_channels`

Guests get public tools only.
A2. **Notice provenance**: "Explain" sends `notificationId`; the server loads the notice (must belong to the user) and passes kind, payload and created time as a trusted system note. Quant notices are cross-checked with `quant_payouts` / `quant_orders`.
A3. **Policy**: "Absence of a record is not evidence of fraud. If a notice or product cannot be found, say you could not verify it, use the tools, and offer support — never call an in-app notice or a listed product unofficial." Product names: 考拉量化 = Koala Quant, an official A-REIT product. Never say "DeepSeek" to users; say 大模型 / large model.
A4. **Knowledge base rebuild** (versioned, through the existing knowledge service, audit kept):
- a generator script reads the product copy in code: quant copy and strategy (QuantResearch), referral rules, prediction rules and fees, deposit and withdrawal steps and limits, trust and official channels, community rules, account and verification, the notice kinds and their meaning
- it writes zh + en articles with stable ids, then publishes them
- stale articles are archived
- retrieval is extended to quant tables
- `/quant` and every route in `lib/routes-v2.ts` with a user-facing page go into the navigation catalog
A5. **Evals**: `apps/api/test/ai-evals/` golden set (≥ 60 questions, zh + en): product facts, own-data questions (expected tool), notice explanations (incl. a quant loss), refusals (other users' data, secrets, injection in attachments/notices). Deterministic checks on tool choice + required facts; runnable offline with a stub model and live with `AI_EVAL_LIVE=1`.
A6. **Ops**: per-user AI rate limit (30 msgs / 10 min, guests 10); tool calls logged (name, latency, row count — no payload bodies); thumbs-down answers listed in admin.

## Stream B — support email + admin inbox (branch `feat/mail-inbox`)
B1. **Data migration**:
- `app.platform_configuration` draft + published: `supportEmail` → `support@a-reit.com`, and any "RWA.LAT" text → "A-REIT"
- a new version row and an audit row (actor `system:migration`)
- defaults/seeds in code and current docs follow, except historical release notes
- `rwa.lat` in the discussion-id hash stays: changing it would re-key existing threads
B2. **Inbound**: `apps/email-inbound` Cloudflare Email Worker:
- `postal-mime` parse, then POST JSON to `https://api.a-reit.com/v1/internal/inbound-email`, signed with an HMAC-SHA256 header over the raw body and a timestamp (env `INBOUND_EMAIL_SECRET`, ±5 min window)
- size cap 10 MB; attachments ≤ 5 MB each go to the API as base64; larger ones are listed but dropped
- reject only on API failure, so Cloudflare retries
B3. **API**:
- tables `mail_threads`, `mail_messages` (direction in/out, from, to, cc, subject, text, sanitized html, message-id, in-reply-to, references, spam verdict, read/archived flags), `mail_attachments` (bytea, content type, size, sha256)
- threading by References / In-Reply-To, else by normalized subject + counterpart within 30 days
- idempotent on Message-ID
- HTML is sanitized on the server (allow-list) and shown in a sandboxed iframe
B4. **Admin inbox** (`/inbox`, permission `mail.read` / `mail.reply`):
- list (unread first, search, filters: all / unread / archived)
- thread view, attachments download
- reply / reply-all from `support@a-reit.com` through `EmailDeliveryClient`; the reply is stored in the thread with proper In-Reply-To / References
- assign, archive, mark read
- an unread count in the nav
- optional "turn into support ticket"
B5. **Cloudflare** (done by Claude in the browser pane after the code is live):
- enable Email Routing on a-reit.com (replaces the Porkbun MX)
- catch-all → the worker
- verify sending DNS for support@a-reit.com with the outbound provider (SPF/DKIM/DMARC)

## Stream C — admin data AI (branch `feat/ops-ai`)
C1. **Postgres role `ai_reader`**:
- LOGIN, read-only, `default_transaction_read_only = on`, `statement_timeout = 5s`, `idle_in_transaction_session_timeout = 10s`
- SELECT only on schema `ai_ro`, which holds **views** over the business tables
- PII masked in the views: email `a***@domain`, phone last 4, names initial, addresses dropped
- no secrets, tokens, password hashes, sessions, MFA, KYC documents or wallet private data
- the connection string comes from env `AI_READER_DATABASE_URL`; the owner sets the password
C2. **API** (admin service):
- `/admin/ai/query`: the model gets `describe_schema` (views and columns with comments) and `run_sql(select-only)`
- the server parses the SQL and rejects anything but a single SELECT/WITH; it wraps it in `LIMIT 500` and runs it as `ai_reader`
- returns columns + rows + the SQL
- every question, SQL, row count and duration goes to `admin_ai_query_audit`
- permission `ai.ops.query`, MFA session required
C3. **Admin page** `/ai`:
- chat with answers that show the SQL (collapsible)
- the result table, with CSV export (audited)
- saved queries

## Things a top practitioner adds (owner did not ask)
- **Least privilege by construction**: user id bound server-side, a read-only DB role, masked views, allow-listed tools — not prompt rules.
- **Provenance over plausibility**: notices and figures are checked against the ledger before the AI explains them; answers cite the record they used.
- **Eval harness + red-team set** run before each deploy: wrong-tool, leaked data, injected instructions inside notices/emails/attachments.
- **Knowledge as code**: articles generated from the same copy the UI shows, so the AI and the app never disagree; versioned and diffable.
- **Observability**: tool-call metrics, thumbs-down review queue, query audit, rate limits.
- **Email hygiene**: HMAC-signed webhook, idempotency, HTML sanitizing, attachment caps, SPF/DKIM/DMARC before sending, no auto-reply loops (`Auto-Submitted`).
