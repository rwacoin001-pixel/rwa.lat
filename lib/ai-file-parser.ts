import { AI_FILE_LIMITS, aiFileFormat, validateExcerpt, validateDocxExpansion, type AiAttachment } from './ai-attachment-policy'
import { containsWalletSecret } from './ai-input-guard'

const languages: Record<string, string> = { 'zh-CN': 'chi_sim+eng', en: 'eng', es: 'spa+eng', fr: 'fra+eng', ar: 'ara+eng', hi: 'hin+eng', pt: 'por+eng' }
/** Runs in the browser. Binary files never leave the device; only reviewed excerpts enter chat. */
export async function readAiFile(file: File, locale: string, current: AiAttachment[], signal: AbortSignal, progress: (percent: number) => void): Promise<AiAttachment> {
  const format = aiFileFormat(file)
  if (current.length >= AI_FILE_LIMITS.count) throw new Error('tooLarge')
  signal.throwIfAborted()
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
  } else {
    const bitmap = await createImageBitmap(file)
    const pixels = bitmap.width * bitmap.height; bitmap.close()
    if (pixels > AI_FILE_LIMITS.pixels) throw new Error('tooLarge')
    const { createWorker, OEM } = await import('tesseract.js')
    const worker = await createWorker(languages[locale] ?? 'eng', OEM.LSTM_ONLY, { workerPath: '/ai-ocr/worker.min.js', corePath: '/ai-ocr/core', langPath: '/ai-ocr/lang', workerBlobURL: false, logger: message => progress(Math.round((message.progress ?? 0) * 100)) })
    const cancel = () => { void worker.terminate() }; signal.addEventListener('abort', cancel, { once: true })
    try { signal.throwIfAborted(); const result = await worker.recognize(file); text = result.data.text }
    finally { signal.removeEventListener('abort', cancel); await worker.terminate() }
  }
  signal.throwIfAborted()
  text = validateExcerpt(text, current)
  if (containsWalletSecret(file.name + '\n' + text)) throw new Error('secret')
  return { name: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180), mime: format.mime, size: file.size, text, method: format.method }
}
