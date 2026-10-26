import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) }
function load(file, imports = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', ...Object.keys(globals), code)(id => {
    if (id === 'react/jsx-runtime') return jsx
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }
    if (!(id in imports)) throw new Error(`Unexpected import ${id}`)
    return imports[id]
  }, exports, ...Object.values(globals))
  return exports
}
function hooks() {
  const slots = [], effects = [], frames = new Map(), timers = new Map()
  let cursor = 0, id = 0, now = 0
  const media = Object.assign(new EventTarget(), { matches: false })
  const browser = Object.assign(new EventTarget(), {
    matchMedia: () => media, requestAnimationFrame: fn => { frames.set(++id, fn); return id }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id }, clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { timers.set(++id, { fn, ms, repeat: true }); return id }, clearInterval: id => timers.delete(id),
  })
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }] },
    useRef(initial) { return slots[cursor++] ??= { current: initial } },
    useCallback(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value },
    useMemo(fn, deps) { return react.useCallback(fn, deps)() },
    useId() { return react.useRef('notice-panel').current },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!equal(old?.deps, deps)) { slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn() }) } },
    useLayoutEffect(fn, deps) { react.useEffect(fn, deps) },
  }
  return { react, browser, media, timers, frames, globals: { window: browser, performance: { now: () => now }, requestAnimationFrame: browser.requestAnimationFrame, cancelAnimationFrame: browser.cancelAnimationFrame },
    render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(fn => fn()); return result },
    frame(time) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)) },
    timer(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms) { if (!timer.repeat) timers.delete(id); timer.fn() } },
    cleanup() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, type))
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
}

test('all configured screens remove bell slots but retain the supported bell action', () => {
  const config = load('lib/rwa-topbar-config.ts')
  for (const [page, slots] of Object.entries(config.pageSlots)) assert.ok(!Object.values(slots).includes('bell'), page)
  for (const screen of Object.keys(config.rwaScreenTopbarKinds)) assert.ok(!Object.values(config.slotsForScreen(screen)).includes('bell'), screen)
  assert.equal(config.topbarDestinations.bell, 'notifications')
})

test('answer reveal progresses without breaking emoji, finishes on tap, and cancels frames', () => {
  const f = hooks(), { useReveal } = load('components/maison/useReveal.ts', { react: f.react }, f.globals)
  const text = 'Hello 😀 world '.repeat(12), render = () => f.render(() => useReveal(text, true))
  assert.equal(render().visible, '')
  for (let time = 0; time < 1800; time += 23) {
    f.frame(time); const result = render()
    assert.ok(text.startsWith(result.visible))
    assert.ok(!/[\uD800-\uDBFF]$/.test(result.visible))
  }
  render().finish(); assert.equal(render().visible, text); assert.equal(render().revealing, false)
  f.cleanup(); assert.equal(f.frames.size, 0)
})

test('reduced motion reveals immediately and a changed preference finishes an active answer', () => {
  const f = hooks(), { useReveal } = load('components/maison/useReveal.ts', { react: f.react }, f.globals)
  f.media.matches = true
  const render = () => f.render(() => useReveal('Full answer 😀', true))
  assert.equal(render().visible, 'Full answer 😀'); assert.equal(f.frames.size, 0)
  f.cleanup()
  const g = hooks(), hook = load('components/maison/useReveal.ts', { react: g.react }, g.globals).useReveal
  const again = () => g.render(() => hook('Another answer', true))
  again(); g.media.matches = true; g.media.dispatchEvent(new Event('change'))
  assert.equal(again().visible, 'Another answer'); assert.equal(g.frames.size, 0); g.cleanup()
})

