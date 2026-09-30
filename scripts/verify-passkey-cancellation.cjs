const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const source = fs.readFileSync('lib/api/auth.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

async function check(stage) {
  const controller = new AbortController()
  let saved = 0, verifies = 0
  const credential = { id: 'cred', rawId: new ArrayBuffer(0), type: 'public-key',
    response: { authenticatorData: new ArrayBuffer(0), clientDataJSON: new ArrayBuffer(0), signature: new ArrayBuffer(0) },
    getClientExtensionResults: () => ({}) }
  global.window = { isSecureContext: true, PublicKeyCredential: function () {} }
  Object.defineProperty(global, 'navigator', { configurable: true, value: { credentials: { get: async () => {
    if (stage === 'credential') controller.abort()
    return credential
  } } } })
  const http = {
    request: async (path, options) => {
      if (path.endsWith('/challenge')) {
        if (stage === 'challenge') controller.abort()
        return { ok: true, data: { challengeId: 'test', options: { challenge: 'aA' } } }
      }
      verifies++
      assert.equal(options.signal, controller.signal, 'verification request must also be cancellable')
      if (stage === 'verify') controller.abort()
      return { ok: true, data: { token: 'test-token', sessionId: 'session', userId: 'user' } }
    },
    saveSession: () => saved++,
  }
  const exportsObject = {}
  new Function('exports', 'require', compiled)(exportsObject, name => {
    if (name === './_http') return http
    if (name === './auth-flow') return { authDevice: () => ({}) }
    if (name === './oauth-state') return {}
    throw new Error(`Unexpected runtime dependency: ${name}`)
  })
  const result = await exportsObject.loginWithPasskey({ signal: controller.signal, mediation: 'required', email: 'a@example.test' })
  if (stage === 'success') {
    assert.equal(result.ok, true); assert.equal(saved, 1); assert.equal(verifies, 1)
  } else {
    assert.equal(result.ok, false, `${stage}: cancelled requests must not report success`)
    assert.equal(result.error.code, 'PASSKEY_CANCELLED'); assert.equal(saved, 0)
    assert.equal(verifies, stage === 'verify' ? 1 : 0)
  }
}

;(async () => {
  for (const stage of ['challenge', 'credential', 'verify', 'success']) await check(stage)
  console.log('PASS: passkey cancellation at challenge, credential and verification; successful session retained')
})().catch(error => { console.error(error); process.exitCode = 1 })
