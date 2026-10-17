import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// lib/home-lifecycle.ts is TypeScript with a relative import; transpile both files in memory so the real code runs.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const lib = resolve(dirname(fileURLToPath(import.meta.url)), '../lib')

function load(kycRequired) {
  const previous = process.env.NEXT_PUBLIC_KYC_REQUIRED
  if (kycRequired === undefined) delete process.env.NEXT_PUBLIC_KYC_REQUIRED
  else process.env.NEXT_PUBLIC_KYC_REQUIRED = kycRequired
  const compile = (name) => ts.transpileModule(readFileSync(resolve(lib, name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const policy = { exports: {} }
  new Function('module', 'exports', 'process', compile('kyc-policy.ts'))(policy, policy.exports, process)
  const home = { exports: {} }
  new Function('module', 'exports', 'require', compile('home-lifecycle.ts'))(home, home.exports, (id) => {
    if (id === './kyc-policy') return policy.exports
    throw new Error(`unexpected import ${id}`)
  })
  if (previous === undefined) delete process.env.NEXT_PUBLIC_KYC_REQUIRED
  else process.env.NEXT_PUBLIC_KYC_REQUIRED = previous
  return { policy: policy.exports, ...home.exports }
}

const base = { sessionLoaded: true, session: { emailVerified: true }, wallet: { available: 0, locked: 0, pending: 0, invested: 0 }, positionsCount: 0, kyc: { state: 'not_started' } }

test('KYC off (default): an unverified account is not "kyc_incomplete" and gets no verification CTA', () => {
  const { resolveHomeState, heroCta, policy } = load(undefined)
  assert.equal(policy.KYC_REQUIRED, false)
  const state = resolveHomeState(base)
  assert.equal(state.lifecycle, 'unfunded')
  assert.equal(heroCta(state).kind, 'deposit')
  assert.equal(resolveHomeState({ ...base, wallet: { ...base.wallet, available: 50 } }).lifecycle, 'funded')
})

test('KYC off: failed KYC lookup or rejected/expired KYC changes nothing', () => {
  const { resolveHomeState } = load('false')
  assert.equal(resolveHomeState({ ...base, kyc: null }).lifecycle, 'unfunded')
  assert.equal(resolveHomeState({ ...base, kyc: { state: 'rejected' } }).variant, null)
  const held = resolveHomeState({ ...base, kyc: { state: 'expired' }, positionsCount: 2 })
  assert.equal(held.lifecycle, 'invested')
  assert.equal(held.variant, null)
  assert.equal(held.degraded, false)
})

test('KYC on: the original behaviour is restored', () => {
  const { resolveHomeState, heroCta, policy } = load('true')
  assert.equal(policy.KYC_REQUIRED, true)
  const state = resolveHomeState(base)
  assert.equal(state.lifecycle, 'kyc_incomplete')
  assert.equal(heroCta(state).kind, 'continueKyc')
  assert.equal(resolveHomeState({ ...base, kyc: { state: 'rejected' } }).variant, 'kyc_rejected')
  assert.equal(resolveHomeState({ ...base, positionsCount: 2, kyc: { state: 'expired' } }).variant, 'invested_restricted')
  assert.equal(resolveHomeState({ ...base, kyc: { state: 'approved' } }).lifecycle, 'unfunded')
})
