// Run the actual screen's handlers with isolated hooks and API boundaries. No network or mail is used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { jsx, jsxs, Fragment } = require('react/jsx-runtime')

const storage = () => {
  const values = new Map([['rwa.onboarded.v2', '1']])
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
global.localStorage = storage()
global.sessionStorage = storage()
global.location = { origin: 'https://a-reit.com', search: '' }
global.window = { addEventListener() {}, removeEventListener() {}, isSecureContext: false, setInterval: () => 0, clearInterval() {} }
global.document = { addEventListener() {}, removeEventListener() {} }
global.matchMedia = () => ({ matches: false })
global.requestAnimationFrame = callback => callback()

function screen(mode = 'register') {
  let index = 0
  let dirty = true
  let tree
  const hooks = []
  const effects = []
  const requests = []
  const replies = new Map()
  const timers = new Map()
  let timerId = 0
  const react = {
    useState(initial) {
      const slot = index++
      if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial
      return [hooks[slot], value => {
        const next = typeof value === 'function' ? value(hooks[slot]) : value
        if (!Object.is(hooks[slot], next)) { hooks[slot] = next; dirty = true }
      }]
    },
    useRef(initial) {
      const slot = index++
      if (!(slot in hooks)) hooks[slot] = { current: initial }
      return hooks[slot]
    },
    useEffect(effect, deps) {
      const slot = index++
      const previous = hooks[slot]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); hooks[slot] = { deps, cleanup: effect() } })
      }
    },
  }
  const requirements = { required: ['terms', 'privacy'].map(documentType => ({ documentType, version: 'v1', href: `/${documentType}` })) }
  const api = {
    lookupEmail: async email => {
      requests.push({ kind: 'lookup', email })
      return { ok: true, data: replies.get(email) ?? { account: 'new', password: false, passkey: false } }
    },
    getAuthConsentRequirements: async () => ({ ok: true, data: requirements }),
    requestEmailCode: async (email, intent, locale, consents) => {
      requests.push({ kind: 'send', email, intent, consents })
      return { ok: true, data: { challengeId: 'test', retryAfter: 60 } }
    },
  }
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs, Fragment },
    'lucide-react': new Proxy({}, { get: (_, name) => String(name) }),
    'next/image': { default: 'image' },
    '@/lib/session-idle': { PASSKEY_ACCOUNT_KEY: 'test.last-account' },
    '@/lib/brand/build-brand': { BRAND: { id: 'kimeng' }, IS_BRAND_PREVIEW: false },
    './brand/ui-copy': { mapBrandCopy: value => value },
    '@/lib/kimeng-desktop': { useKimengDesktop: () => false },
    '@/lib/api/auth': api,
    '@/lib/i18n': { useI18n: () => ({ locale: 'zh-CN', t: value => value }) },
    '@/lib/auth-error-copy': { authErrorMessage: error => error.code, isConsentError: () => false },
    '@/lib/api/_http': { prefetchAuthAttribution() {} },
    '@/lib/api/auth-navigation': { safeAuthReturnPath: () => null },
    '@/lib/use-ui-loading': { useUiLoading() {} },
    '@/lib/api/auth-flow': { continueAuth: () => false },
    '@/lib/api/wallet-connection': {},
    '@/lib/android-app': { isAndroidApp: () => false },
    './AuthShell': { AuthShell: 'auth-shell' },
    '@/components/onboarding/Onboarding': { default: 'onboarding' },
    '@/components/maison/flow-kit': { CodePad: 'code-pad' },
    './InviteCodeField': { InviteCodeField: 'invite-code', useInviteCode: () => ({ status: 'empty', value: '', commit: async () => true }) },
    './AuthLegalFooter': { AuthLegalFooter: 'legal-footer' },
    './FocusTitle': { FocusTitle: 'focus-title' },
  }
  function load(file) {
    const exports = {}
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText
    new Function('require', 'exports', 'setTimeout', 'clearTimeout', source)(name => {
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => String(key) }) }
      if (Object.hasOwn(modules, name)) return modules[name]
      if (/^@\/lib\/(route-copy|auth-visual-copy|maison-auth-copy|auth-email-copy|auth-password-copy)$/.test(name)) {
        return (modules[name] = load(path.resolve(name.replace('@/', '') + '.ts')))
      }
      throw Error(`Unexpected dependency: ${name}`)
    }, exports, (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }, id => timers.delete(id))
    return exports
  }
  const { LoginScreen } = load('components/screens/P02-Login.tsx')
  async function flush() {
    for (let round = 0; round < 15; round++) {
      if (dirty) {
        dirty = false; index = 0
        tree = LoginScreen({ mode, go() {}, notify() {}, onAuthenticated() { throw Error('Editing must not authenticate') } })
      }
      while (effects.length) effects.shift()()
      await Promise.resolve()
    }
    assert.equal(dirty, false, 'screen must settle')
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(child => nodes(child))
    if (!node || typeof node !== 'object') return []
    return [node, ...nodes(node.props?.children)]
  }
  const find = predicate => {
    const node = nodes(tree).find(predicate)
    assert.ok(node, 'expected control must exist')
    return node
  }
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '')
  return {
    requests, replies, flush,
    step: () => tree.props.attrs['data-auth-step'],
    view: () => tree.props.attrs['data-auth-view'],
    heading: () => text(nodes(tree).find(node => node.type === 'h1')),
    async fill(email) { find(node => node.type === 'input' && node.props.type === 'email' && !node.props.hidden).props.onChange({ target: { value: email } }); await flush() },
    async submit() { await find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await flush() },
    async change() { find(node => node.type === 'button' && text(node) === '修改邮箱').props.onClick(); await flush() },
    async consent() { find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await flush() },
    async autoLookup() {
      for (const [id, timer] of timers) if (timer.delay === 1500) { timers.delete(id); timer.callback() }
      await flush()
    },
    sends: () => requests.filter(item => item.kind === 'send'),
  }
}

