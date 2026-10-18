> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](deployment-current.md)，界面设计以[当前设计规则](../DESIGN.md)为准。

# Delivery evidence — 2026-10-04

Source: canonical `E:\rwa-lat-current` → `E:\rwa-lat-recovery\prediction-ui-20261002`, branch `feat/android-client-ai-polish-20261004`. Its verified base and current remote main are both `d76fec11d6f65776f8983f726e58a407d316e06d`. No older checkout was substituted. No merge, deployment or database migration has occurred in this task.

Implemented: installed-app logo entrance, compact installed iOS chrome geometry, unified real scanner/KYC capture, shared AI composer and answer actions, question-first display and local file readers. The signed Android trial is available; further emulator/device work was stopped at the user's request.

Verification:

| Check | Result |
|---|---|
| Frontend regressions including startup, file limits, voice/TTS and stop | 21 passed |
| API attachment/chat/model/status/grounding regressions | 41 passed |
| API no-emit TypeScript | Passed |
| Changed frontend/capture files ESLint and tracked diff checks | Passed |
| Browser scanner/KYC | Six isolated groups passed; actual jsQR/JPEG multipart and idempotency |
| Browser AI | Question-first, send transition, feedback, playback handler, simulated voice and retry passed |
| Browser readers | Actual PDF/DOCX/OCR text reached isolated API; development and local production Cloudflare Worker |
| Narrow UI | Seven locales at 320px, RTL, overflow/button bounds and simulated keyboard passed |
| Production builds | User frontend Cloudflare, API, Admin API and admin frontend all passed |
| Cloudflare runtime | `/ai` interaction and `/ai-assistant` readers passed locally; static reader MIME/data available |
| Dev fixture | Production page renders not-found, no fixture content |

Open-source selection/attribution: `mobile-polish-oss.md`. Details and remaining real-model/real-account/real-phone acceptance: `ai-input-acceptance.md`, `capture-acceptance.md`, `android-client-trial.md`.

Artifacts: `C:\Users\30396\Desktop\rwa\artifacts\mobile-polish-20261004`. APK SHA256 `EF46545393F4CD297135828B5FF20782056C252CCC6B977224EADC23550F2A67`; signature and five Android unit tests passed, zero lint errors with three documented warnings. Installation/launch were not physically verified. At this historical 2026-10-04 checkpoint images provided text OCR. The 2026-10-05 follow-up adds actual native DeepSeek Flash scene/interface vision; see `ai-input-acceptance.md` for current evidence and deployment status. Microphone/audio/safe areas and Didit acceptance require real devices/provider. The website overlay cannot animate the OS-owned static iOS launch screen.

Next action requires the user's explicit merge confirmation, followed by pushing the approved main commit and deploying both website and API together. The current APK loads live `rwa.lat`; it does not ship this unmerged website branch by itself.

Logo revision after visual review: removed the particle renderer, gold recoloring, wordmark and decorative line. The entrance now reuses `RwaLogoMark`, the existing Anime.js 4.5 dependency and one scoped assembly/sheening timeline. The development preview repeats; production still ends within 1.83 seconds. Dark mode colors are exactly `#FFFFFF` / `#2FE6BF`; light mode preserves the existing `#0D0D0D` / `#0E8F7A` adaptation. The particle packages and their lockfile entries are removed without changing other dependency snapshots. TypeScript, scoped ESLint, startup-boundary regression, frozen offline dependency installation and actual browser no-text/color/motion checks passed for this revision. The four production builds listed above were performed before this visual revision; rebuilding the frontend is required before eventual deployment. User requested preview first and no deployment.
