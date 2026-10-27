import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/android-app.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, encodeURIComponent })
const { ANDROID_APP, ANDROID_APP_UA, chromeIntentUrl } = exports

test('"Open in Chrome" hands the same page to Chrome and falls back when Chrome is missing', () => {
  const href = 'https://a-reit.com/home?ref=abc'
  const fallback = 'https://a-reit.com/download/a-reit-android-1.0.0.apk'
  assert.equal(chromeIntentUrl(href, fallback), 'intent://a-reit.com/home?ref=abc#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fa-reit.com%2Fdownload%2Fa-reit-android-1.0.0.apk;end')
})

test('the offered APK is the published file, byte for byte', async () => {
  const { createHash } = await import('node:crypto')
  const file = readFileSync(new URL('../public' + ANDROID_APP.url, import.meta.url))
  assert.equal(createHash('sha256').update(file).digest('hex'), ANDROID_APP.sha256)
  assert.ok(ANDROID_APP.url.endsWith(`-${ANDROID_APP.version}.apk`))
})

test('the marker matches the Android client user agent', () => {
  const activity = readFileSync(new URL('../apps/android-client/app/src/main/java/lat/rwa/trial/MainActivity.java', import.meta.url), 'utf8')
  assert.ok(activity.includes('" ' + ANDROID_APP_UA.replace('/', '')), 'MainActivity appends the marker')
})

// detectEnv reads the global window, so each user agent gets its own run of the real module.
function envFor(ua) {
  const ctx = { exports: {}, window: { navigator: { userAgent: ua, maxTouchPoints: 5 } } }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/home/install-env.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx)
  const kind = ctx.exports.detectEnv().kind
  return { kind, offer: ctx.exports.needsAndroidApp(kind) }
}

test('Android browsers that cannot install the web app are offered the Android app; Chrome and WeChat are not', () => {
  const uc = 'Mozilla/5.0 (Linux; U; Android 13; zh-CN; V2203A Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/16.6.0.1342 Mobile Safari/537.36'
  const via = 'Mozilla/5.0 (Linux; Android 13; 2211133C Build/TKQ1.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36'
  const miui = 'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23013RK75C Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.9.40411'
  const chrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
  const wechat = 'Mozilla/5.0 (Linux; Android 13; V2203A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160065 MMWEBSDK/20240301 MicroMessenger/8.0.48'
  assert.deepEqual(envFor(uc), { kind: 'android-other', offer: true })
  assert.deepEqual(envFor(via), { kind: 'android-other', offer: true })
  assert.deepEqual(envFor(miui), { kind: 'android-xiaomi', offer: true })
  // Since 2026-10-27 every Android browser gets the app, Chrome included.
  assert.deepEqual(envFor(chrome), { kind: 'android-chrome', offer: true })
  assert.deepEqual(envFor(wechat), { kind: 'wechat-android', offer: false })
})
