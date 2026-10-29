'use client'

/**
 * Direct messages (2026-10-29): the inbox and a conversation. Paper & Glass: plain rows on hairlines, the other side's
 * bubbles on paper, mine in ink, a glass composer pinned above the keyboard. The server owns every rule (membership,
 * blocks, follow-only, rate limits, keyword guard); this screen only shows its answers in plain words. New messages
 * arrive by polling while the screen is open (every few seconds), so nothing runs in the background.
 */
import { ArrowUp, BellOff, MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { CommunityAvatar } from '@/components/community-avatar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { ApiError } from '@/lib/api/_http'
import { dmBlock, dmMessages, dmRead, dmReport, dmSend, dmThreadSettings, dmThreads, dmUnblock, type DmMessage, type DmProfile, type DmThread } from '@/lib/api/community-dm'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock } from '@/components/maison/primitives'
import { Sheet } from '@/components/maison/Sheet'
import d from './dm.module.css'

type Copy = {
  inbox: string; empty: string; emptyBody: string; soon: string; soonBody: string; identity: string; identityBody: string; toCommunity: string
  failed: string; retry: string; you: string; muted: string; title: string; older: string; placeholder: string; send: string
  notSent: string; tapRetry: string; blocked: string; policy: string; tooFast: string; guard: string; tooLong: string; sendFailed: string
  menu: string; viewProfile: string; mute: string; unmute: string; block: string; unblock: string; report: string; reportTitle: string
  reasons: [string, string][]; reported: string; cancel: string; today: string; yesterday: string; firstLine: string
}
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    inbox: '私信', empty: '还没有私信', emptyBody: '在成员主页点信封图标，就能开始对话。', soon: '私信即将开放', soonBody: '功能正在上线，稍后再来看看。',
    identity: '先设置社区昵称', identityBody: '有了昵称，别人才知道是谁在和他说话。', toCommunity: '去社区', failed: '加载失败', retry: '重试', you: '你：', muted: '免打扰',
    title: '私信', older: '查看更早的消息', placeholder: '发消息…', send: '发送', notSent: '未发送', tapRetry: '点按重试',
    blocked: '你们之间有拉黑，无法发送。', policy: '对方只接收 TA 关注的人的私信。', tooFast: '发得太快了，稍等一下再发。', guard: '消息里有联系方式或「带单」「拉群」等内容，不能发送。',
    tooLong: '消息最多 2000 字。', sendFailed: '没有发出去，请重试。', menu: '更多', viewProfile: '查看主页', mute: '免打扰', unmute: '取消免打扰', block: '拉黑', unblock: '取消拉黑',
    report: '举报这条消息', reportTitle: '举报原因', reasons: [['spam', '垃圾信息或广告'], ['scam', '诈骗或带单'], ['abuse', '辱骂或骚扰'], ['other', '其他']], reported: '已收到举报，我们会尽快处理。', cancel: '取消',
    today: '今天', yesterday: '昨天', firstLine: '这是你们对话的开始。不要透露密码、验证码或私钥。',
  },
  en: {
    inbox: 'Messages', empty: 'No messages yet', emptyBody: 'Tap the envelope on a member’s page to start a conversation.', soon: 'Messages are coming soon', soonBody: 'The feature is rolling out. Check back shortly.',
    identity: 'Set your community name first', identityBody: 'People need to know who they are talking to.', toCommunity: 'Go to community', failed: 'Could not load', retry: 'Retry', you: 'You: ', muted: 'Muted',
    title: 'Message', older: 'Show earlier messages', placeholder: 'Message…', send: 'Send', notSent: 'Not sent', tapRetry: 'Tap to retry',
    blocked: 'One of you has blocked the other, so messages cannot be sent.', policy: 'They only accept messages from people they follow.', tooFast: 'You are sending too fast. Wait a moment.', guard: 'Contact details or trading-group invitations cannot be sent.',
    tooLong: 'Messages can be up to 2,000 characters.', sendFailed: 'Not sent. Try again.', menu: 'More', viewProfile: 'View profile', mute: 'Mute', unmute: 'Unmute', block: 'Block', unblock: 'Unblock',
    report: 'Report this message', reportTitle: 'Why are you reporting it?', reasons: [['spam', 'Spam or advertising'], ['scam', 'Scam or signal group'], ['abuse', 'Abuse or harassment'], ['other', 'Something else']], reported: 'Report received. We will look at it soon.', cancel: 'Cancel',
    today: 'Today', yesterday: 'Yesterday', firstLine: 'This is the start of your conversation. Never share passwords, codes or keys.',
  },
}
const useCopy = () => { const { locale } = useI18n(); return { c: COPY[locale] ?? COPY.en!, locale } }

