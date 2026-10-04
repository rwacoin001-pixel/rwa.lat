'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void }
type VoiceWindow = Window & { RwaNativeVoice?: { start(input: { locale: string }): void; stop(): void }; SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
let cancelActiveVoice: (() => void) | null = null

/** The default mode fills question cards. Hold mode keeps every transcript private until release. */
export function useAiVoice(locale: string, onText: (text: string) => void, options: { deferResult?: boolean } = {}) {
  const [available, setAvailable] = useState(false), [listening, setListening] = useState(false), [error, setError] = useState<'denied' | 'empty' | 'failed' | 'unavailable' | null>(null)
  const [processing, setProcessing] = useState(false)
  const active = useRef(false), recognition = useRef<Recognition | null>(null), receive = useRef(onText), heard = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), run = useRef(0)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null), deferred = useRef(!!options.deferResult), transcript = useRef(''), released = useRef(false), ended = useRef(false)
  receive.current = onText; deferred.current = !!options.deferResult
  const settle = useCallback(() => {
    active.current = false; recognition.current = null; setListening(false); setProcessing(false)
    if (timer.current) clearTimeout(timer.current)
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    timer.current = releaseTimer.current = null
  }, [])
  const cancel = useCallback(() => {
    const item = recognition.current, wasActive = active.current
    run.current++; transcript.current = ''; settle()
    if (cancelActiveVoice === cancel) cancelActiveVoice = null
    try { if (item) { item.onresult = item.onerror = item.onend = null; item.abort() } else if (wasActive && !ended.current) (window as VoiceWindow).RwaNativeVoice?.stop() } catch { /* Navigation can already have torn down the microphone. */ }
  }, [settle])
  const finish = useCallback(() => {
    if (!active.current) return
    const text = transcript.current.trim(), deliver = deferred.current && released.current && !!text
    settle()
    if (cancelActiveVoice === cancel) cancelActiveVoice = null
    if (!heard.current) setError(previous => previous ?? 'empty')
    if (deliver) receive.current(text)
  }, [cancel, settle])
  const stop = useCallback(() => {
    if (!active.current) return
    released.current = true; setListening(false); setProcessing(deferred.current)
    if (ended.current) { finish(); return }
    try {
      if (recognition.current) recognition.current.stop(); else (window as VoiceWindow).RwaNativeVoice?.stop()
      // Engines can fail to emit an end event. Discard that run instead of sending a partial result.
      if (active.current) releaseTimer.current = setTimeout(() => { cancel(); setError('failed') }, 6000)
    } catch { cancel(); setError('failed') }
  }, [cancel, finish])
  useEffect(() => {
    const w = window as VoiceWindow
    setAvailable(!!(w.RwaNativeVoice ?? w.SpeechRecognition ?? w.webkitSpeechRecognition))
    const native = (event: Event) => {
      if (!active.current || recognition.current || cancelActiveVoice !== cancel) return
      const detail = (event as CustomEvent<{ type: string; text?: string; error?: string; final?: boolean }>).detail
      if (detail?.type === 'result' && detail.text && detail.final !== false) {
        heard.current = true; transcript.current = detail.text
        if (!deferred.current) receive.current(detail.text)
      }
      if (detail?.type === 'error') { const reason = /permission|denied|not-allowed|recognizer-9$/i.test(detail.error ?? '') ? 'denied' : /no.?speech|no.?match|recognizer-[67]$/i.test(detail.error ?? '') ? 'empty' : 'failed'; cancel(); setError(reason) }
      if (detail?.type === 'end') { ended.current = true; if (!deferred.current || released.current) finish() }
    }
    window.addEventListener('rwa-native-voice', native)
    const hide = () => { if (document.visibilityState === 'hidden') cancel() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', cancel)
    return () => { window.removeEventListener('rwa-native-voice', native); window.removeEventListener('pagehide', cancel); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', hide); cancel() }
  }, [cancel, finish])
  const start = useCallback(() => {
    if (active.current) { if (!deferred.current) stop(); return false }
    const w = window as VoiceWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    setAvailable(!!(w.RwaNativeVoice ?? Constructor))
    if (!w.RwaNativeVoice && !Constructor) { setError('unavailable'); return false }
    cancelActiveVoice?.(); cancelActiveVoice = cancel
    const runId = ++run.current
    setError(null); heard.current = false; transcript.current = ''; released.current = false; ended.current = false; active.current = true; setListening(true); setProcessing(false)
    timer.current = setTimeout(() => { cancel(); setError(previous => previous ?? 'failed') }, 60000)
    try {
      if (w.RwaNativeVoice) { w.RwaNativeVoice.start({ locale }); return true }
      if (!Constructor) { settle(); return false }
      const item = new Constructor(); recognition.current = item; item.lang = locale === 'en' ? 'en-US' : locale; item.interimResults = deferred.current; item.continuous = deferred.current
      const current = () => active.current && run.current === runId && recognition.current === item
      item.onresult = event => {
        if (!current()) return
        const text = Array.from(event.results).filter(result => result.isFinal !== false).map(result => result[0]?.transcript ?? '').join(' ').trim()
        if (text) { heard.current = true; transcript.current = text; if (!deferred.current) receive.current(text) }
      }
      item.onerror = event => { if (!current()) return; const reason = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : event.error === 'no-speech' ? 'empty' : 'failed'; cancel(); setError(reason) }
      item.onend = () => { if (!current()) return; ended.current = true; if (!deferred.current || released.current) finish() }
      item.start(); return true
    } catch { cancel(); setError('failed'); return false }
  }, [cancel, locale, settle, stop, finish])
  return { available, listening, processing, error, start, stop, cancel }
}
