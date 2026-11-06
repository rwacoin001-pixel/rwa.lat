import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { test } from 'node:test'

function load(file, modules = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, URL, URLSearchParams, AbortSignal, ...globals, require: name => modules[name] ?? {} })
  return exports
}
const { localeOptions } = load('lib/app-locales.ts')
const detection = load('lib/locale-detection.ts', { './app-locales': { localeOptions } })
const { documentPreferencesBootstrap } = load('lib/document-preferences-bootstrap.ts', { './app-locales': { localeOptions } })

test('hydration uses the invitation language before recipient storage and persists it for sign-up', () => {
  for (const { code } of localeOptions) {
    const updates = [], writes = [], effects = []
    const document = { documentElement: {} }
    const react = { createContext: () => ({ Provider: 'Provider' }), useState: x => [x, next => updates.push(next)], useLayoutEffect: fn => effects.push(fn), useEffect() {}, useMemo: fn => fn() }
    const mod = load('lib/i18n.tsx', {
      react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, './brand/build-brand': { brandText: x => x },
      '@/lib/locale-detection': detection, '@/lib/app-locales': { localeOptions }, './app-locales': { localeOptions },
    }, { document, location: { protocol: 'https:' }, window: { location: { search: `?lang=${code}` }, localStorage: { getItem: () => 'zh-CN', setItem: (...args) => writes.push(args) } } })
    mod.I18nProvider({ children: null, initialLocale: 'en' })
    effects.forEach(fn => fn())
    assert.equal(updates.at(-1), code)
    assert.deepEqual(writes.at(-1), ['rwa-language', code])
  }
})

test('the first paint honors the invitation language before old browser storage', () => {
  for (const { code, direction } of localeOptions) {
    const root = { lang: 'zh-CN', dir: 'ltr', dataset: {}, style: { setProperty() {} } }
    const storage = { getItem: key => key === 'rwa-language' ? 'zh-CN' : null, removeItem() {} }
    vm.runInNewContext(documentPreferencesBootstrap, {
      URLSearchParams, Object,
      document: { documentElement: root, querySelectorAll: () => [] },
      localStorage: storage,
      window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
      matchMedia: () => ({ matches: false }), navigator: { userAgent: '' },
      location: { pathname: '/invite', search: `?lang=${code}` },
    })
    assert.equal(root.lang, code)
    assert.equal(root.dir, direction)
  }
})

test('a later manual language change updates the carried URL while preserving registration context', () => {
  const changes = []
  const document = { documentElement: {} }
  const react = { createContext: () => ({ Provider: 'Provider' }), useState: x => [x, () => {}], useLayoutEffect() {}, useEffect() {}, useMemo: fn => fn() }
  const mod = load('lib/i18n.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, './brand/build-brand': { brandText: x => x },
    '@/lib/locale-detection': detection, '@/lib/app-locales': { localeOptions }, './app-locales': { localeOptions },
  }, { document, location: { protocol: 'https:' }, window: {
    location: { href: 'https://kimengresearch.com/register?lang=fr&return=%2Fhome', search: '?lang=fr&return=%2Fhome' },
    history: { state: { entry: 1 }, replaceState: (state, title, url) => changes.push([state, url.href]) },
    localStorage: { setItem() {} },
  } })
  mod.I18nProvider({ children: null, initialLocale: 'fr' }).props.value.setLocale('zh-CN')
  assert.equal(changes.at(-1)?.[1], 'https://kimengresearch.com/register?lang=zh-CN&return=%2Fhome')
})

function referralRoute() {
  const cookies = []
  const mod = load('app/r/[code]/route.ts', { '@/lib/locale-detection': detection, 'next/server': { NextResponse: {
    redirect: (url, status) => ({ location: url.href, status, headers: new Headers(), cookies: { set: (...args) => cookies.push(args) } }),
    json: (body, init) => ({ body, ...init }),
  } } }, {
    Headers, process: { env: {} },
    fetch: async () => ({ ok: true, json: async () => ({ attributionToken: 'signed-existing-attribution', expiresAt: '2027-01-01T00:00:00Z' }) }),
  })
  return { GET: mod.GET, cookies }
}
test('referral redirects carry the inviter language and update an old recipient cookie', async () => {
  const { GET, cookies } = referralRoute()
  const url = new URL('https://kimengresearch.com/r/ABC123?lang=fr')
  const result = await GET({ url: url.href, nextUrl: url, cookies: { get: name => name === 'rwa-language' ? { value: 'zh-CN' } : undefined } }, { params: Promise.resolve({ code: 'ABC123' }) })
  assert.equal(result.location, 'https://kimengresearch.com/invite?lang=fr')
  assert.equal(result.status, 303)
  assert.ok(cookies.some(([key, value]) => key === 'rwa-language' && value === 'fr'))
  assert.ok(cookies.some(([key, value, options]) => key === 'rwa_referral' && value === 'signed-existing-attribution' && options.httpOnly))
})
test('shared paths preserve their query and never redirect to another origin', async () => {
  for (const [next, expected] of [['/community?tab=following', '/community?tab=following&lang=ar'], ['//example.org', '/invite?lang=ar']]) {
    const { GET } = referralRoute()
    const url = new URL(`https://kimengresearch.com/r/ABC123?lang=ar&next=${encodeURIComponent(next)}`)
    const result = await GET({ url: url.href, nextUrl: url, cookies: { get: () => undefined } }, { params: Promise.resolve({ code: 'ABC123' }) })
    assert.equal(result.location, 'https://kimengresearch.com' + expected)
  }
})

test('unsupported languages preserve the destination and recipient language', async () => {
  const { GET, cookies } = referralRoute()
  const url = new URL('https://kimengresearch.com/r/ABC123?lang=invalid')
  const result = await GET({ url: url.href, nextUrl: url, cookies: { get: () => ({ value: 'zh-CN' }) } }, { params: Promise.resolve({ code: 'ABC123' }) })
  assert.equal(result.location, 'https://kimengresearch.com/invite')
  assert.ok(!cookies.some(([key]) => key === 'rwa-language'))
})
