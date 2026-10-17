> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](../../deployment-current.md)，界面设计以[当前设计规则](../../../DESIGN.md)为准。

# Private Content Crawler Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep authenticated user content unavailable to anonymous requests and discourage compliant crawlers from indexing private pages or API responses.

**Architecture:** Preserve the public marketing and discovery pages. Emit `noindex` metadata for app routes that require a session, publish a real root-domain robots document with crawler-specific rules, and serve a separate deny-all robots document on the API host. Set private cache headers in session guards because optional-auth responses can contain user-specific fields.

**Tech Stack:** Next.js App Router metadata routes, NestJS guards/controllers, TypeScript.

**Spec:** This plan implements the user request to audit unauthenticated page/API access and add crawler rules; the source audit found private API routes already return 401, while the root-domain robots response is the app shell and the API-host response is Cloudflare-generated.

## Global Constraints

- Robots directives are crawler guidance, not access control; API session authorization remains authoritative.
- Public pages remain available for Google Search.
- No merge, push, or deployment without a separate explicit approval.
- Keep the existing uncommitted SEO copy edit in `app/layout.tsx` out of this batch.

## Review Focus

- Private `/home` and account routes must carry `noindex` while public `/invest`, legal, and discovery routes retain inherited indexability.
- Anonymous API calls to session-required endpoints must remain unauthorized.
- Optional-session public reads must not be cached because authenticated responses can include user-specific fields.
- Root-domain and API-host robots documents must be served on their own hostnames.
- User-triggered fetches may ignore robots rules; server-side authentication must still deny private data.

---

### Task 1: Protect app pages and publish site crawler rules

**Files:**
- Create: `app/robots.ts`
- Modify: `app/[[...rwa]]/page.tsx`

**Interfaces:**
- Use `resolveRoute(pathname)?.def.auth` for current route auth metadata and existing legacy route mappings for protected legacy screens.
- Next.js `Metadata` return value adds `robots: { index: false, follow: false }` only for protected app routes.

- [x] Add route metadata that marks current and legacy protected screens `noindex` while leaving public marketing/discovery routes indexable.
- [x] Add a metadata route with Googlebot allowed to observe `noindex`, Google-Extended and common AI crawlers denied private paths, and wildcard crawlers denied private paths.
- [x] Review generated paths against the route registry and legacy protected screen list.

### Task 2: Protect API crawler access and caches

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/common/robots.controller.ts`
- Modify: `apps/api/src/security/session-auth.guard.ts`
- Modify: `apps/api/src/security/optional-session-auth.guard.ts`

**Interfaces:**
- Exempt `GET /robots.txt` from the global `/v1` prefix and return `text/plain` with `User-agent: *` / `Disallow: /`.
- Set `Cache-Control: private, no-store` on authenticated and optional-session requests before their handlers run.

- [x] Add API-host crawler rules so API response URLs are not indexed.
- [x] Set private no-store headers in both session guards, including optional-auth endpoints that may enrich public payloads.
- [x] Review guard coverage and ensure unauthenticated protected routes continue to reject requests.

### Task 3: Review the resulting changes

**Files:**
- Review only the files above and the plan.

- [x] Run `git diff --check` and inspect the complete diff.
- [x] Run frontend and API TypeScript checks if installed dependencies permit; do not run a production deploy.
- [x] Record any limitation that depends on Cloudflare routing or cache configuration: Cloudflare may serve its managed API-host robots response before the Nest origin; verify the new endpoint after deployment and change Cloudflare's managed robots setting if it still overrides the origin.
