'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, X } from 'lucide-react'
import { BuddyFace } from '@/components/buddy/BuddyFace'
import { containsWalletSecret } from '@/lib/ai-input-guard'
import { aiCustomer } from '@/lib/api/ai-customer'
import { useI18n } from '@/lib/i18n'
import { aiChatCopy } from '@/lib/maison-content-copy'
import { aiVoiceCopy } from '@/lib/ai-voice-copy'
import { aiShellCopy } from '@/lib/maison-ai-copy'
import styles from './kimeng-desktop-auth.module.css'

export default function KimengDesktopAsk() {
  const { locale } = useI18n()
  const copy = aiChatCopy[locale]
  const title = aiVoiceCopy(locale).title
  const shell = aiShellCopy[locale]
  const placeholder = locale === 'zh-CN' ? '问金英 AI 助手' : locale === 'en' ? 'Ask the KIMENG AI Assistant' : shell.placeholder
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<{ question: string; answer: string }[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(0)
  const [error, setError] = useState('')
  const [session, setSession] = useState<string>()
  const active = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const thread = useRef<HTMLDivElement>(null)

  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight
  }, [messages, open, busy, error])

  function close() {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setOpen(false)
    setFlash(0)
    input.current?.focus({ preventScroll: true })
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = draft.trim()
    if (!question || active.current) return
    setOpen(true)
    if (containsWalletSecret(question)) {
      setError(copy.secret)
      return
    }
    const controller = new AbortController()
    active.current = controller
    setFlash(current => current + 1)
    setBusy(true)
    setError('')
    const result = await aiCustomer.chat(question, locale, session, [], [], controller.signal)
    if (active.current !== controller || controller.signal.aborted) return
    active.current = null
    setBusy(false)
    if (!result.ok) {
      if (result.error.status === 404) setSession(undefined)
      setError(result.error.status === 429 ? copy.busy : result.error.status === 0 ? copy.network : copy.failed)
      return
    }
    if (!result.data.reply) { setError(copy.badFormat); return }
    setSession(result.data.sessionId)
    setMessages(previous => [...previous, { question, answer: result.data.reply }].slice(-12))
    setDraft('')
  }

  return <>
    <aside className={styles.askWrap} aria-label={title} onKeyDown={event => { if (event.key === 'Escape' && open) close() }}>
      {open && <section className={styles.reply} aria-label={title}>
        <header><BuddyFace size={23} still /><strong>{title}</strong><button className={styles.close} type="button" aria-label={shell.close} onClick={close}><X size={18} /></button></header>
        <div ref={thread} className={styles.thread} role="log" aria-live="polite" tabIndex={0}>
          {messages.map(({ question, answer }, index) => <div key={index}><p className={styles.question} dir="auto">{question}</p><p className={styles.answer} dir="auto">{answer}</p></div>)}
          {busy && <><p className={styles.question} dir="auto">{draft.trim()}</p><p className={styles.hint}>{copy.thinking}</p></>}
          {error && <p className={styles.hint} role="alert">{error}</p>}
        </div>
      </section>}
      <form className={styles.composer} data-busy={busy || undefined} onSubmit={send}>
        <BuddyFace size={29} mood={busy ? 'thinking' : 'idle'} still={!busy} />
        <input ref={input} type="text" maxLength={400} autoComplete="off" aria-label={placeholder} placeholder={placeholder} value={draft} readOnly={busy} onChange={event => setDraft(event.target.value)} />
        <button className={styles.send} type="submit" aria-label={copy.send} disabled={busy || !draft.trim()}><ArrowUp size={18} /></button>
      </form>
    </aside>
    {flash > 0 && <div key={flash} className={styles.edge} aria-hidden="true" onAnimationEnd={event => { if (event.target === event.currentTarget) setFlash(0) }} />}
  </>
}
