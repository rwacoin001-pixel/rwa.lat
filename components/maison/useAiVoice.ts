'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void }
type VoiceWindow = Window & { RwaNativeVoice?: { start(input: { locale: string }): void; stop(): void }; SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
let cancelActiveVoice: (() => void) | null = null
export function useAiVoice(locale: string, onText: (text: string) => void) {
  const [available, setAvailable] = useState(false), [listening, setListening] = useState(false), [error, setError] = useState<'denied' | 'empty' | 'failed' | 'unavailable' | null>(null)
  const active = useRef(false), recognition = useRef<Recognition | null>(null), receive = useRef(onText), heard = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), run = useRef(0)
  receive.current = onText
  const settle = useCallback(() => { active.current = false; recognition.current = null; setListening(false); if (timer.current) clearTimeout(timer.current); timer.current = null }, [])
  const cancel = useCallback(() => {
    const item = recognition.current, wasActive = active.current
    run.current++; settle()
    if (cancelActiveVoice === cancel) cancelActiveVoice = null
    try { if (item) { item.onresult = item.onerror = item.onend = null; item.abort() } else if (wasActive) (window as VoiceWindow).RwaNativeVoice?.stop() } catch { /* The engine may already be torn down by navigation. */ }
  }, [settle])
  const stop = useCallback(() => { if (!active.current) return; const w = window as VoiceWindow; try { if (recognition.current) recognition.current.stop(); else w.RwaNativeVoice?.stop() } catch { cancel(); setError('failed') } }, [cancel])
  useEffect(() => {
    const w = window as VoiceWindow
    setAvailable(!!(w.RwaNativeVoice ?? w.SpeechRecognition ?? w.webkitSpeechRecognition))
    const native = (event: Event) => {
      if (!active.current || recognition.current || cancelActiveVoice !== cancel) return
      const detail = (event as CustomEvent<{ type: string; text?: string; error?: string; final?: boolean }>).detail
      if (detail?.type === 'result' && detail.text && detail.final !== false) { heard.current = true; receive.current(detail.text) }
      if (detail?.type === 'error') { setError(/permission|denied|not-allowed|recognizer-9$/i.test(detail.error ?? '') ? 'denied' : /no.?speech|no.?match|recognizer-[67]$/i.test(detail.error ?? '') ? 'empty' : 'failed'); settle() }
      if (detail?.type === 'end') { if (!heard.current) setError(previous => previous ?? 'empty'); settle() }
    }
    window.addEventListener('rwa-native-voice', native)
    return () => { window.removeEventListener('rwa-native-voice', native); cancel() }
  }, [cancel, settle])
  const start = useCallback(() => {
    if (active.current) { stop(); return }
    const w = window as VoiceWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    // Older WebViews inject the first-party native bridge after page load.
    setAvailable(!!(w.RwaNativeVoice ?? Constructor))
    if (!w.RwaNativeVoice && !Constructor) { setError('unavailable'); return }
    cancelActiveVoice?.(); cancelActiveVoice = cancel
    const runId = ++run.current
    setError(null); heard.current = false; active.current = true; setListening(true)
    timer.current = setTimeout(() => { cancel(); setError(previous => previous ?? 'failed') }, 60000)
    try {
      if (w.RwaNativeVoice) { w.RwaNativeVoice.start({ locale }); return }
      if (!Constructor) { settle(); return }
      const item = new Constructor(); recognition.current = item; item.lang = locale === 'en' ? 'en-US' : locale; item.interimResults = false; item.continuous = false
      const current = () => active.current && run.current === runId && recognition.current === item
      item.onresult = event => { if (!current()) return; const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim(); if (text) { heard.current = true; receive.current(text) } }
      item.onerror = event => { if (!current()) return; setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : event.error === 'no-speech' ? 'empty' : 'failed'); settle() }
      item.onend = () => { if (!current()) return; if (!heard.current) setError(previous => previous ?? 'empty'); settle() }
      item.start()
    } catch { recognition.current = null; setError('failed'); settle() }
  }, [cancel, locale, settle, stop])
  return { available, listening, error, start, stop, cancel }
}
