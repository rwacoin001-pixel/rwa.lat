import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function fixture(browser, options = {}) {
  const react = {}, exports = {}, timers = new Map()
  const code = ts.transpileModule(readFileSync('components/maison/useAiVoice.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  let timerId = 0
  new Function('require', 'exports', 'window', 'setTimeout', 'clearTimeout', code)(name => { assert.equal(name, 'react'); return react }, exports, browser, fn => { timers.set(++timerId, fn); return timerId }, id => timers.delete(id))
  const create = () => {
    const cleanups = [], states = [], refs = [], received = []
    Object.assign(react, { useState: value => { const index = states.length; states.push(value); return [value, next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] }, useRef: value => { const item = { current: value }; refs.push(item); return item }, useCallback: fn => fn, useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup) } })
    const hook = exports.useAiVoice('zh-CN', text => received.push(text), options)
    return { hook, states, refs, received, cleanup: () => cleanups.forEach(fn => fn()), another: create, expire: () => [...timers.values()].forEach(fn => fn()) }
  }
  return create()
}
test('browser speech actually adds recognised words, with denial and empty results reported', () => {
  let active
  class Recognition { constructor() { active = this } start() {} stop() {} abort() {} }
  const browser = Object.assign(new EventTarget(), { SpeechRecognition: Recognition })
  const f = fixture(browser)
  f.hook.start()
  assert.equal(active.lang, 'zh-CN')
  active.onresult({ results: [[{ transcript: '实际识别的文字' }]] }); active.onend()
  assert.deepEqual(f.received, ['实际识别的文字'])
  f.hook.start(); active.onerror({ error: 'not-allowed' })
  assert.equal(f.states[2], 'denied')
  f.cleanup()
})
test('native bridge receives final text only and ignores unrequested events after cleanup', () => {
  let started = 0, stopped = 0
  const browser = Object.assign(new EventTarget(), { RwaNativeVoice: { start: () => started++, stop: () => stopped++ } })
  const f = fixture(browser)
  f.hook.start(); assert.equal(started, 1)
  const emit = detail => { const event = new Event('rwa-native-voice'); event.detail = detail; browser.dispatchEvent(event) }
  emit({ type: 'result', text: 'partial', final: false }); assert.deepEqual(f.received, [])
  emit({ type: 'result', text: 'final', final: true }); assert.deepEqual(f.received, ['final'])
  f.cleanup(); emit({ type: 'result', text: 'late' }); assert.deepEqual(f.received, ['final']); assert.equal(stopped, 1)
})
test('native bridge injected after initial mount is detected when the user taps the microphone', () => {
  const browser = new EventTarget(), f = fixture(browser)
  assert.equal(f.states[0], false)
  let started = false
  browser.RwaNativeVoice = { start: () => { started = true }, stop() {} }
  f.hook.start()
  assert.equal(started, true)
  assert.equal(f.states[0], true)
  f.cleanup()
})

test('late callbacks from a failed browser recognition cannot overwrite a new recognition', () => {
  const instances = []
  class Recognition { constructor() { instances.push(this) } start() {} stop() {} abort() {} }
  const f = fixture(Object.assign(new EventTarget(), { SpeechRecognition: Recognition }))
  f.hook.start()
  const staleResult = instances[0].onresult, staleEnd = instances[0].onend
  instances[0].onerror({ error: 'not-allowed' })
  f.hook.start()
  staleResult({ results: [[{ transcript: 'stale account text' }]] }); staleEnd()
  assert.deepEqual(f.received, []); assert.equal(f.states[1], true)
  instances[1].onresult({ results: [[{ transcript: 'current text' }]] }); instances[1].onend()
  assert.deepEqual(f.received, ['current text']); assert.equal(f.states[1], false)
  f.cleanup()
})

test('recognition timeout aborts the engine and discards late text', () => {
  let active, aborted = 0
  class Recognition { constructor() { active = this } start() {} stop() {} abort() { aborted++ } }
  const f = fixture(Object.assign(new EventTarget(), { SpeechRecognition: Recognition }))
  f.hook.start(); const staleResult = active.onresult
  f.expire(); staleResult({ results: [[{ transcript: 'too late' }]] })
  assert.equal(aborted, 1); assert.equal(f.states[1], false); assert.equal(f.states[2], 'failed'); assert.deepEqual(f.received, [])
  f.cleanup()
})

