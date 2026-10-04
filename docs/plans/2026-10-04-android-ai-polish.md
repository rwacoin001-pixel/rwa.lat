# Android trial client and mobile experience polish

Goal: deliver an installable Android trial APK and reviewable mobile improvements against the current deployed source, preserving authentication, financial, location and KYC requirements.

Architecture: keep the current Next.js/API application as the source of business behavior. Use maintained open-source native/browser components where suitable. Never expose model credentials in the client or make cosmetic changes imply successful KYC. Android authentication must use a supported external browser flow; label untested device features honestly.

Design: retain RWA's existing warm/midnight themes and brand. Animate the existing logo during installed-app startup, for a bounded duration independent of account requests. Safe areas are applied once. Camera screens use a full-screen viewfinder and small controls. AI composer expands smoothly in place; question choices precede an answer.

Ownership:
- Android agent: apps/android-client and its build documentation/artifacts. Native trial, permissions, secure navigation, build/signing. No root package or layout edits.
- Capture agent: TransferScanner, KycCapture, capture CSS/copy and other camera capture entry points. Reuse scanner implementation and preserve submitted document validation.
- AI agent: AiChatScreen, AI assistant entry, AI question/answer/composer modules, copy and scoped API support. Attachments must actually reach supported processing; no fake recognition. No root package/layout edits.
- Root: startup animation, shared iOS chrome geometry, dependency/lockfile changes, integration, previews and acceptance.

Acceptance:
- Baseline and final typechecks, production build, focused regressions and visual screenshots.
- Scanner camera/file path, invalid QR and denied camera; KYC capture/review/retry without approving identity.
- AI choice-first state, retries, draft retention, composer idle/focus/text, voice and attachment errors, actions.
- Installed-app startup bounded/reduced-motion behavior; desktop remains public; safe-area geometry and narrow-screen layouts.
- APK built and signed, package metadata/hash recorded. Device-only behavior remains explicitly pending real phone checks.
- Review concrete diff and artifacts before requesting user confirmation to merge and deploy.

Progress:
- [x] Canonical deployed main verified; clean existing worktree reused.
- [x] Baseline TypeScript check passed.
- [x] Open-source research and implementation.
- [x] Integration: 21 frontend regressions, 41 API regressions, actual browser extraction/interaction, capture, seven-locale/narrow-screen checks and all four production builds passed.
- [x] Signed trial APK and visual artifacts created. User requested that further Android acceptance not hold up the website; physical-device verification is pending.
- [ ] User-approved merge and website/API deployment.
