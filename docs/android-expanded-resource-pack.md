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

Release requires a production website snapshot, regenerated manifest, incremented Android version/code, signing with the existing certificate, and verification before replacing the offered download. Do not use the source-only audit manifest as a release bundle. Phone launch/navigation timing, PDF worker behavior, install/upgrade, sign-in handoff, video network fallback and incremental update still require acceptance on the release APK.

## Authorized 1.1.5 release

The user authorized push and production release. APK 1.1.5 / code 8 bundles the then-live website build `ctXivtQzAkjmz3qcsjhYB`, with all 617 previously listed file hashes checked against the saved production assets. Its expanded pack contains 711 files / 83.7 MiB. The APK is 78,339,603 bytes; SHA-256 `974aea7a1dc69d31afd56875c08dc57e4efa756f9d683d2485182ac15cf0c8a9`. The signing certificate matches the existing `com.areit.app` release certificate. Subsequent website builds update its on-device resources using the existing verified update mechanism.

The APK exceeds the frontend static-file size limit. It is hosted on the existing `https://dl.a-reit.com/android/a-reit-android-1.1.5.apk` download origin, under `/opt/rwa-lat/media/android/`. Caddy's versioned APK route was added after backing up and validating its configuration; existing routes are retained. Do not add this large APK to Cloudflare assets. The frontend receives a fresh production build to update the offered download and resource manifest.

Public download/hash checks and Android API 34 emulator installation and launch passed. An emulator screenshot showed the current A-REIT welcome experience. No physical-phone timing or authenticated financial action was tested. Real-phone navigation, PDF execution and upgrade acceptance remain user checks.

## 1.1.6 — 2026-11-03

APK 1.1.6 / code 9 bundles website build `PSsfgyDr_W8H47ugw_lJn` (main `a9f3f140`, 711 files / 83.7 MiB). 78,339,715 bytes; SHA-256 `c2ec88990faab957d6e0ceb3a8bdfde074a106824798e4fe60d07eebbced4511`; signing certificate `7ef88406…` (unchanged). Served from `https://dl.a-reit.com/android/a-reit-android-1.1.6.apk`; 1.1.5 stays on the server.

Changes: the launch splash follows the theme the app opens in (Android 13+ via `setSplashScreenTheme`; colours #F5F6F8 / #0A0C10), and "follow the phone" is dark on a dark phone (`android:isLightTheme`). With the website's instant launch shell, a signed-in cold start on the API 34 emulator went from 2.3–3.0 s to 1.4–1.8 s. Not yet checked on a physical phone.
