import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../lib/unread-count.ts'), 'utf8')
const mod = { exports: {} }
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod, mod.exports)
const { countUnread } = mod.exports

test('counts items without a readAt', () => {
  assert.equal(countUnread([{ readAt: null }, { readAt: '2026-10-18T00:00:00Z' }, {}]), 2)
})

test('anything that is not a list of objects is zero, never a throw', () => {
  for (const body of [undefined, null, {}, { items: [] }, 'x', 7, [null, 3, 'a']]) assert.equal(countUnread(body), 0)
})
