'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Share2, Square, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { aiInputCopy, aiShellCopy } from '@/lib/maison-ai-copy'
import { getSessionToken, readSession, request } from '@/lib/api/_http'
import s from './ai-answer-actions.module.css'

let activeSpeech: { utterance: SpeechSynthesisUtterance; finish(): void } | null = null
async function copy(text: string) {
  if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); return } catch { /* Some WebViews require the selection fallback. */ } }
  const field = document.createElement('textarea'); field.value = text; field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'; document.body.appendChild(field); field.select()
  try { if (!document.execCommand('copy')) throw new Error('Clipboard unavailable') } finally { field.remove() }
}
export default function AiAnswerActions({ text, messageId, localId, locale }: { text: string; messageId?: string; localId: string; locale: AppLocale }) {
  const c = aiInputCopy(locale), shell = aiShellCopy[locale]
  const [copied, setCopied] = useState(false), [speaking, setSpeaking] = useState(false), [helpful, setHelpful] = useState<boolean | null>(null), [saving, setSaving] = useState(false), [status, setStatus] = useState('')
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null)
  const copyTimer = useRef<number | null>(null)
  const storageKey = `rwa.ai.feedback.${readSession()?.userId ?? 'guest'}.${localId}`
  useEffect(() => { try { const saved = localStorage.getItem(storageKey); setHelpful(saved === 'true' ? true : saved === 'false' ? false : null) } catch { /* Optional local feedback storage. */ } }, [storageKey])
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); if (activeUtterance.current && activeSpeech?.utterance === activeUtterance.current) { activeUtterance.current.onend = activeUtterance.current.onerror = null; activeSpeech = null; window.speechSynthesis?.cancel() } }, [])
  const copyAnswer = async () => { try { await copy(text); setCopied(true); setStatus(shell.copied); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = window.setTimeout(() => setCopied(false), 1600) } catch { setStatus(c.actionFailed) } }
  const speak = () => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setStatus(c.speechUnavailable); return }
    const ownSpeech = activeUtterance.current && activeSpeech?.utterance === activeUtterance.current
    activeSpeech?.finish(); window.speechSynthesis.cancel()
    if (ownSpeech) return
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*#`]/g, '')); utterance.lang = locale === 'en' ? 'en-US' : locale
    activeUtterance.current = utterance
    const finish = () => { if (activeUtterance.current !== utterance) return; activeUtterance.current = null; if (activeSpeech?.utterance === utterance) activeSpeech = null; setSpeaking(false) }
    utterance.onend = finish; utterance.onerror = event => { if (activeUtterance.current !== utterance) return; finish(); if (event.error !== 'canceled' && event.error !== 'interrupted') setStatus(c.speechUnavailable) }
    activeSpeech = { utterance, finish }
    setStatus(''); setSpeaking(true); window.speechSynthesis.speak(utterance)
  }
  const feedback = async (value: boolean) => {
    if (saving || helpful === value) return
    setSaving(true); setStatus('')
    try {
      const server = !!messageId && !!getSessionToken()
      if (server) { const result = await request('/v1/ai/feedback', { method: 'POST', body: JSON.stringify({ messageId, helpful: value }), loading: 'silent' }); if (!result.ok) throw new Error('Feedback failed') }
      try { localStorage.setItem(storageKey, String(value)) } catch { if (!server) throw new Error('Storage unavailable') }
      setHelpful(value); setStatus(server ? c.feedbackSaved : c.feedbackLocal)
    } catch { setStatus(c.actionFailed) } finally { setSaving(false) }
  }
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: shell.name, text }); setStatus('') } else { await copy(text); setStatus(c.shared) } }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus(c.actionFailed) }
  }
  return <div className={s.wrap}><div className={s.actions}>
    <button type="button" aria-label={speaking ? c.readStop : c.read} aria-pressed={speaking} onClick={speak}>{speaking ? <Square size={13}/> : <Volume2 size={18}/>}</button>
    <button type="button" aria-label={copied ? shell.copied : shell.copy} onClick={() => void copyAnswer()}>{copied ? <Check size={18}/> : <Copy size={17}/>}</button>
    <button type="button" aria-label={c.like} aria-pressed={helpful === true} disabled={saving} onClick={() => void feedback(true)}><ThumbsUp size={17}/></button>
    <button type="button" aria-label={c.dislike} aria-pressed={helpful === false} disabled={saving} onClick={() => void feedback(false)}><ThumbsDown size={17}/></button>
    <button type="button" className={s.share} aria-label={c.share} onClick={() => void share()}><Share2 size={17}/></button>
  </div><span className={s.status} role="status" aria-live="polite">{status}</span></div>
}
