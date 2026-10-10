const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('lib/api/auth-navigation.ts', 'utf8')
const exportsObject = {}
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exportsObject)
const { safeAuthReturnPath, consumeAuthDestination, markPasskeyOfferSeen, snoozePasskeyOffer, completePasskeyOffer } = exportsObject
const origin = 'https://a-reit.com'
for (const target of ['/login', '/register', '/auth/callback/google', '/recovery?token=x', '/verify-email', '//evil.test', '/\\evil.test', '/', '/%6cogin', '/%2f%2fevil.test']) assert.equal(safeAuthReturnPath(target, origin), null, target)
assert.equal(safeAuthReturnPath('/portfolio?tab=orders#recent', origin), '/portfolio?tab=orders#recent')
for (const oauth of [true, false]) {
  const values = new Map([['rwa.return-to', '/portfolio'], ['rwa.pending-email', 'fixture'], ['rwa.pending-consents', 'fixture']])
  const store = { getItem: key => values.get(key), removeItem: key => values.delete(key) }
  assert.equal(consumeAuthDestination(store, origin, oauth), '/portfolio')
  assert.equal(values.size, 0)
}
assert.equal(consumeAuthDestination({ getItem() { throw Error('disabled') }, removeItem() {} }, origin), '/home')
{
  // A new account lands on the welcome step once, keeping the real destination for "later".
  const values = new Map([['rwa.auth-new-account', '1'], ['rwa.return-to', '/portfolio']])
  const store = { getItem: key => values.get(key), removeItem: key => values.delete(key) }
  assert.equal(consumeAuthDestination(store, origin), '/auth/welcome')
  assert.equal(consumeAuthDestination(store, origin), '/portfolio')
  values.set('rwa.auth-new-account', '1'); values.set('rwa.return-to', '/portfolio')
  assert.equal(consumeAuthDestination(store, origin, true), '/auth/welcome')
  assert.equal(values.has('rwa.return-to'), false)
}
{
  // With passkey support, the offer comes first, then the welcome, then the saved page; a snooze skips it.
  const local = new Map()
  globalThis.window = { isSecureContext: true, PublicKeyCredential: function PublicKeyCredential() {}, localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) } }
  const values = new Map([['rwa.auth-new-account', '1'], ['rwa.return-to', '/portfolio']])
  const store = { getItem: key => values.get(key), removeItem: key => values.delete(key), setItem: (key, value) => values.set(key, value) }
  assert.equal(consumeAuthDestination(store, origin), '/auth/passkey')
  markPasskeyOfferSeen(store)
  assert.equal(consumeAuthDestination(store, origin), '/auth/welcome')
  assert.equal(consumeAuthDestination(store, origin), '/portfolio')
  assert.equal(values.size, 0)
  snoozePasskeyOffer(window.localStorage, 30)
  values.set('rwa.return-to', '/portfolio')
  assert.equal(consumeAuthDestination(store, origin), '/portfolio')
  local.set('rwa.passkey-offer-snooze', String(Date.now() - 1))
  assert.equal(consumeAuthDestination(store, origin), '/auth/passkey')
  delete globalThis.window
}
{
  const values = new Map([['rwa.return-to', '/portfolio']])
  const session = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const local = { getItem: () => null, setItem() {} }
  globalThis.window = { isSecureContext: true, PublicKeyCredential: function () {}, sessionStorage: session, localStorage: local }
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
  assert.equal(completePasskeyOffer(origin, 30), '/portfolio', 'blocked localStorage must preserve the saved page')
  values.set('rwa.return-to', '/portfolio')
  assert.equal(consumeAuthDestination(session, origin), '/portfolio', 'blocked localStorage must only skip the optional offer')
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local })
  values.set('rwa.return-to', '/portfolio')
  session.setItem = () => { throw new Error('QuotaExceededError') }
  assert.equal(completePasskeyOffer(origin, 30), '/portfolio', 'failed seen-marker write must not create a redirect loop')
  values.set('rwa.auth-new-account', '1'); values.set('rwa.return-to', '/portfolio')
  assert.equal(completePasskeyOffer(origin, 30), '/auth/welcome')
  assert.equal(consumeAuthDestination(session, origin, false, true), '/portfolio')
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new Error('SecurityError') } })
  assert.equal(completePasskeyOffer(origin, 30), '/home', 'blocked sessionStorage must still leave the offer')
  delete globalThis.window
}
console.log('PASS: auth destinations, OAuth resume, welcome, passkey offer/snooze, blocked storage getters and failed writes')
