# AI input and answer actions acceptance

Reviewed on 2026-10-04 in `E:\rwa-lat-current`, branch `feat/android-client-ai-polish-20261004`. These changes are local and unmerged. This document does not establish a production deployment or real-account/device acceptance.

## Implemented behavior

- `components/maison/AiChatScreen.tsx` and `app/ai-assistant/page.tsx` use the shared `AiComposer`, `AiAnswerActions` and `useAiVoice`. Typing, IME composition, Enter/Shift+Enter, local file review, voice draft input, send and stop are available. Stop ends the client's wait; the synchronous server can still complete and save its answer.
- Clarification responses show their question titles/cards and hide the preliminary reply, citations and answer actions. This applies to new responses and restored history. Selection/custom input remains available after a failed send. Questions and file excerpts do not grant account, trading or fund permissions.
- Answer actions support speech synthesis, clipboard copy, helpful/unhelpful feedback and native share with copy fallback. Feedback uses the signed-in owner's backend message when available; guest feedback is local. Only the answer that owns playback can cancel it during unmount.
- Browser speech callbacks belong to one recognition run. Cancellation, timeout and unmount discard late browser results. One microphone owner is active at a time; browser/native denial, empty recognition and unsupported environments produce recoverable status. Recognized words become a draft and are never sent automatically.

## File and account boundaries

Binary files are parsed on the device. `/v1/ai/chat` receives only `{ name, mime, size, text, method }` excerpts alongside the message. There is no file-upload endpoint, file URL, object-storage reference or model vision input in this feature. The excerpt is visible before sending; OCR provides recognized text, not scene/diagram understanding.

| Limit | Enforcement |
| --- | --- |
| Files | At most 3, each 8 MiB |
| Extracted text | 12,000 characters per file; 24,000 total |
| Message | 4,000 characters |
| Provider conversation history | 64,000 serialized-content characters, newest contiguous turns retained |
| PDF | 20 pages; image-only/scanned PDFs without text produce an empty-file error |
| OCR image | 16,000,000 pixels |
| DOCX ZIP | At most 512 entries and 16 MiB expanded data; encrypted, ZIP64, multi-disk and unsupported compression rejected |
| File processing | 120-second frontend abort deadline; parsers check cancellation and release workers/readers |
| Model generation | 90-second backend deadline; 95-second client timeout |

DOCX checks both declared ZIP sizes and actual streamed inflation before Mammoth collects document text. A forged small declared size is rejected during the preflight. Deflate DOCX requires `DecompressionStream('deflate-raw')`; unsupported environments fail visibly instead of bypassing the bound.

Server validation runs before session/message persistence or model access. It rejects unknown attachment fields, paths/control characters in names, unsupported MIME/method combinations, empty excerpts, invalid sizes and over-budget text. A separate check catches JSON escape expansion that would otherwise push the current request beyond the history budget.

Private-key-shaped hex and runs of 12 English BIP39 words are blocked in the composer/parser and again on the server, including attachment names/text. This is a heuristic guard: other languages and deliberately disguised secrets are not claimed to be comprehensively detected. Ordinary English investment questions remain usable.

Authenticated session history, deletion and feedback resolve the requested owner before reading or mutating message data. Continuing a session owned by another authenticated user is rejected before retrieval/provider access. Guest chat has no account-data scope; account snapshots require an authenticated user and explicitly selected `balances`, `positions`, `orders` or `qualification`, with server queries scoped to that user's ID. Guest conversation UUIDs permit continuation and can be attached to a signed-in account; authenticated history listing/reading still requires the owner.

File excerpts are persisted inside their conversation's user message and restored only through that conversation. Provider replay labels them untrusted data and explicitly excludes permission, platform-fact, identity and account-record authority. The current login/session change resets the visible conversation, aborts the client wait and remounts file/voice state; an old response is not added to a new UI session.

## Open-source readers

Installed packages were checked locally:

