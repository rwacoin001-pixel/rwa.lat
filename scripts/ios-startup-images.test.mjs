import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {testBrandContext} from './brand-test-context.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const exports = {}
const compiled=ts.transpileModule(readFileSync(new URL('../lib/ios-startup-images.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(compiled, { exports, require:()=>testBrandContext() })
test('Kimeng has its own 24 startup images at their declared physical dimensions',()=>{
  const kimeng={}
  vm.runInNewContext(compiled,{exports:kimeng,require:()=>testBrandContext('kimeng')})
  assert.equal(kimeng.iosStartupImages.length,24)
  for(const{url,media}of kimeng.iosStartupImages){
    assert.ok(url.startsWith('/startup/kimeng-'))
    const png=readFileSync(new URL('../public'+url,import.meta.url))
    const [,w,h,scale]=media.match(/device-width: (\d+)px\).*device-height: (\d+)px\).*pixel-ratio: (\d+)/)
    assert.equal(png.readUInt32BE(16),Number(w)*Number(scale));assert.equal(png.readUInt32BE(20),Number(h)*Number(scale))
  }
})

test('every iOS launch image exists and is served without a redirect-prone file name', () => {
  assert.equal(exports.iosStartupImages.length, 24)
  for (const { url, media } of exports.iosStartupImages) {
    assert.ok(!/[@%\s]/.test(url), url)
    assert.ok(existsSync(new URL('../public' + url, import.meta.url)), url)
    assert.match(media, /^\(device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: [23]\) and \(orientation: portrait\) and \(prefers-color-scheme: (light|dark)\)$/)
  }
})
