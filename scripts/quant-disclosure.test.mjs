import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/quant-disclosure.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { disclosureSections } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('retains complete primary risk clauses rather than substituting the English summary', () => {
  const text = '【产品性质】\n不是银行存款。\n\n【一、本金损失风险】\n可能损失全部本金。\n\n【费用】\n管理费 1.5%，业绩报酬 20%。\n\n—— English summary ——\nShort summary.'
  assert.deepEqual(disclosureSections(text), [
    { heading: '产品性质', paragraphs: ['不是银行存款。'] },
    { heading: '一、本金损失风险', paragraphs: ['可能损失全部本金。'] },
    { heading: '费用', paragraphs: ['管理费 1.5%，业绩报酬 20%。'] },
  ])
})
test('keeps an English document intact when it has a summary heading', () => {
  const sections = disclosureSections('Full disclosure.\n\n—— English summary ——\nAdditional text.')
  assert.equal(sections.flatMap(s => s.paragraphs).join('\n\n'), 'Full disclosure.\n\n—— English summary ——\nAdditional text.')
})
test('preserves every character while splitting long paragraphs below the translation limit', () => {
  const text = '本金可能亏损，费用不变。'.repeat(700)
  const paragraphs = disclosureSections(text).flatMap(s => s.paragraphs)
  assert.ok(paragraphs.every(p => p.length <= 3000))
  assert.equal(paragraphs.join(''), text)
})
test('handles inline Chinese headings, markdown, CRLF and paragraphs', () => {
  assert.deepEqual(disclosureSections('导言\r\n\r\n【费用】管理费 1.5%。\r\n\r\n## Redemption\r\n15:00 SGT.'), [
    { heading: '', paragraphs: ['导言'] },
    { heading: '费用', paragraphs: ['管理费 1.5%。'] },
    { heading: 'Redemption', paragraphs: ['15:00 SGT.'] },
  ])
})
test('empty disclosures do not manufacture content', () => {
  assert.deepEqual(disclosureSections(' \n\n'), [])
})
