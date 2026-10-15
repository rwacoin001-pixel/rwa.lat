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

function runBootstrap({ path = '/home', standalone = false, ua = 'Mozilla/5.0', session = null, browsing = false } = {}) {
  const dataset = {}
  const replaced = []
  const store = (values) => ({ getItem: (key) => values[key] ?? null })
  vm.runInNewContext(documentPreferencesBootstrap, {
    document: {
      documentElement: { dataset, style: { setProperty() {} }, lang: 'en', dir: 'ltr' },
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild() {} },
    },
    navigator: { userAgent: ua, standalone: false },
    location: { pathname: path, replace: (to) => replaced.push(to) },
    localStorage: store(session ? { 'rwa.session': session } : {}),
    sessionStorage: store(browsing ? { 'rwa.browse-as-guest': '1' } : {}),
    matchMedia: (query) => ({ matches: standalone && /standalone/.test(query) }),
  })
  return { dataset, replaced }
}

test('an installed app opened signed out goes straight to sign-in', () => {
  assert.deepEqual(runBootstrap({ standalone: true }).replaced, ['/login'])
  assert.deepEqual(runBootstrap({ standalone: true, path: '/' }).replaced, ['/login'])
  assert.deepEqual(runBootstrap({ ua: 'Mozilla/5.0 RwaLatAndroidTrial/0.1' }).replaced, ['/login'])
  assert.equal(runBootstrap({ standalone: true }).dataset.launch, 'app')
})

test('signed in, "look around first", other pages and browser tabs are left alone', () => {
  assert.deepEqual(runBootstrap({ standalone: true, session: '{"sessionToken":"x"}' }).replaced, [])
  assert.deepEqual(runBootstrap({ standalone: true, browsing: true }).replaced, [])
  assert.deepEqual(runBootstrap({ standalone: true, path: '/markets' }).replaced, [])
  const tab = runBootstrap({ standalone: false })
  assert.deepEqual(tab.replaced, [])
  assert.equal(tab.dataset.launch, undefined, 'no launch screen in a browser tab')
})

function runSplash({ installed, placeholders }) {
  const events = {}
  const timers = []
  let observer = null
  let removed = false
  const classes = new Set()
  const splash = { remove: () => { removed = true }, classList: { add: (name) => classes.add(name) } }
  const doc = {
    readyState: 'loading',
    documentElement: { dataset: installed ? { launch: 'app' } : {} },
    body: {},
    getElementById: () => splash,
    querySelector: () => (placeholders.count ? {} : null),
    addEventListener: (name, fn) => { events[name] = fn },
  }
  vm.runInNewContext(launchSplashScript, {
    document: doc,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    MutationObserver: class { constructor(fn) { observer = { fn, disconnected: false }; this.o = observer } observe() {} disconnect() { this.o.disconnected = true } },
  })
  return {
    ready: () => { doc.readyState = 'interactive'; events.DOMContentLoaded?.() },
    mutate: () => observer?.fn(),
    timers,
    get leaving() { return classes.has('is-leaving') },
    get removed() { return removed },
  }
}

test('the launch screen stays while the loading placeholder is up and leaves once the first screen renders', () => {
  const placeholders = { count: 1 }
  const splash = runSplash({ installed: true, placeholders })
  splash.ready()
  assert.equal(splash.leaving, false)
  placeholders.count = 0
  splash.mutate()
  assert.equal(splash.leaving, true)
  assert.ok(splash.timers.some(t => t.ms === 8000), 'safety stop')
})

test('outside the installed app the launch screen is removed at once', () => {
  assert.equal(runSplash({ installed: false, placeholders: { count: 1 } }).removed, true)
})
