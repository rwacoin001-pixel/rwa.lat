import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { aiFileFormat, validateExcerpt, showAiAnswer, validateDocxArchive, validateDocxExpansion } from '../lib/ai-attachment-policy.ts'

test('clarification responses never reveal their preliminary answer, including historical cards', () => {
  assert.equal(showAiAnswer([{ id: 'intent' }]), false)
  assert.equal(showAiAnswer([]), true)
  assert.equal(showAiAnswer(undefined), true)
})
test('input rejects executable, spoofed mime and oversized files', () => {
  for (const file of [{ name: 'a.exe', size: 10, type: '' }, { name: 'a.png', size: 10, type: 'application/pdf' }, { name: 'a.txt', size: 9000000, type: 'text/plain' }]) assert.throws(() => aiFileFormat(file))
  assert.deepEqual(aiFileFormat({ name: '账单.PDF', size: 30, type: 'application/pdf' }), { mime: 'application/pdf', method: 'pdf' })
})
test('extracted content cannot silently exceed per-file and combined context budgets', () => {
  assert.throws(() => validateExcerpt('a'.repeat(12001)))
  assert.throws(() => validateExcerpt('a'.repeat(12000), [{ text: 'a'.repeat(12001) }]))
  assert.throws(() => validateExcerpt('  '))
  assert.equal(validateExcerpt('  statement  '), 'statement')
})
test('DOCX parsing rejects excessive decompression and malformed ZIP instead of expanding arbitrary input', () => {
  assert.throws(() => validateDocxArchive(new ArrayBuffer(30)))
  const data = new ArrayBuffer(68), view = new DataView(data)
  view.setUint32(0, 0x02014b50, true); view.setUint32(24, 32 * 1024 * 1024, true)
  view.setUint32(46, 0x06054b50, true); view.setUint16(54, 1, true); view.setUint16(56, 1, true); view.setUint32(58, 46, true)
  assert.throws(() => validateDocxArchive(data))
  view.setUint32(24, 300, true)
  assert.equal(validateDocxArchive(data), undefined)
})

function zipFixture(text, declaredSize = text.length) {
  const data = deflateRawSync(text), name = new TextEncoder().encode('word/document.xml'), offset = 30 + name.length + data.length
  const buffer = new ArrayBuffer(offset + 46 + name.length + 22), view = new DataView(buffer), bytes = new Uint8Array(buffer), end = buffer.byteLength - 22
  view.setUint32(0, 0x04034b50, true); view.setUint16(8, 8, true); view.setUint32(18, data.length, true); view.setUint32(22, declaredSize, true); view.setUint16(26, name.length, true)
  bytes.set(name, 30); bytes.set(data, 30 + name.length)
  view.setUint32(offset, 0x02014b50, true); view.setUint16(offset + 10, 8, true); view.setUint32(offset + 20, data.length, true); view.setUint32(offset + 24, declaredSize, true); view.setUint16(offset + 28, name.length, true); bytes.set(name, offset + 46)
  view.setUint32(end, 0x06054b50, true); view.setUint16(end + 8, 1, true); view.setUint16(end + 10, 1, true); view.setUint32(end + 12, 46 + name.length, true); view.setUint32(end + 16, offset, true)
  return buffer
}
test('DOCX deflate is bounded against dishonest ZIP sizes before the text parser runs', async () => {
  await validateDocxExpansion(zipFixture('<w:document>Readable fixture</w:document>'), new AbortController().signal)
  const dishonest = zipFixture('a'.repeat(2 * 1024 * 1024), 32)
  assert.equal(validateDocxArchive(dishonest), undefined)
  await assert.rejects(validateDocxExpansion(dishonest, new AbortController().signal), /tooLarge/)
  const stopped = new AbortController(); stopped.abort()
  await assert.rejects(validateDocxExpansion(zipFixture('fixture'), stopped.signal), /abort/i)
})
