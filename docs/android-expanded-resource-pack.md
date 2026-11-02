# Android resource pack expansion — 2026-11-03

Base: `origin/main` at `5f856916`. Work branch: `codex/android-expanded-resource-pack`.

## Result

The generator now includes mobile product derivatives, basket covers/thumbnails and original fallbacks, asset icons, generated artwork, login/brand images, the PDF module worker and QR decoder. Existing font, quant, referral and avatar inclusion remains intact. The native path policy is expanded with it, and `.mjs` is served as JavaScript so PDF workers can load.

Public assets measured from this source revision (uncompressed; excludes generated `/_next/static` code):

| | Files | Bytes | MiB |
|---|---:|---:|---:|
| Previous selection | 309 | 15,897,799 | 15.2 |
| Expanded selection | 403 | 74,365,639 | 70.9 |

These figures are resource payload sizes, not APK sizes. APK compression, native code and the fresh website build determine the final download size.

## Update behavior and limits

The existing manifest v1 format, SHA-256 verification, content-addressed storage, reuse of downloaded files, background download and next-launch activation are preserved. New mobile directories require an updated APK: older installed clients ignore paths outside their own whitelist even when the website publishes them.

Single files remain limited to 8 MiB. Native per-launch downloads and generator whole-pack budget are both 128 MiB, leaving space for website build output above the 70.9 MiB public assets. Selection exceeding either limit now fails the build explicitly instead of silently excluding a selected file. No need to fill the budget deliberately.

Video is excluded: native interception currently returns full 200 responses and does not implement byte-range playback. Desktop media, retired product originals, downloaded APKs, API responses and user documents are excluded. OCR engines/language data remain on demand; the current AI image attachment path does not run OCR. HTML/pages and live financial data continue to use the network.

## Verification and release

- `node --test scripts/app-pack.test.mjs`: generation, native path coverage, bundling and SHA-256 validation, corruption rejection, file and pack capacity boundaries.
- Android `testReleaseUnitTest lintRelease`: path/traversal policy and MIME tests plus native compilation/lint.
- A source asset audit generated the full 403-file list and checked every entry against the native allowlist and bundled hashes.

This is a tested source change, not a published APK. Release requires a fresh production website build, regenerated manifest, incremented Android version/code, bundling that exact build, signing with the existing certificate, and phone validation before replacing the offered download. Do not use the source-only audit manifest as a release bundle. Phone launch/navigation timing, PDF worker behavior, install/upgrade, sign-in handoff, video network fallback and incremental update still require acceptance on the release APK.
