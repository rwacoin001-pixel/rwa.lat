# Mobile capture acceptance — 2026-10-04

Scope: `TransferScanner`, `KycCapture`, their capture CSS and seven-locale copy. Local fixture route: `/dev/mobile-polish?screen=scanner|kyc`. No commit, merge or deployment is included in this check.

## Implementation

- Scanner opens the camera behind a full-screen viewfinder, decodes with the locally bundled Apache-2.0 jsQR, and preserves caller validation of platform receive codes. Camera denial has retry and image selection; camera switching and torch controls appear only when supported.
- KYC guides document choice, document front/back as required, selfie, photo review and individual retakes. Actual JPEG evidence retains the full sensor frame, is limited to 5 MiB per image, and uses the existing multipart capture API. Retries reuse the idempotency key; changed photos reset it. A submission response does not mean identity approval.
- Camera tracks and object URLs are released on the relevant capture/dismissal lifecycle. Both flows use Base UI dialogs with focus and Escape handling; KYC dismissal is blocked during a submission.
- The KYC heading keeps its local gold focus underline and overrides the global mint outline. Button focus rings remain visible.

## Checks

- Capture components, copy and `scripts/capture-polish.test.mjs`: scoped ESLint passed on the final changes.
- Tracked capture changes: `git diff --check` passed.
- Browser acceptance: all six groups passed on the final changes, using headless system Chrome at `localhost:3034`. No page or console error was observed during the capture actions.

| Result | Actual browser check |
| --- | --- |
| PASS | Scanner camera denial, retry, generated QR PNG decoded by real jsQR, rejection of a foreign-host receive URL, close |
| PASS | Scanner live fake-camera stream, unsupported torch hidden, Escape dismissal, every camera track ended |
| PASS | Valid `https://rwa.lat/assets/cash/transfer?to=…` QR decoded by real jsQR, exact recipient callback, dialog closes and stream ends |
| PASS | ID front/back/selfie canvas capture, actual JPEG multipart parts under 5 MiB, review and front retake, unchanged retries reuse the key, retake changes the key, Escape blocked while submission is in flight, `submitted` response closes the flow |
| PASS | KYC camera denial leaves retry available and no submit control without required evidence |
| PASS | Arabic scanner at 320 × 700 has no horizontal overflow |

Visual inspection covered document choice, live selfie guide, three-photo review and Arabic scanner. The final document-choice screenshot confirms the heading focus outline correction.

## Browser fixture and evidence

Run from `E:\rwa-lat-current` in PowerShell:

```powershell
$env:RWA_PLAYWRIGHT_DIR='C:\Users\30396\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:RWA_BROWSER_CHANNEL='chrome'
$env:RWA_PREVIEW_URL='http://localhost:3034'
$env:RWA_CAPTURE_OUTPUT='C:\Users\30396\Desktop\rwa\artifacts\mobile-polish-20261004\capture'
node scripts/capture-polish.test.mjs
```

The script uses headless system Chrome, fake camera frames, real canvas JPEG encoding, generated QR PNGs and real jsQR decoding. All API reads are isolated; the KYC multipart endpoint is mocked with two retryable failures followed by a `submitted` response. External traffic is denied. Pages are exercised and closed serially.

The output directory contains `results.json` and 13 screenshots: scanner live/invalid/Arabic; KYC document choice, front/back/selfie live frames and resulting photos, selfie guide, review and camera denial. The green moving pattern in the evidence photos is Chrome's fake camera fixture.

## Remaining acceptance

Real Android/browser camera permission prompts, focus and glare, front/rear camera selection, hardware torch, safe areas and keyboard/device behavior still require a real phone. Didit document, liveness and face-match acceptance still requires the authorized provider flow. Neither the fake camera nor a mocked `submitted` response demonstrates those checks.
