import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const startupFile = resolve('components/app-startup.tsx')
const compiled = ts.transpileModule(readFileSync(startupFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function mount({ path = '/home', installed = true, seen = false, reducedMotion = false } = {}) {
  let cursor = 0, now = 0, pathname = path
  const slots = [], effects = [], timers = new Map(), listeners = new Map()
  const storage = new Map(seen ? [['rwa:startup:logo:v2', '1']] : [])
  const storageWrites = []
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = value }]
    },
    useLayoutEffect(setup) { const index = cursor++; if (!(index in slots)) { slots[index] = true; effects.push({ setup }) } },
    useEffect() {},
  }
  const environment = {
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reducedMotion : installed && query.includes('standalone') }),
    navigator: { userAgent: 'Android' },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { storage.set(key, value); storageWrites.push(key) } },
    document: { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    window: {
      setTimeout: (fn, delay) => { const id = Symbol(); timers.set(id, { fn, due: now + delay }); return id },
    },
    clearTimeout: id => timers.delete(id),
  }
  const previous = new Map(Object.keys(environment).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(environment)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const fixture = new Module(startupFile)
  fixture.require = name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    if (name === 'next/navigation') return { usePathname: () => pathname }
    if (name === '@/lib/rwa-theme') return { useRwaTheme: () => ({ theme: 'dark' }) }
    if (name === '@/lib/app-startup') return require('../lib/app-startup.ts')
    if (name === '@/components/rwa-logo') return { default: 'RwaLogoMark' }
    if (name.endsWith('.module.css')) return { default: {} }
    throw new Error(`Unexpected import: ${name}`)
  }
  fixture._compile(compiled, startupFile)
  return {
    render() { cursor = 0; return fixture.exports.default() },
    flush() { for (const effect of effects) { if (!effect.active) { effect.cleanup = effect.setup(); effect.active = true } } },
    strictReplay() { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup() } },
    navigate(path) { pathname = path; return this.render() },
    advance(ms) {
      now += ms
      for (const [id, timer] of [...timers.entries()].sort((a, b) => a[1].due - b[1].due)) {
        if (timer.due <= now) { timers.delete(id); timer.fn() }
      }
    },
    writes: storageWrites,
    hide() { environment.document.hidden = true; listeners.get('visibilitychange')?.() },
    cleanup() {
      for (const effect of effects) effect.cleanup?.()
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    },
  }
}

test('installed entrance remains one bounded logo across route navigation', () => {
  const app = mount()
  try {
    assert.equal(app.render(), null)
    app.flush()
    assert.equal(app.render().type.name, 'LogoStartupVisual')
    assert.equal(app.navigate('/markets').props.leaving, false)
    assert.deepEqual(app.writes, ['rwa:startup:logo:v2'])
    app.advance(1000)
    assert.equal(app.render().props.leaving, true)
    app.advance(240)
    assert.equal(app.render(), null)
    assert.equal(app.navigate('/home'), null)
  } finally { app.cleanup() }
})

test('StrictMode cleanup does not strand the splash or write the session twice', () => {
  const app = mount()
  try {
    app.render(); app.flush(); app.strictReplay()
    assert.equal(app.render().type.name, 'LogoStartupVisual')
    assert.deepEqual(app.writes, ['rwa:startup:logo:v2'])
    app.advance(1240)
    assert.equal(app.render(), null)
  } finally { app.cleanup() }
})

test('public/auth documents, repeat sessions and reduced motion never insert a later splash', () => {
  for (const options of [{ path: '/auth/callback/google' }, { seen: true }, { installed: false }, { reducedMotion: true }]) {
    const app = mount(options)
    try {
      app.render(); app.flush()
      assert.equal(app.render(), null)
      assert.equal(app.navigate('/home'), null)
      assert.deepEqual(app.writes, [])
    } finally { app.cleanup() }
  }
})

test('backgrounding dismisses the entrance without restarting it', () => {
  const app = mount()
  try {
    app.render(); app.flush(); app.hide()
    assert.equal(app.render(), null)
    app.advance(1000)
    assert.equal(app.render(), null)
    app.advance(240)
    assert.equal(app.navigate('/home'), null)
  } finally { app.cleanup() }
})

test('manifest launches current home while preserving the installed application identity', () => {
  const manifestFile = resolve('app/manifest.ts')
  const fixture = new Module(manifestFile)
  fixture._compile(ts.transpileModule(readFileSync(manifestFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, manifestFile)
  const manifest = fixture.exports.default()
  assert.equal(manifest.start_url, '/home')
  assert.equal(manifest.id, '/')
  assert.equal(manifest.background_color, '#F4F1EA')
  assert.equal(manifest.theme_color, '#F4F1EA')
})
