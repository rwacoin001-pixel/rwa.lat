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

## Current release and backup

The first migration/brand release is main 34ea63cc745fa53f96dc3195eaab581a9a6a0945.
Oracle rollback files are in /opt/rwa-lat/backups/a-reit-domain-20261010T153341Z.
The frontend Worker version before this retirement batch is
844b5572-15fa-41a1-836b-48d16da0695e.