function trayFixture(locale = 'en') {
  const f = hooks(), document = Object.assign(new EventTarget(), { visibilityState: 'visible' }), calls = []
  let data = Array.from({ length: 6 }, (_, i) => ({ id: String(i), kind: 'wallet.deposit', title: `Notice ${i}`, body: `Body ${i}`, createdAt: `2026-10-26T0${i}:00:00Z`, readAt: null, payload: { route: '/assets' } }))
  let digest = { ok: true, data: { summary: 'Digest result' } }
  const api = { markNotificationRead: async id => { calls.push(['read', id]); return { ok: true } }, markAllNotificationsRead: async () => { calls.push(['all']); return { ok: true } }, getNotificationDigest: async () => digest }
  const { AiNoticeTray } = load('components/maison/AiNoticeTray.tsx', { react: f.react, 'lucide-react': { ChevronUp: 'chevron' }, '@/hooks/useUnread': { useUnread: () => ({ data, unread: data.filter(item => !item.readAt).length, refetch: async () => calls.push(['refetch']) }) }, '@/lib/api/notifications': api, '@/lib/display/labels': { localNotice: item => item }, '@/lib/display/format': { formatTime: value => value }, '@/lib/maison-nav': { openPath: path => calls.push(['open', path]) } }, { ...f.globals, document, navigator: { vibrate: ms => calls.push(['vibrate', ms]) } })
  const props = { locale, disabled: false, hidden: false, onAsk: text => calls.push(['ask', text]), onSummary: text => calls.push(['summary', text]) }
  const render = () => f.render(() => AiNoticeTray(props))
  render(); render(); f.frame(0); f.frame(16)
  const button = label => nodes(render(), 'button').find(node => node.props.children === label)
  const expand = () => { nodes(render(), 'button').find(node => 'aria-expanded' in node.props).props.onClick(); render() }
  return { ...f, document, props, calls, render, button, expand, data, setData: next => { data = next }, setDigest: next => { digest = next } }
}

test('notice tray sorts newest first, caps at five, and asks without navigating', async () => {
  const f = trayFixture(); f.expand()
  assert.equal(nodes(f.render(), 'li').length, 5)
  await f.button('Ask AI').props.onClick()
  assert.deepEqual(f.calls.filter(call => call[0] !== 'vibrate'), [['read', '5'], ['refetch'], ['ask', 'Explain this notice: Notice 5. Body 5']])
  f.cleanup()
})

test('unsafe notice destinations fall back to the inbox after marking read', async () => {
  for (const route of ['//evil.example', '/\\evil.example', 'https://evil.example', undefined, '/assets']) {
    const f = trayFixture(); f.data[5].payload.route = route; f.expand()
    const item = nodes(f.render(), 'li')[0]
    await nodes(item, 'button')[0].props.onClick()
    assert.deepEqual(f.calls.slice(-3), [['read', '5'], ['refetch'], ['open', route === '/assets' ? '/assets' : '/notifications']]); f.cleanup()
  }
})

test('summary appends locally; failure and empty summaries ask the fallback question', async () => {
  for (const digest of [{ ok: true, data: { summary: 'Digest result' } }, { ok: false }, { ok: true, data: { summary: null } }]) {
    const f = trayFixture('zh-CN'); f.setDigest(digest); f.expand()
    await f.button('让 AI 总结').props.onClick()
    assert.deepEqual(f.calls.at(-1), digest.ok && digest.data.summary ? ['summary', 'Digest result'] : ['ask', '总结一下我的未读通知']); f.cleanup()
  }
})

test('ticker pauses for expanded, hidden and reduced-motion states; exit retains then removes the tray', () => {
  const f = trayFixture(), title = () => nodes(f.render(), 'button').find(node => 'aria-expanded' in node.props)?.props['aria-label']
  const first = title(); f.timer(4500); assert.notEqual(title(), first)
  f.expand(); const expanded = title(); f.timer(4500); assert.equal(title(), expanded)
  f.browser.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })); f.render()
  f.document.visibilityState = 'hidden'; f.document.dispatchEvent(new Event('visibilitychange')); f.render()
  const hidden = title(); f.timer(4500); assert.equal(title(), hidden)
  f.document.visibilityState = 'visible'; f.document.dispatchEvent(new Event('visibilitychange')); f.media.matches = true; f.media.dispatchEvent(new Event('change')); f.render()
  f.timer(4500); assert.equal(title(), hidden)
  f.media.matches = false; f.media.dispatchEvent(new Event('change')); f.render()
  f.props.hidden = true; f.render(); assert.notEqual(f.render(), null)
  f.timer(300); assert.equal(f.render(), null); f.cleanup(); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0)
})

