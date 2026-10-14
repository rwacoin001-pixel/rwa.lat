import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const exports = {}
new Function('require', 'exports', ts.transpileModule(readFileSync('lib/asset-labels.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => ({}), exports)
const { assetClassLabel, networkLabel } = exports

test('API asset classes read in the page language instead of raw ids', () => {
  assert.deepEqual(['equity', 'fund', 'commodity'].map(id => assetClassLabel(id, 'zh-CN')), ['股票', '基金', '大宗商品'])
  assert.equal(assetClassLabel('real_estate', 'fr'), 'Immobilier')
  assert.equal(assetClassLabel('Private-Credit', 'en'), 'Private credit')
  assert.equal(assetClassLabel('new_kind', 'zh-CN'), 'New kind')
  assert.equal(assetClassLabel(null, 'en'), null)
})

test('networks keep their proper names', () => {
  assert.deepEqual(['ethereum', 'bsc', 'tron', 'zksync', 'some-l2'].map(networkLabel), ['Ethereum', 'BNB Chain', 'TRON', 'zkSync', 'Some l2'])
})