/** The backend is not live everywhere yet: a missing route reads as "coming soon", not as an error. */
const unavailable = (e: ApiError) => e.status === 404 && !/^DM_/.test(e.code)
const identityMissing = (e: ApiError) => e.code === 'COMMUNITY_IDENTITY_REQUIRED'

// The other side of a thread, kept from the inbox so the conversation can title itself at once.
const PEERS = 'rwa-dm-peers'
function rememberPeer(threadId: string, peer: DmProfile) {
  try { const all = JSON.parse(sessionStorage.getItem(PEERS) ?? '{}'); all[threadId] = peer; sessionStorage.setItem(PEERS, JSON.stringify(all)) } catch { /* private mode */ }
}
function recallPeer(threadId: string): DmProfile | null {
  try { return JSON.parse(sessionStorage.getItem(PEERS) ?? '{}')[threadId] ?? null } catch { return null }
}
/** Open (or reuse) the conversation with a member, then go to it. Returns the server's error, if any. */
export async function openConversation(handle: string, peer?: DmProfile): Promise<ApiError | null> {
  const { dmOpenThread } = await import('@/lib/api/community-dm')
  const res = await dmOpenThread(handle)
  if (!res.ok) return res.error
  if (peer) rememberPeer(res.data.id, peer)
  openPath(`/community/messages/${encodeURIComponent(res.data.id)}`)
  return null
}

function when(iso: string, locale: string, c: Copy) {
  const at = new Date(iso), now = new Date()
  if (Number.isNaN(at.getTime())) return ''
  const day = (x: Date) => x.toLocaleDateString('en-CA')
  if (day(at) === day(now)) return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (day(at) === day(new Date(now.getTime() - 86_400_000))) return c.yesterday
  return at.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })
}

/* ── Inbox ────────────────────────────────────────────────────────────────────────────────────────────────────── */
export function DmInboxScreen() {
  const { c, locale } = useCopy()
  const [threads, setThreads] = useState<DmThread[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const load = useCallback(async () => {
    const res = await dmThreads()
    if (res.ok) { setThreads(Array.isArray(res.data?.items) ? res.data.items : []); setError(null) } else setError(res.error)
  }, [])
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15_000)
    return () => window.clearInterval(timer)
  }, [load])

  const topbar = <RwaTopbar screen="community-messages" title={c.inbox} onBack={() => backOr('/community')} />
  let body
  if (error && identityMissing(error)) body = <StateBlock title={c.identity} body={c.identityBody} action={<button type="button" className={d.plainKey} onClick={() => openPath('/community')}>{c.toCommunity}</button>} />
  else if (error && unavailable(error)) body = <StateBlock tone="unavailable" title={c.soon} body={c.soonBody} />
  else if (error && !threads) body = <StateBlock tone="error" title={c.failed} retry={() => void load()} retryLabel={c.retry} />
  else if (!threads) body = <Skeleton rows={4} />
  else if (!threads.length) body = <StateBlock title={c.empty} body={c.emptyBody} />
  else body = <ul className={d.inbox}>
    {threads.map(thread => {
      const peer = thread.otherProfile, unread = thread.unreadCount > 0
      const mine = thread.lastMessage && thread.lastMessage.senderProfileId !== peer.id
      return <li key={thread.id}>
        <button type="button" className={d.row} data-unread={unread || undefined} onClick={() => { rememberPeer(thread.id, peer); openPath(`/community/messages/${encodeURIComponent(thread.id)}`) }}>
          <CommunityAvatar avatarUrl={peer.avatarUrl} seed={peer.avatarSeed} handle={peer.handle} size={48} />
          <span className={d.rowMain}>
            <span className={d.rowTop}><b dir="auto">{peer.displayName}</b><small>{when(thread.updatedAt, locale, c)}</small></span>
            <span className={d.rowBottom}>
              <span className={d.preview} dir="auto">{mine ? c.you : ''}{thread.lastMessage?.preview ?? ''}</span>
              {thread.muted && <BellOff size={14} strokeWidth={1.9} aria-label={c.muted} />}
              {unread && <i className={d.count}>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</i>}
            </span>
          </span>
        </button>
      </li>
    })}
  </ul>
  return <MaisonPage page="community-messages" topbar={topbar}><div className={d.page}>{body}</div></MaisonPage>
}