test('mark all read refetches and zero unread exits with the retained row before unmounting', async () => {
  const f = trayFixture(); f.expand()
  await f.button('Mark all read').props.onClick()
  assert.deepEqual(f.calls.slice(-2), [['all'], ['refetch']])
  f.setData(f.data.map(item => ({ ...item, readAt: '2026-10-26T06:00:00Z' })))
  f.render(); const leaving = f.render()
  assert.equal(leaving.props.inert, true); assert.ok(nodes(leaving, 'button').length > 0)
  f.timer(300); assert.equal(f.render(), null); f.cleanup()
})

test('new-notice pulse ends after 600ms and does not replay when the tray reopens', () => {
  const f = trayFixture(), dot = () => nodes(f.render(), 'span').find(node => node.props.className === 'noticeDot')
  assert.equal(dot().props['data-pulse'], undefined)
  f.setData([...f.data, { ...f.data[5], id: 'new' }]); f.render()
  assert.equal(dot().props['data-pulse'], true)
  f.timer(600); assert.equal(dot().props['data-pulse'], undefined)
  f.props.hidden = true; f.render(); f.timer(300); f.render()
  f.props.hidden = false; f.render(); f.frame(1000); f.frame(1016)
  assert.equal(dot().props['data-pulse'], undefined); f.cleanup()
})

test('summary cannot append or fall back after its component unmounts', async () => {
  for (const result of [{ ok: true, data: { summary: 'Old account digest' } }, { ok: false }]) {
    const f = trayFixture(); let resolve
    f.setDigest(new Promise(done => { resolve = done })); f.expand()
    const pending = f.button('AI summary').props.onClick()
    assert.equal(f.button('…').props.disabled, true)
    f.cleanup(); resolve(result); await pending
    assert.ok(!f.calls.some(([name]) => name === 'summary' || name === 'ask'))
  }
})

test('disabled controls cannot start actions and expanded items never nest buttons', async () => {
  const f = trayFixture(); f.props.disabled = true; f.expand()
  const buttons = nodes(f.render(), 'button')
  for (const button of buttons) assert.equal(nodes(button.props.children, 'button').length, 0)
  await f.button('Ask AI').props.onClick(); await f.button('AI summary').props.onClick(); await f.button('Mark all read').props.onClick()
  assert.deepEqual(f.calls, [['vibrate', 6]]); f.cleanup()
})

function screenFixture() {
  const f = hooks(), storage = { getItem: () => null, setItem() {}, removeItem() {} }, scrolls = []
  let bottom = 600
  f.browser.innerHeight = 800; f.browser.sessionStorage = storage
  const session = { AI_CHAT_SESSION_KEY: 'fixture', parseAiChatSession: () => null, serializeAiChatSession: () => null, clearAiChatSession() {} }
  const { AiChatScreen } = load('components/maison/AiChatScreen.tsx', {
    react: { ...f.react, Fragment: 'fragment' }, 'next/link': { __esModule: true, default: 'link' }, 'next/dynamic': { __esModule: true, default: () => 'community' }, 'lucide-react': {},
    '@/lib/ai-input-guard': { containsWalletSecret: () => false }, '@/lib/ai-account-intent': { accountScopesFor: () => [] }, '@/lib/ai-navigation-link': { aiNavigationLink: () => null },
    './AiQuestionCard': { __esModule: true, default: 'questions' }, '../community-avatar': { CommunityAvatar: 'avatar' }, '../community-compose': { useCommunityMe: () => null }, '@/hooks/useAccount': { useSignedIn: () => true },
    '@/hooks/useScrollChrome': { expandChrome() {}, useScrollChrome: () => false }, '@/lib/maison-nav': { openPath() {} }, '@/lib/routes': { navigate() {} },
    '@/lib/api/_http': { SESSION_CHANGED: 'session-changed', SESSION_EXPIRED: 'session-expired', request: async () => ({ ok: true, data: { available: true } }) },
    '@/lib/i18n': { useI18n: () => ({ locale: 'en' }) }, '@/lib/maison-content-copy': { aiChatCopy: { en: {} } }, '@/lib/maison-ai-copy': { aiShellCopy: { en: { name: 'AI' } }, aiInputCopy: () => ({}) },
    '@/lib/ai-voice-copy': { aiVoiceCopy: () => ({}) }, '@/lib/ai-visual-copy': { aiVisualCopy: () => ({ prompts: [] }) }, '@/lib/ai-attachment-policy': { showAiAnswer: () => true }, '@/lib/ai-chat-session': session,
    './AiComposer': { __esModule: true, default: 'composer' }, '@/lib/buddy-signals': { buddySignal() {} }, '@/components/buddy/BuddyFace': { BuddyFace: 'buddy' }, '@/lib/ai-pearl-copy': { aiPearlCopy: () => ({}), pearlGreeting: () => 'Hello' },
    '@/lib/ai-surface-state': load('lib/ai-surface-state.ts'), './AiAnswerActions': { __esModule: true, default: 'actions' }, './AiNoticeTray': { AiNoticeTray: 'tray' }, './useReveal': { useReveal() {} }, './primitives': { MaisonPage: 'page' },
  }, { ...f.globals, sessionStorage: storage, navigator: { vibrate() {} } })
  const render = () => {
    const tree = f.render(() => AiChatScreen({ onClose() {}, onPlan() {} }))
    const end = nodes(tree, 'div').find(node => node.props.className === 'end')
    end.props.ref.current = { getBoundingClientRect: () => ({ bottom }), scrollIntoView: options => scrolls.push(options) }
    return tree
  }
  const answer = () => {
    const find = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(find) : [...(tree.type?.name === 'Answer' ? [tree] : []), ...find(tree.props?.children)]
    return find(render()).at(-1)
  }
  render(); render()
  return { ...f, render, answer, scrolls, setBottom: value => { bottom = value; f.browser.dispatchEvent(new Event('scroll')) } }
}

