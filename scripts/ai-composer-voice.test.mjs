import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, type))
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
}
function fixture(sendResult = true) {
  const slots = [], effects = [], timers = new Map(), engines = [], sent = []
  let cursor = 0, timerId = 0, value = '保留草稿'
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i])
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useCallback(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!equal(old?.deps, deps)) { slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn() }) } },
    useLayoutEffect(fn, deps) { react.useEffect(fn, deps) },
  }
  class Recognition { constructor() { engines.push(this) } start() {} stop() {} abort() {} }
  const browser = Object.assign(new EventTarget(), { SpeechRecognition: Recognition, navigator: { userAgent: 'Android 15' }, requestAnimationFrame: fn => fn() })
  function load(file, imports) {
    const exports = {}
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require', 'exports', 'window', 'setTimeout', 'clearTimeout', code)(id => {
      if (id === 'react/jsx-runtime') return jsx
      if (id.endsWith('.css')) return {}
      if (!(id in imports)) throw new Error(`Unexpected import ${id}`)
      return imports[id]
    }, exports, browser, (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId }, id => timers.delete(id))
    return exports
  }
  const voice = load('components/maison/useAiVoice.ts', { react })
  const { aiVoiceCopy } = load('lib/ai-voice-copy.ts', {})
  const Composer = load('components/maison/AiComposer.tsx', {
    react, 'motion/react': { motion: { div: 'div', form: 'form' }, AnimatePresence: 'presence', useReducedMotion: () => false }, 'lucide-react': {},
    '@/lib/maison-ai-copy': { aiInputCopy: () => ({ voice: '语音输入', actionFailed: '发送失败', voiceEmpty: '没听到', voiceDenied: '请授权麦克风', voiceFailed: '识别失败', voiceUnavailable: '服务不可用' }) },
    '@/lib/ai-voice-copy': { aiVoiceCopy }, '@/lib/ai-visual-copy': { aiVisualCopy: () => ({ prompts: [] }) },
    '@/lib/ai-attachment-policy': { AI_FILE_LIMITS: { count: 3 } }, '@/lib/ai-file-parser': { readAiFile() { throw new Error('No file expected') } },
    './useAiVoice': voice, '@/lib/ai-surface-state': load('lib/ai-surface-state.ts', {}), '@/components/buddy/BuddyFace': { BuddyFace: 'buddy' }, '@/lib/ai-pearl-copy': { aiPearlCopy: () => ({ listening: '请说…', busy: '正在回答' }) }, './AiFaqTicker': { default: 'ticker', __esModule: true },
  }).default
  const render = () => {
    cursor = 0
    const tree = Composer({ value, onChange: next => { value = next }, onSend: async (message, attachments) => { sent.push({ message, attachments }); return sendResult }, busy: false, locale: 'zh-CN' })
    for (const field of nodes(tree, 'textarea')) field.props.ref.current = { style: {}, scrollHeight: 30, blur() {}, focus() {} }
    effects.splice(0).forEach(fn => fn())
    return tree
  }
  const button = label => nodes(render(), 'button').find(item => item.props['aria-label'] === label).props
  render(); button('语音输入').onClick()
  const capture = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} }
  const event = (y = 300) => ({ button: 0, pointerId: 1, clientY: y, currentTarget: capture, preventDefault() {} })
  return { render, button, engines, sent, value: () => value, event, browser, cleanup: () => slots.forEach(item => item?.cleanup?.()) }
}
const result = text => ({ results: [Object.assign([{ transcript: text }], { isFinal: false })] })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('composer sends Android interim text once on release, retains typed draft and clears only after success', async () => {
  const f = fixture(); f.button('按住说话').onPointerDown(f.event())
  // Connecting: the buddy thinks until the engine reports audio.
  assert.equal(nodes(f.render(), 'buddy')[0].props.mood, 'thinking')
  f.engines[0].onaudiostart(); f.engines[0].onspeechstart()
  assert.equal(nodes(f.render(), 'buddy')[0].props.mood, 'listening')
  f.engines[0].onresult(result('如何充值')); assert.deepEqual(f.sent, [])
  // The live transcript remains visible before release while the buddy listens.
  const tree = f.render()
  assert.ok(nodes(tree, 'p').some(item => item.props.children === '如何充值'))
  assert.equal(nodes(tree, 'buddy')[0].props.mood, 'listening')
  const end = f.engines[0].onend
  f.button('按住说话').onPointerUp(f.event()); end(); end(); await tick()
  assert.deepEqual(f.sent, [{ message: '保留草稿 如何充值', attachments: [] }]); assert.equal(f.value(), '')
  f.cleanup()
})

test('slide cancellation never sends recognised text and leaves the typed draft intact', async () => {
  const f = fixture(); f.button('按住说话').onPointerDown(f.event()); const end = f.engines[0].onend
  f.engines[0].onresult(result('取消此句'))
  f.button('按住说话').onPointerMove(f.event(200)); f.button('按住说话').onPointerUp(f.event(200)); end(); await tick()
  assert.deepEqual(f.sent, []); assert.equal(f.value(), '保留草稿'); f.cleanup()
})

test('recognition connection failures show their own message and keep the draft; failed sends retain recognised text', async () => {
  const f = fixture(false); f.button('按住说话').onPointerDown(f.event()); f.engines[0].onerror({ error: 'network' })
  const alert = nodes(f.render(), 'p').find(item => item.props.role === 'alert')
  assert.match(alert.props.children, /语音识别服务连接失败/); assert.equal(f.value(), '保留草稿')
  f.button('按住说话').onPointerDown(f.event()); f.engines[1].onresult(result('保留语音'))
  f.button('按住说话').onPointerUp(f.event()); f.engines[1].onend(); await tick()
  assert.equal(f.value(), '保留草稿 保留语音'); assert.equal(f.sent.length, 1); f.cleanup()
})
