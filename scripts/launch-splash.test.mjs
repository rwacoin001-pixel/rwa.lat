import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Same loader as the other script tests: transpile the real modules, no bundler.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(relative) {
  const source = readFileSync(new URL('../' + relative, import.meta.url), 'utf8')
  const exports = {}
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(output, { exports, require: (name) => name.endsWith('app-locales') ? load('lib/app-locales.ts') : require(name) })
  return exports
}
const { documentPreferencesBootstrap } = load('lib/document-preferences-bootstrap.ts')
const { launchSplashScript } = load('lib/launch-splash.ts')

function runBootstrap({ path = '/home', standalone = false, ua = 'Mozilla/5.0', session = null, search = '', saved = {} } = {}) {
  const dataset = {}
  const replaced = []
  const store = (values) => ({ getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = String(value) }, removeItem: (key) => { delete values[key] } })
  const context = {
    document: {
      documentElement: { dataset, style: { setProperty() {} }, lang: 'en', dir: 'ltr' },
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild() {} },
    },
    navigator: { userAgent: ua, standalone: false },
    location: { pathname: path, search, replace: (to) => replaced.push(to) },
    localStorage: store({ ...saved, ...(session ? { 'rwa.session': session } : {}) }),
    matchMedia: (query) => ({ matches: standalone && /standalone/.test(query) }),
    URLSearchParams,
    addEventListener() {},
  }
  // The bootstrap is a page script: it reaches the global object as `window` (install prompt, colour scheme).
  context.window = context
  vm.runInNewContext(documentPreferencesBootstrap, context)
  return { dataset, replaced }
}

test('an installed app opened signed out goes straight to sign-in', () => {
  assert.deepEqual(runBootstrap({ standalone: true }).replaced, ['/login'])
  assert.deepEqual(runBootstrap({ standalone: true, path: '/' }).replaced, ['/login'])
  assert.deepEqual(runBootstrap({ ua: 'Mozilla/5.0 RwaLatAndroidTrial/0.1' }).replaced, ['/login'])
  assert.equal(runBootstrap({ standalone: true }).dataset.launch, 'app')
})

test('signed in, other pages and browser tabs are left alone', () => {
  assert.deepEqual(runBootstrap({ standalone: true, session: '{"sessionToken":"x"}' }).replaced, [])
  assert.deepEqual(runBootstrap({ standalone: true, path: '/markets' }).replaced, [])
  const tab = runBootstrap({ standalone: false })
  assert.deepEqual(tab.replaced, [])
  assert.equal(tab.dataset.launch, undefined, 'no launch screen in a browser tab')
})

function runSplash({ installed, placeholders }) {
  const events = {}
  const timers = []
  let observer = null
  const dataset = installed ? { launch: 'app' } : {}
  const doc = {
    readyState: 'loading',
    documentElement: { dataset },
    body: {},
    querySelector: () => (placeholders.count ? {} : null),
    addEventListener: (name, fn) => { events[name] = fn },
  }
  vm.runInNewContext(launchSplashScript, {
    document: doc,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    MutationObserver: class { constructor(fn) { observer = { fn } } observe() {} disconnect() {} },
  })
  return {
    ready: () => { doc.readyState = 'interactive'; events.DOMContentLoaded?.() },
    mutate: () => observer?.fn(),
    flush: (ms) => timers.filter(t => t.ms === ms).forEach(t => t.fn()),
    timers,
    get state() { return dataset.launchState },
  }
}

test('the launch screen stays while the loading placeholder is up and leaves once the first screen renders', () => {
  const placeholders = { count: 1 }
  const splash = runSplash({ installed: true, placeholders })
  splash.ready()
  assert.equal(splash.state, undefined)
  placeholders.count = 0
  splash.mutate()
  assert.equal(splash.state, 'leaving')
  splash.flush(320)
  assert.equal(splash.state, 'gone')
  assert.ok(splash.timers.some(t => t.ms === 8000), 'safety stop')
})

test('the safety stop clears it even if a placeholder never goes away', () => {
  const splash = runSplash({ installed: true, placeholders: { count: 1 } })
  splash.ready()
  splash.flush(8000)
  assert.equal(splash.state, 'leaving')
})

test('outside the installed app the script does nothing (CSS keeps the element hidden)', () => {
  const splash = runSplash({ installed: false, placeholders: { count: 1 } })
  splash.ready()
  assert.equal(splash.state, undefined)
  assert.equal(splash.timers.length, 0)
})

test('Paper & Glass is the default; a device can keep the classic colours', () => {
  assert.equal(runBootstrap().dataset.palette, 'a')
  assert.equal(runBootstrap({ search: '?palette=classic' }).dataset.palette, undefined)
  assert.equal(runBootstrap({ saved: { 'rwa.palette': 'classic' } }).dataset.palette, undefined)
  assert.equal(runBootstrap({ search: '?palette=a', saved: { 'rwa.palette': 'classic' } }).dataset.palette, 'a')
})
