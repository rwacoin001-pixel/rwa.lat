import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/app-handoff.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URLSearchParams, encodeURIComponent })
const { readAppLoginParams, appReturnUrls, readInjectedHandoff, APP_HANDOFF_COPY } = exports
// Objects built inside the vm context have its own Object prototype; compare their values.
const plain = (value) => JSON.parse(JSON.stringify(value))

const challenge = 'A'.repeat(43)
const state = 'abcDEF0123456789_-xy'
const code = 'f'.repeat(64)

test('the browser page only accepts a well-formed challenge and state', () => {
  assert.deepEqual(plain(readAppLoginParams(`?challenge=${challenge}&state=${state}`)), { challenge, state })
  assert.equal(readAppLoginParams(`?challenge=${challenge}`), null)
  assert.equal(readAppLoginParams(`?challenge=short&state=${state}`), null)
  assert.equal(readAppLoginParams(`?challenge=${challenge}&state=<script>`), null)
})

test('the return link is pinned to the app package and carries only the code and state', () => {
  const urls = appReturnUrls(code, state)
  assert.equal(urls.intent, `intent://auth?code=${code}&state=${state}#Intent;scheme=areit;package=com.areit.app;end`)
  assert.equal(urls.scheme, `areit://auth?code=${code}&state=${state}`)
  assert.equal(appReturnUrls('bad code', state), null)
})

test('the app page only uses an injected code and verifier of the right shape', () => {
  assert.deepEqual(plain(readInjectedHandoff({ code, verifier: 'v'.repeat(43) })), { code, verifier: 'v'.repeat(43) })
  assert.equal(readInjectedHandoff({ code }), null)
  assert.equal(readInjectedHandoff('x'), null)
  assert.equal(readInjectedHandoff({ code: 'x', verifier: 'y' }), null)
})

test('copy exists for all seven languages', () => {
  assert.deepEqual(Object.keys(APP_HANDOFF_COPY).sort(), ['ar', 'en', 'es', 'fr', 'hi', 'pt', 'zh-CN'])
})
