import type { AppLocale } from './i18n'

/**
 * The A-REIT Android client (apps/android-client, com.areit.app): a signed APK served from this site for Android
 * browsers that cannot install the web app (most built-in Chinese OEM browsers, UC, QQ, Quark…; their "add to
 * desktop" is only a bookmark). Fill this in after running apps/android-client/Build-Release.ps1 and copying the APK
 * to public/download/; while `url` is null the install sheet offers only "Open in Chrome".
 */
export const ANDROID_APP: { url: string | null; version: string; sha256: string } = {
  url: '/download/a-reit-android-1.1.1.apk',
  version: '1.1.1',
  sha256: 'd65d4015fb06695282f72628c1c5dcbf51bd79c218841cf2174ca227770e9d18',
}

/** Signing certificate SHA-256 (apksigner verify --print-certs); every later version must show the same one. */
export const ANDROID_APP_CERT_SHA256 = '7ef88406ea2f2076cb5b6a07cf864c9bfbc3e3caa3a6d9e098ced70bc73030ff'

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

/** Copy for the Android-app offer: the install sheet (download, meta, chrome, shortcut) and the sign-in banner. */
export const APP_OFFER: Record<AppLocale, { download: string; meta: string; chrome: string; shortcut: string; title: string; get: string; close: string }> = {
  'zh-CN': { download: '下载 A-REIT 安卓 App', meta: '版本 {v} · SHA-256 {h}…', chrome: '用 Chrome 打开', shortcut: '或添加到桌面（仅为浏览器快捷方式）', title: 'A-REIT 安卓 App', get: '下载', close: '关闭' },
  en: { download: 'Download the A-REIT Android app', meta: 'Version {v} · SHA-256 {h}…', chrome: 'Open in Chrome', shortcut: 'Or add to your home screen (a browser shortcut only)', title: 'A-REIT for Android', get: 'Download', close: 'Close' },
  es: { download: 'Descargar la app de A-REIT para Android', meta: 'Versión {v} · SHA-256 {h}…', chrome: 'Abrir en Chrome', shortcut: 'O añadir a la pantalla de inicio (solo un acceso directo)', title: 'A-REIT para Android', get: 'Descargar', close: 'Cerrar' },
  fr: { download: 'Télécharger l’app Android A-REIT', meta: 'Version {v} · SHA-256 {h}…', chrome: 'Ouvrir dans Chrome', shortcut: 'Ou ajouter à l’écran d’accueil (simple raccourci)', title: 'A-REIT pour Android', get: 'Télécharger', close: 'Fermer' },
  pt: { download: 'Baixar o app Android da A-REIT', meta: 'Versão {v} · SHA-256 {h}…', chrome: 'Abrir no Chrome', shortcut: 'Ou adicionar à tela inicial (apenas um atalho)', title: 'A-REIT para Android', get: 'Baixar', close: 'Fechar' },
  ar: { download: 'تنزيل تطبيق A-REIT لأندرويد', meta: 'الإصدار {v} · SHA-256 {h}…', chrome: 'فتح في Chrome', shortcut: 'أو أضِفه إلى الشاشة الرئيسية (اختصار للمتصفح فقط)', title: 'A-REIT لأندرويد', get: 'تنزيل', close: 'إغلاق' },
  hi: { download: 'A-REIT Android ऐप डाउनलोड करें', meta: 'संस्करण {v} · SHA-256 {h}…', chrome: 'Chrome में खोलें', shortcut: 'या होम स्क्रीन पर जोड़ें (सिर्फ़ ब्राउज़र शॉर्टकट)', title: 'A-REIT Android ऐप', get: 'डाउनलोड', close: 'बंद करें' },
}
