import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audit } from './design-audit.mjs'

test('flags off-scale font sizes, including the font shorthand', () => {
  const found = audit('.a { font-size: 14px; } .b { font: 600 12.5px/1.4 var(--sans); } .c { font-size: 15px; }')
  assert.deepEqual(found.map(f => [f.kind, f.value]), [['font', 14], ['font', 12.5]])
})

test('accepts the scale, tokens, calc() and hairlines', () => {
  const css = `.a { font-size: var(--pa-fs-body); border-radius: 22px; padding: 16px 24px; gap: 8px; }
.b { padding: calc(10px + env(safe-area-inset-top)) 16px; border-radius: 2px; margin: 1px; border-radius: 50%; }`
  assert.deepEqual(audit(css), [])
})

test('flags off-scale radius and spacing with line numbers', () => {
  const found = audit('.a {\n  border-radius: 14px;\n  padding: 10px 16px;\n}')
  assert.deepEqual(found.map(f => [f.kind, f.value, f.line]), [['radius', 14, 2], ['space', 10, 3]])
})

test('ignores values inside comments', () => {
  assert.deepEqual(audit('/* font-size: 9px */ .a { gap: 12px; }'), [])
})

test('reads declarations that span lines, rem sizes and fixed calc() literals', () => {
  const found = audit('.a {\n  padding:\n    10px 16px;\n  font-size: 0.875rem;\n  gap: calc(10px + 4px);\n  margin: calc(10px + env(safe-area-inset-top));\n}')
  assert.deepEqual(found.map(f => [f.kind, f.value]), [['space', 10], ['font', 14], ['space', 10]])
})

test('checks inline styles in TSX', async () => {
  const { auditTsx } = await import('./design-audit.mjs')
  const found = auditTsx("<p style={{ fontSize: 14, padding: '10px 16px', borderRadius: 22 }} />")
  assert.deepEqual(found.map(f => [f.kind, f.value]), [['font', 14], ['space', 10]])
})