/* ── Conversation ─────────────────────────────────────────────────────────────────────────────────────────────── */
type Local = DmMessage & { state?: 'sending' | 'failed'; clientId?: string }
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\D/g, '').padEnd(32, '0').replace(/^(.{8})(.{4})(.{3})(.{3})(.{12}).*/, '$1-$2-4$3-8$4-$5'))
const byTime = (a: DmMessage, b: DmMessage) => Date.parse(a.createdAt) - Date.parse(b.createdAt)

export function DmThreadScreen({ id }: { id: string | null }) {
  const { c, locale } = useCopy()
  const [peer, setPeer] = useState<DmProfile | null>(() => id ? recallPeer(id) : null)
  const [thread, setThread] = useState<DmThread | null>(null)
  const [items, setItems] = useState<Local[] | null>(null)
  const [older, setOlder] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState<DmMessage | null>(null)
  const [blocked, setBlocked] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const lastRead = useRef<string | null>(null)

  const merge = useCallback((incoming: DmMessage[]) => setItems(prev => {
    const map = new Map<string, Local>((prev ?? []).map(m => [m.id, m]))
    for (const m of incoming) map.set(m.id, m)
    return [...map.values()].sort(byTime)
  }), [])

  const loadLatest = useCallback(async () => {
    if (!id) return
    const res = await dmMessages(id)
    if (!res.ok) { setError(res.error); setItems(prev => prev ?? []); return }
    setError(null)
    const page = Array.isArray(res.data?.items) ? res.data.items : []
    merge(page)
    setOlder(prev => prev === null && page.length ? res.data.nextBefore : prev)
  }, [id, merge])

  // Who the other side is: from the inbox cache at once, confirmed from the thread list.
  useEffect(() => {
    if (!id) return
    void dmThreads().then(res => {
      const found = res.ok && Array.isArray(res.data?.items) ? res.data.items.find(t => t.id === id) : undefined
      if (found) { setThread(found); setPeer(found.otherProfile); rememberPeer(id, found.otherProfile) }
    })
  }, [id])
  useEffect(() => {
    void loadLatest()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadLatest() }, 4_000)
    return () => window.clearInterval(timer)
  }, [loadLatest])

  // Keep the newest message in view unless the reader scrolled up to read history.
  const onScroll = () => { const el = document.scrollingElement; if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }
  useEffect(() => { window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll) }, [])
  useEffect(() => { if (atBottom.current) window.scrollTo({ top: document.documentElement.scrollHeight }) }, [items?.length])

  // Read receipt for the newest message from the other side.
  useEffect(() => {
    if (!id || !peer || !items?.length) return
    const last = [...items].reverse().find(m => m.senderProfileId === peer.id && !m.state)
    if (last && last.id !== lastRead.current) { lastRead.current = last.id; void dmRead(id, last.id) }
  }, [id, peer, items])

  const reason = (e: ApiError) => e.code === 'DM_BLOCKED' ? c.blocked : /FOLLOW|POLICY/.test(e.code) ? c.policy : e.status === 429 ? c.tooFast
    : /GUARD|CONTENT|SOLICIT|CONTACT/.test(e.code) ? c.guard : /TOO_LONG|LENGTH/.test(e.code) ? c.tooLong : c.sendFailed

  const deliver = async (message: Local) => {
    if (!id || !message.clientId) return
    setItems(prev => (prev ?? []).map(m => m.id === message.id ? { ...m, state: 'sending' } : m))
    const res = await dmSend(id, message.body, message.clientId)
    if (res.ok) {
      setItems(prev => [...(prev ?? []).filter(m => m.id !== message.id && m.id !== res.data.id), res.data].sort(byTime))
      setNotice(null)
    } else {
      setItems(prev => (prev ?? []).map(m => m.id === message.id ? { ...m, state: 'failed' } : m))
      setNotice(reason(res.error))
    }
  }
  const send = () => {
    const body = draft.trim()
    if (!body || !id) return
    if (body.length > 2000) { setNotice(c.tooLong); return }
    const clientId = newId()
    const local: Local = { id: `local-${clientId}`, clientId, threadId: id, senderProfileId: 'me', body, createdAt: new Date().toISOString(), deletedAt: null, state: 'sending' }
    setItems(prev => [...(prev ?? []), local])
    setDraft('')
    atBottom.current = true
    void deliver(local)
  }
  const loadOlder = async () => {
    if (!id || !older) return
    const res = await dmMessages(id, older)
    if (res.ok) { merge(Array.isArray(res.data?.items) ? res.data.items : []); setOlder(res.data.nextBefore) }
  }

  // Long-press (or right-click) a received message to report it.
  const press = useRef<number | null>(null)
  const holdStart = (m: DmMessage) => (e: ReactPointerEvent) => { if (e.pointerType === 'mouse' && e.button !== 0) return; press.current = window.setTimeout(() => setReporting(m), 550) }
  const holdEnd = () => { if (press.current) window.clearTimeout(press.current); press.current = null }

  const mineOf = (m: Local) => peer ? m.senderProfileId !== peer.id : m.senderProfileId === 'me'
  const rows = useMemo(() => {
    const out: Array<{ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: Local; mine: boolean; tail: boolean }> = []
    const all = items ?? []
    let lastDay = ''
    all.forEach((m, i) => {
      const day = new Date(m.createdAt).toLocaleDateString('en-CA')
      if (day !== lastDay) {
        lastDay = day
        const today = new Date().toLocaleDateString('en-CA'), yest = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
        out.push({ kind: 'day', key: `d-${day}`, label: day === today ? c.today : day === yest ? c.yesterday : new Date(m.createdAt).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' }) })
      }
      const next = all[i + 1], mine = mineOf(m)
      // A bubble ends its group when the next one is from the other side, another day, or five minutes later.
      const tail = !next || mineOf(next) !== mine || Date.parse(next.createdAt) - Date.parse(m.createdAt) > 300_000 || new Date(next.createdAt).toLocaleDateString('en-CA') !== day
      out.push({ kind: 'msg', m, mine, tail })
    })
    return out
  }, [items, peer, locale, c])

  const toggleMute = async () => {
    if (!id) return
    const res = await dmThreadSettings(id, { muted: !thread?.muted })
    if (res.ok) setThread(t => t ? { ...t, muted: res.data.muted } : t)
    setMenu(false)
  }
  const toggleBlock = async () => {
    if (!peer) return
    const res = blocked ? await dmUnblock(peer.handle) : await dmBlock(peer.handle)
    if (res.ok) setBlocked(res.data.blocked)
    setMenu(false)
  }
  const report = async (reasonKey: string) => {
    if (!reporting) return
    const res = await dmReport(reporting.id, reasonKey)
    setReporting(null)
    setNotice(res.ok ? c.reported : c.sendFailed)
  }

  const topbar = <RwaTopbar screen="community-thread" title={peer?.displayName ?? c.title} onBack={() => backOr('/community/messages')}
    action={peer ? { label: c.menu, Icon: MoreHorizontal, onClick: () => setMenu(true) } : undefined} />

  if (!id) return <MaisonPage page="community-thread" topbar={topbar}><StateBlock title={c.failed} /></MaisonPage>
  if (error && !items?.length) {
    const block = identityMissing(error) ? <StateBlock title={c.identity} body={c.identityBody} />
      : unavailable(error) ? <StateBlock tone="unavailable" title={c.soon} body={c.soonBody} />
      : <StateBlock tone="error" title={c.failed} retry={() => void loadLatest()} retryLabel={c.retry} />
    return <MaisonPage page="community-thread" topbar={topbar}><div className={d.page}>{block}</div></MaisonPage>
  }

  return <MaisonPage page="community-thread" topbar={topbar}>
    <div className={d.thread} ref={list}>
      {items === null ? <Skeleton rows={4} /> : <>
        {older ? <button type="button" className={d.older} onClick={() => void loadOlder()}>{c.older}</button>
          : peer && <div className={d.start}>
            <CommunityAvatar avatarUrl={peer.avatarUrl} seed={peer.avatarSeed} handle={peer.handle} size={64} />
            <b dir="auto">{peer.displayName}</b>
            <small dir="ltr">@{peer.handle}</small>
            <p>{c.firstLine}</p>
          </div>}
        {rows.map(row => row.kind === 'day'
          ? <p key={row.key} className={d.day}>{row.label}</p>
          : <div key={row.m.id} className={d.line} data-mine={row.mine || undefined} data-tail={row.tail || undefined}>
            <div className={d.bubble} dir="auto" data-state={row.m.state}
              onPointerDown={row.mine ? undefined : holdStart(row.m)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
              onContextMenu={row.mine ? undefined : (e) => { e.preventDefault(); setReporting(row.m) }}
              onClick={row.m.state === 'failed' ? () => void deliver(row.m) : undefined}>
              {row.m.deletedAt ? '—' : row.m.body}
            </div>
            {row.m.state === 'failed' ? <small className={d.failed}>{c.notSent} · {c.tapRetry}</small>
              : row.tail && <small className={d.time}>{new Date(row.m.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>}
          </div>)}
      </>}
    </div>
    <form className={d.composer} data-glass-bar="" onSubmit={(e) => { e.preventDefault(); send() }}>
      {notice && <p className={d.notice} role="status">{notice}</p>}
      <div className={d.field}>
        <textarea value={draft} rows={1} maxLength={2000} placeholder={c.placeholder} aria-label={c.placeholder} dir="auto"
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px` }} />
        <button type="submit" className={d.send} aria-label={c.send} disabled={!draft.trim()}><ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" /></button>
      </div>
    </form>

    <Sheet open={menu} onClose={() => setMenu(false)} title={peer?.displayName ?? c.menu}>
      <div className={d.options}>
        {peer && <button type="button" onClick={() => { setMenu(false); openPath(`/community/member/${encodeURIComponent(peer.handle)}`) }}>{c.viewProfile}</button>}
        <button type="button" onClick={() => void toggleMute()}>{thread?.muted ? c.unmute : c.mute}</button>
        <button type="button" data-danger="" onClick={() => void toggleBlock()}>{blocked ? c.unblock : c.block}</button>
      </div>
    </Sheet>
    <Sheet open={reporting !== null} onClose={() => setReporting(null)} title={c.reportTitle} kicker={c.report}>
      <div className={d.options}>
        {c.reasons.map(([key, label]) => <button key={key} type="button" onClick={() => void report(key)}>{label}</button>)}
      </div>
    </Sheet>
  </MaisonPage>
}
