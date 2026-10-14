'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type VoiceError = 'denied' | 'empty' | 'failed' | 'unavailable' | 'network' | 'capture' | 'language' | 'timeout'
export type VoicePhase = 'idle' | 'connecting' | 'listening' | 'processing'
// The engine must report audio within this window, or the hold ends with a retryable timeout.
const CONNECT_MS = 4500
// Android ends a silent recognizer after a few seconds; a held button restarts it at most this often.
const MAX_RESTARTS = 12
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  onaudiostart: (() => void) | null; onspeechstart: (() => void) | null; onspeechend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type VoiceWindow = Window & { RwaNativeVoice?: { start(input: { locale: string }): void; stop(): void }; SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
let cancelActiveVoice: (() => void) | null = null
const detach = (item: Recognition) => { item.onresult = item.onerror = item.onend = item.onaudiostart = item.onspeechstart = item.onspeechend = null }
const voiceError = (code = ''): VoiceError => code === 'service-not-allowed' ? 'unavailable' : /permission|denied|not-allowed|recognizer-9$/i.test(code) ? 'denied'
  : /no.?speech|no.?match|recognizer-[67]$/i.test(code) ? 'empty'
  : /network|recognizer-[12]$/i.test(code) ? 'network'
  : /audio-capture|recognizer-3$/i.test(code) ? 'capture'
  : /language-not-supported|recognizer-1[23]$/i.test(code) ? 'language' : 'failed'

/** Only the recognition engine opens the microphone. Hold mode sends nothing before release. */
export function useAiVoice(locale: string, onText: (text: string) => void, options: { deferResult?: boolean } = {}) {
  const [available, setAvailable] = useState(false), [listening, setListening] = useState(false), [error, setError] = useState<VoiceError | null>(null)
  const [processing, setProcessing] = useState(false), [ready, setReady] = useState(false), [speaking, setSpeaking] = useState(false), [live, setLive] = useState('')
  const active = useRef(false), recognition = useRef<Recognition | null>(null), receive = useRef(onText), timer = useRef<ReturnType<typeof setTimeout> | null>(null), run = useRef(0)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null), restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deferred = useRef(!!options.deferResult), transcript = useRef(''), completed = useRef(''), released = useRef(false), ended = useRef(false), delivered = useRef(false)
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null), readyRef = useRef(false), restarts = useRef(0), permission = useRef<PermissionState | null>(null)
  receive.current = onText; deferred.current = !!options.deferResult
  const textSoFar = useCallback(() => [completed.current, transcript.current].filter(Boolean).join(' ').trim().slice(0, 4000), [])
  const markReady = useCallback(() => {
    readyRef.current = true; setReady(true)
    if (connectTimer.current) { clearTimeout(connectTimer.current); connectTimer.current = null }
  }, [])
  const settle = useCallback(() => {
    active.current = false; recognition.current = null; readyRef.current = false; setListening(false); setProcessing(false); setReady(false); setSpeaking(false); setLive('')
    for (const ref of [timer, releaseTimer, restartTimer, connectTimer]) { if (ref.current) clearTimeout(ref.current); ref.current = null }
  }, [])
  const cancel = useCallback(() => {
    const item = recognition.current, wasActive = active.current
    run.current++; transcript.current = completed.current = ''; settle()
    if (cancelActiveVoice === cancel) cancelActiveVoice = null
    try { if (item) { detach(item); item.abort() } else if (wasActive && !ended.current) (window as VoiceWindow).RwaNativeVoice?.stop() } catch { /* The browser may already have released the device. */ }
  }, [settle])
  const finish = useCallback(() => {
    if (!active.current) return
    const text = textSoFar(), deliver = deferred.current && released.current && !!text, item = recognition.current
    settle(); transcript.current = completed.current = ''
    if (cancelActiveVoice === cancel) cancelActiveVoice = null
    // A timeout or an error can omit `end`; release the engine before delivering buffered words.
    if (item) { detach(item); try { item.abort() } catch { /* Already stopped. */ } }
    if (!text) setError(previous => previous ?? 'empty')
    if (deliver) receive.current(text)
    else if (!deferred.current && text && !delivered.current) receive.current(text)
  }, [cancel, settle, textSoFar])
  const stop = useCallback(() => {
    if (!active.current || released.current) return
    released.current = true; setListening(false); setSpeaking(false); setProcessing(deferred.current)
    for (const ref of [timer, connectTimer]) { if (ref.current) clearTimeout(ref.current); ref.current = null }
    if (ended.current) { finish(); return }
    try {
      if (recognition.current) recognition.current.stop(); else (window as VoiceWindow).RwaNativeVoice?.stop()
      // Android sometimes emits only an interim result, or omits the final end callback.
      if (active.current) releaseTimer.current = setTimeout(() => { if (textSoFar()) finish(); else { cancel(); setError('failed') } }, 6000)
    } catch { if (textSoFar()) finish(); else { cancel(); setError('failed') } }
  }, [cancel, finish, textSoFar])
  useEffect(() => {
    const w = window as VoiceWindow
    setAvailable(!!(w.RwaNativeVoice ?? w.SpeechRecognition ?? w.webkitSpeechRecognition))
    const native = (event: Event) => {
      if (!active.current || recognition.current || cancelActiveVoice !== cancel) return
      const detail = (event as CustomEvent<{ type: string; text?: string; error?: string; final?: boolean }>).detail
      if (detail?.type === 'ready' || detail?.type === 'speechstart') { markReady(); setSpeaking(detail.type === 'speechstart') }
      if (detail?.type === 'result' && detail.text) {
        markReady(); setSpeaking(true)
        transcript.current = detail.text.trim().slice(0, 4000); setLive(textSoFar())
        if (!deferred.current && detail.final !== false) { delivered.current = true; receive.current(transcript.current) }
      }
      if (detail?.type === 'error') {
        const reason = voiceError(detail.error)
        // A no-match callback must not erase words already recognised in this held run.
        if (reason === 'empty' && textSoFar()) { ended.current = true; setSpeaking(false); if (!deferred.current || released.current) finish() }
        else { cancel(); setError(reason) }
      }
      if (detail?.type === 'end') { ended.current = true; setSpeaking(false); if (!deferred.current || released.current) finish() }
    }
    window.addEventListener('rwa-native-voice', native)
    const hide = () => { if (document.visibilityState === 'hidden') cancel() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', cancel)
    // Cache the microphone permission without opening the device; a query inside start() would lose the user gesture.
    let status: PermissionStatus | null = null
    const sync = () => { permission.current = status?.state ?? null }
    try {
      void w.navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(result => { status = result; sync(); result.addEventListener?.('change', sync) }).catch(() => undefined)
    } catch { /* Older WebViews have no Permissions API; the engine reports denial instead. */ }
    return () => { status?.removeEventListener?.('change', sync); window.removeEventListener('rwa-native-voice', native); window.removeEventListener('pagehide', cancel); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', hide); cancel() }
  }, [cancel, finish, markReady, textSoFar])
  const start = useCallback(() => {
    if (active.current) { if (!deferred.current) stop(); return false }
    const w = window as VoiceWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    setAvailable(!!(w.RwaNativeVoice ?? Constructor))
    if (!w.RwaNativeVoice && !Constructor) { setError('unavailable'); return false }
    if (permission.current === 'denied') { setError('denied'); return false }
    cancelActiveVoice?.(); cancelActiveVoice = cancel
    const runId = ++run.current, android = /Android/i.test(w.navigator?.userAgent ?? '')
    setError(null); setLive(''); transcript.current = completed.current = ''; released.current = ended.current = delivered.current = false
    active.current = true; readyRef.current = false; restarts.current = 0; setListening(true); setProcessing(false); setReady(false); setSpeaking(false)
    timer.current = setTimeout(() => { cancel(); setError(previous => previous ?? 'failed') }, 60000)
    // A WebView can expose the constructor yet never deliver audio; never leave the hold on "connecting".
    connectTimer.current = setTimeout(() => {
      connectTimer.current = null
      if (active.current && run.current === runId && !readyRef.current && !released.current) { cancel(); setError('timeout') }
    }, w.RwaNativeVoice ? CONNECT_MS * 2 : CONNECT_MS)
    const begin = () => {
      if (!active.current || run.current !== runId || released.current || !Constructor) return
      const item = new Constructor(); recognition.current = item; ended.current = false
      item.lang = ({ en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', ar: 'ar-SA', hi: 'hi-IN' } as Record<string, string>)[locale] ?? locale
      item.interimResults = true
      // Chromium's Android recognizer does not implement continuous=true or shared audio tracks.
      item.continuous = deferred.current && !android
      const current = () => active.current && run.current === runId && recognition.current === item
      item.onaudiostart = () => { if (current()) markReady() }
      item.onspeechstart = () => { if (current()) { markReady(); setSpeaking(true) } }
      item.onspeechend = () => { if (current()) setSpeaking(false) }
      item.onresult = event => {
        if (!current()) return
        // Keep the latest full hypothesis; a later final event replaces it, never duplicates it.
        const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim().slice(0, 4000)
        if (text) { transcript.current = text; setLive(textSoFar()); markReady(); setSpeaking(true) }
        if (!deferred.current) {
          const final = Array.from(event.results).filter(result => result.isFinal !== false).map(result => result[0]?.transcript ?? '').join(' ').trim()
          if (final) { delivered.current = true; receive.current(final) }
        }
      }
      item.onerror = event => {
        if (!current()) return
        const reason = voiceError(event.error)
        if ((reason === 'empty' || (event.error === 'aborted' && released.current)) && textSoFar()) { setSpeaking(false); if (released.current) finish(); return }
        cancel(); setError(reason)
      }
      item.onend = () => {
        if (!current()) return
        ended.current = true; setSpeaking(false)
        if (!deferred.current || released.current) { setReady(false); finish(); return }
        // Android ends at every pause, including silence before the first word. Previously an empty end left the
        // hold with a dead recognizer and the overlay stuck on "connecting"; restart within the same hold instead.
        if (restarts.current++ < MAX_RESTARTS) {
          completed.current = textSoFar(); transcript.current = ''; recognition.current = null; detach(item)
          restartTimer.current = setTimeout(() => { restartTimer.current = null; try { begin() } catch { cancel(); setError('failed') } }, 120)
          return
        }
        setReady(false)
        if (!textSoFar()) { cancel(); setError(readyRef.current ? 'empty' : 'timeout') }
      }
      item.start()
    }
    try {
      if (w.RwaNativeVoice) { w.RwaNativeVoice.start({ locale }); return true }
      begin(); return true
    } catch { cancel(); setError('failed'); return false }
  }, [cancel, locale, stop, finish, markReady, textSoFar])
  const phase: VoicePhase = processing ? 'processing' : listening ? ready ? 'listening' : 'connecting' : 'idle'
  // `live` is the words recognised so far in this hold, shown while speaking so a misheard phrase can be cancelled.
  return { available, listening, processing, ready, speaking, error, phase, live, start, stop, cancel }
}