test('chat inserts summary messages with unique IDs and reveals actions only after completion', () => {
  const f = screenFixture(), tray = () => nodes(f.render(), 'tray')[0]
  tray().props.onSummary('First digest')
  assert.equal(f.answer().props.text, 'First digest'); assert.equal(f.answer().props.reveal, true)
  assert.equal(nodes(f.render(), 'div').find(node => node.props.className === 'answerExtras').props.inert, true)
  f.answer().props.onDone(); assert.equal(f.answer().props.reveal, false)
  tray().props.onSummary('Second digest')
  const actions = nodes(f.render(), 'actions')
  assert.equal(actions.length, 2); assert.notEqual(actions[0].props.localId, actions[1].props.localId)
  assert.equal(f.answer().props.text, 'Second digest'); assert.equal(f.answer().props.reveal, true)
  f.cleanup()
})

test('typing and voice states hide notices, and session reset remounts their pending work', () => {
  const f = screenFixture(), tray = () => nodes(f.render(), 'tray')[0], composer = () => nodes(f.render(), 'composer')[0]
  assert.equal(tray().props.hidden, false)
  composer().props.onChange('draft'); assert.equal(tray().props.hidden, true)
  composer().props.onChange(''); composer().props.onVoice({ state: 'listening', live: '' }); assert.equal(tray().props.hidden, true)
  composer().props.onVoice({ state: 'idle', live: '' }); assert.equal(tray().props.hidden, false)
  const key = tray().key
  f.browser.dispatchEvent(new Event('session-changed')); assert.notEqual(tray().key, key)
  f.cleanup()
})

test('reveal following is throttled to 120ms and stops when the reader leaves the bottom', () => {
  const f = screenFixture()
  f.frame(1000); nodes(f.render(), 'tray')[0].props.onSummary('A digest')
  f.answer(); assert.equal(f.scrolls.length, 1)
  f.frame(1010); f.answer().props.onProgress(); f.frame(1020); f.answer().props.onProgress()
  assert.equal(f.scrolls.length, 1)
  f.frame(1120); f.timer(110); assert.equal(f.scrolls.length, 2)
  f.setBottom(1000); f.frame(1300); f.answer().props.onProgress(); assert.equal(f.scrolls.length, 2)
  f.setBottom(600); f.answer().props.onProgress(); assert.equal(f.scrolls.length, 3)
  f.cleanup()
})
