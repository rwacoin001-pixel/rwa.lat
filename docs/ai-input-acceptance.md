> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](deployment-current.md)，界面设计以[当前设计规则](../DESIGN.md)为准。

# AI input and answer actions acceptance

Updated on 2026-10-05 in `E:\rwa-lat-worktrees\prediction-order-polish-20261004`, branch `codex/mobile-followup-20261004`. The additions below are local and unmerged. This document does not establish a production deployment or real-account/device acceptance.

## Implemented behavior

- `components/maison/AiChatScreen.tsx` and `app/ai-assistant/page.tsx` use the shared `AiComposer`, `AiAnswerActions` and `useAiVoice`. Typing, IME composition, Enter/Shift+Enter, local file review, voice draft input, send and stop are available. Stop ends the client's wait; the synchronous server can still complete and save its answer.
- Clarification responses show their question titles/cards and hide the preliminary reply, citations and answer actions. This applies to new responses and restored history. Selection/custom input remains available after a failed send. Questions and file excerpts do not grant account, trading or fund permissions.
- Answer actions support speech synthesis, clipboard copy, helpful/unhelpful feedback and native share with copy fallback. Feedback uses the signed-in owner's backend message when available; guest feedback is local. Only the answer that owns playback can cancel it during unmount.
- Browser speech callbacks belong to one recognition run. Cancellation, timeout and unmount discard late browser results. Hold mode keeps words private until release; release submits the final transcript, while sliding upward cancels. Voice input in question cards still fills a draft. One microphone owner is active at a time; browser/native denial, empty recognition and unsupported environments produce recoverable status.
- Empty input shows one common question as a sliding subtitle above the composer, rotating every 5.2 seconds. Focus/hover pauses rotation, hidden pages do not advance, and reduced-motion mode stays static. Tapping fills the draft and never submits a question.
- Holding voice shows rounded WaveSurfer microphone bars above the input with no enclosing card. It monitors microphone input without saving/uploading audio. Cancel changes the color, and release/cancel/unmount closes the renderer and microphone. Permission failures use a static fallback rather than invented sound. Android native speech does not currently provide amplitude data to the web layer.

## File and account boundaries

PDF/DOCX/text documents are parsed on the device; only their bounded excerpts are sent. Images are decoded, resized and re-encoded as JPEG locally, stripping metadata. The user can review/remove the thumbnail before explicitly sending the message. `/v1/ai/chat` then receives bounded JPEG data URLs and dimensions, and the configured native DeepSeek Flash receives actual image content blocks. Pictures with no text are supported, including scenes, controls, selected states and error messages. No separate upload endpoint, remote file URL or object-storage reference is introduced.

Only chat accepts a 2 MB JSON body; other API routes retain a 100 KB JSON limit and normal JSON parsing. Unsupported image providers reject before creating conversation rows. Image binaries are transient and never stored in chat/database rows; metadata remains in the owner's conversation. Historical image metadata is never presented to the model as visible pixels. A later question requiring the same image needs a new attachment.

Opening AI from an app page supplies only its registered page key and a known Markets tab, with server-owned page labels and routes. Raw URLs, route IDs, query parameters, balances and form values are excluded. This helps operation guidance and knowledge retrieval without granting account/fund/order permissions. Images and their embedded instructions remain untrusted input.

| Limit | Enforcement |
| --- | --- |
| Files | At most 3, each 8 MiB |
| Extracted text | 12,000 characters per file; 24,000 total |
| Message | 4,000 characters |
| Provider conversation history | 64,000 serialized-content characters, newest contiguous turns retained |
| PDF | 20 pages; image-only/scanned PDFs without text produce an empty-file error |
| Original image | 16,000,000 pixels, supported JPEG/PNG/WebP |
| Model image | JPEG, longest edge 1,920 px, at most 384 KiB per image |
| DOCX ZIP | At most 512 entries and 16 MiB expanded data; encrypted, ZIP64, multi-disk and unsupported compression rejected |
| File processing | 120-second frontend abort deadline; parsers check cancellation and release workers/readers |
| Model generation | 90-second backend deadline; 95-second client timeout |

DOCX checks both declared ZIP sizes and actual streamed inflation before Mammoth collects document text. A forged small declared size is rejected during the preflight. Deflate DOCX requires `DecompressionStream('deflate-raw')`; unsupported environments fail visibly instead of bypassing the bound.

Server validation runs before session/message persistence or model access. It rejects unknown attachment fields, paths/control characters in names, unsupported MIME/method combinations, empty document excerpts, invalid image headers/dimensions, invalid sizes and over-budget text. A separate check catches JSON escape expansion that would otherwise push the current request beyond the history budget.

Private-key-shaped hex and runs of 12 English BIP39 words are blocked in the composer/parser and again on the server, including attachment names/text. This is a heuristic guard: other languages and deliberately disguised secrets are not claimed to be comprehensively detected. Ordinary English investment questions remain usable.

Authenticated session history, deletion and feedback resolve the requested owner before reading or mutating message data. Continuing a session owned by another authenticated user is rejected before retrieval/provider access. Guest chat has no account-data scope; account snapshots require an authenticated user and explicitly selected `balances`, `positions`, `orders` or `qualification`, with server queries scoped to that user's ID. Guest conversation UUIDs permit continuation and can be attached to a signed-in account; authenticated history listing/reading still requires the owner.

File excerpts are persisted inside their conversation's user message and restored only through that conversation. Provider replay labels them untrusted data and explicitly excludes permission, platform-fact, identity and account-record authority. The current login/session change resets the visible conversation, aborts the client wait and remounts file/voice state; an old response is not added to a new UI session.

## Open-source readers

Installed packages were checked locally:

| Reader | Version | License |
| --- | --- | --- |
| WaveSurfer.js | 8.0.1 | BSD-3-Clause |
| PDF.js (`pdfjs-dist`) | 6.3.289 | Apache-2.0 |
| Mammoth | 1.13.0 | BSD-2-Clause |

The PDF worker is served locally from `public/ai-ocr`. Legacy Tesseract assets remain available to old bundles, but current images use model vision instead of OCR. Reader libraries load only for their document type; WaveSurfer and its microphone plugin load only during a voice hold. Licenses are retained with the installed dependencies.

## Verification evidence

2026-10-05 additions:

- A real model probe ran the actual compiled `AiService` and `AiModelClient` in memory through the existing configured native DeepSeek Flash. No production database/service/file was modified. It identified an isolated prediction-buy screenshot, its unchecked confirmation box and visible refresh control in 1.5 seconds. A second probe using a photo processed by the actual browser image parser described its coast, glass house, water, crescent moon and lights in 1.7 seconds. Neither image had OCR text; stored conversation data contained metadata only.
- Six backend suites passed 50 tests, including real Nest HTTP middleware with 1.6 MB chat input, rejection above 2 MB, controlled malformed-JSON errors and preservation of small/default-bounded JSON requests on other routes. Image validation, current-turn pixels, metadata-only history, provider capability and private screen-context rejection are covered.
- `scripts/ai-visual.test.mjs` passed five tests: route privacy, subtitle rotation/pause/draft selection, image sizing/resource release and WaveSurfer late-permission/cleanup ownership. Existing voice/input/action regressions remain required.
- Browser review at 390 px: original JPEG and a no-text WebP produce removable previews; FAQ is above the input and selection fills text without creating a conversation. Real microphone amplitude/recognition on target phones remains pending.

The evidence below describes the earlier 2026-10-04 reader/action verification; OCR results are historical and are superseded by the vision pipeline above.

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
