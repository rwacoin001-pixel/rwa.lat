# A-REIT · Current design rules

Updated: 2026-10-16. This document preserves the existing product; it is not a redesign request. Historical concept images and specifications do not override current components or later user-approved changes.

## Brand and public copy

- Use **A-REIT** and the existing folded-portal mark with its green plane. Reuse `components/rwa-logo.tsx` and `public/brand/a-reit/`; their compatibility filenames are intentional.
- Preserve the existing logo geometry, light/dark variants and green accent (`#19C7AA`). Do not restore the historical circle/axis logo or generate a replacement.
- Public application, API and admin origins are `https://a-reit.com`, `https://api.a-reit.com` and `https://admin.a-reit.com`. Confirm the actual sender configuration before making email-delivery claims.
- Platform-owned category labels use “真实资产 / Real assets”; basket labels use “资产组合 / Asset basket” and the corresponding supported translations. Internal enum keys, routes and provider fields may retain `RWA`.
- Do not rename third-party products, user content, historical transactions, signed documents or registered legal entities as a copy cleanup. Do not imply an institutional affiliation, licence, return or guarantee that has not been established.

## Follow the current page, not a single global palette

- Preserve both themes and the existing backgrounds, images, video, fonts, spacing and interaction. A documentation change is not permission to restyle a page.
- Home owns its styles in `components/screens/P04-HomeMaison.module.css`; shared Maison surfaces use `components/maison/maison.module.css`; authentication and referral surfaces have their own modules. Read the owning module and actual DOM before editing.
- Use the page's existing theme variables. Do not force every surface to pure black, ivory/navy, mint CTAs, glass or gradients. A local theme override is not a new global design rule.
- Preserve the existing font variables and language fallbacks. Use tabular numerals where the current financial components do; do not replace all typography with the old Inter/Space Grotesk prototype prescription.

## Navigation and layout

- Trace the live entry: `app/[[...rwa]]/page.tsx` → `components/rwa-app-entry.tsx` → `components/rwa-h5.tsx`, then the selected page component. `ScreenRouter`/Maison adapters and compatibility routes are active code.
- Preserve the current primary destinations **Home, Markets, Assets**, the independent AI action, and the profile entry provided by the current chrome. Do not restore the historical Home/Invest/Portfolio/Wallet four-item dock.
- Reuse the current topbar, bottom navigation and page-specific detail header. Do not introduce another dock, change its vertical anchoring, or remove the approved compacting animation as part of text edits.
- Preserve safe-area and keyboard handling, current responsive rules and horizontal/vertical scrolling. Verify 375, 390 and 430 px rather than declaring one historical fixed phone width universal.
- The existing wide-window external redirect and its exceptions are owned by `lib/desktop-redirect.ts`; do not recreate the old desktop phone-shell concept or change that policy incidentally.

## Language, density and feedback

- Support `en`, `zh-CN`, `hi`, `es`, `ar`, `fr`, `pt`; retain manual-language precedence and current locale detection. Arabic uses RTL, while amounts, identifiers and addresses retain their existing directional handling.
- Keep copy short and operational. Preserve amount units, fee bases, conditions, placeholders and disabled/error/loading semantics. Do not add decorative explanations, fake progress or example financial values to production data.
- Prefer existing controls and local disclosure patterns. Keep readable contrast, visible focus, approximately 44 px touch areas and reduced-motion support without changing layout in a copy-only task.
- Preserve existing animations and timings. Do not add continuous animation, blur, shaders or a new animation runtime without a separate scoped task.

## Delivery boundary

- Compare against the current implementation and the user-approved reference for the affected page. Old screenshots remain historical evidence, not a command to roll the product back.
- Run checks appropriate to the change. Distinguish static checks, simulated browser checks, real-device tests, source merge, push and deployment. Do not infer one from another.
- Keep other agents' changes. Start from the latest remote main in an isolated branch; obtain the user's batch-specific merge/push/deployment approval.
- Current source and publication guidance: [project and deployment reference](docs/deployment-current.md). Current/historical document navigation: [documentation index](docs/README.md).
