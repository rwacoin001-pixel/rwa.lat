# A-REIT · Android client source reference

Updated: 2026-10-16. This is a source snapshot, not a claim that every device or sign-in path was tested in this documentation batch.

## Current source snapshot

- App entry: `https://a-reit.com`; API origin: `https://api.a-reit.com`.
- Source: `apps/android-client`; current source version: **1.1.3**, versionCode **6**, minSdk **26**, targetSdk **35**.
- Install identity: **`com.areit.app`**. Preserve this value and the existing signing certificate for compatible upgrades.
- The Java namespace `lat.rwa.trial`, existing source/resource paths and `RwaLatAndroidTrial/` UA are compatibility identifiers. Web startup, native insets, wallet return handling and app detection depend on that contract. They are not an instruction to display the old brand or to rename the application during copy cleanup.
- The offered APK URL, SHA-256 and certificate reference are maintained in `lib/android-app.ts`; verify the actual artifact before publishing. The checked-in current download is `public/download/a-reit-android-1.1.3.apk`.

## Preserve existing behavior

Keep trusted-origin and external-link policy, native/browser sign-in handoff, wallet deep links, keyboard/safe-area handling, app-pack checks, sharing and gallery save unchanged. Copy cleanup must not reset application data, sessions, user preferences or authentication credentials.

Use the existing build scripts and tests in the Android source tree. A web build does not prove APK signing, upgrade compatibility, browser-provider return, wallet signing or permission behavior on a real device.

## Release boundary

See [current project and deployment reference](deployment-current.md). APK publication and any website/API handoff changes require their own scoped verification and user approval. Do not revive withdrawn downloads or replace the current offer using a dated handoff file.
