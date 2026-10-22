import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
const require = createRequire(import.meta.url)
const ts = require('typescript')
// Only the pure helpers are exercised; the request layer is stubbed.
const source = readFileSync(new URL('../lib/referral-invite.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(output, { exports, require: name => name === './api/_http' ? { request: () => null, resetAuthAttribution: () => {} } : require(name) })
const { normalizeInviteCode, isInviteCodeShape, displayInviteCode } = exports

test('typed invitation codes are cleaned the same way the API cleans them', () => {
  assert.equal(normalizeInviteCode(' k7m-4qx '), 'K7M4QX')
  assert.equal(normalizeInviteCode('k7m 4qx'), 'K7M4QX')
  assert.equal(normalizeInviteCode('a3f9c27e51d08b4f9999'), 'A3F9C27E51D08B4F')
  assert.equal(isInviteCodeShape('K7M4QX'), true)
  assert.equal(isInviteCodeShape('K7M4'), false)
  assert.equal(isInviteCodeShape('K7M4Q!'), false)
})

test('short codes display in two groups; longer legacy and custom codes stay whole', () => {
  assert.equal(displayInviteCode('k7m4qx'), 'K7M 4QX')
  assert.equal(displayInviteCode('a3f9c27e51d08b4f'), 'A3F9C27E51D08B4F')
  assert.equal(displayInviteCode('areit2026'), 'AREIT2026')
})
