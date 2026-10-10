# a-reit.com domain migration

## Scope

- Canonical site: https://a-reit.com; www.a-reit.com redirects to the root.
- Keep rwa.lat and www.rwa.lat routes and their DNS. No general old-domain redirect.
- Reuse the current API, admin services and production databases.
- Move Google/GitHub callbacks, email links, API public URLs and KYC return URL.
- X migration is deferred at the user's request. Its existing settings remain in use.
- Keep the verified Resend sender and Porkbun MX/SPF configuration.
- Users sign in again on the new origin and enroll a new passkey. Browser storage,
  installed PWAs and credentials for the old RP cannot move between domains.

## Verified baseline

- Remote main and deployed frontend source: 6fc1a2caa644f7cce25fac7e847f4e589202bc7a.
- Worker: rwa-lat; version 14d73a5a-a72a-400a-b898-1cbd06671cc5 (100%).
- API/admin source: 6eb42b2b4938e37101f98d80a1aec658b6cef9eb.
- API/admin/deploy/lockfile content is identical between those two commits.
- Oracle host: 161.118.192.220; API 4000, admin API 4100, admin frontend 3100.
- API image ID: sha256:87a878a3b028ab608b5e8f7e7f3b08b7da68d46d7d163c473979b883cf9cd4a0.
- Admin and admin frontend images remain unchanged; PDF renderer and bot are independent.
- Configuration: /opt/rwa-lat/config/*.production.env.
- Compose: /opt/rwa-lat/deploy/compose.oracle.yml; Caddy: /etc/caddy/Caddyfile.
- Cloudflare account: 993b9af3885a4400af632f04399db51e.
- a-reit.com zone: 197ccb7b3337758927b631b33e646ed8.

## Preparation and cutover

1. Build only the frontend and API from the isolated migration branch.
2. Back up private environment files, Compose and Caddy on the Oracle host with
   root-only access. Never copy secrets into Git, reports or terminal output.
3. Register exact callbacks https://a-reit.com/auth/callback/google and
   https://a-reit.com/auth/callback/github; preserve old callbacks and leave
   wildcard matching disabled. Add the new Google authorized domain and public
   app URLs where required. Do not rotate client secrets.
4. Obtain the user's concrete source release and DNS/callback confirmation.
5. Merge/push the migration branch into remote main. Publish only clean, pushed
   main through the existing release guard. Preserve all live image/session fixes.
6. Replace the root/www CNAME records with Worker custom domains. Cloudflare
   manages their DNS and certificates. Leave wildcard, mail and TXT records alone.
7. Add proxied A records for api/admin-api/admin.a-reit.com -> 161.118.192.220.
8. Add the new Caddy hosts alongside the old hosts, preserving TLS settings,
   forwarding headers and cache headers. Validate Caddy before reload.
9. API runtime: PUBLIC_APP_URL=https://a-reit.com,
   PUBLIC_API_URL=https://api.a-reit.com, PASSKEY_RP_ID=a-reit.com,
   PASSKEY_ORIGIN=https://a-reit.com, Google/GitHub redirect URIs above and
   DIDIT_CALLBACK_URL=https://a-reit.com/profile/kyc?status=complete.
   Append both new frontend origins to the existing CORS allowlist.
10. Append https://admin.a-reit.com to ADMIN_CORS_ORIGINS. Remove the single-host
    PUBLIC_ADMIN_FRONTEND_ORIGIN override from the admin frontend environment:
    the existing proxy verifies each write's Origin against the serving Host.
    This preserves same-origin enforcement on both approved admin hostnames.
11. Deploy the rebuilt API; recreate only services whose environment changed.
    Keep financial switches, credentials, migrations and database data intact.
12. Verify public DNS, HTTPS, root/www routing, frontend /v1 proxy, API/admin
    health and provider callback configuration. Actual user login, emailed tokens
    and new passkey enrollment need the user's browser/account interaction.

## Rollback

- Restore the saved private env, Compose and Caddy files; validate and reload
  Caddy, then recreate only API/admin/admin_frontend with their saved images.
- Restore Worker version 14d73a5a-a72a-400a-b898-1cbd06671cc5 if required.
- Restore root/www CNAME -> uixie.porkbun.com (DNS only) and remove only the new
  custom-domain bindings/new A records if abandoning the new domain.
- Old provider callbacks are retained. Their runtime settings can be restored
  from the private environment backup. No database rollback is required.

## References

- Cloudflare custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- GitHub callbacks: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Google client configuration: https://developers.google.com/workspace/guides/create-credentials
