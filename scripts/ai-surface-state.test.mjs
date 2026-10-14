import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const exports = {}
new Function('require', 'exports', ts.transpileModule(readFileSync('lib/ai-surface-state.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => ({}), exports)
const { surfaceState, pearlFor, isVoiceActive, showsSuggestions, holdLabel } = exports
const rest = { available: true, busy: false, voiceMode: false, voicePhase: 'idle', cancelled: false, reading: false, hasDraft: false, focused: false }
const at = (patch) => surfaceState({ ...rest, ...patch })

test('one surface state, resolved in a fixed priority order', () => {
  assert.equal(at({}), 'idle')
  assert.equal(at({ focused: true }), 'focused')
  assert.equal(at({ focused: true, hasDraft: true }), 'composing')
  assert.equal(at({ hasDraft: true, reading: true }), 'attaching')
  assert.equal(at({ voiceMode: true, hasDraft: true }), 'voiceReady')
  assert.equal(at({ voiceMode: true, voicePhase: 'connecting' }), 'connecting')
  assert.equal(at({ voiceMode: true, voicePhase: 'listening' }), 'listening')
  assert.equal(at({ voiceMode: true, voicePhase: 'listening', cancelled: true }), 'cancelArmed')
  assert.equal(at({ voiceMode: true, voicePhase: 'connecting', cancelled: true }), 'cancelArmed')
  assert.equal(at({ voiceMode: true, voicePhase: 'processing', cancelled: true }), 'transcribing')
  // An answer in flight outranks everything the reader could be doing; a closed service outranks that.
  assert.equal(at({ busy: true, voicePhase: 'listening', hasDraft: true }), 'busy')
  assert.equal(at({ available: false, busy: true }), 'unavailable')
})

test('the pearl, the hold bar and the suggestions never disagree with the state', () => {
  assert.deepEqual(['idle', 'listening', 'cancelArmed', 'connecting', 'transcribing', 'busy', 'composing'].map(pearlFor), ['idle', 'listening', 'listening', 'thinking', 'thinking', 'thinking', 'idle'])
  assert.deepEqual(['connecting', 'listening', 'cancelArmed', 'transcribing', 'voiceReady', 'busy'].map(isVoiceActive), [true, true, true, true, false, false])
  assert.deepEqual(['idle', 'focused', 'composing', 'voiceReady', 'listening', 'busy'].map(showsSuggestions), [true, false, false, false, false, false])
  const v = { hold: '按住说话', preparing: '正在连接麦克风…', release: '松开发送，上滑取消', cancel: '松开取消', transcribing: '正在识别…' }
  assert.deepEqual(['voiceReady', 'connecting', 'listening', 'cancelArmed', 'transcribing'].map(state => holdLabel(state, v)), ['按住说话', '正在连接麦克风…', '松开发送，上滑取消', '松开取消', '正在识别…'])
})
