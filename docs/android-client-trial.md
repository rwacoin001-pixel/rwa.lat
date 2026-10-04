# RWA.LAT Android trial client

This is an installable trial shell for the current SSR application at `https://rwa.lat`, using the existing `https://api.rwa.lat` API through the website. It is not a bundled offline version of Next.js or a native financial implementation. APK installation/build verification is separate from real-phone login/camera/KYC/voice acceptance.

The APK loads the deployed website. Unmerged frontend/AI/scanner changes in this branch will appear only after an approved website/API deployment. No production deployment or authentication bridge was performed for this trial.

## Install and try

APK delivery copy: `C:\Users\30396\Desktop\rwa\artifacts\mobile-polish-20261004\rwa-lat-0.1.0-trial.apk`. Original build output: `E:\rwa-android-build\artifacts\rwa-lat-0.1.0-trial.apk`.

APK SHA-256: `EF46545393F4CD297135828B5FF20782056C252CCC6B977224EADC23550F2A67`.

Package `lat.rwa.trial`, version `0.1.0-trial` / code `1`, Android 8.0+ (min API 26), target/compile API 35. No Google Play Services dependency is imposed by the shell. It still needs a compatible, updated device WebView, internet access, and installed system services for the functions being tested. This does not promise equal support across Huawei, Xiaomi, OPPO, vivo, Honor, Samsung or GMS devices.

Send the APK to the phone and open it; allow installation from the chosen file-transfer/browser app when Android requests it. Alternatively:

```powershell
E:\rwa-android-build\sdk\platform-tools\adb.exe install -r E:\rwa-android-build\artifacts\rwa-lat-0.1.0-trial.apk
E:\rwa-android-build\sdk\platform-tools\adb.exe shell am start -n lat.rwa.trial/.MainActivity
```

The browser-login button and client menu appear on login/registration/auth/error pages. Normal website pages do not have a duplicate native header. At the root page, Android Back offers client options or exit. Browser login opens the clean `https://rwa.lat/login` page. Google, X and Passkey login continue in the browser; browser sessions are **not synchronized into the APK**. Email password/code sign-in uses the existing website/API inside the app. A user who normally signs in with Google can try the existing verified-email code/password path if their account supports it; successful email delivery and session creation still require a real-account check. No Google authorization page runs in the WebView.

## Included native behavior

- Exact HTTPS `rwa.lat` navigation allowlist. Cross-origin pages open only through an explicit browser action; insecure schemes, file/content/intent navigation and session-bearing external URI parameters are blocked. API traffic is made by the first-party website, not by loading API pages inside the shell. TLS errors fail closed. Mixed content, file/content access, third-party cookies and release debugging are disabled.
- Native loading/error/retry screen, 30-second initial-load timeout, Android Back navigation and exit confirmation. Android system/keyboard/cutout insets are applied once around the WebView. No separate native title header is added to regular pages.
- Origin checked camera/microphone/location requests with Android runtime permissions. Web requests do not bypass operating-system consent. Approximate location remains possible; precision or KYC eligibility is never inferred from granting a permission.
- File selection uses Android's document picker. Image-only inputs offer camera or file selection; captures use a private temporary cache file and a scoped FileProvider. Arbitrary file URI access is rejected. File selection and camera permission denial return cancellation, allowing website retry. No all-files/storage permission is requested.
- Public first-party HTTPS downloads can be handed to DownloadManager after confirmation, into the app's private external files directory. No website bearer/cookie is copied to DownloadManager. Authenticated, blob-generated or cross-origin downloads must use the browser/site flow; they are not reported as verified native downloads.
- Native `SpeechRecognizer` is offered only when Android reports a service and WebView supports origin-bound WebMessageListener. Requests come only from the `https://rwa.lat` main frame. Microphone access is requested on use. The selected Android recognition provider may require internet access or process speech using its own service. Text becomes a composer draft; no automatic AI send or fake transcription occurs in the shell.
- Session/cache removal, device WebView/service information and bundled open-source notices. Browser sessions remain in the browser. Backup/device transfer of app state is disabled. No session, speech or KYC content is written to native logs.

Voice integration contract:

