export type AiAttachment = { name: string; mime: string; size: number; text: string; method: 'text' | 'pdf' | 'docx' | 'ocr' | 'image'; dataUrl?: string; width?: number; height?: number }
export const AI_FILE_LIMITS = { count: 3, bytes: 8 * 1024 * 1024, text: 12000, totalText: 24000, pdfPages: 20, pixels: 16000000, imageEdge: 1920, imageBytes: 384 * 1024 } as const
export const AI_FILE_ACCEPT = '.txt,.md,.csv,.json,.pdf,.docx,.jpg,.jpeg,.png,.webp'
const formats: Record<string, { mime: string; method: AiAttachment['method'] }> = {
  txt: { mime: 'text/plain', method: 'text' }, md: { mime: 'text/markdown', method: 'text' }, csv: { mime: 'text/csv', method: 'text' }, json: { mime: 'application/json', method: 'text' },
  pdf: { mime: 'application/pdf', method: 'pdf' }, docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', method: 'docx' },
  jpg: { mime: 'image/jpeg', method: 'image' }, jpeg: { mime: 'image/jpeg', method: 'image' }, png: { mime: 'image/png', method: 'image' }, webp: { mime: 'image/webp', method: 'image' },
}
export function aiFileFormat(file: { name: string; size: number; type: string }) {
  const format = formats[file.name.toLowerCase().split('.').at(-1) ?? '']
  if (!format || file.size < 1 || file.size > AI_FILE_LIMITS.bytes) throw new Error('unsupported')
  if (file.type && file.type !== format.mime && !(format.method === 'text' && ['application/octet-stream', 'text/plain'].includes(file.type))) throw new Error('unsupported')
  return format
}
export function validateExcerpt(text: string, existing: AiAttachment[] = []) {
  const value = text.replace(/\u0000/g, '').trim()
  if (!value) throw new Error('empty')
  if (value.length > AI_FILE_LIMITS.text || value.length + existing.reduce((sum, row) => sum + row.text.length, 0) > AI_FILE_LIMITS.totalText) throw new Error('tooLarge')
  return value
}
export function showAiAnswer(questions?: unknown): boolean { return !Array.isArray(questions) || questions.length === 0 }

/** Bound ZIP expansion before the Word parser inflates entries. ZIP64/multi-disk archives are unsupported. */
function docxEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  let end = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || end + 22 + view.getUint16(end + 20, true) !== buffer.byteLength) throw new Error('unsupported')
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true)
  if (count > 512 || offset + size !== end || count === 0xffff || view.getUint16(end + 8, true) !== count) throw new Error('tooLarge')
  let cursor = offset, total = 0
  const entries: { compressed: number; uncompressed: number; method: number; local: number }[] = []
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('unsupported')
    if (view.getUint16(cursor + 8, true) & 1 || view.getUint16(cursor + 34, true)) throw new Error('unsupported')
    const uncompressed = view.getUint32(cursor + 24, true)
    total += uncompressed
    if (uncompressed === 0xffffffff || total > 16 * 1024 * 1024) throw new Error('tooLarge')
    const compressed = view.getUint32(cursor + 20, true), local = view.getUint32(cursor + 42, true), method = view.getUint16(cursor + 10, true)
    if (compressed === 0xffffffff || local === 0xffffffff || (method !== 0 && method !== 8)) throw new Error('unsupported')
    entries.push({ compressed, uncompressed, method, local })
    cursor += 46 + view.getUint16(cursor + 28, true) + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true)
  }
  if (cursor !== offset + size) throw new Error('unsupported')
  return { entries, offset }
}
export function validateDocxArchive(buffer: ArrayBuffer): void { docxEntries(buffer) }

/** A dishonest ZIP size must fail while inflating, before Mammoth accumulates its output. */
export async function validateDocxExpansion(buffer: ArrayBuffer, signal: AbortSignal): Promise<void> {
  const { entries, offset } = docxEntries(buffer), view = new DataView(buffer)
  let total = 0
  for (const entry of entries) {
    signal.throwIfAborted()
    if (entry.local + 30 > offset || view.getUint32(entry.local, true) !== 0x04034b50) throw new Error('unsupported')
    const start = entry.local + 30 + view.getUint16(entry.local + 26, true) + view.getUint16(entry.local + 28, true)
    if (start + entry.compressed > offset || view.getUint16(entry.local + 6, true) & 1 || view.getUint16(entry.local + 8, true) !== entry.method) throw new Error('unsupported')
    if (entry.method === 0) { if (entry.compressed !== entry.uncompressed) throw new Error('unsupported'); total += entry.uncompressed; continue }
    if (typeof DecompressionStream === 'undefined') throw new Error('unsupported')
    const reader = new Blob([buffer.slice(start, start + entry.compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
    const cancel = () => { void reader.cancel().catch(() => {}) }; signal.addEventListener('abort', cancel, { once: true })
    let actual = 0
    try {
      while (true) {
        const { value, done } = await reader.read(); signal.throwIfAborted(); if (done) break
        actual += value.byteLength; total += value.byteLength
        if (actual > entry.uncompressed || total > 16 * 1024 * 1024) throw new Error('tooLarge')
      }
      if (actual !== entry.uncompressed) throw new Error('unsupported')
    } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock() }
  }
}
