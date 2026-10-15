import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const plugin = require('./postcss-native-insets.cjs')
const postcss = require('postcss')

test('safe-area insets also honour the Android client variables, and nothing else changes', async () => {
  const input = '.a{padding-top:calc(env(safe-area-inset-top) + 8px)}.b{bottom:env(safe-area-inset-bottom, 0px)}.c{left:var(--x)}.d{padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}'
  const { css } = await postcss([plugin()]).process(input, { from: undefined })
  assert.equal(css, '.a{padding-top:calc(max(env(safe-area-inset-top), var(--native-inset-top, 0px)) + 8px)}.b{bottom:max(env(safe-area-inset-bottom, 0px), var(--native-inset-bottom, 0px))}.c{left:var(--x)}.d{padding:max(env(safe-area-inset-top), var(--native-inset-top, 0px)) max(env(safe-area-inset-right), var(--native-inset-right, 0px)) 0 max(env(safe-area-inset-left), var(--native-inset-left, 0px))}')
})

test('running twice does not wrap twice', () => {
  const once = plugin.rewrite('env(safe-area-inset-top)')
  assert.equal(plugin.rewrite(once), once)
})
