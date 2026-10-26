'use client'
import { containsWalletSecret } from '@/lib/ai-input-guard'
import { accountScopesFor } from '@/lib/ai-account-intent'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { aiNavigationLink } from '@/lib/ai-navigation-link'
import type { Citation, AiQuestion } from '@/lib/api/ai-customer'
import AiQuestionCard from './AiQuestionCard'

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, RotateCcw, UserRound } from 'lucide-react'
import { CommunityAvatar } from '../community-avatar'
import { useCommunityMe } from '../community-compose'
import { useSignedIn } from '@/hooks/useAccount'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { openPath } from '@/lib/maison-nav'
import { navigate } from '@/lib/routes'
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
import { MaisonPage } from './primitives'
import a from './ai-chat.module.css'
// The 社区 tab loads the feed only when first opened, so the assistant stays light.
const CommunityFeed = dynamic(() => import('../community-screens').then(module => module.CommunityFeedScreen), { ssr: false })
const TAB_KEY = 'rwa-ai-tab'
const memberPath = (id: string) => '/community/member/' + encodeURIComponent(id)

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

// The assistant's avatar is the same pearl as the welcome screen: still at rest, an orbiting arc while it
// thinks, and one bright pulse as an answer lands.
function Mark({ busy = false, speaking = false, size = 'sm' }: { busy?: boolean; speaking?: boolean; size?: 'sm' | 'lg' }) {
  // The paper buddy: thinking while it waits, talking as the answer lands, still otherwise.
  return <span className={a.mark} data-size={size} data-busy={busy || undefined} aria-hidden="true"><BuddyFace size={size === 'lg' ? 56 : 26} mood={busy ? 'thinking' : speaking ? 'replying' : 'idle'} still={!busy && !speaking} /></span>
}

/* ---------- Screen ---------- */

