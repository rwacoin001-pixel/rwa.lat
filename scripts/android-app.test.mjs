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
