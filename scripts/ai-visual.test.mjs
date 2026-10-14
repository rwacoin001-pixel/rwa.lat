import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
function load(file, imports = {}, globals = {}) {
  const exports = {}, names = Object.keys(globals)
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', ...names, code)(id => {
    if (id === 'react/jsx-runtime') return jsx
    if (id.endsWith('.css')) return {}
    if (!(id in imports)) throw new Error(`Unexpected import: ${id}`)
    return imports[id]
  }, exports, ...Object.values(globals))
  return exports
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, type))
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
}
function runtime() {
  const slots = [], pending = []; let cursor = 0
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }] },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index] },
    useEffect(effect, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((v, i) => v !== old.deps[i])) { slots[index] = { deps, cleanup: old?.cleanup }; pending.push(() => { old?.cleanup?.(); slots[index].cleanup = effect() }) } },
  }
  return { react, render(fn, mount) { cursor = 0; const result = fn(); mount?.(result); pending.splice(0).forEach(fn => fn()); return result }, cleanup() { slots.forEach(slot => slot?.cleanup?.()) } }
}

test('screen context identifies operation pages without disclosing IDs, queries or private state', () => {
  const routes = load('lib/routes-v2.ts')
  const { aiPageContext } = load('lib/ai-page-context.ts', { './routes-v2': routes })
  assert.deepEqual(aiPageContext('/assets/cash/deposit', '?code=secret&balance=10000'), { pageKey: 'cashDeposit' })
  assert.deepEqual(aiPageContext('/markets', '?tab=predictions&user=private'), { pageKey: 'markets', tab: 'predictions' })
  assert.deepEqual(aiPageContext('/markets', '?tab=private'), { pageKey: 'markets' })
  assert.equal(aiPageContext('/ai'), undefined)
  assert.equal(aiPageContext('/not-a-registered-page'), undefined)
})

test('FAQ subtitles rotate, pause during interaction and visibility changes, and fill a draft only', () => {
  const r = runtime(), timers = new Map(), doc = { hidden: false }, selected = []
  let id = 0, reduced = false
  const browser = { setInterval: fn => { timers.set(++id, fn); return id }, clearInterval: id => timers.delete(id) }
  const Ticker = load('components/maison/AiFaqTicker.tsx', { react: r.react, 'motion/react': { motion: { span: 'span' }, AnimatePresence: 'animate', useReducedMotion: () => reduced }, 'lucide-react': {} }, { window: browser, document: doc }).default
  const render = () => r.render(() => Ticker({ questions: ['How to use this screen?', 'How to deposit?'], label: 'Common questions', onSelect: text => selected.push(text) }))
  let tree = render()
  assert.equal(nodes(tree, 'button')[0].props['aria-label'], 'Common questions: How to use this screen?')
  timers.values().next().value(); tree = render()
  assert.equal(nodes(tree, 'button')[0].props['aria-label'], 'Common questions: How to deposit?')
  doc.hidden = true; timers.values().next().value(); tree = render()
  assert.equal(nodes(tree, 'button')[0].props['aria-label'], 'Common questions: How to deposit?')
  tree.props.onFocus(); tree = render(); assert.equal(timers.size, 0)
  nodes(tree, 'button')[0].props.onClick(); assert.deepEqual(selected, ['How to deposit?'])
  tree.props.onBlur(); reduced = true; render(); assert.equal(timers.size, 0)
  r.cleanup()
})

function imageReader(width, height) {
  const policy = load('lib/ai-attachment-policy.ts')
  const guard = load('lib/ai-input-guard.ts', { './bip39-english.json': JSON.parse(readFileSync('lib/bip39-english.json', 'utf8')) })
  const metrics = { closed: 0, fill: 0, drawn: 0 }
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: () => metrics.fill++, drawImage: () => metrics.drawn++ }), toBlob: fn => fn(new Blob(['bounded-jpeg'], { type: 'image/jpeg' })) }
  class Reader { readAsDataURL() { this.result = 'data:image/jpeg;base64,' + Buffer.from('bounded-jpeg').toString('base64'); queueMicrotask(() => this.onload()) } abort() {} }
  const parsed = load('lib/ai-file-parser.ts', { './ai-attachment-policy': policy, './ai-input-guard': guard }, { createImageBitmap: async () => ({ width, height, close: () => metrics.closed++ }), document: { createElement: () => canvas }, FileReader: Reader })
  return { ...parsed, metrics, canvas }
}
test('image preparation sends bounded pixels even when no OCR text exists, releasing decoded resources', async () => {
  const f = imageReader(4000, 2000), progress = []
  const image = await f.readAiFile({ name: 'scene.webp', type: 'image/webp', size: 250000 }, 'zh-CN', [], new AbortController().signal, value => progress.push(value))
  assert.equal(image.method, 'image'); assert.equal(image.text, '')
  assert.equal(image.mime, 'image/jpeg'); assert.ok(image.dataUrl.startsWith('data:image/jpeg;base64,'))
  assert.deepEqual([image.width, image.height], [1920, 960])
  assert.equal(progress.at(-1), 100); assert.equal(f.metrics.closed, 1); assert.equal(f.metrics.drawn, 1)
  assert.deepEqual([f.canvas.width, f.canvas.height], [0, 0])
})
test('oversized decoded images fail before rendering and release resources', async () => {
  const f = imageReader(5000, 5000)
  await assert.rejects(f.readAiFile({ name: 'large.png', type: 'image/png', size: 1000 }, 'en', [], new AbortController().signal, () => {}), /tooLarge/)
  assert.equal(f.metrics.drawn, 0); assert.equal(f.metrics.closed, 1)
})

test('the pearl is driven by recognition events, never opens a microphone, and holds still when asked', () => {
  const pearl = load('components/maison/AiPearl.tsx', { react: { useEffect() {}, useRef: initial => ({ current: initial }) } }, { navigator: new Proxy({}, { get() { throw new Error('The visual must not acquire the microphone') } }) })
  const at = (state, energy = 0, still = false, time = 1.3) => pearl.pearlGeometry({ size: 200, time, state, energy, inset: .36, still })
  // A recognised word (energy 1) swells the listening pearl; the same energy does nothing at rest.
  assert.ok(at('listening', 1).radius > at('listening', 0).radius + 4)
  assert.equal(at('idle', 1).radius, at('idle', 0).radius)
  // Reduced motion and message avatars draw one composed frame: no breathing, no drift, arc parked at 12 o'clock.
  assert.equal(at('idle', 0, true, 0).radius, at('idle', 0, true, 7).radius)
  assert.equal(at('thinking', 0, true).arcStart, -Math.PI / 2)
  const tree = pearl.default({ state: 'thinking', size: 28, still: true })
  assert.equal(tree.props['data-state'], 'thinking'); assert.equal(tree.props['aria-hidden'], true)
})
