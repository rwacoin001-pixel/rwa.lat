import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'

const load = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const tone = 'data:text/javascript,' + encodeURIComponent(load('lib/toast-tone.ts'))
const store = await import('data:text/javascript,' + encodeURIComponent(load('lib/toast-store.ts').replace("'./toast-tone'", JSON.stringify(tone))))

test('a newer toast replaces the older one and guesses error tone from failure wording', () => {
  let calls = 0
  const off = store.subscribeToast(() => { calls++ })
  store.showToast('Saved')
  assert.equal(store.getToast().tone, 'info')
  store.showToast('Transfer failed')
  assert.equal(store.getToast().tone, 'error')
  store.showToast('Copied', 'ok')
  assert.equal(store.getToast().message, 'Copied')
  assert.equal(store.getToast().tone, 'ok')
  assert.equal(calls, 3)
  off()
})
