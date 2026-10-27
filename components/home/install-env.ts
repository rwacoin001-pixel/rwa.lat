/**
 * Install environment detection, shared by the Home install sheet and the iPhone install gate.
 * Kept free of UI and motion imports so the gate can decide before paint without loading a chunk.
 */

export type InstallKind =
  | 'ios-safari' | 'ios-other'
  | 'android-chrome' | 'android-samsung' | 'android-xiaomi' | 'android-huawei' | 'android-other'
  | 'desktop-chrome' | 'desktop-edge' | 'desktop-safari' | 'desktop-other'
  | 'wechat-ios' | 'wechat-android' | 'inapp'

export type InstallEnv = { kind: InstallKind; ios: boolean; app: string | null }

export function isStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || ['standalone', 'fullscreen', 'minimal-ui'].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
}

const IN_APPS: [RegExp, string][] = [
  [/AlipayClient/i, 'Alipay'], [/DingTalk/i, 'DingTalk'], [/Lark|Feishu/i, 'Feishu'], [/\bQQ\//, 'QQ'], [/Weibo/i, 'Weibo'],
  [/aweme|BytedanceWebview|musical_ly/i, 'TikTok'], [/FBAN|FBAV|FB_IAB/, 'Facebook'], [/Instagram/i, 'Instagram'], [/\bLine\//, 'LINE'], [/Telegram/i, 'Telegram'],
]

export function detectEnv(): InstallEnv {
  const ua = window.navigator.userAgent
  // iPadOS 13+ reports a desktop Mac UA; touch points tell them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  if (/MicroMessenger/i.test(ua)) return { kind: ios ? 'wechat-ios' : 'wechat-android', ios, app: 'WeChat' }
  const inApp = IN_APPS.find(([pattern]) => pattern.test(ua))
  if (inApp) return { kind: 'inapp', ios, app: inApp[1] }
  if (ios) return { kind: /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|DuckDuckGo/.test(ua) || !/Safari\//.test(ua) ? 'ios-other' : 'ios-safari', ios, app: null }
  if (android) {
    // A WebView UA not claimed by a known app above is a WebView-based browser (Via, X, Mint…): it cannot install
    // the web app either, so it gets the same Android-app offer as the other non-Chrome browsers.
    if (/; wv\)/.test(ua)) return { kind: 'android-other', ios, app: null }
    if (/SamsungBrowser/.test(ua)) return { kind: 'android-samsung', ios, app: null }
    if (/MiuiBrowser|XiaoMi/i.test(ua)) return { kind: 'android-xiaomi', ios, app: null }
    if (/HuaweiBrowser|HONORBrowser/i.test(ua)) return { kind: 'android-huawei', ios, app: null }
    if (/Chrome\//.test(ua) && !/EdgA|OPR|UCBrowser|Quark|MQQBrowser|VivoBrowser|HeyTapBrowser|baidu|360/i.test(ua)) return { kind: 'android-chrome', ios, app: null }
    return { kind: 'android-other', ios, app: null }
  }
  if (/Edg\//.test(ua)) return { kind: 'desktop-edge', ios, app: null }
  if (/Chrome\//.test(ua) && !/OPR\//.test(ua)) return { kind: 'desktop-chrome', ios, app: null }
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Firefox/.test(ua)) return { kind: 'desktop-safari', ios, app: null }
  return { kind: 'desktop-other', ios, app: null }
}

/** Safari's major version from `Version/NN` (iOS 26 freezes the OS version in the UA, not this). 0 when absent. */
export function safariMajor() {
  return Number(/Version\/(\d+)/.exec(window.navigator.userAgent)?.[1] ?? 0)
}

/**
 * Every Android browser gets the Android app (2026-10-27): one way to install, one guide, and the app can share and
 * save posters natively. Chrome is included, so the web-app install is no longer offered on Android.
 */
export function needsAndroidApp(kind: InstallKind) {
  return kind === 'android-chrome' || kind === 'android-samsung' || kind === 'android-xiaomi' || kind === 'android-huawei' || kind === 'android-other'
}
