'use client'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, FileText, ImagePlus, Keyboard, LoaderCircle, Mic, Plus, Square, X } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { aiInputCopy } from '@/lib/maison-ai-copy'
import { aiVoiceCopy } from '@/lib/ai-voice-copy'
import { aiVisualCopy } from '@/lib/ai-visual-copy'
import { AI_FILE_ACCEPT, AI_FILE_LIMITS, type AiAttachment } from '@/lib/ai-attachment-policy'
import { readAiFile } from '@/lib/ai-file-parser'
import { useAiVoice } from './useAiVoice'
import { BuddyFace } from '@/components/buddy/BuddyFace'
import { aiPearlCopy } from '@/lib/ai-pearl-copy'
import { holdLabel, isVoiceActive, pearlFor, showsSuggestions, surfaceState, type SurfaceState } from '@/lib/ai-surface-state'
import AiFaqTicker from './AiFaqTicker'
import s from './ai-composer.module.css'

export type ComposerVoice = { state: SurfaceState; live: string }

// `voiceOverlay` false hands the listening visual to the page (the welcome pearl shows it instead), and
// `suggestions` false hides the question ticker where the page already shows its own suggestions.
export default function AiComposer({ value, onChange, onSend, onStop, onInteraction, onVoice, busy, disabled, placeholder, sendLabel, stopLabel, locale, secretLabel, voiceOverlay = true, suggestions = true }: {
  value: string; onChange(value: string): void; onSend(value: string, attachments: AiAttachment[]): Promise<boolean>; onStop?(): void; onInteraction?(): void; onVoice?(voice: ComposerVoice): void; busy: boolean; disabled?: boolean; placeholder: string; sendLabel: string; stopLabel: string; locale: AppLocale; secretLabel: string; voiceOverlay?: boolean; suggestions?: boolean
}) {
  const c = aiInputCopy(locale), v = aiVoiceCopy(locale), visual = aiVisualCopy(locale), pearl = aiPearlCopy(locale), reduced = useReducedMotion()
  const [focused, setFocused] = useState(false), [picker, setPicker] = useState(false), [files, setFiles] = useState<AiAttachment[]>([]), [reading, setReading] = useState<number | null>(null), [error, setError] = useState('')
  const [voiceMode, setVoiceMode] = useState(false), [cancelled, setCancelled] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), imageInput = useRef<HTMLInputElement>(null), processing = useRef<AbortController | null>(null), ime = useRef(false), sending = useRef(false)
  const hold = useRef<{ pointer: number; y: number; cancel: boolean } | null>(null), keyHeld = useRef(false)
  const voice = useAiVoice(locale, text => { const message = [value.trimEnd(), text].filter(Boolean).join(' ').slice(0, 4000); onChange(message); void submit(message, true) }, { deferResult: true })
  const expanded = !voiceMode && (focused || !!value || files.length > 0 || reading !== null)
  useLayoutEffect(() => { const el = field.current; if (el) { el.style.height = '0px'; el.style.height = `${Math.min(el.scrollHeight, 148)}px` } }, [value, expanded])
  useEffect(() => () => { processing.current?.abort() }, [])
  const state = surfaceState({ available: !disabled, busy, voiceMode, voicePhase: voice.phase, cancelled, reading: reading !== null, hasDraft: !!value.trim() || files.length > 0, focused })
  useEffect(() => { onVoice?.({ state, live: voice.live }) }, [state, voice.live])
  useEffect(() => { if (!voice.listening && !voice.processing) { hold.current=null; keyHeld.current=false; setCancelled(false) } }, [voice.listening, voice.processing, voice.error])
  const submit = async (message = value, releasedVoice = false) => {
    if (busy || disabled || reading !== null || sending.current || (!releasedVoice && (voice.listening || voice.processing)) || (!message.trim() && !files.length)) return
    sending.current = true; setPicker(false); setError('')
    onInteraction?.()
    // The box empties the moment the question is sent (it is already in the thread, and the busy placeholder
    // needs the room); if the send fails or is stopped, the words and attachments come straight back.
    const sentFiles = files
    onChange(''); setFiles([])
    const restore = () => { onChange(message); setFiles(sentFiles) }
    try { if (await onSend(message.trim() || c.sendFile, sentFiles)) { if (!voiceMode) field.current?.focus() } else restore() } catch { restore(); setError(c.actionFailed) } finally { sending.current = false }
  }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !ime.current && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
    if (event.key === 'Escape') { if (voice.listening || voice.processing) voice.cancel(); else if (busy) onStop?.(); else setPicker(false) }
  }
  const beginHold = () => {
    if (disabled || busy || reading !== null || voice.processing) return false
    setPicker(false); setError(''); setCancelled(false)
    if (!voice.start()) return false
    onInteraction?.(); return true
  }
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || hold.current || !beginHold()) return
    event.preventDefault(); hold.current = { pointer: event.pointerId, y: event.clientY, cancel: false }
    // A very fast tap can end before capture; the hold still works, it just won't follow a finger off the bar.
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer already released. */ }
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = hold.current
    if (!current || current.pointer !== event.pointerId) return
    current.cancel = current.y - event.clientY >= 80; setCancelled(current.cancel)
  }
  const finishHold = (event?: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const current = hold.current
    if (event && (!current || current.pointer !== event.pointerId)) return
    hold.current = null; keyHeld.current = false; setCancelled(false)
    if (cancel || current?.cancel) voice.cancel(); else voice.stop()
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const switchKeyboard = () => { hold.current = null; keyHeld.current = false; voice.cancel(); setVoiceMode(false); setCancelled(false); window.requestAnimationFrame(() => field.current?.focus()) }
  const load = async (list: FileList | null) => {
    if (!list?.length || processing.current || disabled || busy || voice.listening || voice.processing) return
    setPicker(false); setError('')
    onInteraction?.()
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
  // Tapping a suggestion asks it at once: the composer clears on success and the thread shows "thinking".
  const ask = (question: string) => {
    setVoiceMode(false)
    if (busy || disabled || reading !== null) { onChange(question); onInteraction?.(); return }
    void submit(question)
  }
  // Each failure names its next step: timeout → hold again; denied → where to re-enable the microphone.
  const voiceError = voice.error === 'unavailable' ? c.voiceUnavailable : voice.error === 'denied' ? v.denied : voice.error === 'timeout' ? v.timeout : voice.error === 'empty' ? c.voiceEmpty : voice.error === 'network' ? v.network : voice.error === 'capture' ? v.capture : voice.error === 'language' ? v.language : voice.error ? c.voiceFailed : ''
  return <div className={s.wrap} dir={locale === 'ar' ? 'rtl' : undefined}>
    {suggestions && showsSuggestions(state) && <AiFaqTicker questions={visual.prompts} label={visual.suggestions} onSelect={ask}/>}
    {/* Holding to talk: the paper buddy listens above the bar and only the recognised words appear; every
        instruction (release to send, slide up to cancel) lives on the bar under the thumb. */}
    <AnimatePresence>{voiceOverlay && isVoiceActive(state) && <motion.div className={s.recording} data-cancel={cancelled || undefined} data-phase={voice.phase} initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 5 }}>
      <BuddyFace size={64} mood={state === 'cancelArmed' ? 'puzzled' : ({ idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'replying' } as const)[pearlFor(state)] ?? 'idle'} />
      <p className={s.live} dir="auto" data-empty={!voice.live || undefined}>{voice.live || (state === 'listening' ? pearl.listening : '')}</p>
    </motion.div>}</AnimatePresence>
    <AnimatePresence>{picker && <motion.div className={s.picker} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="group" aria-label={c.attach}>
      <button type="button" onClick={() => imageInput.current?.click()}><ImagePlus size={20}/><span>{c.image}<small>{visual.hint}</small></span></button>
      <button type="button" onClick={() => fileInput.current?.click()}><FileText size={20}/><span>{c.file}<small>{c.filesHint}</small></span></button>
    </motion.div>}</AnimatePresence>
    <input ref={fileInput} className={s.hidden} type="file" accept={AI_FILE_ACCEPT} multiple onChange={e => void load(e.target.files)} />
    <input ref={imageInput} className={s.hidden} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => void load(e.target.files)} />
    <motion.form layout="size" className={s.composer} data-mode={voiceMode ? 'voice' : 'text'} data-recording={voice.listening || undefined} data-phase={voice.phase} data-cancel={cancelled || undefined} data-expanded={expanded || undefined} data-busy={busy || undefined} data-state={state} data-disabled={disabled || undefined} animate={{ borderRadius: expanded ? 25 : 30 }} transition={{ duration: reduced ? 0 : .22, ease: [.22, 1, .36, 1] }} onSubmit={event => { event.preventDefault(); void submit() }}>
      {!!files.length && <ul className={s.files}>{files.map((file, i) => <li key={`${file.name}-${i}`}><details><summary>{file.method === 'image' && file.dataUrl ? <img className={s.thumbnail} src={file.dataUrl} alt=""/> : <FileText size={15}/>}<span>{file.name}<small>{file.method === 'image' ? `${visual.image} · ${file.width} × ${file.height}` : `${file.method === 'ocr' ? c.ocr : c.extracted} · ${file.text.length.toLocaleString(locale)}`}</small></span></summary>{file.method === 'image' && file.dataUrl ? <img className={s.imageReview} src={file.dataUrl} alt={file.name}/> : <pre>{file.text}</pre>}</details><button type="button" disabled={busy || reading !== null} aria-label={`${c.remove}: ${file.name}`} onClick={() => setFiles(old => old.filter((_, index) => index !== i))}><X size={15}/></button></li>)}</ul>}
      <button type="button" className={s.add} aria-label={c.attach} aria-expanded={picker} disabled={disabled || busy || reading !== null || voice.listening || voice.processing} onClick={() => setPicker(open => !open)}><Plus size={22}/></button>
      {voiceMode ? <button type="button" className={s.hold} disabled={disabled || busy || reading !== null || voice.processing} aria-label={v.hold} aria-pressed={voice.listening} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => finishHold(event)} onPointerCancel={event => finishHold(event, true)} onLostPointerCapture={event => { if (hold.current) finishHold(event, true) }} onContextMenu={event => event.preventDefault()} onKeyDown={event => { if (event.key === 'Escape') finishHold(undefined, true); if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !keyHeld.current) { event.preventDefault(); keyHeld.current = beginHold() } }} onKeyUp={event => { if ((event.key === ' ' || event.key === 'Enter') && keyHeld.current) { event.preventDefault(); finishHold() } }} onBlur={() => { if (keyHeld.current) finishHold(undefined, true) }}><span>{holdLabel(state, v)}</span></button> : <textarea ref={field} value={value} rows={1} maxLength={4000} dir="auto" disabled={disabled || busy} placeholder={busy ? pearl.busy : placeholder} aria-label={placeholder} onChange={e => { onChange(e.target.value); if (e.target.value) onInteraction?.() }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={keyDown} onCompositionStart={() => { ime.current = true }} onCompositionEnd={() => { ime.current = false }} />}
      <div className={s.controls}>
        {voiceMode ? <button type="button" className={s.voice} aria-label={v.keyboard} disabled={voice.listening} onClick={switchKeyboard}><Keyboard size={21}/></button> : <button type="button" className={s.voice} disabled={disabled || busy || reading !== null} aria-label={c.voice} onClick={() => { setError(''); setVoiceMode(true); setFocused(false); field.current?.blur() }}><Mic size={22}/></button>}
        {reading !== null ? <span className={s.reading} role="status"><LoaderCircle size={18}/><span>{reading}%</span></span> : busy && onStop ? <button key="stop" type="button" className={s.send} aria-label={stopLabel} onClick={onStop}><Square size={12} fill="currentColor"/></button> : !voiceMode && (value.trim() || files.length) ? <button key="send" type="submit" className={s.send} disabled={disabled || busy} aria-label={sendLabel}><ArrowUp size={19}/></button> : null}
      </div>
    </motion.form>
    {(error || voiceError || reading !== null || (voice.processing && !voiceOverlay)) && <p className={s.status} data-tone={error || voiceError ? 'error' : undefined} role={error || voiceError ? 'alert' : 'status'}>{error || voiceError || (voice.processing ? v.transcribing : `${c.reading} ${reading}%`)}</p>}
  </div>
}
