const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const exp = {}
const code = ts.transpileModule(fs.readFileSync('lib/api/_http.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
let started = 0, finished = 0
new Function('exports', 'require', code)(exp, () => ({ beginUiLoading() { started++; let done = false; return () => { if (!done) { finished++; done = true } } } }))
const fetchBefore = global.fetch
const hang = (_url, options) => new Promise((_resolve, reject) => {
  const abort = () => reject(new DOMException('Aborted', 'AbortError'))
  if (options.signal.aborted) abort()
  else options.signal.addEventListener('abort', abort, { once: true })
})
;(async () => {
  try {
    global.fetch = hang
    const timedOut = await exp.request('/v1/auth/email-code/request', { method: 'POST', token: null, timeoutMs: 25 })
    assert.equal(timedOut.ok, false); assert.equal(timedOut.error.code, 'REQUEST_TIMEOUT')
    assert.equal(started, finished)
    const controller = new AbortController(); controller.abort()
    const aborted = await exp.request('/v1/auth/email-code/request', { method: 'POST', token: null, signal: controller.signal })
    assert.equal(aborted.error.code, 'ABORTED'); assert.equal(started, finished)
    global.fetch = async () => new Response('invalid JSON', { status: 200 })
    const invalid = await exp.request('/v1/auth/email-code/request', { method: 'POST', token: null })
    assert.equal(invalid.error.code, 'INVALID_JSON'); assert.equal(started, finished)
    const before = started
    global.fetch = async () => new Response('{}')
    await exp.request('/v1/notifications', { token: null })
    assert.equal(started, before, 'background reads must not blur the page')
    console.log('PASS: timeout unlock, cancellation, malformed responses, loading cleanup, quiet background reads')
  } finally { global.fetch = fetchBefore }
})().catch(error => { console.error(error); process.exitCode = 1 })
