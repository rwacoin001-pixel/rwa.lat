const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('../node_modules/typescript')
const Module = require('node:module')
const filename = require('node:path').resolve(__dirname, '../lib/community-location.ts')
const fixture = new Module(filename)
fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename)
const { getPostLocation } = fixture.exports
let fetchCalls = 0, positionCalls = 0, deny = false
global.window = { isSecureContext: true }
Object.defineProperty(global, 'navigator', { configurable: true, value: { geolocation: {
  getCurrentPosition(resolve, reject, options) {
    positionCalls++; assert.equal(options.maximumAge, 0)
    if (deny) reject(new Error('denied'))
    else resolve({ coords: { latitude: 1, longitude: 2 } })
  },
} } })
global.fetch = async (url, options) => {
  fetchCalls++; assert.equal(options.credentials, 'omit')
  assert.equal(new URL(url).searchParams.get('localityLanguage'), 'zh')
  return { ok: true, json: async () => ({ city: ' Singapore ', countryCode: 'sg', latitude: 1, longitude: 2 }) }
}
;(async () => {
  assert.deepEqual(await getPostLocation('zh-CN'), { city: 'Singapore', countryCode: 'SG', source: 'device' })
  deny = true
  await assert.rejects(getPostLocation('zh-CN'), /denied/)
  assert.equal(fetchCalls, 1, 'Denied location never sends coordinates for lookup')
  window.isSecureContext = false
  await assert.rejects(getPostLocation('zh-CN'), /LOCATION_UNAVAILABLE/)
  assert.equal(positionCalls, 2)
  console.log('PASS: permission denial, fresh device position, localized lookup, city-only post payload')
})().catch(error => { console.error(error); process.exitCode = 1 })
