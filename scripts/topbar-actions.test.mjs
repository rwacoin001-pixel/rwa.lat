import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(path, imports = {}, globals = {}) {
  const exports = {}, names = Object.keys(globals)
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', ...names, code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  }, exports, ...Object.values(globals))
  return exports
}
const { sharePage } = load('lib/share-page.ts')
const config = load('lib/rwa-topbar-config.ts')
const url = 'https://rwa.lat/prediction/example'

test('native share succeeds without copying or a false copied notice', async () => {
  let copied = 0
  assert.equal(await sharePage(url, { share: async data => assert.deepEqual(data, { url }), clipboard: { writeText: async () => copied++ } }), 'shared')
  assert.equal(copied, 0)
})
test('cancelling native share leaves the clipboard unchanged', async () => {
  let copied = 0
  assert.equal(await sharePage(url, { share: async () => { throw { name: 'AbortError' } }, clipboard: { writeText: async () => copied++ } }), 'cancelled')
  assert.equal(copied, 0)
})
test('failed native share falls back to copying the exact page URL', async () => {
  let copied
  assert.equal(await sharePage(url, { share: async () => { throw new Error('unsupported') }, clipboard: { writeText: async value => { copied = value } } }), 'copied')
  assert.equal(copied, url)
})
test('clipboard-only sharing reports success only after the write succeeds', async () => {
  assert.equal(await sharePage(url, { clipboard: { writeText: async value => assert.equal(value, url) } }), 'copied')
  assert.equal(await sharePage(url, { clipboard: { writeText: async () => { throw new Error('denied') } } }), 'failed')
  assert.equal(await sharePage(url, {}), 'failed')
})

function topbarRuntime(signedIn = true) {
  const navigated = []
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  const Topbar = load('components/rwa-topbar.tsx', {
    'react/jsx-runtime': jsx,
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-dom': { createPortal: node => node }, 'lucide-react': {},
    '@/lib/rwa-theme': { useRwaTheme: () => ({ theme: 'light', toggleTheme() {} }) }, './maison/theme-reveal': { revealTheme() {} },
    '@/lib/rwa-topbar-config': config, '@/lib/share-page': { sharePage }, '@/lib/routes': { navigate: route => navigated.push(route) },
    '@/lib/i18n': { useI18n: () => ({ locale: 'en' }) }, '@/hooks/useAccount': { useSignedIn: () => signedIn },
    '@/hooks/useScrollChrome': { expandChrome() {}, useScrollChrome: () => false }, '@/hooks/useLargeTitle': { useLargeTitle: () => false },
    '@/hooks/useUnread': { useUnread: () => ({ unread: 0 }) }, '@/hooks/useEdgeSwipeBack': { useEdgeSwipeBack() {} },
    '@/lib/toast-store': { showToast() {} }, './ui/Segmented': {}, './rwa-logo': { default: 'logo' }, '@/lib/use-community-me': {}, './community-avatar': {},
    './language-menu': { default: 'language' }, './topbar-actions.module.css': { default: {} },
  }, { window: { scrollY: 0 }, history: { state: {} } }).default
  return { Topbar, navigated }
}
function buttons(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(buttons)
  return [...(tree.type === 'button' ? [tree] : []), ...buttons(tree.props?.children)]
}
test('unsupported contextual buttons are absent; the back handler remains active', () => {
  const { Topbar } = topbarRuntime()
  let back = 0
  const visible = buttons(Topbar({ screen: 'prediction-detail', onBack: () => back++ }))
  assert.deepEqual(visible.map(node => node.props['aria-label']), ['Back'])
  visible[0].props.onClick({}); assert.equal(back, 1)
})
test('explicit contextual actions render and respect disabled state', () => {
  const { Topbar } = topbarRuntime()
  let opened = 0
  const props = { screen: 'prediction-detail', action: { label: 'How to play', onClick: () => opened++ } }
  const active = buttons(Topbar(props)).find(node => node.props['aria-label'] === 'How to play')
  active.props.onClick({}); assert.equal(opened, 1)
  const inactive = buttons(Topbar({ ...props, action: { ...props.action, disabled: true } })).find(node => node.props['aria-label'] === 'How to play')
  assert.equal(inactive.props.disabled, true); inactive.props.onClick({}); assert.equal(opened, 1)
})
test('guest inbox actions are hidden while supported destinations and custom slot handlers work', () => {
  const guest = topbarRuntime(false)
  assert.deepEqual(buttons(guest.Topbar({ screen: 'notifications' })).map(node => node.props['aria-label']), ['Back'])
  const active = topbarRuntime()
  buttons(active.Topbar({ screen: 'wallet', onBack() {} })).find(node => node.props['aria-label'] === 'Transactions').props.onClick({})
  assert.deepEqual(active.navigated, [{ id: 'wallet.transactions' }])
  const slots = []
  buttons(active.Topbar({ screen: 'address-book', onSlot: slot => slots.push(slot) })).find(node => node.props['aria-label'] === 'Add').props.onClick({})
  assert.deepEqual(slots, ['plus'])
})
