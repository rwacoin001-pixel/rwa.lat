import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function runtime() {
  const slots = [], pending = []
  let cursor = 0
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }] },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index] },
    useEffect(effect, deps) { const index = cursor++, old = slots[index]; if (!old || !deps || deps.some((value, i) => value !== old.deps[i])) { slots[index] = { deps, cleanup: old?.cleanup }; pending.push(() => { old?.cleanup?.(); slots[index].cleanup = effect() }) } },
  }
  return { react, render(fn) { cursor = 0; const result = fn(); pending.splice(0).forEach(fn => fn()); return result }, cleanup() { slots.forEach(slot => slot?.cleanup?.()) } }
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
function load(path, imports, globals = {}) {
  const exports = {}, names = Object.keys(globals)
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', ...names, code)(name => {
    if (name === 'react/jsx-runtime') return jsx
    if (name.endsWith('.css')) return {}
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  }, exports, ...Object.values(globals))
  return exports.default
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, type))
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
}
const copy = { read: 'Read', readStop: 'Stop reading', speechUnavailable: 'Speech unavailable', actionFailed: 'Failed', like: 'Like', dislike: 'Dislike', share: 'Share' }

test('switching spoken answers updates both cards; old unmount and callbacks preserve the current answer', () => {
  const first = runtime(), second = runtime(), storage = new Map(), spoken = []
  let cancellations = 0
  class Utterance { constructor(text) { this.text = text } }
  const browser = { SpeechSynthesisUtterance: Utterance, speechSynthesis: { cancel: () => cancellations++, speak: value => spoken.push(value) } }
  let currentRuntime = first
  const react = Object.fromEntries(Object.keys(first.react).map(name => [name, (...args) => currentRuntime.react[name](...args)]))
  const Actions = load('components/maison/AiAnswerActions.tsx', { react, 'lucide-react': {}, '@/lib/maison-ai-copy': { aiInputCopy: () => copy, aiShellCopy: { en: { name: 'AI', copied: 'Copied', copy: 'Copy' } } }, '@/lib/api/_http': { readSession: () => ({ userId: 'owner' }), getSessionToken: () => null } }, { window: browser, SpeechSynthesisUtterance: Utterance, localStorage: { getItem: key => storage.get(key) } })
  const render = (r, localId) => { currentRuntime = r; return r.render(() => Actions({ text: localId, localId, locale: 'en' })) }
  nodes(render(first, 'first'), 'button')[0].props.onClick()
  const staleEnd = spoken[0].onend
  nodes(render(second, 'second'), 'button')[0].props.onClick()
  assert.equal(nodes(render(first, 'first'), 'button')[0].props['aria-pressed'], false)
  assert.equal(nodes(render(second, 'second'), 'button')[0].props['aria-pressed'], true)
  const beforeUnmount = cancellations
  first.cleanup(); staleEnd()
  assert.equal(cancellations, beforeUnmount)
  assert.equal(nodes(render(second, 'second'), 'button')[0].props['aria-pressed'], true)
  second.cleanup(); assert.equal(cancellations, beforeUnmount + 1)
})

test('support-page Stop keeps the draft, drops a late reply, and a subsequent send succeeds', async () => {
  const outer = runtime(), inner = runtime(), browser = Object.assign(new EventTarget(), { location: { search: '' } }), pending = []
  const questions = [{ id: 'intent', title: 'What do you need?', options: [{ id: 'a', label: 'Account' }, { id: 'b', label: 'Order' }] }]
  let currentRuntime = outer
  const react = Object.fromEntries(Object.keys(outer.react).map(name => [name, (...args) => currentRuntime.react[name](...args)]))
  const Page = load('app/ai-assistant/page.tsx', {
    react, 'next/link': { __esModule: true, default: 'link' }, '@/lib/ai-navigation-link': { aiNavigationLink: () => null }, '@/lib/api/ai-customer': { aiCustomer: { status: async () => ({ ok: true, data: { provider: 'fixture' } }), chat: (...args) => new Promise(resolve => pending.push({ args, resolve })) } }, '@/lib/i18n': { useI18n: () => ({ locale: 'en' }) }, '@/lib/api/_http': { SESSION_CHANGED: 'changed', SESSION_EXPIRED: 'expired', request: async path => ({ ok: true, data: path === '/v1/ai/sessions' ? [{ id: 'restored', title: 'Saved fixture' }] : { id: 'restored', messages: [{ id: 'saved', role: 'assistant', content: 'HIDDEN RESTORED ANSWER', questions }] } }) }, '@/lib/ai-input-guard': { containsWalletSecret: () => false }, '@/components/maison/AiQuestionCard': { __esModule: true, default: 'questions' }, '@/components/maison/AiComposer': { __esModule: true, default: 'composer' }, '@/components/maison/AiAnswerActions': { __esModule: true, default: 'actions' }, '@/lib/maison-ai-copy': { aiInputCopy: () => copy, aiShellCopy: { en: {} } }, '@/lib/maison-content-copy': { aiChatCopy: { en: { cancelled: 'Stopped waiting; the reply may still be saved.', secret: 'Secret' } } }, '@/lib/ai-attachment-policy': { showAiAnswer: questions => !questions?.length },
  }, { window: browser })
  const Child = outer.render(Page).type
  const render = () => { currentRuntime = inner; return inner.render(Child) }
  const composer = () => nodes(render(), 'composer')[0].props
  composer().onChange('keep this draft')
  const attachment = { name: 'fixture.txt', text: 'actual excerpt', method: 'text' }
  const first = composer().onSend('keep this draft', [attachment])
  assert.equal(composer().busy, true); composer().onStop()
  assert.equal(pending[0].args[5].aborted, true)
  assert.equal(composer().value, 'keep this draft'); assert.equal(composer().busy, false)
  pending[0].resolve({ ok: true, data: { reply: 'late answer', sessionId: 'old', messageId: 'late' } })
  assert.equal(await first, false); assert.equal(nodes(render(), 'article').length, 0)
  const next = composer().onSend('retry draft', [attachment])
  assert.equal(pending[1].args[4][0], attachment)
  pending[1].resolve({ ok: true, data: { reply: 'HIDDEN CURRENT ANSWER', questions, sessionId: 'current', messageId: 'now' } })
  assert.equal(await next, true); assert.equal(nodes(render(), 'article').length, 2)
  assert.equal(JSON.stringify(render()).includes('HIDDEN CURRENT ANSWER'), false); assert.equal(nodes(render(), 'actions').length, 0)
  nodes(render(), 'select')[0].props.onChange({ target: { value: 'restored' } })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(JSON.stringify(render()).includes('HIDDEN RESTORED ANSWER'), false); assert.equal(nodes(render(), 'actions').length, 0); assert.equal(nodes(render(), 'questions').length, 1)
  const third = composer().onSend('unmounted draft', [])
  inner.cleanup(); assert.equal(pending[2].args[5].aborted, true)
  pending[2].resolve({ ok: true, data: { reply: 'after account change', sessionId: 'wrong' } })
  assert.equal(await third, false)
  outer.cleanup()
})
