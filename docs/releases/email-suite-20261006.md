> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](../deployment-current.md)，界面设计以[当前设计规则](../../DESIGN.md)为准。

# Branded email suite release — 2026-10-06

The user approved aligning with the live application, then pushing and deploying the email changes.
At verification, the active API used revision `e7287d9f1959a29443812ca7fbc596b820545f4a`, image
`sha256:ece787b171b952f485b048a49c04a63905898af031d74d78166ea2d37f119594`.
Cloudflare served version `db9f8032-b8a4-480d-908b-e98aa228d8b9`.

## Scope

- 35 template definitions in seven languages (245 HTML/TXT pairs), copied from the approved independent design package.
- Eight existing identity mail types: registration/login codes, password-reset code, email-binding/change codes,
  verification link, passwordless login link, recovery link.
- Codes and links use their persisted challenge/flow expiry; resends retain the original expiry.
- The renderer validates template names, required fields, six-digit codes and HTTPS app links, escapes HTML,
  and supplies fixed brand assets/support URLs. Plain text uses the same event values.
- Four PNG/JPG assets are bundled in the API and served through the existing read-only media endpoint at
  `/v1/media/email-v1/`. No external image vendor or new runtime dependency is introduced.
- Demo outbox, current Google/GitHub/wallet sign-in, email linking, session rules, queues and SMTP/Resend transports remain intact.

## Unconnected events

The other 27 scenario templates are packaged resources, not newly activated notification triggers.
Funds, orders, settlement, KYC, security events and marketing subscriptions require their own authoritative
event/recipient wiring and acceptance. No database migration, fund operation or marketing opt-in change is part of this release.

## Isolation and deployment

Other AI tools have uncommitted frontend/API changes in the current worktree. Stage only the email renderer,
five existing implementation files, three email test files, versioned assets and this document.
Publish a layer over the immutable active API image containing only the explicit email file allowlist.
Compare every other existing runtime file before switching. Recheck active image, production config and Compose hashes
immediately before activation, abort on concurrent change, preserve the old image and Compose for rollback.
Do not publish a rebuilt frontend or restart Admin, PDF or the community bot for this email release.

## Verification

Run rendering/security/media tests and current identity unit regressions, build the API into a separate artifact directory,
then validate the candidate image with production configuration without sending mail. Before switching, start a temporary
API on an isolated port with scheduled workers disabled. Verify health/readiness and all public images; verify all 245
templates inside the image. After switching, check public health/readiness, the image/revision, unchanged services,
unchanged frontend deployment and image hashes. A real inbox test requires a user-designated recipient.

Live evidence and exact source/image digests are saved under the independent email package's `release/` directory.
These checks do not constitute Gmail/Outlook/Apple Mail inbox, dark-mode or native-speaker acceptance.
