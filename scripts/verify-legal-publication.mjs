import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/legal-publication.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { displayLegalPublication, formatLegalEffectiveDate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const brand = { id: 'kimeng', name: 'KIMENG', origin: 'https://kimengresearch.com' }
const original = {
  version: 'terms-2026-09-18', revision: 1, title: 'Terms of Service', effectiveDate: '2026-09-18',
  sections: [
    { title: 'Acceptance', body: 'RWA.LAT at https://rwa.lat. Fees are 3.00%. 2 .' },
    { title: 'Contact', body: 'Contact support@rwa.lat . © 2026 RWA.LAT — All rights reserved. Privacy Policy Terms of Service support@rwa.lat' },
  ],
}
const snapshot = JSON.stringify(original)
const shown = displayLegalPublication(original, brand)
assert.equal(shown.adapted, true)
assert.equal(shown.document.sections[0].body, 'KIMENG at https://kimengresearch.com. Fees are 3.00%.')
assert.equal(shown.document.sections[1].body, 'Contact support@a-reit.com .')
assert.equal(shown.document.version, original.version)
assert.equal(shown.document.effectiveDate, original.effectiveDate)
assert.equal(JSON.stringify(original), snapshot, 'Published source must stay immutable')
assert.deepEqual(displayLegalPublication(original, brand, true), { document: original, adapted: false })
assert.deepEqual(displayLegalPublication(original, { ...brand, id: 'areit' }), { document: original, adapted: false })
const future = { ...original, version: 'terms-2', revision: 2 }
assert.deepEqual(displayLegalPublication(future, brand), { document: future, adapted: false }, 'Future legal text must not be rewritten')
assert.equal(formatLegalEffectiveDate('2026-09-18', 'en'), 'September 18, 2026')
assert.equal(formatLegalEffectiveDate('2026-09-18', 'zh-CN'), '2026年9月18日')
assert.equal(formatLegalEffectiveDate('2026-02-30', 'en'), null)
assert.equal(formatLegalEffectiveDate('', 'en'), null)
console.log('Legal publication: branding, immutable originals, future revisions and actual dates passed.')
