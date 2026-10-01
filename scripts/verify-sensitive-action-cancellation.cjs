const fs = require('node:fs')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('../node_modules/typescript')
const cleanups = []
const react = { useRef: value => ({ current: value }), useState: value => [value, () => {}], useCallback: fn => fn,
  useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup) } }
const filename = require('node:path').resolve(__dirname, '../components/maison/StepUp.tsx')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const fixture = new Module(filename)
fixture.require = name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } : {}
fixture._compile(compiled, filename)
;(async () => {
  const { run, sheet } = fixture.exports.useStepUp()
  let submissions = 0
  const action = async () => { submissions++; return { ok: true, data: 'done' } }
  const cancelled = run(true, action)
  sheet.props.onDone(null)
  assert.equal(await cancelled, null)
  assert.equal(submissions, 0, 'Cancellation must not submit an operation')
  const first = run(true, action)
  sheet.props.onDone({ reauthentication: 'first', expiresInSeconds: 300, method: 'passkey' })
  assert.equal((await first).ok, true)
  const second = run(true, action)
  await Promise.resolve()
  assert.equal(submissions, 1, 'Second operation must wait for fresh verification')
  sheet.props.onDone(null)
  assert.equal(await second, null)
  const abandoned = run(true, action)
  cleanups.forEach(fn => fn())
  assert.equal(await abandoned, null, 'Leaving the page must cancel a pending operation')
  assert.equal(submissions, 1)
  console.log('PASS: cancellation, fresh verification for each operation, unmount cancellation')
})().catch(error => { console.error(error); process.exitCode = 1 })