export function AiChatScreen({ onClose, pageContext }: { onClose: () => void; onPlan: () => void; pageContext?: AiPageContext }) {
  const { locale } = useI18n()
  const pearl = aiPearlCopy(locale), prompts = aiVisualCopy(locale).prompts.slice(0, 3)
  const c = aiShellCopy[locale], chat = aiChatCopy[locale]
  const voiceCopy = aiVoiceCopy(locale)
  const [input, setInput] = useState('')
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
  const signedIn = useSignedIn(), me = useCommunityMe(!signedIn)
  const [tab, setTab] = useState<'ai' | 'community'>('ai')
  const chromeHidden = useScrollChrome()
  // Returning from a post or profile restores the tab the reader left.
  useEffect(() => { try { if (sessionStorage.getItem(TAB_KEY) === 'community') setTab('community') } catch { /* Storage can be blocked. */ } }, [])
  const switchTab = (next: 'ai' | 'community') => {
    if (next === tab) { if (next === 'community') window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return }
    setTab(next); expandChrome()
    try { sessionStorage.setItem(TAB_KEY, next) } catch { /* Storage can be blocked. */ }
    requestAnimationFrame(() => { if (next === 'community') window.scrollTo({ top: 0 }); else end.current?.scrollIntoView({ block: 'end' }) })
  }
  // The avatar is the reader's community profile (with its edit entry); guests sign in first.
  const openMe = () => {
    if (!signedIn) { navigate({ id: 'auth.login' }); return }
    const id = me?.handle || me?.id
    if (id) openPath(memberPath(id)); else navigate({ id: 'profile' })
  }
  const community = tab === 'community'

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
      setSending(false); setMessages([]); setSessionId(null); setInput(''); setError(null); setStarted(false)
      try { clearAiChatSession(window.sessionStorage) } catch { /* Keep account transitions usable when storage is blocked. */ }
      setGeneration(n => n + 1)
    }
    window.addEventListener(SESSION_CHANGED, reset)
    window.addEventListener(SESSION_EXPIRED, reset)
    return () => { window.removeEventListener(SESSION_CHANGED, reset); window.removeEventListener(SESSION_EXPIRED, reset) }
  }, [])
  useEffect(() => { const viewport = window.visualViewport; if (!viewport) return; const update = () => setKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update); update(); return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update) } }, [])
  useEffect(() => { if (!dock.current || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(entries => setDockHeight(Math.ceil(entries[0]?.contentRect.height ?? 150) + 40)); observer.observe(dock.current); return () => observer.disconnect() }, [])

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (messages.length || sending) end.current?.scrollIntoView({ block: 'end', behavior: reduced() ? 'auto' : 'smooth' }) }, [messages, sending, error, dockHeight, keyboard])

  // The chat endpoint is synchronous and has no server-side cancel: stopping only ends the wait
  // here, and the copy says the reply may still be stored in history.
  const ask = useCallback(async (message: string, attachments: AiAttachment[] = []) => {
    if (!message || sending || inflight.current || status !== 'ready') return false
    if (message.length > MAX || containsWalletSecret([message, ...attachments.map(file => file.name + '\n' + file.text)].join('\n'))) { setError({ text: message.length > MAX ? chat.tooLong : chat.secret, tone: 'info', retry: null }); return false }
    const controller = new AbortController()
    inflight.current = controller
    const userId = nextId.current++
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

  return <MaisonPage page="ai">
    <div className={a.shell}>
      <header className={a.bar} data-hidden={(community && chromeHidden) || undefined} onFocusCapture={expandChrome}>
        <button type="button" className={a.icon} aria-label={voiceCopy.back} onClick={onClose}><ChevronLeft size={23} strokeWidth={1.85} /></button>
        <h1 className={a.srOnly}>{community ? voiceCopy.communityTab : voiceCopy.title}</h1>
        <div className={a.capsule} role="tablist" aria-label={voiceCopy.tabs} data-tab={tab}>
          <i className={a.capsuleThumb} aria-hidden="true" />
          <button type="button" role="tab" id="ai-tab-ai" aria-controls="ai-panel-ai" aria-selected={!community} onClick={() => switchTab('ai')}>{voiceCopy.assistantTab}</button>
          <button type="button" role="tab" id="ai-tab-community" aria-controls="ai-panel-community" aria-selected={community} onClick={() => switchTab('community')}>{voiceCopy.communityTab}</button>
        </div>
        <button type="button" className={a.account} aria-label={signedIn ? voiceCopy.account : voiceCopy.signIn} title={signedIn ? voiceCopy.account : voiceCopy.signIn} onClick={openMe}>
          {signedIn && me ? <CommunityAvatar avatarUrl={me.avatarUrl} seed={me.avatarSeed} handle={me.handle} size={32} /> : <UserRound size={19} strokeWidth={1.8} aria-hidden="true" />}
        </button>
      </header>

      {community && <section id="ai-panel-community" role="tabpanel" aria-labelledby="ai-tab-community" className={a.communityPanel}>
        <CommunityFeed embedded isGuest={!signedIn} go={(screen) => { if (screen === 'login') navigate({ id: 'auth.login' }); else openPath('/community') }} openPost={(id) => openPath('/community/post/' + encodeURIComponent(id))} openProfile={(id) => openPath(memberPath(id))} />
      </section>}

      <div id="ai-panel-ai" role="tabpanel" aria-labelledby="ai-tab-ai" hidden={community} className={a.thread} aria-busy={sending} style={{ paddingBottom: dockHeight + keyboard + 24 }}>
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
              {showAiAnswer(message.questions) ? <><Answer text={message.content} reveal={message.id === revealId && !reduced()} />
                {message.citations?.map(c=><Link key={`${c.id}:${c.revision}`} prefetch={false} href={aiNavigationLink(c.url) ?? `/ai-assistant?knowledge=${encodeURIComponent(c.id)}&revision=${c.revision}`}>{c.title}{c.url ? '' : ` · v${c.revision}`}</Link>)}
                <AiAnswerActions text={message.content} messageId={message.messageId} localId={`${sessionId ?? generation}:${message.id}`} locale={locale}/></> : <p className={a.questionPrompt}>{message.questions?.map(question => question.title).join(' · ')}</p>}
            </li>)}
          {sending && <li className={a.assistant}>
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

      <div ref={dock} className={a.dockWrap} hidden={community} style={{ bottom: keyboard }} data-keyboard={keyboard > 80 || undefined}>
        {(() => { const latest = messages.findLast(m => m.role === 'assistant'); return latest?.questions?.length ? <AiQuestionCard key={latest.id} questions={latest.questions} locale={locale} disabled={sending || status !== 'ready'} onConfirm={ask} /> : null })()}
        {showWelcome && showsSuggestions(voice.state) && <ul className={a.chips} aria-label={pearl.suggestions}>{prompts.map(question => <li key={question}><button type="button" disabled={status !== 'ready'} onClick={() => { void ask(question) }}><span dir="auto">{question}</span></button></li>)}</ul>}
        <AiComposer key={generation} value={input} onChange={setInput} onVoice={setVoice} voiceOverlay={!showWelcome} suggestions={false} onInteraction={() => setStarted(true)} onSend={ask} onStop={stop} busy={sending} disabled={status !== 'ready'} placeholder={c.placeholder} sendLabel={chat.send} stopLabel={c.stop} locale={locale} secretLabel={chat.secret}/>
        {!empty && <p className={a.disclaimer}>{c.footnote}</p>}
      </div>
    </div>
  </MaisonPage>
}
