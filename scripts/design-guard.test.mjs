// Keeps the design system from drifting back: the global stylesheet may only shrink, has no dead rules,
// and the shared UI components take colours from tokens, not literals.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const baseline = JSON.parse(fs.readFileSync('scripts/design-guard.baseline.json', 'utf8'))
const css = fs.readFileSync('app/globals.css', 'utf8')
const classSelectors = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1])).size

test('app/globals.css does not grow (new styles belong in CSS modules using --ds-* tokens)', () => {
  const lines = css.split('\n').length
  assert.ok(lines <= baseline.globalsLines, `globals.css has ${lines} lines, baseline ${baseline.globalsLines}. Put new styles in a CSS module; if you removed rules, lower scripts/design-guard.baseline.json.`)
  assert.ok(classSelectors <= baseline.globalsClasses, `globals.css names ${classSelectors} classes, baseline ${baseline.globalsClasses}.`)
})

test('global stylesheets contain no class that no source file mentions', () => {
  for (const file of ['app/globals.css', 'styles/ios.css']) {
    const out = execFileSync(process.execPath, ['scripts/prune-css.mjs', file], { encoding: 'utf8' })
    assert.match(out, /^0 selectors/, `${file}: ${out.trim()} (run: node scripts/prune-css.mjs ${file} --write)`)
  }
})

test('shared UI components use tokens, not raw colours', () => {
  const dir = 'components/ui'
  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.module.css'))) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8')
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text), false, `${name} has a raw hex colour`)
  }
})
