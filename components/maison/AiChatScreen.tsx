'use client'
import { containsWalletSecret } from '@/lib/ai-input-guard'
import Link from 'next/link'
import { aiNavigationLink } from '@/lib/ai-navigation-link'
import type { Citation, AiQuestion } from '@/lib/api/ai-customer'
import AiQuestionCard from './AiQuestionCard'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowUp, ArrowUpLeft, Check, Copy, Layers3, RotateCcw, Square, SquarePen, X } from 'lucide-react'
import { request } from '@/lib/api/_http'
import { useI18n } from '@/lib/i18n'
import { aiChatCopy } from '@/lib/maison-content-copy'
import { aiShellCopy } from '@/lib/maison-ai-copy'
import ParticleLogoIcon from '../particle-logo-icon'
import { MaisonPage } from './primitives'
import a from './ai-chat.module.css'

type Message = { id: number; role: 'user' | 'assistant'; content: string; citations?: Citation[]; questions?: AiQuestion[] }
type SendError = { text: string; tone: 'error' | 'info'; retry: string | null }
const MAX = 4000
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))

/* ---------- Answer rendering: a small, safe markdown subset (React nodes only, no HTML injection). ---------- */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*]))/g
  let last = 0, match: RegExpExecArray | null, index = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyBase}-${index++}`
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
    const href = link ? aiNavigationLink(link[2]) : null
    out.push(link ? (href ? <Link key={key} href={href} prefetch={false}>{link[1]}</Link> : link[1]) : token.startsWith('**') ? <strong key={key}>{token.slice(2, -2)}</strong> : token.startsWith('*') ? <em key={key}>{token.slice(1, -1)}</em> : <code key={key} dir="ltr">{token.slice(1, -1)}</code>)
    last = match.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'ol'; items: string[] }
function blocks(source: string): Block[] {
  const result: Block[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { result.push({ kind: 'p', text: para.join('\n') }); para = [] } }
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line), number = /^\s*\d+[.)、]\s+(.*)$/.exec(line), heading = /^\s*#{1,4}\s+(.*)$/.exec(line)
    if (!line.trim()) { flush(); continue }
    if (heading) { flush(); result.push({ kind: 'h', text: heading[1] }); continue }
    const kind = bullet ? 'ul' : number ? 'ol' : null
    if (kind) {
      flush()
      const prev = result.at(-1)
      const item = (bullet ?? number)![1]
      if (prev && prev.kind === kind) prev.items.push(item); else result.push({ kind, items: [item] })
      continue
    }
    para.push(line)
  }
  flush()
  return result
}

function Answer({ text, reveal }: { text: string; reveal: boolean }) {
  // Blocks rise in sequence once the reply lands; the delay is capped so long replies never feel slow.
  const list = blocks(text)
  return <div className={a.answer} data-reveal={reveal || undefined} dir="auto">{list.map((block, i) => {
    const style = reveal ? { animationDelay: `${Math.min(i, 8) * 70}ms` } : undefined
    if (block.kind === 'h') return <h3 key={i} style={style}>{inline(block.text, `h${i}`)}</h3>
    if (block.kind === 'p') return <p key={i} style={style}>{block.text.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{inline(line, `p${i}-${j}`)}</Fragment>)}</p>
    const Tag = block.kind, items = block.items
    return <Tag key={i} style={style}>{items.map((item, j) => <li key={j}>{inline(item, `l${i}-${j}`)}</li>)}</Tag>
  })}</div>
}

/* ---------- Thinking: breathing mark, shimmering label, elapsed seconds, honest stage hints. ---------- */

function Thinking({ label, slow, slower, seconds }: { label: string; slow: string; slower: string; seconds: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => { const started = Date.now(); const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500); return () => window.clearInterval(timer) }, [])
  const hint = elapsed >= 20 ? slower : elapsed >= 7 ? slow : null
  return <div className={a.thinking} role="status" aria-live="polite">
    <div className={a.thinkingHead}><span className={a.shimmer}>{label}</span><span className={a.dots} aria-hidden="true"><i /><i /><i /></span>{elapsed >= 2 && <small className={a.elapsed} aria-hidden="true">{fill(seconds, { n: elapsed })}</small>}</div>
    {hint && <p className={a.thinkingHint} key={hint}>{hint}</p>}
    <div className={a.ghost} aria-hidden="true"><i /><i /><i /></div>
  </div>
}

function Mark({ busy = false, size = 'sm' }: { busy?: boolean; size?: 'sm' | 'lg' }) {
  return <span className={a.mark} data-size={size} data-busy={busy || undefined} aria-hidden="true"><ParticleLogoIcon className={a.markLogo} label="" /></span>
}

/* ---------- Screen ---------- */

export function AiChatScreen({ onClose, onPlan }: { onClose: () => void; onPlan: () => void }) {
  const { locale } = useI18n()
  const c = aiShellCopy[locale], chat = aiChatCopy[locale]
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<SendError | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'disabled'>('loading')
  const [copied, setCopied] = useState<number | null>(null)
  const [revealId, setRevealId] = useState<number | null>(null)
  const inflight = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const field = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const composing = useRef(false)

  useEffect(() => {
    let active = true
    request<Record<string, unknown>>('/v1/ai/status').then((result) => { if (active) setStatus(result.ok && result.data?.available !== false && result.data?.configured !== false ? 'ready' : 'disabled') })
    return () => { active = false; inflight.current?.abort() }
  }, [])

  // Grow the composer with its content (1–6 lines); the CSS max-height caps it.
  useLayoutEffect(() => { const el = field.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }, [input])

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (messages.length || sending) end.current?.scrollIntoView({ block: 'end', behavior: reduced() ? 'auto' : 'smooth' }) }, [messages, sending, error])

  // The chat endpoint is synchronous and has no server-side cancel: stopping only ends the wait
  // here, and the copy says the reply may still be stored in history.
  const ask = useCallback(async (message: string) => {
    if (!message || sending || inflight.current || status !== 'ready') return false
    if (message.length > MAX || containsWalletSecret(message)) { setError({ text: message.length > MAX ? chat.tooLong : chat.secret, tone: 'info', retry: null }); return false }
    const controller = new AbortController()
    inflight.current = controller
    const userId = nextId.current++
    setError(null); setInput(''); setSending(true); setRevealId(null)
    setMessages((current) => [...current, { id: userId, role: 'user', content: message }])
    const result = await request<Record<string, unknown>>('/v1/ai/chat', { method: 'POST', body: JSON.stringify({ message, ...(sessionId ? { sessionId } : {}), locale }), signal: controller.signal, timeoutMs: 95_000, loading: 'silent' })
    // Stop / New chat already settled the UI; a late result from an abandoned request is dropped.
    if (controller.signal.aborted || inflight.current !== controller) return false
    inflight.current = null
    setSending(false)
    if (!result.ok) {
      // Take the unanswered message back out of the thread and into the composer.
      setMessages((current) => current.filter((item) => item.id !== userId))
      setInput(message)
      const { status: code, code: reason } = result.error
      const upstreamFailure = code === 503 && reason === 'AI_UPSTREAM_UNAVAILABLE'
      if (code === 404) setSessionId(null)
      const text = reason === 'ABORTED' ? chat.cancelled : code === 0 ? chat.network : upstreamFailure ? chat.failed : code === 503 ? chat.off : code === 429 ? chat.busy : code === 404 ? chat.sessionLost : code === 413 || code === 400 ? chat.tooLong : chat.failed
      setError({ text, tone: reason === 'ABORTED' ? 'info' : 'error', retry: (code === 503 && !upstreamFailure) || code === 400 || code === 413 ? null : message })
      window.requestAnimationFrame(() => field.current?.focus())
      return false
    }
    const data = result.data
    const answer = typeof data.reply === 'string' ? data.reply : typeof data.answer === 'string' ? data.answer : typeof data.response === 'string' ? data.response : typeof data.content === 'string' ? data.content : null
    if (typeof data.sessionId === 'string') setSessionId(data.sessionId)
    if (answer) { const id = nextId.current++; setRevealId(id); const citations = Array.isArray(data.citations) ? data.citations.filter((c): c is Citation => typeof c?.id === 'string' && typeof c?.title === 'string' && Number.isInteger(c?.revision)) : []; const questions = Array.isArray(data.questions) ? data.questions as AiQuestion[] : []; setMessages((current) => [...current, { id, role: 'assistant', content: answer, citations, questions }]); return true }
    else setError({ text: chat.badFormat, tone: 'error', retry: null })
    return false
  }, [chat, locale, sending, sessionId, status])

  // Stopping settles the UI at once rather than waiting for the aborted fetch to unwind.
  const stop = () => {
    const controller = inflight.current
    if (!controller) return
    inflight.current = null
    controller.abort()
    setSending(false)
    // Same as a failed send: the unanswered question goes back into the composer.
    const last = messages.at(-1)
    const pending = last?.role === 'user' ? last.content : null
    if (pending !== null) { setMessages(messages.slice(0, -1)); setInput(pending) }
    setError({ text: chat.cancelled, tone: 'info', retry: pending })
    window.requestAnimationFrame(() => field.current?.focus())
  }
  const submit = () => void ask(input.trim())
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
    if (event.key === 'Escape' && sending) stop()
  }
  const reset = () => { const controller = inflight.current; inflight.current = null; controller?.abort(); setSending(false); setMessages([]); setSessionId(null); setError(null); setInput(''); setRevealId(null); field.current?.focus() }
  const copyText = async (message: Message) => {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); window.setTimeout(() => setCopied((id) => id === message.id ? null : id), 1600) } catch { /* clipboard blocked: nothing to announce */ }
  }

  const empty = messages.length === 0 && !sending
  const canSend = status === 'ready' && !!input.trim() && !sending

  return <MaisonPage page="ai">
    <div className={a.shell}>
      <header className={a.bar}>
        <button type="button" className={a.icon} aria-label={c.close} onClick={onClose}><X size={23} strokeWidth={1.85} /></button>
        <h1 className={a.barTitle}><span>{c.title}</span></h1>
        {messages.length > 0 || sending ? <button type="button" className={a.icon} aria-label={c.newChat} title={c.newChat} onClick={reset}><SquarePen size={19} strokeWidth={1.6} /></button> : <span className={a.icon} aria-hidden="true" />}
      </header>
      <Link href="/ai-assistant">{locale === 'zh-CN' ? '客服中心 · 投资授权' : 'Support · Investment mandate'}</Link>

      <div className={a.thread} aria-busy={sending}>
        {empty ? <section className={a.welcome} aria-labelledby="ai-greeting">
          <Mark size="lg" busy={status === 'loading'} />
          <p className={a.kicker}>{c.kicker}</p>
          <h2 id="ai-greeting" className={a.greeting}>{status === 'disabled' ? chat.unavailable : c.greeting}</h2>
          <p className={a.lede}>{status === 'disabled' ? c.unavailableBody : status === 'loading' ? c.checking : chat.intro}</p>
          {status !== 'disabled' && <div className={a.suggest}>
            <small>{c.suggestions}</small>
            <ul>
              {c.prompts.map((prompt) => <li key={prompt}><button type="button" disabled={status !== 'ready'} onClick={() => void ask(prompt)}><span dir="auto">{prompt}</span><ArrowUpLeft size={16} strokeWidth={1.6} aria-hidden="true" /></button></li>)}
            </ul>
          </div>}
          <button type="button" className={a.planCard} onClick={onPlan}>
            <span className={a.planIcon} aria-hidden="true"><Layers3 size={18} strokeWidth={1.6} /></span>
            <span><b>{c.plan}</b><small>{c.planBody}</small></span>
          </button>
        </section> : <ol className={a.messages}>
          {messages.map((message) => message.role === 'user'
            ? <li key={message.id} className={a.user}><span className={a.srOnly}>{c.you}: </span><p dir="auto">{message.content}</p></li>
            : <li key={message.id} className={a.assistant}>
              <div className={a.who}><Mark /><b>{c.name}</b></div>
              <Answer text={message.content} reveal={message.id === revealId && !reduced()} />
              {message.citations?.map(c=><Link key={`${c.id}:${c.revision}`} prefetch={false} href={aiNavigationLink(c.url) ?? `/ai-assistant?knowledge=${encodeURIComponent(c.id)}&revision=${c.revision}`}>{c.title}{c.url ? '' : ` · v${c.revision}`}</Link>)}
              <div className={a.tools}>
                <button type="button" onClick={() => void copyText(message)} aria-label={copied === message.id ? c.copied : c.copy}>{copied === message.id ? <Check size={15} /> : <Copy size={15} />}<span>{copied === message.id ? c.copied : c.copy}</span></button>
                <span className={a.srOnly} aria-live="polite">{copied === message.id ? c.copied : ''}</span>
              </div>
            </li>)}
          {sending && <li className={a.assistant}>
            <div className={a.who}><Mark busy /><b>{c.name}</b></div>
            <Thinking label={c.thinking} slow={c.slow} slower={c.slower} seconds={c.seconds} />
          </li>}
        </ol>}
        {error && <div className={a.notice} data-tone={error.tone} role={error.tone === 'error' ? 'alert' : 'status'}>
          <AlertCircle size={16} strokeWidth={1.8} aria-hidden="true" /><p>{error.text}</p>
          {error.retry && status === 'ready' && <button type="button" onClick={() => void ask(error.retry ?? '')}><RotateCcw size={14} aria-hidden="true" />{chat.retry}</button>}
        </div>}
        <div ref={end} className={a.end} />
      </div>

      <div className={a.dockWrap}>
        {(() => { const latest = messages.findLast(m => m.role === 'assistant'); return latest?.questions?.length ? <AiQuestionCard key={latest.id} questions={latest.questions} locale={locale} disabled={sending || status !== 'ready'} onConfirm={ask} /> : null })()}
        <form className={a.composer} data-disabled={status === 'disabled' || undefined} onSubmit={(event) => { event.preventDefault(); submit() }}>
          <textarea ref={field} rows={1} value={input} dir="auto" maxLength={MAX} aria-label={c.placeholder} placeholder={c.placeholder} disabled={status === 'disabled'}
            onChange={(event) => setInput(event.target.value)} onKeyDown={onKey}
            onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
          <div className={a.composerRow}>
            {input.length > MAX - 400 ? <small className={a.counter} data-full={input.length >= MAX || undefined} aria-live="polite">{fill(c.counter, { n: input.length, max: MAX })}</small> : <span />}
            {/* Distinct keys: reusing one node would flip it to type=submit mid-click and resend. */}
            {sending
              ? <button key="stop" type="button" className={a.send} data-mode="stop" aria-label={c.stop} title={c.stop} onClick={stop}><Square size={12} fill="currentColor" strokeWidth={0} /></button>
              : <button key="send" type="submit" className={a.send} aria-label={chat.send} disabled={!canSend}><ArrowUp size={18} strokeWidth={2} /></button>}
          </div>
        </form>
        {!empty && <p className={a.disclaimer}>{c.footnote}</p>}
      </div>
    </div>
  </MaisonPage>
}