| Reader | Version | License |
| --- | --- | --- |
| Tesseract.js | 7.0.0 | Apache-2.0 |
| PDF.js (`pdfjs-dist`) | 6.3.289 | Apache-2.0 |
| Mammoth | 1.13.0 | BSD-2-Clause |

OCR and PDF workers, Tesseract cores and seven language assets are served from `public/ai-ocr`. OCR does not depend on a third-party runtime CDN. `scripts/prepare-ai-reader-assets.mjs` records pinned language-package sources, integrity values and hashes in `public/ai-ocr/assets.json`; PDF/Tesseract license files are copied alongside their assets. Reader libraries load only when that file type is selected.

## Verification evidence

Run from the repository root:

```powershell
node --experimental-strip-types --test scripts/ai-input.test.mjs scripts/ai-voice.test.mjs scripts/ai-interaction.test.mjs scripts/frontend-refresh-and-ai.test.mjs
```

Result: **20/20 passed**. The AI-specific suites contain 5 file-policy tests, 7 voice lifecycle tests and 2 interaction tests; the existing refresh/secret suite contains 6 tests. The tests execute the actual TypeScript component/hook bodies with controlled browser/React substitutes. They do not constitute real microphone or audio-output tests.

Covered event sequences include browser denial followed by a new recognition with old callbacks arriving late, recognition timeout/abort, final-only native text, bridge injection after mount, transfer of microphone ownership, Android denial/no-match categorization, TTS ownership switching and old-card unmount, stopped support-page requests followed by a late success and retry, component unmount during chat, and preliminary-answer hiding in current/restored support-page cards. File tests cover extension/MIME spoofing, text budgets and dishonest DOCX expansion.

Backend regressions in `apps/api/test/ai/ai-chat-grounding.spec.ts` cover extracted-text persistence/replay, pre-storage attachment rejection, serialized expansion rejection, private-key/mnemonic input rejection, owner history isolation, owner feedback isolation, provider failure cleanup and persisted/restored question cards.

Coordinated final verification:

- Frontend production TypeScript and API `tsc --noEmit`: passed. Fixed the browser copy timer's ref type after the first typecheck found the Node/DOM timer mismatch.
- API attachment/chat-grounding/model/status/grounding suites: **41/41 passed**, five suites, run in band.
- Main `/ai` page in the actual local Cloudflare Worker: question-first interaction, send visibility, TTS handler, authenticated feedback request, simulated voice transcript and failed-send file/draft retry all passed. API responses were intercepted; this was not a live model/account test.
- Actual PDF, DOCX and image OCR extraction passed in both development and local Cloudflare production `/ai-assistant`. The reviewed text `RWA Reader Test: balance 200 USDT.` reached the intercepted API as pdf/docx/ocr excerpts; workers and English OCR data loaded locally. No binary was uploaded.
- All seven UI languages at 320px passed RTL, horizontal overflow, send-button bounds and simulated visualViewport keyboard checks. Startup canvas rendered in the warm theme; fresh installed-session/reduced-motion/public-route logic passed the startup test.
- User frontend Cloudflare bundle, API, Admin API and admin frontend: **all four production builds passed**. Runtime dev fixture did not render in the production bundle.

Evidence is under `C:\Users\30396\Desktop\rwa\artifacts\mobile-polish-20261004`, including `production/ui-acceptance.json`, `production/ai-reader-acceptance.json`, `layout-acceptance.json`, screenshots and capture results.

## Remaining acceptance

- Verify live multi-turn model replies, real owner history and feedback against a database-backed API. Mock provider outputs and service repository doubles do not prove provider stability or production persistence.
- Verify microphone permission, recognized text, final-result timing, native share/clipboard and audible TTS on target devices. The existing Android native event protocol has no recording/session ID; rapid native stop/restart or switching inputs needs true-device acceptance for late-event isolation. APK rebuilding/testing is outside the user's current website-focused request.
- Merge and website/API deployment remain subject to the user's confirmation. The existing trial APK loads the deployed website, so local branch changes are not delivered by handing over that APK alone.
