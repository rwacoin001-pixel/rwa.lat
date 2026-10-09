const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('../node_modules/typescript')
const originalNow = Date.now
let now = originalNow(), cursor = 0, states = [], refs = [], effects = [], proof = null, nativeCalls = 0, nativeSuccess = false, pathname = '/profile/security'
Date.now = () => now
const listeners = {}, data = new Map()
global.document = { visibilityState: 'visible', addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener() {} }
global.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
global.window = { isSecureContext: false, addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener() {}, location: { replace: value => { window.destination = value } } }
let session = { userId: 'alice', sessionId: 'session-1', loggedInAt: new Date(now).toISOString() }
const react = {
  useId: () => 'unlock-title-fixture',
  useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value }] },
  useRef: initial => { const i = cursor++; return refs[i] ??= { current: initial } },
  useEffect: fn => { effects.push(fn) },
}
const filename = require('node:path').resolve(__dirname, '../components/session-privacy-gate.tsx')
const fixture = new Module(filename)
fixture.require = name => {
  if (name === 'react') return react
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  if (name === 'next/navigation') return { usePathname: () => pathname }
  if (name === 'lucide-react') return { Fingerprint: 'Fingerprint' }
  if (name === './app-loading') return { default: 'AppLoading' }
  if (name === './rwa-logo') return { default: 'RwaLogoMark' }
  if (name === '@/lib/api/_http') return { readSession: () => session, SESSION_CHANGED: 'session', clearSession: () => { session = null; listeners.session?.() } }
  if (name === '@/lib/api/auth') return { logout: async () => { session = null; listeners.session?.() } }
  if (name === '@/lib/ai-chat-session') return { clearAiChatSession() {} }
  if (name === '@/lib/api/security') return { listSecurityFactors: async () => ({ ok: true, data: { passkeys: [{ state: 'active' }] } }), stepUpWithPasskey: async () => { assert.equal(window.isSecureContext, true); nativeCalls++; return nativeSuccess ? { ok: true, data: { reauthentication: 'native-proof' } } : { ok: false, error: { code: 'PASSKEY_CANCELLED' } } } }
  if (name === '@/lib/i18n') return { useI18n: () => ({ locale: 'en' }) }
  if (name === '@/lib/rwa-theme') return { useRwaTheme: () => ({ theme: 'light' }) }
  if (name.endsWith('.module.css')) return { default: {} }
  if (name === '@/lib/session-unlock-copy') {
    const copyFile = require('node:path').resolve(__dirname, '../lib/session-unlock-copy.ts')
    const copy = new Module(copyFile)
    copy._compile(ts.transpileModule(fs.readFileSync(copyFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, copyFile)
    return copy.exports
  }
  if (name === '@/lib/maison-funds-copy') return { fundsCopy: { en: { stepUp: { title: 'Confirm', verifying: 'Verifying' } } } }
  if (name === './maison/primitives') return { MaisonPage: 'MaisonPage', maison: {} }
  if (name === './maison/StepUp') return { useStepUp: () => ({ run: async (_required, action) => proof ? action(proof) : null, sheet: 'sheet' }) }
  if (name === '@/lib/session-idle') return { needsIdleVerification: last => !Number.isFinite(last) || last <= 0 || last > now || now - last >= 86400000 }
  throw Error(`Unexpected import: ${name}`)
}
fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename)
function render() { cursor = 0; return fixture.exports.default({ children: 'ACCOUNT_PRIVATE_CONTENT' }) }
function buttons(node, result = []) {
  if (!node || typeof node !== 'object') return result
  if (node.type === 'button') result.push(node)
  for (const item of [node.props?.children].flat(Infinity)) buttons(item, result)
  return result
}
async function click(index) { buttons(render())[index].props.onClick(); await new Promise(resolve => setImmediate(resolve)) }
;(async () => {
  assert.equal(render().type, 'AppLoading', 'Initial clock check has no fingerprint screen or private content')
  effects.at(-1)()
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT')
  pathname = '/markets'
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Fresh session navigation must preserve the mounted application before effects')
  effects.at(-1)()
  pathname = '/assets'
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Second menu navigation must not replace the application with a lock screen')
  effects.at(-1)()
  document.visibilityState = 'hidden'; listeners.visibilitychange()
  now += 86400000
  document.visibilityState = 'visible'; listeners.visibilitychange()
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Background return locks at 24h')
  await click(0)
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Cancellation stays locked')
  assert.equal(nativeCalls, 0, 'Unsupported browser never invokes Passkey')
  proof = 'VALIDATED_PROOF'
  await click(0)
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Successful verification unlocks')
  window.isSecureContext = true; window.PublicKeyCredential = function () {}
  Object.defineProperty(global, 'navigator', { configurable: true, value: { credentials: { get() {} } } })
  document.visibilityState = 'hidden'; listeners.visibilitychange()
  now += 86400000
  document.visibilityState = 'visible'; listeners.visibilitychange()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(nativeCalls, 1, 'Supported device prompts automatically')
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Native cancellation stays locked')
  pathname = '/login'; render(); effects.at(-1)()
  listeners.keydown()
  pathname = '/profile/security'
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Returning from login cannot briefly mount private content')
  effects.at(-1)()
  await new Promise(resolve => setImmediate(resolve))
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Login-page activity cannot reset the locked account clock')
  await click(0)
  nativeSuccess = true
  document.visibilityState = 'hidden'; listeners.visibilitychange(); now += 86400000
  document.visibilityState = 'visible'; listeners.visibilitychange()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Verified native Passkey unlocks')
  nativeSuccess = false
  document.visibilityState = 'hidden'; listeners.visibilitychange(); now += 86400000
  document.visibilityState = 'visible'; listeners.visibilitychange()
  await new Promise(resolve => setImmediate(resolve))
  await click(1)
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Logout event must not reveal account before navigation')
  assert.equal(window.destination, '/login')
  states = []; refs = []; effects = []
  pathname = '/home'; render(); effects.at(-1)()
  pathname = '/markets'
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Guest menu navigation must also preserve the mounted application')
  session = { userId: 'alice', sessionId: 'desktop-old-session', loggedInAt: new Date(now - 86400000).toISOString() }
  states = []; refs = []; effects = []
  pathname = '/desktop'
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Public desktop presentation renders immediately even with an idle session')
  const callsBeforeDesktop = nativeCalls
  effects.at(-1)()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Desktop presentation does not request identity verification')
  assert.equal(nativeCalls, callsBeforeDesktop, 'Desktop presentation never starts native verification')
  assert.equal(data.has('rwa.idle.alice.desktop-old-session'), false, 'Public presentation does not refresh the private account activity clock')
  pathname = '/profile/security'
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Leaving the public desktop cannot expose a stale private account')
  effects.at(-1)()
  await new Promise(resolve => setImmediate(resolve))
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Private account still locks after viewing the public presentation')
  pathname = '/desktop/'
  assert.equal(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Desktop presentation also remains public with a trailing slash')
  effects.at(-1)()
  pathname = '/desktop-account'
  assert.notEqual(render(), 'ACCOUNT_PRIVATE_CONTENT', 'Only the desktop presentation is exempt, not paths sharing its prefix')
  console.log('PASS: initial privacy, background 24h lock, unsupported browser, automatic Passkey, cancellation, verified unlock, logout without content flash')
})().finally(() => { Date.now = originalNow })
