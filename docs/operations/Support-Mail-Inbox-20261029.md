# Support email and admin inbox

The support address is **support@a-reit.com**. The inbox is `/inbox` in the admin console.
Inbound mail travels through the Cloudflare Email Worker to the signed core endpoint;
admin reads and actions use the existing authenticated admin-to-core channel.
Replies are persisted with their queue entry and audit record in one transaction,
then delivered by the core `support-mail` job worker through `EmailDeliveryClient`.

## Owner rollout sequence

1. Install the workspace with pnpm and run the checks in `REPORT-B.md`. Build all
   three apps and run `pnpm --filter @rwa-lat/email-inbound build` (dry run only).
   The new worker pins postal-mime 4.1.3. Its upstream release adds bounded parsing;
   the worker supplies stricter MIME part, depth and header limits. Source:
   https://github.com/postalsys/postal-mime/tree/v4.1.3
2. Back up the platform configuration and apply the two core migrations in order:
   `1793232000000-support-email-brand.ts`, then `1793232000100-mail-inbox.ts`.
   Apply `deploy/migrations/admin-20261029-mail-permissions.sql` to the separate admin
   database. This grants `mail.read` and `mail.reply` to existing owner/admin/super_admin
   roles. The API migration grants the same permissions in the core database.
3. Configure `INBOUND_EMAIL_SECRET` identically in core API and Worker (at least 32
   characters; use secret storage). Set `INBOUND_EMAIL_API_URL` to the core signed
   endpoint. Set `MAIL_SUPPORT_FROM` to `A-REIT Support <support@a-reit.com>`.
   Preserve the existing outbound provider configuration and admin service channel.
   Set `MAIL_DELIVERY_WORKER_ENABLED` to `true` only after sender DNS is verified.
4. Deploy core API, admin API and admin frontend, then the Worker
   `a-reit-email-inbound` under the owner's Cloudflare account.
5. **B5, manual:** enable Email Routing for a-reit.com, replace the Porkbun MX as
   instructed by Cloudflare, and route catch-all to this Worker only, without a
   personal-mailbox copy. Verify the outbound provider's SPF, DKIM and DMARC.
6. Sign in again to refresh cached permissions. Send an external test mail with an
   attachment. Verify unread badge, thread references, attachment bytes, image
   consent, reply/reply-all, delivery status, archive/read and assignment to self.
   Confirm the received reply's From, In-Reply-To and References headers. Verify
   an unauthenticated webhook and a reader without `mail.reply` are rejected.

No step above has been executed against a live system by this implementation task.

## Operation and limits

- Incoming raw MIME is capped at 10 MiB; attachments above 5 MiB are listed without
  storing bytes. Auto-Submitted messages other than `no` are skipped. These policy
  drops do not send an automatic reply. API non-2xx responses throw for delivery retry.
- At most 100 attachments/addresses/references are retained. Text and HTML are each
  capped at 2 Mi characters. HTML uses a small server allow-list; the opaque sandbox
  iframe forbids active content and remote images until the reader selects 加载图片.
  Unsupported HTML formatting is intentionally reduced; plain text remains available.
- List pages hold 50 conversations. Message pages hold at most 10 messages and a
  bounded body budget; one large message can occupy its own page. Use 更早邮件 to read
  older pages. Unread status is shared by administrators, and read changes are explicit.
- Assignment supports assigning to the current session administrator or unassigning.
  Reply-all excludes every a-reit.com address because all of them route to this inbox.
  Replies target the latest inbound sender; Reply-To overrides are not implemented.
- Resend receives a stable idempotency key. SMTP cannot guarantee exactly-once
  delivery if a process crashes after provider acceptance and before persistence.
  Intents older than 23 hours fail closed; inspect the job queue before manual retry.
  Failed jobs appear as failed delivery in the thread. Keep bodies/attachments out of logs.
- There is no attachment malware scanner, retention cleanup, ticket conversion or
  rich-text/outbound-attachment composer in this stream. Downloads are forced binary.
- Reverting the mail schema deletes inbox data. The branding down migration restores
  the saved prior configuration, including its independent draft, publication and
  revisions, and removes this migration's version/audit entries. Back up before rollback.
  Historical release notes and the prediction discussion-id hash remain untouched.

The root `pnpm-lock.yaml` is authoritative. The postal-mime package resolution uses
its explicit versioned npm tarball URL; the package could not be downloaded in the
restricted implementation environment. Refresh and verify its registry integrity
metadata with pnpm in the owner's network-enabled release environment before release.
