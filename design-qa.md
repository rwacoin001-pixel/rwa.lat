# Homepage asset card design QA — 2026-10-05

## Scope and evidence

- Baseline: `8e5733015d57ee9dab373893428e6ec3ccfe0ed6`.
- Source visual truth: `C:/Users/30396/.codex/generated_images/01a0df16-ba46-7431-9584-cc87a5d37b62/exec-7cfada50-5a36-4d30-a86e-997fe00e9e73.png` — the first displayed concept selected by the user.
- Implementation: `http://localhost:3036/dev/home-card`, using the production `HomePortfolioCard`, existing hero CSS/assets and `BottomDock`.
- Implementation capture: `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/screenshots/03-home-final-light-390x844.jpg`.
- Full comparison: `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/screenshots/03-home-concept-implementation.png`.
- Focused card comparison: `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/screenshots/03-home-card-focused-comparison.png`.
- Previous project-root QA report preserved at `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/03-previous-design-qa.md`.

## Comparison conditions

- Source: 852 × 1847 pixels. Render: 375 × 812 pixels from a 390 × 844 CSS-pixel browser viewport. Both are normalized to 390 × 844 in the comparison board; the implementation retains the browser scrollbar. This is browser emulation, not a physical device.
- State: warm/light theme, Simplified Chinese, top of the page, invested sample account, visible balance 12,680.00 USDT, available 2,680.00, three holdings. No authentication token or session is fabricated.
- The development controls and sample-data label belong only to the preview. The topbar truthfully displays Login because the local browser is unauthenticated; the reference's avatar is not reproduced with fake authentication.
- User constraints take precedence over full-page pixel cloning: preserve the current hero art and brand font; align the compact card 16px above the expanded dock; keep normal document scrolling; use the first concept's three direct cash actions.

## Required fidelity surfaces

- **Typography:** existing Instrument Serif/Geist and locale fallbacks retained. Chinese hero scale, wrapping and weight remain unchanged on regular-height phones. Short phones reduce vertical spacing and longer headline sizing to preserve the full card. The gold balance uses exact atomic formatting, a moderate weight and a 28–36px scale; small labels, counts, tabular figures, ellipsis for exceptionally large values and the full unmasked amount title were inspected.
- **Spacing/layout:** approximately 198/199/202px card heights at 375/390/430 widths; 20px corners, restrained elevation and three equal action columns. All three action targets are at least 52px high. Card-title and privacy controls are at least 44px high. Available funds and holdings share one line. The 16px card/dock gap is verified at 375×667, 390×844 and 430×932, and all seven locales on the shortest viewport.
- **Colors/tokens:** warm charcoal/champagne and cool navy/gold follow the existing theme tokens; muted currency/labels, gold balance/icons, logical separators and focus styles are retained. No alternate brand palette was introduced.
- **Assets/icons:** existing coastal day/night raster images, real RWA topbar assets and animated dock sphere are preserved. Cash/privacy controls use the existing Lucide family. No placeholder avatar, recreated logo, CSS picture or additional asset dependency was introduced.
- **Copy/content:** localized deposit/withdraw/transfer names and original account guidance remain. Missing total, available funds or holdings display an em dash, never a invented zero. Critical restricted/degraded/locked guidance remains visible. Sample numbers are labeled and confined to a development route.

## Comparison history and fixes

1. **P2 — Short-phone card could meet or overlap the dock.** The initial layout combined an inaccurate topbar subtraction with intrinsic translated headline height. Shared dock/topbar tokens and the first-screen grid fixed the origin and gap. A later 375×667 pass still found Hindi overflow and insufficient spacing for Spanish/French/Portuguese. A short-height-only spacing/headline rule corrected these cases. Revised evidence: `03-home-final-hi-375x667.jpg`, `03-home-final-light-375x667.jpg`, and the seven-locale geometry in `03-home-final-checks.json`; each now measures a 16px gap.
2. **P2 — An expanded holdings click target could overlap a locked-order CTA.** Independent code review caught the overlap. Holdings are now plain text; the full-size asset-title button provides portfolio access. Locked account guidance keeps its separate View orders button. Button rectangles are saved in `03-home-final-checks.json`.
3. **P2 — The asset-title accessible name differed from its visible text.** Removed the overriding aria label. Its accessible name now comes from the localized visible title.
4. **P3 — Mock and rendered optical weight/layout differ slightly.** The implementation uses the actual app font, a lighter balance weight, right-aligned holdings and the original hero crop. These are accepted adaptations for the user's requested compact card and preserved hero, not unresolved functional mismatches.

## Interactions and verification

- Actual `/home` guest page uses the new component, keeps its Create account CTA, measures the same 16px gap and contains no homepage quick-action plus.
- Deposit, withdrawal, transfer and asset-title clicks navigate to the existing routes. In the unauthenticated local browser they lead to the existing Login screen. No financial submission or authenticated account acceptance was performed.
- Privacy hides both total and available balance and removes the full-amount title. Restoring visibility works.
- Scrolling approximately 398px moves the card upward by the same amount; the card is relative in normal flow, not fixed over subsequent content.
- Seven locales including Arabic RTL: no horizontal overflow on 375×667. Ten account fixtures: guest, email verification, KYC, unfunded, funded, restricted, missing data, locked funds, very large balance and invested account preserve their meaningful state/CTA.
- Warm and cool themes captured. Final viewport geometry and button checks saved in `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/03-home-final-checks.json`.
- Production route renders the Next not-found result and no sample content. Its streamed HTTP envelope is 200 with `NEXT_HTTP_ERROR_FALLBACK;404`, so this is not reported as a transport-level 404.
- TypeScript, scoped lint and production Next build checked. No dependency or API/database/auth/business changes.
- The final sample-preview browser tab reports no warnings or errors and renders the full card/dock. After one development build restart, an earlier tab logged a transient layout-script parse error; the generated script passed `node --check`, a normal reload rendered correctly and the final fresh tab is clean. No source change was made to disguise this local startup observation.
- Real homepage/API checks locally show the pre-existing unavailable-local-API warnings. The sample preview is independent of live account data. No claim is made that these warnings or production API availability were fixed by this layout change.

## Remaining acceptance boundaries

- Android/iOS hardware, installed-PWA safe-area insets and authenticated balances/financial operations require real-device/production acceptance after approved deployment. CSS respects the existing safe-area variables, but hardware behavior was not simulated as proof.
- No merge, push or deployment is included in this iteration; source remains on the review branch until explicit user approval.

## Implementation checklist

- [x] Use the first concept's compact balance and three direct actions.
- [x] Preserve hero imagery, font families, themes and localized account states.
- [x] Remove the home-only quick plus.
- [x] Align to the expanded dock and keep normal scrolling.
- [x] Check responsive layout, privacy, status fixtures and existing navigation.
- [x] Compare source and render together in full and focused images.
- [ ] Merge/push/deploy only after the user confirms.

final result: passed
