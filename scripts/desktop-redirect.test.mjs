import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/desktop-redirect.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
runInNewContext(compiled, { exports })
const TARGET = 'https://www.capitaland-ascendasreit.com/'

function browser({ width = 1280, path = '/home', search = '', hash = '', coarse = false, userAgent = 'Desktop', touchPoints = 0, framed = false, legacy = false } = {}) {
  let viewportWidth = width
  const redirects = []
  const media = []
  const location = { pathname: path, search, hash, replace: value => redirects.push(value) }
  const window = {
    matchMedia(query) {
      const listeners = new Set()
      const matches = () => viewportWidth >= Number(query.match(/min-width:\s*(\d+)px/)?.[1] ?? 0)
        && (!query.includes('pointer: fine') || !coarse)
        && (!query.includes('hover: hover') || !coarse)
      const item = { matches, listeners }
      media.push(item)
      return {
        get matches() { return matches() },
        ...(legacy
          ? { addListener: listener => listeners.add(listener) }
          : { addEventListener: (_event, listener) => listeners.add(listener) }),
      }
    },
  }
  window.self = window
  window.top = framed ? {} : window
  runInNewContext(exports.desktopRedirectBootstrap, {
    window, location, navigator: { userAgent, maxTouchPoints: touchPoints },
  })
  return {
    redirects,
    resize(nextWidth) {
      const previous = media.map(item => item.matches())
      viewportWidth = nextWidth
      media.forEach((item, index) => {
        if (item.matches() !== previous[index]) {
          for (const listener of item.listeners) listener({ matches: item.matches() })
        }
      })
    },
  }
}

for (const width of [375, 390, 430, 768, 1023]) {
  test(`a ${width}px viewport remains in the mobile app`, () => {
    assert.deepEqual(browser({ width }).redirects, [])
  })
}

for (const width of [1024, 1280, 1920]) {
  test(`a ${width}px viewport goes directly to the external desktop site`, () => {
    assert.deepEqual(browser({ width }).redirects, [TARGET])
  })
}

test('the root homepage redirects directly at desktop width', () => {
  assert.deepEqual(browser({ path: '/', width: 1024 }).redirects, [TARGET])
})

test('the root homepage remains local below the breakpoint and redirects after widening', () => {
  const page = browser({ path: '/', width: 1023 })
  assert.deepEqual(page.redirects, [])
  page.resize(1024)
  assert.deepEqual(page.redirects, [TARGET])
})

test('a direct wide /desktop visit uses the external destination', () => {
  assert.deepEqual(browser({ path: '/desktop', search: '?from=%2Fassets' }).redirects, [TARGET])
})

test('a narrow /desktop visit is left to the existing mobile fallback', () => {
  assert.deepEqual(browser({ path: '/desktop', width: 390 }).redirects, [])
})

test('width alone controls a touch-only tablet with a mobile user agent', () => {
  assert.deepEqual(browser({ width: 1024, coarse: true, userAgent: 'iPad', touchPoints: 5 }).redirects, [TARGET])
})

test('a touchscreen Macintosh is also classified by viewport width', () => {
  assert.deepEqual(browser({ width: 1024, userAgent: 'Macintosh', touchPoints: 2 }).redirects, [TARGET])
})

test('a desktop user agent with a narrow window is not redirected', () => {
  assert.deepEqual(browser({ width: 800, userAgent: 'Windows' }).redirects, [])
})

for (const path of ['/auth/github/callback', '/api/v1/health', '/privacy', '/terms', '/dev/funds-security', '/design-preview', '/_next/static/example.js']) {
  test(`${path} remains accessible even at desktop width`, () => {
    const page = browser({ path, width: 1023, search: '?code=private-code' })
    page.resize(1280)
    assert.deepEqual(page.redirects, [])
  })
}

test('application paths, query parameters and fragments are never forwarded', () => {
  const page = browser({ path: '/assets/cash', search: '?session=private-value&returnTo=%2Fhome', hash: '#private-fragment' })
  assert.deepEqual(page.redirects, [TARGET])
})

test('crossing the breakpoint redirects an already open narrow window once', () => {
  const page = browser({ width: 1023 })
  assert.deepEqual(page.redirects, [])
  page.resize(1024)
  page.resize(1200)
  page.resize(1000)
  page.resize(1280)
  assert.deepEqual(page.redirects, [TARGET])
})

test('legacy media-query listeners support the same width transition', () => {
  const page = browser({ width: 800, legacy: true })
  page.resize(1024)
  assert.deepEqual(page.redirects, [TARGET])
})

test('embedded phone previews are not redirected out of their parent page', () => {
  const page = browser({ width: 1280, framed: true })
  page.resize(800)
  page.resize(1280)
  assert.deepEqual(page.redirects, [])
})
