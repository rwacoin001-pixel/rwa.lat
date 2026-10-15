/**
 * The A-REIT Android client (apps/android-client, com.areit.app): a signed APK served from this site for Android
 * browsers that cannot install the web app (most built-in Chinese OEM browsers, UC, QQ, Quark…; their "add to
 * desktop" is only a bookmark). Fill this in after running apps/android-client/Build-Release.ps1 and copying the APK
 * to public/download/; while `url` is null the install sheet offers only "Open in Chrome".
 */
export const ANDROID_APP: { url: string | null; version: string; sha256: string } = {
  url: null,
  version: '',
  sha256: '',
}

/** The Android client's WebView user agent carries this marker (MainActivity). */
export const ANDROID_APP_UA = 'RwaLatAndroidTrial/'

/**
 * An intent link that opens `href` in Chrome; Android browsers that support intents (most do) hand it over, and
 * where Chrome is missing the browser falls back to `fallback` (the APK when there is one, otherwise this page).
 */
export function chromeIntentUrl(href: string, fallback: string) {
  const url = new URL(href)
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
}
