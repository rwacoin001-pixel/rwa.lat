import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// lib/toast-tone.ts is plain TypeScript; transpile it in memory so the real code runs.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../lib/toast-tone.ts'), 'utf8')
const mod = { exports: {} }
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod, mod.exports)
const { toastTone } = mod.exports

test('failure wording gets the alert tone in every language', () => {
  for (const message of ['提交失败，请稍后再试', '无法连接服务器', 'Request failed', 'Unable to load', 'Code expired', 'No se pudo guardar', 'Échec de l’envoi', 'Falha ao enviar', 'فشل الإرسال']) {
    assert.equal(toastTone(message), 'error', message)
  }
})

test('ordinary messages stay neutral and success is never guessed', () => {
  for (const message of ['请先登录后继续', 'Link copied', 'Settings saved', '已复制', 'Signed in successfully']) {
    assert.equal(toastTone(message), 'info', message)
  }
})
