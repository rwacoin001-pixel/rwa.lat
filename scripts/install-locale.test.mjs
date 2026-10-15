import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = new URL('../', import.meta.url)

// Evaluate the actual copy and preference effects without mounting browser-only UI.
function load(relative, globals = {}) {
  const path = new URL(relative, root)
  let source = readFileSync(path, 'utf8')
  if (relative === 'components/ios-install-gate.tsx') source += '\nexports.gateCopy = gateCopy\n'
  const exports = {}
  const react = globals.react ?? {}
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(output, {
    ...globals, exports, Set,
    require: name => {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      if (name === '@/lib/app-locales' || name === './app-locales') return load('lib/app-locales.ts')
      if (name === '@/lib/locale-detection') return load('lib/locale-detection.ts')
      if (name.startsWith('@/lib/install-')) {
        const file = `${name.slice(2)}.ts`
        if (existsSync(fileURLToPath(new URL(file, root)))) return load(file)
      }
      return {}
    },
  })
  return exports
}

const { localeOptions } = load('lib/app-locales.ts')
const { installCopy } = load('components/home/HomeInstall.tsx')
const { gateCopy } = load('components/ios-install-gate.tsx')

for (const { code } of localeOptions) {
  test(`${code}: the iPhone gate and browser-specific steps are translated`, () => {
    for (const key of ['title', 'lede', 'safari', 'inApp', 'webApp', 'privateMode', 'done', 'exit']) {
      assert.ok(gateCopy[code][key]?.trim(), `${code}.${key} missing`)
      if (code !== 'en') assert.notEqual(gateCopy[code][key], gateCopy.en[key], `${code}.${key} still falls back to English`)
    }
    for (const key of ['strip', 'stripSub', 'title', 'lede', 'iosNote', 'copyLink', 'copied', 'close']) {
      assert.ok(installCopy[code][key]?.trim(), `${code}.${key} missing`)
      if (code !== 'en') assert.notEqual(installCopy[code][key], installCopy.en[key], `${code}.${key} still falls back to English`)
    }
    for (const [kind, steps] of Object.entries(installCopy[code].guide)) {
      assert.equal(steps.length, 3, `${code}.${kind} needs three steps`)
      if (code !== 'en') assert.notEqual(JSON.stringify(steps), JSON.stringify(installCopy.en.guide[kind]), `${code}.${kind} uses English instructions`)
      for (const text of steps) {
        assert.ok(text.trim())
        assert.equal((text.match(/\[/g) ?? []).length, (text.match(/\]/g) ?? []).length, `${code}.${kind}: broken menu label`)
      }
    }
  })
}

function preferenceHarness(stored, initialLocale = 'fr') {
  const writes = []
  const cookies = []
  const updates = []
  const layoutEffects = []
  const document = { documentElement: { lang: initialLocale, dir: 'ltr' } }
  Object.defineProperty(document, 'cookie', { set: value => cookies.push(value) })
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: value => [value, next => updates.push(next)],
    useLayoutEffect: effect => layoutEffects.push(effect),
    useEffect: () => {},
    useMemo: callback => callback(),
  }
  const { I18nProvider } = load('lib/i18n.tsx', {
    react, document, location: { protocol: 'https:' },
    window: { localStorage: { getItem: () => stored, setItem: (key, value) => writes.push([key, value]) } },
  })
  const provider = I18nProvider({ children: null, initialLocale })
  layoutEffects.forEach(effect => effect())
  return { writes, cookies, updates, document, value: provider.props.value }
}

test('automatic IP/device detection is not saved as a manual language choice', () => {
  const state = preferenceHarness(null)
  assert.equal(state.updates.at(-1), 'fr')
  assert.equal(state.writes.length, 0)
  assert.equal(state.cookies.length, 0)
})

test('a previously selected language is preserved and migrated for server rendering', () => {
  const state = preferenceHarness('ar', 'zh-CN')
  assert.equal(state.updates.at(-1), 'ar')
  assert.deepEqual(state.writes.at(-1), ['rwa-language', 'ar'])
  assert.match(state.cookies.at(-1), /^rwa-language=ar;/)
})

test('manual choice persists and immediately updates document language and RTL', () => {
  const state = preferenceHarness(null)
  state.value.setLocale('ar')
  assert.deepEqual(state.writes.at(-1), ['rwa-language', 'ar'])
  assert.match(state.cookies.at(-1), /SameSite=Lax; Secure$/)
  assert.equal(state.document.documentElement.lang, 'ar')
  assert.equal(state.document.documentElement.dir, 'rtl')
})

test('invalid storage cannot turn automatic fallback into a saved choice', () => {
  const state = preferenceHarness('<script>')
  assert.equal(state.updates.at(-1), 'fr')
  assert.equal(state.writes.length, 0)
  assert.equal(state.cookies.length, 0)
})
