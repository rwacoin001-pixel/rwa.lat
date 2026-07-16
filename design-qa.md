# Authentication, brand motion, and PWA icon design QA

- Visual source screenshots supplied by the user:
  - `D:\360MoveData\Users\Administrator\Desktop\rwa.lat\assets\generated\screens-v1\02-sign-in.png`
  - `D:\360MoveData\Users\Administrator\Desktop\rwa.lat\assets\generated\screens-v1\03-kyc.png`
- Current-product source captures: `design-audit/auth-2026-07-17/01-home-before.png` through `07-welcome-before.png`.
- Implementation captures: `design-audit/auth-2026-07-17/08-home-after.png` through `14-verify-email-after-refined.png`.
- Generated production asset: `public/media/generated/auth/verify-email-metal-envelope-v1.webp`.
- PWA icon set: `public/icons/rwa-pwa-v2-192.png`, `rwa-pwa-v2-512.png`, `rwa-pwa-v2-maskable-512.png`, and `rwa-pwa-v2-apple-180.png`.
- Browser viewport: 1265 x 712 for home, KYC, verify-email, and register comparisons; 1280 x 720 for welcome. The existing mobile shell renders at approximately 430 px wide.
- State: Simplified Chinese, local production build, equivalent route and scroll state inside each before/after pair.

## Full-view comparison evidence

- KYC: `design-audit/auth-2026-07-17/comparisons/kyc-before-after.png`
- Verify email: `design-audit/auth-2026-07-17/comparisons/verify-email-before-after.png`
- Register: `design-audit/auth-2026-07-17/comparisons/register-before-after.png`
- Welcome: `design-audit/auth-2026-07-17/comparisons/welcome-before-after.png`

The comparison images place the source capture and the implementation capture in one side-by-side image at the same viewport. KYC and verify-email now keep the center of their headers clear. The generated metallic mail asset has no visible rectangular matte and preserves the dark mint-lit product language. Register retains the supplied luminous semicircle, but the smaller brand and lower content origin create more breathing room. Welcome retains its product composition while reducing the center mark.

## Focused comparison evidence

- Home top bar: `design-audit/auth-2026-07-17/comparisons/home-logo-before-after.png`

The focused crop confirms that the home mark changed from approximately 104 px to 70 px without changing the source artwork or the action controls. The motion remains restrained: the production SVG receives a shallow 3D float, aura pulse, and occasional light sweep, with a reduced-motion fallback.

## Comparison history

1. **P1 — Brand marks competed with task content on KYC and verify-email.**
   - Before: a centered logo occupied the header between Back and Language controls.
   - Fix: used the existing header layout with a center spacer on those two routes.
   - After: both task titles begin sooner and the two action controls remain balanced.

2. **P1 — Verify-email used a flat line icon instead of the requested realistic asset.**
   - Before: a CSS glass tile, line envelope, and orbit rings.
   - Fix: generated a brushed titanium/chrome envelope with restrained mint reflections, optimized it to a 768 px WebP, and feathered only the dark outer matte at placement time.
   - After: the icon reads as a physical, high-resolution metal object without a visible image rectangle.

3. **P2 — Register header and form felt vertically crowded.**
   - Before: the mark, wordmark, title, subtitle, and first field started too close together.
   - Fix: moved the arc down 26 px, moved the brand stack down 23 px, increased title spacing, reduced the mark, and expanded the scrollable minimum height from 930 px to 990 px.
   - After: the title and first field are lower, gaps are more consistent, and no controls overlap or clip.

4. **P2 — Home and welcome marks were oversized.**
   - Fix: the home top-bar mark is 70 px and the welcome/register mark-only variant is 108 px (104 px on narrow screens). Motion was added only to the home instance.

5. **P1 — Installed desktop PWA could retain the previous icon.**
   - Before: the manifest exposed only an SVG and a 180 px image under stable old URLs.
   - Fix: added explicit versioned 192 px, 512 px, 512 px maskable, and 180 px Apple assets; added a stable manifest `id`; set `updateViaCache: none`; call `registration.update()`; and bumped the offline cache to `rwa-lat-offline-v4`.
   - Validation: every versioned asset returns HTTP 200, the manifest exposes all four icon declarations, and `public/sw.js` passes Node syntax validation.

## Required fidelity surfaces

- **Typography and copy:** existing localized copy, hierarchy, weights, and line wrapping are unchanged.
- **Spacing and layout:** no overlap, accidental crop, or broken mobile-shell alignment remains in the compared states.
- **Colors and tokens:** white, graphite, and `#2FE6BF` remain the only brand accents; the mail asset uses the same restrained mint reflection.
- **Asset fidelity:** the supplied RWA mark SVG remains the visible source; no substitute logo drawing or placeholder was introduced.
- **Responsiveness:** narrow-screen mark sizing and reduced-motion behavior are present. The taller register screen scrolls instead of compressing controls.
- **Accessibility:** decorative images use empty alt text, task controls retain labels, focus-visible styling is preserved, and form errors remain announced.

## Interaction and build checks

- Empty register submission announces `请输入有效的邮箱地址。` and moves focus to the email field.
- Verify-email code `000000` announces the expired-code state after submission.
- Home motion and register arc animation were sampled at two points and produced different transforms/clip paths.
- Low-memory production build completed successfully with one worker and a 1024 MB heap.
- Direct TypeScript validation still reports the repository's existing API-client/product-model errors in `lib/api-client.ts` and `lib/h5-data.ts`; none are in the changed files and the configured production build intentionally skips those existing errors.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains for the requested scope.
- P3: the register arc can appear faint at the beginning of its animation cycle; the later sampled phase reaches 0.82 opacity and the left-to-right sweep remains clearly visible.

final result: passed