;(async () => {
  for (const mode of ['register', 'login']) {
    const ui = screen(mode)
    await ui.flush()
    await ui.fill('first@example.com')
    await ui.autoLookup()
    assert.equal(ui.step(), 'new', 'a new email opens account creation')
    assert.equal(ui.sends().length, 0)
    await ui.change()
    assert.equal(ui.heading(), '创建账户', 'editing a new account must preserve registration context')
    assert.equal(ui.view(), 'form', 'registration editing must not become the shared sign-in welcome')
    assert.equal(ui.sends().length, 0, 'change email must not send a code')
    const beforeInvalid = ui.requests.length
    await ui.fill('invalid-address'); await ui.submit()
    assert.equal(ui.requests.length, beforeInvalid, 'an invalid replacement must not reach the API')
    assert.equal(ui.heading(), '创建账户')
    await ui.fill('first@example.com')
    await ui.submit()
    assert.equal(ui.step(), 'new', 'continuing with the same unsent address must still register')
    await ui.change()
    await ui.fill('second@example.com')
    await ui.autoLookup()
    assert.equal(ui.sends().length, 0, 'typing a replacement must not send a code')
    await ui.submit()
    assert.equal(ui.step(), 'new', 'a replacement new address must still register')
    assert.equal(ui.sends().length, 0, 'lookup must not create or email an account')
    await ui.consent()
    await ui.submit()
    assert.deepEqual(ui.sends().map(({ email, intent }) => ({ email, intent })), [{ email: 'second@example.com', intent: 'register' }])
    assert.equal(ui.step(), 'code')
  }
  const ui = screen()
  await ui.flush(); await ui.fill('new@example.com'); await ui.submit(); await ui.change()
  ui.replies.set('blocked@example.com', { account: 'unavailable', password: false, passkey: false })
  await ui.fill('blocked@example.com'); await ui.submit()
  assert.equal(ui.heading(), '创建账户', 'unavailable addresses must stay editable')
  ui.replies.set('member@example.com', { account: 'existing', password: true, passkey: false })
  await ui.fill('member@example.com'); await ui.submit()
  assert.equal(ui.step(), 'password', 'only a fresh lookup of a real member may enter sign-in')
  assert.equal(ui.sends().length, 0)
  await ui.change()
  assert.equal(ui.view(), 'welcome', 'existing-account editing keeps its established behavior')
  console.log('PASS: registration email editing, repeated changes, consent/code intent, existing and unavailable accounts')
})().catch(error => { console.error(error); process.exitCode = 1 })
