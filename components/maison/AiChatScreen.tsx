'use client'
import { containsWalletSecret } from '@/lib/ai-input-guard'
import { accountScopesFor } from '@/lib/ai-account-intent'
import Link from 'next/link'
import { aiNavigationLink } from '@/lib/ai-navigation-link'
import type { Citation, AiQuestion } from '@/lib/api/ai-customer'
import AiQuestionCard from './AiQuestionCard'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, RotateCcw, X } from 'lucide-react'
import { useSignedIn } from '@/hooks/useAccount'
import { request, SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import { useI18n } from '@/lib/i18n'
import { aiChatCopy } from '@/lib/maison-content-copy'
import { aiShellCopy, aiInputCopy } from '@/lib/maison-ai-copy'
import { aiVoiceCopy } from '@/lib/ai-voice-copy'
import { aiVisualCopy } from '@/lib/ai-visual-copy'
import type { AiPageContext } from '@/lib/ai-page-context'
import { showAiAnswer, type AiAttachment } from '@/lib/ai-attachment-policy'
import { AI_CHAT_SESSION_KEY, clearAiChatSession, parseAiChatSession, serializeAiChatSession, type AiChatMessage } from '@/lib/ai-chat-session'
import AiComposer, { type ComposerVoice } from './AiComposer'
import { buddySignal } from '@/lib/buddy-signals'
import { BuddyFace } from '@/components/buddy/BuddyFace'
import { aiPearlCopy, pearlGreeting } from '@/lib/ai-pearl-copy'
import { isVoiceActive, pearlFor, showsSuggestions } from '@/lib/ai-surface-state'
import AiAnswerActions from './AiAnswerActions'
import { AiNoticeTray } from './AiNoticeTray'
import { useReveal } from './useReveal'
import { MaisonPage } from './primitives'
import a from './ai-chat.module.css'

type Message = AiChatMessage
type SendError = { text: string; tone: 'error' | 'info'; retry: string | null; attachments?: AiAttachment[] }
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

function Answer({ text, reveal, onDone, onProgress }: { text: string; reveal: boolean; onDone: () => void; onProgress: () => void }) {
  const { visible, revealing, finish } = useReveal(text, reveal)
  const list = blocks(visible), caret = revealing ? <span className={a.caret} aria-hidden="true" /> : null
  useEffect(() => { if (reveal && !revealing) onDone() }, [reveal, revealing, onDone])
  useLayoutEffect(() => { if (reveal) onProgress() }, [visible, reveal, onProgress])
  return <div onClick={finish} tabIndex={revealing ? 0 : undefined} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); finish() } }}>
    {revealing && <span className={a.srOnly}>{text}</span>}
    <div className={a.answer} dir="auto" aria-hidden={revealing || undefined} inert={revealing}>{list.map((block, i) => {
      const tail = i === list.length - 1 ? caret : null
      if (block.kind === 'h') return <h3 key={i}>{inline(block.text, `h${i}`)}{tail}</h3>
      if (block.kind === 'p') return <p key={i}>{block.text.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{inline(line, `p${i}-${j}`)}</Fragment>)}{tail}</p>
      const Tag = block.kind, items = block.items
      return <Tag key={i}>{items.map((item, j) => <li key={j}>{inline(item, `l${i}-${j}`)}{j === items.length - 1 && tail}</li>)}</Tag>
    })}{!list.length && <p>{caret}</p>}</div>
  </div>
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

// The assistant's avatar is the same pearl as the welcome screen: still at rest, an orbiting arc while it
// thinks, and one bright pulse as an answer lands.
function Mark({ busy = false, speaking = false, size = 'sm' }: { busy?: boolean; speaking?: boolean; size?: 'sm' | 'lg' }) {
  // The paper buddy: thinking while it waits, talking as the answer lands, still otherwise.
  return <span className={a.mark} data-size={size} data-busy={busy || undefined} aria-hidden="true"><BuddyFace size={size === 'lg' ? 56 : 26} mood={busy ? 'thinking' : speaking ? 'replying' : 'idle'} still={!busy && !speaking} /></span>
}

/* ---------- Screen ---------- */

/**
 * The assistant (2026-10-28): conversation only — Community has its own tab and "Me" its own page. In `overlay` mode it
 * sits on the current page (components/h5/AiOverlay.tsx) and scrolls inside `scroller` instead of the window.
 */
