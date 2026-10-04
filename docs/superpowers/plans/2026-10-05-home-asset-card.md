# Homepage asset card implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the first displayed concept to the current homepage: a compact gold balance with three direct cash actions, aligned above the dock.

**Architecture:** Reuse the current hero assets, fonts, theme tokens, account resolver and cash routes. Extract the presentation-only portfolio card so production and a development-only sample preview use the same implementation. Compose hero and card in one viewport-aware first-screen grid; keep normal document scrolling.

**Tech Stack:** Existing Next.js, React, CSS Modules, Framer Motion and Lucide.

**Spec:** Selected image `C:/Users/30396/.codex/generated_images/01a0df16-ba46-7431-9584-cc87a5d37b62/exec-7cfada50-5a36-4d30-a86e-997fe00e9e73.png`; decisions in `C:/Users/30396/Desktop/rwa/artifacts/frontend-page-review-20261005/02-hero-discussion-conclusion.md`.

## Global constraints

- Baseline: 8e5733015d57ee9dab373893428e6ec3ccfe0ed6. Branch: codex/home-asset-card-20261005 in the existing linked worktree.
- Preserve hero imagery, headline typography, seven languages, themes and existing account/KYC/transaction permissions.
- Real balances only in production. Missing data remains unknown; sample data exists only on a development route and is visibly labeled.
- Three direct actions supersede the earlier funds-menu preference because the user selected the first displayed image.
- Hide the quick-action plus on home only. Other screens keep their existing cash access.
- No new dependencies. No production API, database, auth, fee or order changes.
- No merge, push or deployment until user confirmation.

## Review focus

- Short 375x667 viewport: complete card and 16px expanded-dock gap without covering the hero text.
- Tall screens and installed safe areas: align relative to the dock, rather than an absolute photo coordinate; scroll normally.
- Guest, verification, KYC, missing account data and restricted accounts: preserve truthful status and necessary CTA.
- Large balances, privacy toggle and Arabic RTL: no overflow or accidental disclosure; exact decimal formatting.
- Deposit, withdrawal and transfer: open existing guarded routes; no transaction submission during testing.

## Tasks

- [x] Record current rendered homepage, clean source state and baseline typecheck.
- [x] Extract compact card; consolidate inline financial data, privacy toggle and localized actions.
- [x] Compose first screen with shared dock height and safe-area spacing; remove homepage quick plus.
- [x] Add development-only sample preview using the production card, with state/theme/language controls.
- [x] Check types and relevant lint, render 375/390/430 widths, themes, languages and status variants; click primary controls.
- [x] Compare selected image and rendered sample together, fix material differences and save design QA.
- [x] Review scoped diff, keep preview open and ask whether to merge.

## Execution ledger

- Baseline typecheck passed before source modifications. No unrelated changes present.
- Ruling: use exact atomic formatting rather than animation starting at a fake zero in the new compact card; retain the existing hero/card entrance motion. No financial computation changes.
- Ruling: reuse supplied production raster assets and icon library; no new image generation or app scaffolding is needed for this scoped existing-project change.
- Ruling: visual and interaction checks cover this reversible layout change; no implementation-mirroring unit tests are added.
- Independent review caught and verified fixes for overlapping holdings/order touch targets and mismatched visible/accessible asset-title text.
- Browser checks uncovered long translated headlines on 375x667; short-height spacing and headline sizing corrected them. All seven languages and ten account states now retain the 16px gap on the shortest checked viewport.
- Evidence and known acceptance limits are recorded in project-root `design-qa.md`. Its previous report is preserved in the task artifact directory.
- Local cash and portfolio controls were clicked through to the existing unauthenticated Login guard. No transaction was submitted and no session was fabricated.
- Final production Next build passed after the short-screen CSS correction, including TypeScript and static-page generation. Scoped lint and whitespace checks passed.
- The preview stays local on port 3036. The streamed production not-found response contains no sample UI; no push or deployment occurred.
