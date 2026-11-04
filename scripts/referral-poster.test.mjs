import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file) {
  const exports = {}
  const source = readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(output, { exports, URL, require: name => name.startsWith('./referral-poster-') ? load(name.slice(2)) : require(name) })
  return exports
}
const { POSTER_PLATFORMS, POSTER_CATEGORIES, posterTemplates, buildPosterModel, invitationUrl } = load('referral-poster')
const rules = { version: 2, holdingRatesBps: [600, 300, 100], feeRatesBps: [2000, 1000, 500] }
const input = { code: 'Sample12', locale: 'en', rules, purchaseRewardsEnabled: true, feeRewardsEnabled: true }
test('ten platforms each expose 18 distinct posters in five style categories', () => {
  assert.equal(POSTER_PLATFORMS.length, 10)
  assert.deepEqual(Array.from(POSTER_CATEGORIES), ['minimal', 'ink', 'vangogh', 'bauhaus', 'cyber'])
  for (const platform of POSTER_PLATFORMS) {
    const templates = posterTemplates(platform.id)
    assert.equal(templates.length, 18)
    assert.equal(new Set(templates.map(t => t.id)).size, 18)
    assert.equal(new Set(templates.map(t => t.style)).size, 18)
    assert.equal(new Set(templates.map(t => t.art)).size, 18)
    assert.equal(posterTemplates(platform.id, 'minimal').length, 6)
    for (const category of POSTER_CATEGORIES.slice(1)) {
      const art = posterTemplates(platform.id, category)
      assert.equal(art.length, 3)
      for (const t of art) {
        // Art posters never carry reward figures, and their headline box never overlaps the subject or the footer zone.
        assert.equal(t.kind, 'brand')
        const { text, subject } = t.layout
        assert.ok(text.x >= .05 && text.x + text.w <= .95 && text.y >= .1 && text.y + text.h <= .82 && text.w >= .38, `${t.id} text box`)
        assert.ok(subject.y + subject.h <= .84, `${t.id} subject above footer`)
        const overlap = Math.min(text.x + text.w, subject.x + subject.w) - Math.max(text.x, subject.x) > 0 && Math.min(text.y + text.h, subject.y + subject.h) - Math.max(text.y, subject.y) > 0
        assert.ok(!overlap, `${t.id} text over subject`)
      }
    }
    assert.ok(platform.width >= 1080 && platform.height >= 1000)
  }
  assert.equal(posterTemplates('unknown').length, 0)
  assert.ok(new Set(POSTER_PLATFORMS.map(p => `${p.width}/${p.height}`)).size >= 5)
})
test('QR destination always uses current canonical domain and a validated personal code', () => {
  assert.equal(invitationUrl('Sample12'), 'https://a-reit.com/r/Sample12')
  for (const code of ['', 'short', '../register', 'abc def', 'a'.repeat(17)]) assert.throws(() => invitationUrl(code))
})
test('reward amounts come from the current rule version and correct basis', () => {
  const template = posterTemplates('instagram').find(t => t.kind === 'purchase')
  const model = buildPosterModel({ ...input, template })
  assert.equal(model.rate, '6%')
  assert.match(model.description, /purchases/)
  assert.equal(buildPosterModel({ ...input, template, rules: { ...rules, version: 3, holdingRatesBps: [850, 250, 75] } }).rate, '8.5%')
  const fee = buildPosterModel({ ...input, template: posterTemplates('instagram').find(t => t.kind === 'fee') })
  assert.equal(fee.rate, '20%')
  assert.match(fee.description, /fees/)
  assert.equal(model.link, 'https://a-reit.com/r/Sample12?lang=en')
})
test('unknown, disabled and missing rules cannot silently produce promotional percentages', () => {
  const template = posterTemplates('instagram').find(t => t.kind === 'purchase')
  for (const patch of [{ purchaseRewardsEnabled: false }, { purchaseRewardsEnabled: undefined }, { rules: null }, { rules: { ...rules, holdingRatesBps: [600] } }, { rules: { ...rules, holdingRatesBps: [NaN, 300, 100] } }]) {
    assert.throws(() => buildPosterModel({ ...input, template, ...patch }))
  }
  assert.throws(() => buildPosterModel({ ...input, template: { id: 'forged', platform: 'instagram', kind: 'purchase' } }))
})
test('all seven languages produce complete text, real link and direction in all 180 templates', () => {
  for (const locale of ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt']) for (const platform of POSTER_PLATFORMS) for (const template of posterTemplates(platform.id)) {
    const model = buildPosterModel({ ...input, template, locale })
    assert.equal(model.dir, locale === 'ar' ? 'rtl' : 'ltr')
    for (const key of ['headline', 'description', 'disclaimer', 'scanLabel', 'codeLabel', 'label']) assert.ok(model[key]?.trim(), `${locale}.${template.id}.${key}`)
    assert.ok(!JSON.stringify(model).includes('undefined'))
    assert.ok(!JSON.stringify(model).includes('rwa.lat'))
    if (locale !== 'en') assert.notEqual(model.description, buildPosterModel({ ...input, template }).description)
  }
})
