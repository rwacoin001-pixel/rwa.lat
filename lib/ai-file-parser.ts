import { AI_FILE_LIMITS, aiFileFormat, validateExcerpt, validateDocxExpansion, type AiAttachment } from './ai-attachment-policy'
import { containsWalletSecret } from './ai-input-guard'

/** Documents stay local; images are resized and stripped of metadata before an explicit send. */
export async function readAiFile(file: File, locale: string, current: AiAttachment[], signal: AbortSignal, progress: (percent: number) => void): Promise<AiAttachment> {
  const format = aiFileFormat(file)
  if (current.length >= AI_FILE_LIMITS.count) throw new Error('tooLarge')
  signal.throwIfAborted()
  if (containsWalletSecret(file.name)) throw new Error('secret')
  if (format.method === 'image') return readAiImage(file, signal, progress)
  let text = ''
  if (format.method === 'text') text = await file.text()
  else if (format.method === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    await validateDocxExpansion(arrayBuffer, signal)
    const result = await mammoth.extractRawText({ arrayBuffer })
    text = result.value
  } else if (format.method === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/ai-ocr/pdf.worker.min.mjs'
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true })
    const cancel = () => { void task.destroy() }; signal.addEventListener('abort', cancel, { once: true })
    try {
      const pdf = await task.promise
      if (pdf.numPages > AI_FILE_LIMITS.pdfPages) throw new Error('tooLarge')
      for (let n = 1; n <= pdf.numPages; n++) {
        signal.throwIfAborted()
        const page = await pdf.getPage(n), content = await page.getTextContent()
        text += content.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n'
        if (text.length > AI_FILE_LIMITS.text) throw new Error('tooLarge')
        progress(Math.round(n / pdf.numPages * 100))
      }
    } finally { signal.removeEventListener('abort', cancel); await task.destroy() }
  }
  signal.throwIfAborted()
  text = validateExcerpt(text, current)
  if (containsWalletSecret(file.name + '\n' + text)) throw new Error('secret')
  return { name: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180), mime: format.mime, size: file.size, text, method: format.method }
}

async function readAiImage(file: File, signal: AbortSignal, progress: (percent: number) => void): Promise<AiAttachment> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  try {
    signal.throwIfAborted()
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > AI_FILE_LIMITS.pixels) throw new Error('tooLarge')
    let scale = Math.min(1, AI_FILE_LIMITS.imageEdge / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 5; attempt++) {
      signal.throwIfAborted()
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('unsupported')
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('unsupported')), 'image/jpeg', Math.max(.6, .88 - attempt * .08)))
      signal.throwIfAborted(); progress(30 + attempt * 12)
      if (blob.size <= AI_FILE_LIMITS.imageBytes) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          const cancel = () => { reader.abort(); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')) }
          reader.onload = () => { signal.removeEventListener('abort', cancel); resolve(String(reader.result)) }
          reader.onerror = () => { signal.removeEventListener('abort', cancel); reject(new Error('unsupported')) }
          signal.addEventListener('abort', cancel, { once: true }); reader.readAsDataURL(blob)
        })
        signal.throwIfAborted(); progress(100)
        return { name: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180), mime: 'image/jpeg', size: file.size, method: 'image', text: '', dataUrl, width: canvas.width, height: canvas.height }
      }
      scale *= .8
    }
    throw new Error('tooLarge')
  } finally { bitmap.close(); canvas.width = canvas.height = 0 }
}
