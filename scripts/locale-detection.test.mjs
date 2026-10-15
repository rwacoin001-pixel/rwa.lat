import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function loadTs(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require: name => dependencies[name] ?? require(name), Set, Number })
  return exports
}
const locales = loadTs('../lib/app-locales.ts')
const { resolveInitialLocale, browserLocale } = loadTs('../lib/locale-detection.ts', { './app-locales': locales })

test('country selects each available regional language before device preference', () => {
  for (const [country, language] of [['CN', 'zh-CN'], ['US', 'en'], ['ES', 'es'], ['SA', 'ar'], ['FR', 'fr'], ['BR', 'pt']]) {
    assert.equal(resolveInitialLocale({ country, acceptLanguage: 'en' }), language)
  }
  assert.equal(resolveInitialLocale({ country: ' br ' }), 'pt')
})
test('IP country takes priority over device language, including multilingual regions', () => {
  assert.equal(resolveInitialLocale({ country: 'IN', acceptLanguage: 'en-IN,hi;q=0.8' }), 'hi')
  assert.equal(resolveInitialLocale({ country: 'IN', acceptLanguage: 'bn' }), 'hi')
  assert.equal(resolveInitialLocale({ country: 'CA', acceptLanguage: 'fr-CA,en;q=0.7' }), 'en')
  assert.equal(resolveInitialLocale({ country: 'SG', acceptLanguage: 'zh-SG,en;q=0.8' }), 'en')
  assert.equal(resolveInitialLocale({ country: 'AE', acceptLanguage: 'en' }), 'ar')
  assert.equal(resolveInitialLocale({ country: 'HK', acceptLanguage: 'en' }), 'zh-CN')
})
test('saved preference wins over country and moving networks', () => {
  assert.equal(resolveInitialLocale({ savedLocale: 'ar', country: 'CN', acceptLanguage: 'en' }), 'ar')
  assert.equal(resolveInitialLocale({ savedLocale: '<script>', country: 'BR' }), 'pt')
})
test('unsupported and missing locations fall back without blocking the page', () => {
  for (const country of [undefined, 'XX', 'T1', 'DE', '']) {
    assert.equal(resolveInitialLocale({ country, acceptLanguage: 'es-MX' }), 'es')
    assert.equal(resolveInitialLocale({ country, acceptLanguage: 'de,ja' }), 'en')
  }
})
test('language negotiation respects quality and refuses disabled or malformed entries', () => {
  assert.equal(browserLocale('en;q=0.4,pt-BR;q=0.9'), 'pt')
  assert.equal(browserLocale('fr;q=0,en;q=0.5'), 'en')
  assert.equal(browserLocale('ar;q=invalid,es;q=2,*;q=1'), undefined)
  assert.equal(browserLocale('zh-Hant-TW'), 'zh-CN')
})