```js
window.RwaNativeVoice?.start({ locale: 'zh-CN' })
window.RwaNativeVoice?.stop()
window.addEventListener('rwa-native-voice', event => {
  // detail: { type: 'listening'|'result'|'error'|'end', text?, error?, final }
})
```

The bridge is injected at document start when supported; older providers receive it after page finish. The website must detect availability at use time. No legacy unrestricted `addJavascriptInterface` is used. Native user agent suffix: `RwaLatAndroidTrial/0.1`. Website integration can navigate to `https://rwa.lat/__native/browser-login`; the native client intercepts it and offers browser login without transmitting URL secrets.

## Open-source choices (checked 2026-10-04)

| Project | GitHub stars observed | License | Decision |
| --- | ---: | --- | --- |
| [AndroidX](https://github.com/androidx/androidx) | 6,103 | Apache-2.0 | Used WebKit 1.14.0 and Core 1.16.0. Official supported WebView extensions, origin-bound messages, FileProvider; device WebView remains independently updatable. |
| [Capacitor](https://github.com/ionic-team/capacitor) | 16,771 | MIT | Not selected as an SSR remote-URL production wrapper. Official [server.url documentation](https://capacitorjs.com/docs/config) reserves it for live reload. A real Capacitor release would require a separately bundled client or a deliberately designed architecture. |
| [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) | 3,117 | Apache-2.0 | TWA remains a valid future browser-based distribution option, but verified Digital Asset Links and a compatible browser are prerequisites; no uniform domestic-phone assumption. |

Pinned AndroidX versions compile against API 35 and provide the required guarded APIs. Lint reports newer stable versions (WebKit 1.17.1, Core 1.19.1); this trial does not claim to use the newest libraries. Update and revalidate Android SDK/device requirements before production distribution. Open-source notices/full Apache-2.0 text are bundled in the APK. No generic third-party WebView application source was copied.

[Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies) prohibits developer-controlled embedded user agents for authorization. [Android WebView Credential Manager guidance](https://developer.android.com/identity/sign-in/credential-manager-webview) requires website/app Digital Asset Links and feature checks; conditional WebAuthn mediation is unsupported there. This trial disables embedded WebAuthn when the provider offers that setting and provides a browser path. On 2026-10-04, `https://rwa.lat/.well-known/assetlinks.json` returned HTTP 200 **HTML**, not the required JSON association, so TWA/native-Passkey deployment readiness is not established.

## Build and signing

The project is self-contained in `apps/android-client`; root Node packages/lockfiles are not needed for this Gradle project. Build tools were installed under `E:\rwa-android-build` rather than globally:

- Eclipse Temurin JDK 17.0.20.1+1 x64. Archive SHA-256 `e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0`; [official release](https://github.com/adoptium/temurin17-binaries/releases/tag/jdk-17.0.20.1%2B1).
- Gradle 8.11.1; wrapper SHA-256 is pinned in `gradle/wrapper/gradle-wrapper.properties` to `f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6`.
- Android command-line tools archive `commandlinetools-win-16111833_latest.zip`; Google's repository metadata SHA-1 was verified as `57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d`. Android CLI installed `platforms/android-35`, `build-tools/35.0.0`, `platform-tools`. SDK manager's legacy semicolon names require careful Windows quoting; current Android CLI uses slash paths.
- Android Gradle Plugin 8.9.2. No dynamic Maven version strings.

```powershell
Set-Location E:\rwa-lat-current\apps\android-client
.\Build-Trial.ps1 `
  -JavaHome 'E:\rwa-android-build\jdk\jdk-17.0.20.1+1' `
  -AndroidSdk 'E:\rwa-android-build\sdk' `
  -OutputDirectory 'E:\rwa-android-build\artifacts' `
  -SigningDirectory 'E:\rwa-android-build\private-signing' `
  -GradleCacheDirectory 'E:\rwa-android-build\gradle-cache'
```

The script runs release unit tests, release lint and assembly, aligns with `zipalign`, signs with `apksigner`, then verifies signature/alignment and prints SHA-256. Signing files stay outside the repository, in a Windows ACL-restricted directory for the current user and SYSTEM. Password is loaded only via a process environment variable and removed afterward. Preserve the local trial signing key for same-package updates; do not distribute it with the APK. This key is not a production/Play signing identity.

Signing identity: `CN=RWA.LAT Local Trial, OU=Trial, O=RWA.LAT, C=SG`, RSA 3072 bits. Certificate SHA-256: `1d53e4a17f18b9356e4e1135a27ef8cde6e2fc67222b578a1686565f5cd55f2b`. Android APK signature v2 and v3 are verified; v1 is unnecessary at min API 26.

## Verification and pending acceptance

Verification evidence lives outside the repository at `E:\rwa-android-build\signed-build.log`, with Gradle reports under the ignored `apps/android-client/app/build` folder. Security navigation tests were written before implementing policy, observed failing, then passed 5/5. `testReleaseUnitTest`, `lintRelease`, `assembleRelease`, `apksigner verify`, `zipalign -c`, APK badging/permissions inspection passed. The actual release lint report has zero errors and three warnings: the two pinned-library update notices above and a `SetTextI18n` notice for concatenating bundled open-source license text. Delivery metadata uses that actual count. Legacy Android activity/chooser/back callbacks remain for API 26 compatibility, with the modern Android Back callback used on API 33+.

On 2026-10-04, a headless Android 35 emulator launch was attempted but failed before an ADB device became available: Windows had about 1.55 GB of remaining committed memory and the emulator required 2.56 GB. The user then asked to skip APK work and prioritize the website, so no further emulator startup, downloads or device testing were attempted. No emulator process remains. Android installation, app launch and rendered-device smoke are **not verified**. The APK is signed and packaged for installation; that does not establish successful installation on a device. No deployment, merge or production write was performed for this delivery.

`adb devices -l` reported no attached physical phone. An APK build/signature check does not establish installation, rendered-device UX, real email/OAuth sessions, camera/file selection, microphone transcription, geolocation accuracy, Passkey, native X-app authorization, push/background behavior or KYC approval. Device WebView versions, installed credential/voice providers, app permissions and network reachability all remain real-phone test variables.

Phone acceptance sequence: install/launch; verify current home and safe areas; open login; verify email/code or password using the existing account; confirm Google opens browser and stays there; deny and allow scanner/camera/file/microphone/location requests; verify QR errors and KYC review/retry; dictate an AI draft and check that it is not auto-sent; verify offline/retry/Back and session clear; test on at least one GMS and one intended domestic phone before describing compatibility.

## Safe future browser-to-app login bridge (proposal only)

Existing `lib/api/auth.ts` and `_http.ts` save bearer sessions in browser `localStorage`. The callback exchanges a provider response with `/v1/auth/oauth/{provider}`. Neither `localStorage` nor browser cookies are automatically available in Android WebView. Passing an existing bearer in an app URI or reading browser cookies is not an acceptable shortcut.

The smallest viable bridge is a dedicated, server-bound one-use authorization grant with S256 PKCE:

1. Native app generates a cryptographically random verifier/state; retains verifier locally and submits only the challenge to a new native-login transaction endpoint. The server binds the transaction to one app identity, expiry, state and exact verified HTTPS return URI.
2. Browser opens the first-party native-login continuation page and uses the existing login flow. An authenticated first-party POST authorizes that transaction for the signed-in user after explicit handoff consent; the server does not trust user IDs supplied by the client.
3. Server creates a 60-second opaque, one-use code. Only code/state/transaction ID return through an Android App Link. Website publishes Digital Asset Links for the package/certificate; Android manifest validates the exact host/path. Provider tokens or bearer sessions never appear in the return URI.
4. Native app checks state/transaction and POSTs the code plus verifier to the API. Server atomically validates S256, expiry, user/app binding, replay and revocation, then creates the app session. The API response carries the session over HTTPS; an origin-bound web-message handshake can write it into the existing first-party website storage while strictly verifying `https://rwa.lat` and main frame.
5. Test code replay, wrong verifier/state/user/app/origin, expiry, cancelled browser, activity restart, existing/new account consent and revoked sessions. Audit handoff without logging codes, verifiers or sessions; rate-limit all endpoints. Only then deploy API/continuation/DAL/manifest and remove the trial limitation.

These endpoints, migrations, continuation page and verified App Link do not exist in this trial and were not deployed. Browser/PWA success alone does not prove direct X-app authorization or native credential support.