export function AiChatScreen({ onClose, pageContext, overlay = false, scroller = null }: { onClose: () => void; onPlan: () => void; pageContext?: AiPageContext; overlay?: boolean; scroller?: HTMLElement | null }) {
  const { locale } = useI18n()
  const pearl = aiPearlCopy(locale), prompts = aiVisualCopy(locale).prompts.slice(0, 3)
  const c = aiShellCopy[locale], chat = aiChatCopy[locale]
  const voiceCopy = aiVoiceCopy(locale)
  const [input, setInput] = useState('')
  // A question handed over from Home ("Ask AI: …") waits in the composer; the reader sends it.
  useEffect(() => { try { const prefill = sessionStorage.getItem('rwa.ai.prefill'); if (prefill) { sessionStorage.removeItem('rwa.ai.prefill'); setInput(prefill.replace(/^[^:：]+[:：]\s*/, '')) } } catch { /* nothing waiting */ } }, [])
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<SendError | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'disabled'>('loading')
  const [generation, setGeneration] = useState(0)
  const [keyboard, setKeyboard] = useState(0)
  const [dockHeight, setDockHeight] = useState(150)
  const [revealId, setRevealId] = useState<number | null>(null)
  const [voice, setVoice] = useState<ComposerVoice>({ state: 'idle', live: '' })
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  // The avatar pulses once while a new answer unfolds, then rests (a resting pearl draws no frames).
  useEffect(() => { setSpeakingId(revealId); if (revealId === null) return; const timer = window.setTimeout(() => setSpeakingId(null), 1600); return () => window.clearTimeout(timer) }, [revealId])
  const [started, setStarted] = useState(false)
  const [sessionRestored, setSessionRestored] = useState(false)
  const inflight = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const end = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const followEnd = useRef(true), lastFollow = useRef(0), followTimer = useRef(0)
  const scrollerRef = useRef<HTMLElement | null>(null)
  scrollerRef.current = scroller
  const toEnd = useCallback((smooth = false) => {
    const box = scrollerRef.current
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    else end.current?.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' })
  }, [])
  const followReveal = useCallback(() => {
    const now = performance.now()
    if (!followEnd.current || followTimer.current) return
    const scroll = () => { followTimer.current = 0; if (followEnd.current) { lastFollow.current = performance.now(); toEnd() } }
    if (now - lastFollow.current < 120) followTimer.current = window.setTimeout(scroll, 120 - (now - lastFollow.current))
    else scroll()
  }, [toEnd])
  useEffect(() => () => window.clearTimeout(followTimer.current), [])
  const finishReveal = useCallback(() => setRevealId(null), [])
  const signedIn = useSignedIn()

  useEffect(() => {
    try {
      const snapshot = parseAiChatSession(sessionStorage.getItem(AI_CHAT_SESSION_KEY))
      if (snapshot) {
        setSessionId(snapshot.sessionId)
        setMessages(snapshot.messages)
        setStarted(true)
        nextId.current = Math.max(0, ...snapshot.messages.map(message => message.id)) + 1
      }
    } catch { /* Storage can be unavailable in private or restricted browser modes. */ }
    setSessionRestored(true)
  }, [])

  useEffect(() => {
    if (!sessionRestored) return
    try {
      const snapshot = serializeAiChatSession(sessionId, messages)
      if (snapshot) sessionStorage.setItem(AI_CHAT_SESSION_KEY, snapshot)
      else clearAiChatSession(sessionStorage)
    } catch { /* Conversation remains usable if storage is unavailable or full. */ }
  }, [messages, sessionId, sessionRestored])

  useEffect(() => {
    let active = true
    request<Record<string, unknown>>('/v1/ai/status').then((result) => { if (active) setStatus(result.ok && result.data?.available !== false && result.data?.configured !== false ? 'ready' : 'disabled') })
    return () => { active = false; inflight.current?.abort() }
  }, [])

  useEffect(() => {
    const reset = () => {
      inflight.current?.abort(); inflight.current = null
      setSending(false); setMessages([]); setSessionId(null); setInput(''); setError(null); setStarted(false); setRevealId(null)
      try { clearAiChatSession(window.sessionStorage) } catch { /* Keep account transitions usable when storage is blocked. */ }
      setGeneration(n => n + 1)
    }
    window.addEventListener(SESSION_CHANGED, reset)
    window.addEventListener(SESSION_EXPIRED, reset)
    return () => { window.removeEventListener(SESSION_CHANGED, reset); window.removeEventListener(SESSION_EXPIRED, reset) }
  }, [])
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const read = () => { frame = 0; const next = Math.round(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)); setKeyboard(previous => Math.abs(previous - next) < 24 && next !== 0 ? previous : next) }
    const update = () => { if (!frame) frame = window.requestAnimationFrame(read) }
    viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update); read()
    return () => { window.cancelAnimationFrame(frame); viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update) }
  }, [])
  useEffect(() => { if (!dock.current || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(entries => setDockHeight(Math.ceil(entries[0]?.contentRect.height ?? 150) + 40)); observer.observe(dock.current); return () => observer.disconnect() }, [])

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    const scroll = () => { const bottom = end.current?.getBoundingClientRect().bottom; if (bottom !== undefined) followEnd.current = bottom <= (window.visualViewport?.height ?? window.innerHeight) - dockHeight + 120 }
    const target: HTMLElement | Window = scroller ?? window
    target.addEventListener('scroll', scroll, { passive: true })
    return () => target.removeEventListener('scroll', scroll)
  }, [dockHeight, scroller])
  useEffect(() => { if (revealId !== null) { followReveal(); return }; if (followEnd.current && (messages.length || sending)) toEnd(!reduced()) }, [messages, sending, error, followReveal, toEnd])
  useEffect(() => { if (followEnd.current && (messages.length || sending)) toEnd() }, [dockHeight, keyboard])

  // The chat endpoint is synchronous and has no server-side cancel: stopping only ends the wait
  // here, and the copy says the reply may still be stored in history.
  const ask = useCallback(async (message: string, attachments: AiAttachment[] = []) => {
    if (!message || sending || inflight.current || status !== 'ready') return false
    if (message.length > MAX || containsWalletSecret([message, ...attachments.map(file => file.name + '\n' + file.text)].join('\n'))) { setError({ text: message.length > MAX ? chat.tooLong : chat.secret, tone: 'info', retry: null }); return false }
    const controller = new AbortController()
    inflight.current = controller
    const userId = nextId.current++
    navigator.vibrate?.(8)
    followEnd.current = true
    setError(null); setSending(true); setRevealId(null); setStarted(true)
    buddySignal('thinking', { hold: true })
    setMessages((current) => [...current, { id: userId, role: 'user', content: message, attachments }])
    // Signed-in readers asking about their own account get only the snapshot slices the question
    // names; guests never send scopes, so the assistant can only point them to sign in.
    const accountScopes = signedIn ? accountScopesFor(message) : []
    const result = await request<Record<string, unknown>>('/v1/ai/chat', { method: 'POST', body: JSON.stringify({ message, ...(attachments.length ? { attachments } : {}), ...(pageContext ? { context: pageContext } : {}), ...(sessionId ? { sessionId } : {}), ...(accountScopes.length ? { accountScopes } : {}), locale }), signal: controller.signal, timeoutMs: 95_000, loading: 'silent' })
    // Stop / New chat already settled the UI; a late result from an abandoned request is dropped.
    if (controller.signal.aborted || inflight.current !== controller) return false
    inflight.current = null
    setSending(false)
    if (!result.ok) {
      buddySignal(result.error.code === 'ABORTED' ? 'idle' : result.error.code === 'AI_REFUSED' ? 'refusing' : 'error', { ms: 3200 })
      // Take the unanswered message back out of the thread and into the composer.
      setMessages((current) => current.filter((item) => item.id !== userId))
      const { status: code, code: reason } = result.error
      const upstreamFailure = code === 503 && reason === 'AI_UPSTREAM_UNAVAILABLE'
      if (code === 404) setSessionId(null)
      const text = reason === 'AI_VISION_UNAVAILABLE' ? aiVisualCopy(locale).unavailable : reason === 'ABORTED' ? chat.cancelled : code === 0 ? chat.network : upstreamFailure ? chat.failed : code === 503 ? chat.off : code === 429 ? chat.busy : code === 404 ? chat.sessionLost : code === 413 || code === 400 ? chat.tooLong : chat.failed
      setError({ text, tone: reason === 'ABORTED' ? 'info' : 'error', retry: (code === 503 && !upstreamFailure) || code === 400 || code === 413 ? null : message, attachments })
      return false
    }
    const data = result.data
    const answer = typeof data.reply === 'string' ? data.reply : typeof data.answer === 'string' ? data.answer : typeof data.response === 'string' ? data.response : typeof data.content === 'string' ? data.content : null
    if (typeof data.sessionId === 'string') setSessionId(data.sessionId)
    buddySignal(answer ? 'replying' : 'error', { ms: answer ? 2800 : 3200 })
    if (answer) { const id = nextId.current++; setRevealId(id); const citations = Array.isArray(data.citations) ? data.citations.filter((c): c is Citation => typeof c?.id === 'string' && typeof c?.title === 'string' && Number.isInteger(c?.revision)) : []; const questions = Array.isArray(data.questions) ? data.questions as AiQuestion[] : []; setMessages((current) => [...current, { id, messageId: typeof data.messageId === 'string' ? data.messageId : undefined, role: 'assistant', content: answer, citations, questions }]); return true }
    else { setMessages(current => current.filter(item => item.id !== userId)); setError({ text: chat.badFormat, tone: 'error', retry: null }) }
    return false
  }, [chat, locale, sending, sessionId, status, pageContext, signedIn])

  // Stopping settles the UI at once rather than waiting for the aborted fetch to unwind.
  const stop = () => {
    const controller = inflight.current
    if (!controller) return
    inflight.current = null
    controller.abort()
    setSending(false)
    buddySignal('idle')
    // Same as a failed send: the unanswered question goes back into the composer.
    const last = messages.at(-1)
    const pending = last?.role === 'user' ? last.content : null
    if (pending !== null) setMessages(messages.slice(0, -1))
    setError({ text: chat.cancelled, tone: 'info', retry: pending, attachments: last?.attachments })
  }
  const summarize = (text: string) => {
    const id = nextId.current++
    setStarted(true); setError(null); setRevealId(id)
    setMessages(current => [...current, { id, role: 'assistant', content: text }])
  }
  const empty = sessionRestored && messages.length === 0 && !sending
  // The welcome pearl stays while the reader holds to talk, and steps aside when the keyboard needs the room.
  const listeningHere = isVoiceActive(voice.state)
  // The dock buddy listens while the reader talks or types (a passing mood while typing, held while the mic is open).
  const sendingNow = useRef(sending)
  sendingNow.current = sending
  useEffect(() => {
    if (listeningHere) buddySignal('listening', { hold: true })
    else if (!sendingNow.current) buddySignal('idle')
  }, [listeningHere])
  useEffect(() => {
    if (input.trim() && !sendingNow.current) buddySignal('listening', { ms: 2200 })
  }, [input])
  const showWelcome = empty && (!started || keyboard <= 80 || listeningHere)

  const body = <div className={a.shell} data-overlay={overlay || undefined}>
      <header className={a.bar} data-overlay={overlay || undefined}>
        {overlay
          ? <><h1 className={a.overlayTitle}>{voiceCopy.title}</h1><button type="button" className={a.icon} aria-label={voiceCopy.back} onClick={onClose}><X size={22} strokeWidth={1.9} /></button></>
          : <><button type="button" className={a.icon} aria-label={voiceCopy.back} onClick={onClose}><ChevronLeft size={23} strokeWidth={1.85} /></button><h1 className={a.srOnly}>{voiceCopy.title}</h1></>}
      </header>

      <div id="ai-panel-ai" className={a.thread} aria-busy={sending} style={{ paddingBottom: dockHeight + keyboard + 24 }}>
        {showWelcome ? <section className={a.welcome} aria-label={voiceCopy.title} data-listening={listeningHere || undefined}>
          <BuddyFace size={132} mood={voice.state === 'cancelArmed' ? 'puzzled' : ({ idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'replying' } as const)[pearlFor(voice.state)] ?? 'idle'} className={a.welcomePearl} />
          {/* One line, always: the greeting at rest, the reader's own words while they speak. */}
          {listeningHere
            ? <p className={a.welcomeLive} dir="auto" role="status" aria-live="polite" data-empty={!voice.live || undefined} data-cancel={voice.state === 'cancelArmed' || undefined}>{voice.live || (voice.state === 'listening' ? pearl.listening : ' ')}</p>
            : <h2 className={a.welcomeLine}>{pearlGreeting(locale)}</h2>}
        </section> : <ol className={a.messages}>
          {messages.map((message) => message.role === 'user'
            ? <li key={message.id} className={a.user}><span className={a.srOnly}>{c.you}: </span><p dir="auto">{message.content}</p>{message.attachments?.map((file, index) => <small key={`${file.name}-${index}`} className={a.fileNote}>{file.name} · {file.method === 'image' ? aiVisualCopy(locale).image : file.method === 'ocr' ? aiInputCopy(locale).ocr : aiInputCopy(locale).extracted}</small>)}</li>
            : <li key={message.id} className={a.assistant}>
              <div className={a.who}><Mark speaking={message.id === speakingId} /><b>{c.name}</b></div>
              {showAiAnswer(message.questions) ? <><Answer text={message.content} reveal={message.id === revealId} onDone={finishReveal} onProgress={followReveal} />
                <div className={a.answerExtras} data-revealing={message.id === revealId || undefined} inert={message.id === revealId} aria-hidden={message.id === revealId || undefined}>
                {message.citations?.map(c=><Link key={`${c.id}:${c.revision}`} prefetch={false} href={aiNavigationLink(c.url) ?? `/ai-assistant?knowledge=${encodeURIComponent(c.id)}&revision=${c.revision}`}>{c.title}{c.url ? '' : ` · v${c.revision}`}</Link>)}
                <AiAnswerActions text={message.content} messageId={message.messageId} localId={`${sessionId ?? generation}:${message.id}`} locale={locale}/></div></> : <p className={a.questionPrompt}>{message.questions?.map(question => question.title).join(' · ')}</p>}
            </li>)}
          {sending && <li className={a.assistant} data-thinking>
            <div className={a.who}><Mark busy /><b>{c.name}</b></div>
            <Thinking label={c.thinking} slow={c.slow} slower={c.slower} seconds={c.seconds} />
          </li>}
        </ol>}
        {status === 'disabled' && !error && <div className={a.notice} role="status"><AlertCircle size={16} aria-hidden="true"/><p>{chat.unavailable}</p></div>}
        {error && <div className={a.notice} data-tone={error.tone} role={error.tone === 'error' ? 'alert' : 'status'}>
          <AlertCircle size={16} strokeWidth={1.8} aria-hidden="true" /><p>{error.text}</p>
          {error.retry && status === 'ready' && <button type="button" onClick={() => { void ask(error.retry ?? '', error.attachments).then(success => { if (success) { setInput(''); setGeneration(n => n + 1) } }) }}><RotateCcw size={14} aria-hidden="true" />{chat.retry}</button>}
        </div>}
        <div ref={end} className={a.end} style={{ scrollMarginBottom: dockHeight + keyboard + 16 }}/>
      </div>

      <div ref={dock} className={a.dockWrap} style={{ bottom: keyboard }} data-keyboard={keyboard > 80 || undefined}>
        {(() => { const latest = messages.findLast(m => m.role === 'assistant'); return latest?.questions?.length ? <AiQuestionCard key={latest.id} questions={latest.questions} locale={locale} disabled={sending || status !== 'ready'} onConfirm={ask} /> : null })()}
        {showWelcome && showsSuggestions(voice.state) && <ul className={a.chips} aria-label={pearl.suggestions}>{prompts.map(question => <li key={question}><button type="button" disabled={status !== 'ready'} onClick={() => { void ask(question) }}><span dir="auto">{question}</span></button></li>)}</ul>}
        <AiNoticeTray key={`notices-${generation}`} locale={locale} disabled={sending || status !== 'ready'} onAsk={ask} onSummary={summarize} hidden={!signedIn || input.trim().length > 0 || voice.state !== 'idle'} />
        <AiComposer key={generation} value={input} onChange={setInput} onVoice={setVoice} voiceOverlay={!showWelcome} suggestions={false} onInteraction={() => setStarted(true)} onSend={ask} onStop={stop} busy={sending} disabled={status !== 'ready'} placeholder={c.placeholder} sendLabel={chat.send} stopLabel={c.stop} locale={locale} secretLabel={chat.secret}/>
        {!empty && <p className={a.disclaimer}>{c.footnote}</p>}
      </div>
    </div>
  return <MaisonPage page={overlay ? 'ai-overlay' : 'ai'}>{body}</MaisonPage>
}
