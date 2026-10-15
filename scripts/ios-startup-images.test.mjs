import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/ios-startup-images.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })

test('every iOS launch image exists and is served without a redirect-prone file name', () => {
  assert.equal(exports.iosStartupImages.length, 24)
  for (const { url, media } of exports.iosStartupImages) {
    assert.ok(!/[@%\s]/.test(url), url)
    assert.ok(existsSync(new URL('../public' + url, import.meta.url)), url)
    assert.match(media, /^\(device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: [23]\) and \(orientation: portrait\) and \(prefers-color-scheme: (light|dark)\)$/)
  }
})
