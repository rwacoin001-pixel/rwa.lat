# Auth poster layout QA — 2026-10-07

Scope: selected login/register layout and mobile wallet connectivity. Existing background image/video assets and email, OAuth, passkey and registration flows are retained. The user subsequently authorized completing wallet login and deploying this batch.

Source visual truth: `C:/Users/30396/AppData/Local/Temp/codex-clipboard-aa7dba7b-d49b-4502-aed0-bc7aaf4febb3.png` (1463 × 1075, two theme panels).

Implementation: `http://localhost:3037/login` and `/register`, production Next build, in-app browser.

Evidence directory: `C:/Users/30396/Desktop/rwa/artifacts/auth-layout-advice-20261007/`.

Previous homepage QA report preserved byte-for-byte from HEAD in that directory as `previous-design-qa.md`; its source history and homepage implementation are unchanged.

- `implemented-dark-390.png`, `implemented-light-390.png`: 390 × 844 CSS / screenshot pixels.
- `implemented-dark-360.png`, `implemented-dark-360-error.png`: 360 × 640.
- `implemented-english-360.png`: English register entry, 360 × 640.
- `implemented-arabic-375.png`: RTL register entry, 375 × 812.
- `implemented-light-430.png`: light register entry, 430 × 932.

The source is a paired design board, not a specified CSS viewport. Review compares the two panels' hierarchy and relative alignment against actual mobile screenshots, retaining a responsive taller viewport and bottom-aligned controls. No device bezel or synthetic home indicator was added. Source and both implementation screenshots were opened together in one comparison input. The 390px captures resolve the mark, title, field and icon row clearly; separate close-up crops were not needed.

## Findings and comparison history

- Initial light capture: second headline and subtitle had weak contrast over the existing stone film. Changed headline accent to #795225 and subtitle to #514338 with restrained light text shadow. Recaptured light mode and compared again.
- A transient screenshot taken during concurrent local dev/build had missing CSS. Stopped the dev process, completed the production build and started a production preview. Replaced that screenshot with production-rendered evidence; it is not a product acceptance result.
- Final comparison: no actionable P0/P1/P2 layout findings in the verified states. Existing moving backgrounds have deliberately different framing from the generated reference, per the user's explicit instruction. Footer and controls fit short and long viewports; no horizontal overflow observed.

## Required fidelity surfaces

- Typography: existing brand serif / sans stacks retained; two-line title left-aligned (RTL start-aligned), concise localized subtitle. All seven locales render; English and Arabic inspected in screenshots.
- Layout: logo-only header, 24px mobile gutters, upper title separated from lower email/provider controls, 50px circular touch targets. Short-screen rules preserve visibility.
- Colors: official W's mint #2FE6BF preserved; dark navy/champagne and warm/ink treatment follow existing auth themes. Monochrome provider icons invert only in dark mode.
- Assets: existing official W geometry, Google raster, GitHub/wallet SVG assets and Lucide fingerprint reused. No background asset changes. Wallet SDK dependencies are listed below.
- Copy: reference Chinese title/subtitle, seven localized variants, icon-only visible alternatives with accessible names; legal links retained.

## Verification

- Next production build: passed, including build TypeScript.
- Full root TypeScript check: passed.
- Targeted ESLint (AuthShell, P02-Login, auth copy): passed.
- git diff --check: passed.
- Email, Google/GitHub and passkey handlers remain unchanged; fingerprint calls existing usePasskey without an email scope. Wallet connection now uses the selected AppKit provider before the existing server challenge/signature flow. Unsupported browsers disable the passkey entry with an existing localized explanation.
- Browser: login/register entry, theme switch, seven-language menu, empty-email validation, icon dimensions/accessibility and horizontal overflow checked.
- Console reviewed: pre-existing desktop GSAP warnings after desktop redirect and generic local API-unavailable warnings. No UI rendering error found in the final login captures. Actual account authentication was not completed; no credentials or verification codes submitted.
- Physical Android/iOS PWA, keyboard behavior and genuine provider/passkey authentication remain unverified; viewport simulation is not device acceptance.

## Implementation checklist

- [x] Preserve existing authentication handlers and background assets.
- [x] Apply layout to shared login/register entry only; other AuthShell uses retain their wordmark.
- [x] Four icon-only login entries; accessible names, focus states, press feedback and reduced-motion transitions.
- [x] Light/dark and mobile/language visual checks.
- [x] User approval: complete wallet login, then deploy.
- [ ] Post-deployment real-device / real-auth acceptance.

final result: passed

## Mobile wallet connectivity verification

- Reown project `2defc1dee243f5dd45ecbe0bbe5b4919`, allowlist `https://rwa.lat` and `https://www.rwa.lat` verified in the logged-in dashboard. Identifier is public; no secret was read or added.
- AppKit and Ethers adapter 1.8.24, ethers 6.16.0, lazy imports on wallet action. The SDK's Coinbase dependency requires optional x402 peers for webpack resolution; pinned 2.25.0 peers are installed, but payments, swaps, onramp, social/email and analytics features are disabled in the app configuration.
- The existing backend accepts EVM externally owned account signatures. This does not add Solana, Bitcoin or smart-contract wallet signature verification.
- Wallet provider is retained through consent, then account, chain, origin and challenge expiry are checked again before signing. No payment or transfer request is issued.
- Red/green regression: new provider tests failed against the original injected-only implementation, then passed after integration. Final wallet/email/OAuth/account client tests: 18 passed, 0 failed. Existing email test fixture updated for the already deployed device-fingerprint contract.
- Root TypeScript, targeted lint and full OpenNext Cloudflare production build passed. Lockfile audit found no version/specifier changes to pre-existing direct dependencies in any workspace; added optional-peer contexts are package-manager metadata.
- Actual 390×844 production preview: wallet selector opened with 560+ searchable wallets; OKX, MetaMask and Trust Wallet appeared. Closing the selector restored enabled login controls with a cancellation message; reopening worked.
- Evidence in `wallet/`: domain settings, connection selector, final login page. No wallet addresses, pair tokens or secrets included in evidence.
- A transient hydration error was logged during the earlier failed development compile; subsequent production reload did not log a new rendering error. Full physical Android/iOS PWA connect, wallet launch/return and successful user signature remain unverified.
