import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBrand, canonicalBrandUrl, brandUiCopy, buildManifest } from '../lib/brand/config.mjs'

test('default is A-REIT and invalid brands fail closed', () => {
  assert.equal(resolveBrand(undefined).id, 'areit')
  assert.throws(() => resolveBrand('kiimeng'), /Unknown site brand/)
  assert.throws(() => resolveBrand(''), /Unknown site brand/)
  assert.ok(Object.isFrozen(resolveBrand('kimeng')))
})
test('brand hosts cannot redirect to another brand or an arbitrary host', () => {
  const k = resolveBrand('kimeng')
  assert.equal(canonicalBrandUrl(k, 'https://www.kimengresearch.com/home?q=1'), 'https://kimengresearch.com/home?q=1')
  assert.equal(canonicalBrandUrl(k, 'https://kimengresearch.com/home'), null)
  assert.throws(() => canonicalBrandUrl(k, 'https://a-reit.com/home'), /Host is not allowed/)
  assert.throws(() => canonicalBrandUrl(k, 'https://kimengresearch.com.evil.test'), /Host is not allowed/)
})
test('only A-REIT retains its existing desktop destination', () => {
  assert.equal(resolveBrand('kimeng').desktopRedirect, null)
  assert.equal(resolveBrand('areit').desktopRedirect, 'https://www.capitaland-ascendasreit.com/')
})
test('manifest identity and all icons belong to the selected brand', () => {
  const k = buildManifest(resolveBrand('kimeng'))
  assert.equal(k.short_name, 'KIMENG')
  assert.equal(k.name, 'KIMENG')
  assert.equal(k.start_url, '/home')
  assert.ok(k.icons.every(i => i.src.includes('/kimeng/')))
  assert.ok(k.shortcuts.every(s => s.icons.every(i => i.src.includes('/kimeng/'))))
  assert.equal(buildManifest(resolveBrand('areit')).icons[0].src, '/icons/a-reit-v1-192.png')
})
test('UI copy changes presentation without changing protocol identifiers', () => {
  assert.equal(brandUiCopy('Welcome to A-REIT', resolveBrand('kimeng')), 'Welcome to KIMENG')
  assert.equal(brandUiCopy('欢迎使用 A-REIT', resolveBrand('kimeng'), 'zh'), '欢迎使用 金英')
  assert.equal(brandUiCopy('rwa.session', resolveBrand('kimeng')), 'rwa.session')
  assert.equal(brandUiCopy('Welcome to A-REIT', resolveBrand('areit')), 'Welcome to A-REIT')
})
