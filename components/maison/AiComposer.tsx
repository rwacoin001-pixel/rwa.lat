'use client'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, FileText, ImagePlus, LoaderCircle, Mic, Plus, Square, X } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { aiInputCopy } from '@/lib/maison-ai-copy'
import { AI_FILE_ACCEPT, AI_FILE_LIMITS, type AiAttachment } from '@/lib/ai-attachment-policy'
import { readAiFile } from '@/lib/ai-file-parser'
import { useAiVoice } from './useAiVoice'
import s from './ai-composer.module.css'

export default function AiComposer({ value, onChange, onSend, onStop, busy, disabled, placeholder, sendLabel, stopLabel, locale, secretLabel }: {
  value: string; onChange(value: string): void; onSend(value: string, attachments: AiAttachment[]): Promise<boolean>; onStop?(): void; busy: boolean; disabled?: boolean; placeholder: string; sendLabel: string; stopLabel: string; locale: AppLocale; secretLabel: string
}) {
  const c = aiInputCopy(locale), reduced = useReducedMotion()
  const [focused, setFocused] = useState(false), [picker, setPicker] = useState(false), [files, setFiles] = useState<AiAttachment[]>([]), [reading, setReading] = useState<number | null>(null), [error, setError] = useState('')
  const field = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), imageInput = useRef<HTMLInputElement>(null), processing = useRef<AbortController | null>(null), ime = useRef(false), sending = useRef(false)
  const voice = useAiVoice(locale, text => { onChange([value.trimEnd(), text].filter(Boolean).join(' ').slice(0, 4000)); field.current?.focus() })
  const expanded = focused || !!value || files.length > 0 || reading !== null || voice.listening
  useLayoutEffect(() => { const el = field.current; if (el) { el.style.height = '0px'; el.style.height = `${Math.min(el.scrollHeight, 148)}px` } }, [value, expanded])
  useEffect(() => () => { processing.current?.abort() }, [])
  const submit = async () => {
    if (busy || disabled || reading !== null || sending.current || voice.listening || (!value.trim() && !files.length)) return
    sending.current = true; setPicker(false); setError('')
    try { if (await onSend(value.trim() || c.sendFile, files)) { setFiles([]); onChange(''); field.current?.focus() } } finally { sending.current = false }
  }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !ime.current && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
    if (event.key === 'Escape') { if (voice.listening) voice.stop(); else if (busy) onStop?.(); else setPicker(false) }
  }
  const load = async (list: FileList | null) => {
    if (!list?.length || processing.current || disabled || busy) return
    setPicker(false); setError('')
    if (list.length + files.length > AI_FILE_LIMITS.count) { setError(c.unsupported); return }
    const controller = new AbortController(); processing.current = controller; setReading(0)
    const timeout = window.setTimeout(() => controller.abort(), 120000)
    let next = [...files]
    try {
      for (const file of Array.from(list)) { const result = await readAiFile(file, locale, next, controller.signal, setReading); next = [...next, result]; setFiles(next) }
    } catch (problem) {
      const reason = problem instanceof Error ? problem.message : ''
      setError(reason === 'secret' ? secretLabel : reason === 'unsupported' ? c.unsupported : reason === 'empty' ? c.emptyFile : reason === 'tooLarge' ? c.tooLarge : c.fileFailed)
    } finally { clearTimeout(timeout); processing.current = null; setReading(null); if (fileInput.current) fileInput.current.value = ''; if (imageInput.current) imageInput.current.value = '' }
  }
  const voiceError = voice.error === 'unavailable' ? c.voiceUnavailable : voice.error === 'denied' ? c.voiceDenied : voice.error === 'empty' ? c.voiceEmpty : voice.error ? c.voiceFailed : ''
  return <div className={s.wrap} dir={locale === 'ar' ? 'rtl' : undefined}>
    <AnimatePresence>{picker && <motion.div className={s.picker} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="group" aria-label={c.attach}>
      <button type="button" onClick={() => imageInput.current?.click()}><ImagePlus size={20}/><span>{c.image}<small>{c.imageHint}</small></span></button>
      <button type="button" onClick={() => fileInput.current?.click()}><FileText size={20}/><span>{c.file}<small>{c.filesHint}</small></span></button>
    </motion.div>}</AnimatePresence>
    <input ref={fileInput} className={s.hidden} type="file" accept={AI_FILE_ACCEPT} multiple onChange={e => void load(e.target.files)} />
    <input ref={imageInput} className={s.hidden} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => void load(e.target.files)} />
    <motion.form layout="size" className={s.composer} data-expanded={expanded || undefined} data-disabled={disabled || undefined} animate={{ borderRadius: expanded ? 25 : 30 }} transition={{ duration: reduced ? 0 : .22, ease: [.22, 1, .36, 1] }} onSubmit={event => { event.preventDefault(); void submit() }}>
      {!!files.length && <ul className={s.files}>{files.map((file, i) => <li key={`${file.name}-${i}`}><details><summary><FileText size={15}/><span>{file.name}<small>{file.method === 'ocr' ? c.ocr : c.extracted} · {file.text.length.toLocaleString(locale)}</small></span></summary><pre>{file.text}</pre></details><button type="button" disabled={busy || reading !== null} aria-label={`${c.remove}: ${file.name}`} onClick={() => setFiles(old => old.filter((_, index) => index !== i))}><X size={15}/></button></li>)}</ul>}
      <button type="button" className={s.add} aria-label={c.attach} aria-expanded={picker} disabled={disabled || busy || reading !== null} onClick={() => setPicker(open => !open)}><Plus size={22}/></button>
      <textarea ref={field} value={value} rows={1} maxLength={4000} dir="auto" disabled={disabled || busy || voice.listening} placeholder={voice.listening ? c.listening : placeholder} aria-label={placeholder} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={keyDown} onCompositionStart={() => { ime.current = true }} onCompositionEnd={() => { ime.current = false }} />
      <div className={s.controls}>
        {reading !== null ? <span className={s.reading} role="status"><LoaderCircle size={18}/><span>{reading}%</span></span> : busy && onStop ? <button key="stop" type="button" className={s.send} aria-label={stopLabel} onClick={onStop}><Square size={12} fill="currentColor"/></button> : voice.listening ? <button key="voice-stop" type="button" className={s.voice} aria-label={c.voiceStop} aria-pressed="true" onClick={voice.stop}><Square size={15}/></button> : value.trim() || files.length ? <button key="send" type="submit" className={s.send} disabled={disabled || busy} aria-label={sendLabel}><ArrowUp size={19}/></button> : <button key="voice" type="button" className={s.voice} disabled={disabled || busy} aria-label={c.voice} onClick={() => { setError(''); voice.start() }}><Mic size={22}/></button>}
      </div>
    </motion.form>
    {(error || voiceError || reading !== null || voice.listening) && <p className={s.status} role={error || voiceError ? 'alert' : 'status'}>{error || voiceError || (voice.listening ? c.listening : `${c.reading} ${reading}%`)}</p>}
  </div>
}
