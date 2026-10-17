> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](../deployment-current.md)，界面设计以[当前设计规则](../../DESIGN.md)为准。

# A-REIT only public domain

The user superseded the earlier compatibility plan: retire rwa.lat and use only
a-reit.com for the public application, admin console and outgoing email.

## Source changes

- Remove the old frontend Worker routes and workers.dev entry point.
- Serve only api.a-reit.com, admin-api.a-reit.com and admin.a-reit.com in Caddy.
- Limit production CORS, navigation links, transfer links and email links to
  the new domain; retain local preview behavior where already supported.
- Replace email subjects, all seven locales of email templates, the email logo,
  AI assistant identity, document template brand and admin presentation with A-REIT.
- Set the new email sender and passkey name in the example configuration, and
  remove the duplicate legacy passkey name. X remains disabled until registered
  with its new-domain callback.
- Point the scheduled service health checks at the new API and admin domains.

## Release sequence

1. Complete the new domain's Resend verification and support email routing.
2. Obtain the required per-batch source merge confirmation.
3. Merge and push, check the clean main release guard, then publish the frontend,
   API, admin and admin frontend images from that exact revision.
4. Set the live CORS lists to the new domain, disable unused X login, switch both
   API/admin senders to no-reply@a-reit.com and reload the new-only Caddy aliases.
5. Remove old Google/GitHub callback entries and Google authorized domain entries.
6. Confirm new-domain public HTTPS and healthy runtime containers.

## Provider configuration completed before release

- Google authorized domains and callback contain only a-reit.com. The new
  A-REIT name, logo and links have been verified and published by Google.
- GitHub contains only the a-reit.com callback, with the A-REIT name and logo.
- Resend verified a-reit.com in Tokyo using DKIM TXT and two sending CNAMEs.
  The existing sending-only API key already covers all domains; no credential
  replacement is needed. Both CNAMEs are DNS-only in Cloudflare.
- support@a-reit.com forwards to the existing project owner's Gmail account.
  This is a saved routing configuration; message delivery was not tested.
- Disable Resend sending for rwa.lat only after the live sender is switched.

## Build evidence

Frontend OpenNext, API Nest and admin Nest builds completed successfully.
Admin frontend compiled successfully with Next.js Webpack; its Turbopack build
cannot resolve the borrowed dependency junction outside the workspace root.
No automated tests were run. Production builds and runtime readiness checks
are distinct from user login, passkey enrollment and email delivery checks.

Historical document snapshots, accounts, credentials, package names, database
migrations, repository paths and stable business identifiers are retained.
Existing operational company settings must be reviewed separately; no historical
legal entity or account email is automatically rewritten.

## Additional customer support and backend scope

The live read-only audit found nine current records requiring migration:

- Two published support knowledge rules still introduce the old brand.
- Platform description and supportEmail still reference RWA.LAT/support@rwa.lat.
- Document company contact/website and the current agreement introduction use the old domain/brand.
- Two official community profiles have old display names/bios.
- Both current terms and privacy publications include the old website and support address.

`scripts/migrate-a-reit-current-content.cjs` prepares a read-only plan by default.
The reviewed plan is held privately on the server at
`/opt/rwa-lat/backups/a-reit-content-plan-20261010T181203Z/current-content-plan.json`.
Its hash is `e6d66e93b9bcd004848c301166868c25d7b91ee13fe67c9afc367f92807d67d7`.
It has not been applied. The apply command requires this exact plan hash and the
merged source revision; all rows are locked and compared with the reviewed
snapshot. A changed row, new matching record, or unrelated unpublished edit
requires a new plan. Current published content gets a new version, and each
change receives a service audit event. No administrator is impersonated.
Registered corporate details, historical publications, generated documents,
customer emails, official handles and discussion UUID namespaces remain intact.

Additional source changes update the operations CLI, Render configuration,
community API launcher, local admin labels, offline page, legacy logo aliases,
and demo preview address. The Android trial source now uses the new home,
login, trusted origin, download API, label and approved icon; its existing
package, signing identity and native bridge identifiers remain intact.
No Android APK has been built or installed for this batch.
Existing navigation, wallet-message and Android URL policy fixtures were aligned
with the new brand/domain. No tests were added or run.
The official community persona's escalation contact uses the already configured
support@a-reit.com forwarding address.

The live community-bot container still has `COMMUNITY_API=https://api.rwa.lat`.
The release helper backs up its private env file, switches only this address,
and restarts that service with the same image and state mount. The admin API's
`PUBLIC_ADMIN_API_URL` also requires its new-domain value.
The reviewed runtime helper is `deploy/apply-a-reit-only-20261011.py`; it
checks all three image revision labels, validates Caddy, takes private backups,
and restores the previous files and containers if readiness checks fail.

After release, re-run the read-only current-content audit and inspect the new
public legal endpoints, support references, official profile presentation and
whitelisted runtime domain fields. Old historical versions are expected to
retain the original text.

## Current release and backup

The first migration/brand release is main 34ea63cc745fa53f96dc3195eaab581a9a6a0945.
Oracle rollback files are in /opt/rwa-lat/backups/a-reit-domain-20261010T153341Z.
The frontend Worker version before this retirement batch is
844b5572-15fa-41a1-836b-48d16da0695e.