test('only one native microphone owner receives results and old unmount cannot stop its successor', () => {
  let stopped = 0
  const browser = Object.assign(new EventTarget(), { RwaNativeVoice: { start() {}, stop: () => stopped++ } })
  const first = fixture(browser), second = first.another()
  first.hook.start(); second.hook.start()
  assert.equal(first.states[1], false); assert.equal(stopped, 1)
  first.cleanup(); assert.equal(stopped, 1)
  const event = new Event('rwa-native-voice'); event.detail = { type: 'result', text: 'current owner', final: true }; browser.dispatchEvent(event)
  assert.deepEqual(first.received, []); assert.deepEqual(second.received, ['current owner'])
  second.cleanup(); assert.equal(stopped, 2)
})

test('native Android denial and no-match errors show their actionable categories', () => {
  const browser = Object.assign(new EventTarget(), { RwaNativeVoice: { start() {}, stop() {} } }), f = fixture(browser)
  const emit = error => { const event = new Event('rwa-native-voice'); event.detail = { type: 'error', error }; browser.dispatchEvent(event) }
  f.hook.start(); emit('recognizer-9'); assert.equal(f.states[2], 'denied')
  f.hook.start(); emit('recognizer-7'); assert.equal(f.states[2], 'empty')
  f.cleanup()
})

test('hold mode buffers final browser results until release and emits them only once', () => {
  let active, stopped = 0
  class Recognition { constructor() { active = this } start() {} stop() { stopped++ } abort() {} }
  const f = fixture(Object.assign(new EventTarget(), { SpeechRecognition: Recognition }), { deferResult: true })
  f.hook.start(); active.onresult({ results: [[{ transcript: '第一句' }], [{ transcript: '第二句' }]] })
  assert.deepEqual(f.received, []); assert.equal(active.continuous, true)
  f.hook.stop(); assert.equal(stopped, 1); assert.equal(f.states[3], true); assert.deepEqual(f.received, [])
  const end = active.onend; end(); end()
  assert.deepEqual(f.received, ['第一句 第二句']); assert.equal(f.states[3], false)
  f.cleanup()
})

test('an engine that ends before finger release still cannot auto-send or leak a cancelled recording', () => {
  let active
  class Recognition { constructor() { active = this } start() {} stop() {} abort() {} }
  const f = fixture(Object.assign(new EventTarget(), { SpeechRecognition: Recognition }), { deferResult: true })
  f.hook.start(); active.onresult({ results: [[{ transcript: '等待松手' }]] }); active.onend()
  assert.deepEqual(f.received, []); f.hook.stop(); assert.deepEqual(f.received, ['等待松手'])
  f.hook.start(); active.onresult({ results: [[{ transcript: '上滑取消的内容' }]] }); const late = active.onend
  f.hook.cancel(); late(); assert.deepEqual(f.received, ['等待松手'])
  f.cleanup()
})

test('native hold release waits for a final transcript and end event; interim text is never sent', () => {
  const browser = Object.assign(new EventTarget(), { RwaNativeVoice: { start() {}, stop() {} } }), f = fixture(browser, { deferResult: true })
  const emit = detail => { const event = new Event('rwa-native-voice'); event.detail = detail; browser.dispatchEvent(event) }
  f.hook.start(); emit({ type: 'result', text: '不完整', final: false }); f.hook.stop()
  emit({ type: 'result', text: '真正最终语音', final: true }); assert.deepEqual(f.received, [])
  emit({ type: 'end' }); assert.deepEqual(f.received, ['真正最终语音'])
  f.cleanup()
})

test('release timeout and permission failure discard buffered text and permit another recording', () => {
  let active
  class Recognition { constructor() { active = this } start() {} stop() {} abort() {} }
  const f = fixture(Object.assign(new EventTarget(), { SpeechRecognition: Recognition }), { deferResult: true })
  f.hook.start(); active.onresult({ results: [[{ transcript: '没有结束事件，不发送' }]] }); f.hook.stop(); f.expire()
  assert.deepEqual(f.received, []); assert.equal(f.states[2], 'failed')
  f.hook.start(); active.onerror({ error: 'not-allowed' }); assert.equal(f.states[2], 'denied')
  f.hook.start(); active.onresult({ results: [[{ transcript: '重新授权后' }]] }); f.hook.stop(); active.onend()
  assert.deepEqual(f.received, ['重新授权后']); f.cleanup()
})

test('page hide aborts a held microphone and ignores its delayed result', () => {
  let active, aborted = 0
  class Recognition { constructor() { active = this } start() {} stop() {} abort() { aborted++ } }
  const browser = Object.assign(new EventTarget(), { SpeechRecognition: Recognition }), f = fixture(browser, { deferResult: true })
  f.hook.start(); const late = active.onresult; browser.dispatchEvent(new Event('pagehide'))
  late({ results: [[{ transcript: '后台页面不应该发送' }]] }); assert.equal(aborted, 1); assert.deepEqual(f.received, [])
  f.cleanup()
})
