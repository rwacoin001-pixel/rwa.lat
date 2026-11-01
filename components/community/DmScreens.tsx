'use client'

/**
 * Direct messages (2026-10-29, redone 2026-10-31): the inbox and a conversation. The conversation opens on the other
 * member's card (avatar, name, joined date, followers, view profile), quick replies sit above a composer with a plus
 * menu (photo, camera, file), and a long-press on a message gives copy, reply, delete (your own messages, both sides)
 * and report. The server owns every rule (membership, blocks, follow-only, rate limits, keyword guard, the upload
 * scan); this screen only shows its answers in plain words. New messages arrive by polling while the screen is open.
 */
import { ArrowUp, BellOff, ChevronLeft, Copy, FileText, Mic, MoreHorizontal, Plus, Reply, Flag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { CommunityAvatar, mediaSrc } from '@/components/community-avatar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { ApiError } from '@/lib/api/_http'
import { DM_SERVER_FEATURES, dmAttachmentLink, dmBlock, dmDeleteMessage, dmMessages, dmRead, dmReport, dmSend, dmThreadSettings, dmThreads, dmUnblock, dmUploadAttachment, type DmMessage, type DmProfile, type DmThread } from '@/lib/api/community-dm'
import { getCommunityProfile } from '@/lib/community-data'
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
  joined: string; followers: string; quick: string[]; quickLabel: string; attach: string; photo: string; camera: string; file: string
  voice: string; voiceKey: string; micDenied: string; recording: string; copy: string; copied: string; reply: string; del: string; delTitle: string; delBody: string; delConfirm: string
  messageActions: string; uploading: string; tooLarge: string; fileType: string; imageLabel: string; fileLabel: string; back: string
}
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    inbox: '私信', empty: '还没有私信', emptyBody: '在成员主页点信封图标，就能开始对话。', soon: '私信即将开放', soonBody: '功能正在上线，稍后再来看看。',
    identity: '先设置社区昵称', identityBody: '有了昵称，别人才知道是谁在和他说话。', toCommunity: '去社区', failed: '加载失败', retry: '重试', you: '你：', muted: '免打扰',
    title: '私信', older: '查看更早的消息', placeholder: '发消息…', send: '发送', notSent: '未发送', tapRetry: '点按重试',
    blocked: '你们之间有拉黑，无法发送。', policy: '对方只接收 TA 关注的人的私信。', tooFast: '发得太快了，稍等一下再发。', guard: '消息里有联系方式或「带单」「拉群」等内容，不能发送。',
    tooLong: '消息最多 2000 字。', sendFailed: '没有发出去，请重试。', menu: '更多', viewProfile: '查看个人资料', mute: '免打扰', unmute: '取消免打扰', block: '拉黑', unblock: '取消拉黑',
    report: '举报这条消息', reportTitle: '举报原因', reasons: [['spam', '垃圾信息或广告'], ['scam', '诈骗或带单'], ['abuse', '辱骂或骚扰'], ['other', '其他']], reported: '已收到举报，我们会尽快处理。', cancel: '取消',
    today: '今天', yesterday: '昨天', firstLine: '这是你们对话的开始。不要透露密码、验证码或私钥。',
    joined: '加入于 {date}', followers: '{n} 位关注者', quick: ['👋', '嗨！', '怎么样？'], quickLabel: '快捷回复', attach: '添加附件', photo: '照片', camera: '相机', file: '文件',
    voice: '语音消息即将开放', voiceKey: '发送语音', micDenied: '没有麦克风权限，请在系统设置里允许。', recording: '正在录音…', copy: '复制', copied: '已复制', reply: '回复', del: '删除', delTitle: '删除这条消息？', delBody: '删除后，你和对方都看不到这条消息。', delConfirm: '删除',
    messageActions: '消息', uploading: '正在上传…', tooLarge: '文件太大了，请换一个再试。', fileType: '这种文件暂不支持。', imageLabel: '照片', fileLabel: '文件', back: '返回',
  },
  en: {
    inbox: 'Messages', empty: 'No messages yet', emptyBody: 'Tap the envelope on a member’s page to start a conversation.', soon: 'Messages are coming soon', soonBody: 'The feature is rolling out. Check back shortly.',
    identity: 'Set your community name first', identityBody: 'People need to know who they are talking to.', toCommunity: 'Go to community', failed: 'Could not load', retry: 'Retry', you: 'You: ', muted: 'Muted',
    title: 'Message', older: 'Show earlier messages', placeholder: 'Message…', send: 'Send', notSent: 'Not sent', tapRetry: 'Tap to retry',
    blocked: 'One of you has blocked the other, so messages cannot be sent.', policy: 'They only accept messages from people they follow.', tooFast: 'You are sending too fast. Wait a moment.', guard: 'Contact details or trading-group invitations cannot be sent.',
    tooLong: 'Messages can be up to 2,000 characters.', sendFailed: 'Not sent. Try again.', menu: 'More', viewProfile: 'View profile', mute: 'Mute', unmute: 'Unmute', block: 'Block', unblock: 'Unblock',
    report: 'Report this message', reportTitle: 'Why are you reporting it?', reasons: [['spam', 'Spam or advertising'], ['scam', 'Scam or signal group'], ['abuse', 'Abuse or harassment'], ['other', 'Something else']], reported: 'Report received. We will look at it soon.', cancel: 'Cancel',
    today: 'Today', yesterday: 'Yesterday', firstLine: 'This is the start of your conversation. Never share passwords, codes or keys.',
    joined: 'Joined {date}', followers: '{n} followers', quick: ['👋', 'Hi!', 'How are you?'], quickLabel: 'Quick replies', attach: 'Add attachment', photo: 'Photo', camera: 'Camera', file: 'File',
    voice: 'Voice messages are coming soon', voiceKey: 'Record a voice message', micDenied: 'Microphone access is off. Allow it in settings.', recording: 'Recording…', copy: 'Copy', copied: 'Copied', reply: 'Reply', del: 'Delete', delTitle: 'Delete this message?', delBody: 'Once deleted, you and they will both stop seeing this message.', delConfirm: 'Delete',
    messageActions: 'Message', uploading: 'Uploading…', tooLarge: 'That file is too large. Try a smaller one.', fileType: 'That file type is not supported.', imageLabel: 'Photo', fileLabel: 'File', back: 'Back',
  },
}
const useCopy = () => { const { locale } = useI18n(); return { c: COPY[locale] ?? COPY.en!, locale } }

/** Limits mirrored by the server (2026-10-31): photos 10 MB, files 20 MB. The server is the rule; this is the early warning. */
const MAX_PHOTO = 10 * 1024 * 1024
const MAX_FILE = 20 * 1024 * 1024
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/gif'
const FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip'

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
/** A message as the screen holds it: sent ones come from the server; `state`, `file` and `preview` are this device's. */
type Local = DmMessage & { state?: 'sending' | 'failed'; clientId?: string; file?: File; attachKind?: 'image' | 'file' | 'voice'; preview?: string; seen?: number }
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\D/g, '').padEnd(32, '0').replace(/^(.{8})(.{4})(.{3})(.{3})(.{12}).*/, '$1-$2-4$3-8$4-$5'))
const byTime = (a: DmMessage, b: DmMessage) => Date.parse(a.createdAt) - Date.parse(b.createdAt)

export function DmThreadScreen({ id }: { id: string | null }) {
  const { c, locale } = useCopy()
  const [peer, setPeer] = useState<DmProfile | null>(() => id ? recallPeer(id) : null)
  const [thread, setThread] = useState<DmThread | null>(null)
  const [facts, setFacts] = useState<{ joinedAt: string | null; followerCount: number } | null>(null)
  const [items, setItems] = useState<Local[] | null>(null)
  const [older, setOlder] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [acting, setActing] = useState<Local | null>(null)
  const [confirming, setConfirming] = useState<Local | null>(null)
  const [reporting, setReporting] = useState<DmMessage | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [rec, setRec] = useState<null | { seconds: number }>(null)
  const recorder = useRef<{ media: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: number; send: boolean } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const atBottom = useRef(true)
  const lastRead = useRef<string | null>(null)
  const photoPicker = useRef<HTMLInputElement>(null)
  const cameraPicker = useRef<HTMLInputElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)

  // Merge a page into the list. The newest page (requestedAt set) also settles what is gone: a message this device saw
  // before that request began, newer than the page's oldest entry, but missing from the page was unsent by the other
  // side (or on another device). Pending ones stay, and so do messages seen after the request began (a slow response
  // must not drop a message that was just sent).
  const merge = useCallback((incoming: DmMessage[], requestedAt?: number) => setItems(prev => {
    const map = new Map<string, Local>((prev ?? []).map(m => [m.id, m]))
    if (requestedAt !== undefined) {
      const present = new Set(incoming.map(m => m.id))
      const floor = incoming.length ? Math.min(...incoming.map(m => Date.parse(m.createdAt))) : -Infinity
      for (const m of [...map.values()]) if (!m.state && !m.id.startsWith('local-') && !present.has(m.id) && (m.seen ?? 0) < requestedAt && Date.parse(m.createdAt) >= floor) map.delete(m.id)
    }
    const now = Date.now()
    for (const m of incoming) map.set(m.id, { ...m, seen: map.get(m.id)?.seen ?? now })
    return [...map.values()].sort(byTime)
  }), [])

  const loadLatest = useCallback(async () => {
    if (!id) return
    const started = Date.now()
    const res = await dmMessages(id)
    if (!res.ok) { setError(res.error); setItems(prev => prev ?? []); return }
    setError(null)
    const page = Array.isArray(res.data?.items) ? res.data.items : []
    merge(page, started)
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
  // The card's facts (joined date, followers) come from the member's public profile.
  const handle = peer?.handle ?? null
  useEffect(() => {
    if (!handle) return
    let live = true
    getCommunityProfile(handle).then(res => { if (live) setFacts({ joinedAt: res.profile.joinedAt ?? null, followerCount: res.stats.followerCount }) }).catch(() => undefined)
    return () => { live = false }
  }, [handle])
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
  const uploadReason = (e: ApiError) => e.status === 413 ? c.tooLarge : e.status === 415 || /TYPE|MIME/.test(e.code) ? c.fileType : c.sendFailed
  const fail = (messageId: string, text: string) => {
    setItems(prev => (prev ?? []).map(m => m.id === messageId ? { ...m, state: 'failed' } : m))
    setNotice(text)
  }

  // Sends a text, a photo or a file. A photo or file is uploaded first (the server scans it), then the message goes.
  const deliver = async (message: Local) => {
    if (!id || !message.clientId) return
    setItems(prev => (prev ?? []).map(m => m.id === message.id ? { ...m, state: 'sending' } : m))
    let attachment = message.attachment ?? null
    if (message.file && !attachment) {
      const up = await dmUploadAttachment(message.file)
      if (!up.ok) { fail(message.id, uploadReason(up.error)); return }
      attachment = up.data
      setItems(prev => (prev ?? []).map(m => m.id === message.id ? { ...m, attachment } : m))
    }
    const res = await dmSend(id, message.body, message.clientId, attachment ? { mediaId: attachment.mediaId, kind: attachment.kind } : undefined)
    if (res.ok) {
      if (message.preview) URL.revokeObjectURL(message.preview)
      setItems(prev => [...(prev ?? []).filter(m => m.id !== message.id && m.id !== res.data.id), { ...res.data, seen: Date.now() }].sort(byTime))
      setNotice(null)
    } else fail(message.id, reason(res.error))
  }
  const send = (text = draft) => {
    const body = text.trim()
    if (!body || !id) return
    if (body.length > 2000) { setNotice(c.tooLong); return }
    const clientId = newId()
    const local: Local = { id: `local-${clientId}`, clientId, threadId: id, senderProfileId: 'me', body, createdAt: new Date().toISOString(), deletedAt: null, state: 'sending' }
    setItems(prev => [...(prev ?? []), local])
    setDraft('')
    atBottom.current = true
    void deliver(local)
  }
  const attach = (file: File, kind: 'image' | 'file' | 'voice') => {
    if (!id) return
    if (file.size > (kind === 'image' ? MAX_PHOTO : MAX_FILE)) { setNotice(c.tooLarge); return }
    const clientId = newId()
    const local: Local = { id: `local-${clientId}`, clientId, threadId: id, senderProfileId: 'me', body: '', createdAt: new Date().toISOString(), deletedAt: null, state: 'sending',
      file, attachKind: kind, preview: kind === 'image' || kind === 'voice' ? URL.createObjectURL(file) : undefined }
    setItems(prev => [...(prev ?? []), local])
    atBottom.current = true
    void deliver(local)
  }
  const pick = (kind: 'image' | 'file' | 'camera') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setAttachOpen(false)
    if (file) attach(file, kind === 'file' ? 'file' : 'image')
  }
  // Voice: tap the mic to record, then send or cancel. The clip goes as an attachment like a photo or a file.
  const stopRecording = (send: boolean) => {
    const r = recorder.current
    if (!r) return
    r.send = send
    window.clearInterval(r.timer)
    if (r.media.state !== 'inactive') r.media.stop()
    setRec(null)
  }
  const startRecording = async () => {
    if (!DM_SERVER_FEATURES.voice || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setNotice(c.voice); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      const chunks: Blob[] = []
      const state = { media, stream, chunks, timer: 0, send: false }
      media.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      media.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        recorder.current = null
        if (!state.send || !chunks.length) return
        const type = media.mimeType || 'audio/webm'
        attach(new File(chunks, `voice.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`, { type }), 'voice')
      }
      state.timer = window.setInterval(() => setRec(r => r ? { seconds: r.seconds + 1 } : r), 1000)
      recorder.current = state
      media.start()
      setRec({ seconds: 0 })
    } catch { setNotice(c.micDenied) }
  }
  useEffect(() => { if (rec && rec.seconds >= 120) stopRecording(true) }, [rec])
  useEffect(() => () => { const r = recorder.current; if (r) { r.send = false; window.clearInterval(r.timer); if (r.media.state !== 'inactive') r.media.stop() } }, [])

  const loadOlder = async () => {
    if (!id || !older) return
    const res = await dmMessages(id, older)
    if (res.ok) { merge(Array.isArray(res.data?.items) ? res.data.items : []); setOlder(res.data.nextBefore) }
  }

  // Long-press (or right-click) any message opens its actions; a pointer that moves away cancels the hold.
  const press = useRef<number | null>(null)
  const holdStart = (m: Local) => (e: ReactPointerEvent) => { if (e.pointerType === 'mouse' && e.button !== 0) return; press.current = window.setTimeout(() => setActing(m), 550) }
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

  // The message actions. Copy and reply work on any message; delete is only for your own, and removes it for both sides.
  const snippet = (m: Local) => m.body ? Array.from(m.body).slice(0, 40).join('') : c.imageLabel
  const copyText = async (m: Local) => {
    setActing(null)
    try { await navigator.clipboard.writeText(m.body); setNotice(c.copied) } catch { setNotice(c.sendFailed) }
  }
  const replyTo = (m: Local) => {
    setActing(null)
    setDraft(current => `「${snippet(m)}」\n${current}`)
    window.setTimeout(() => composer.current?.focus(), 0)
  }
  const unsend = async (m: Local) => {
    setConfirming(null)
    if (!id) return
    if (m.state || m.id.startsWith('local-')) { setItems(prev => (prev ?? []).filter(x => x.id !== m.id)); return }
    const res = await dmDeleteMessage(id, m.id)
    if (res.ok) setItems(prev => (prev ?? []).filter(x => x.id !== m.id))
    else setNotice(c.sendFailed)
  }

  const topbar = <header className={d.top} data-glass-bar="">
    <button type="button" className={d.circle} aria-label={c.back} onClick={() => backOr('/community/messages')}><ChevronLeft size={20} strokeWidth={2} aria-hidden="true" /></button>
    <span className={d.who}>
      {peer && <span className={d.whoFace}><CommunityAvatar avatarUrl={peer.avatarUrl} seed={peer.avatarSeed} handle={peer.handle} size={60} /></span>}
      <b className={d.whoName} dir="auto">{peer?.displayName ?? c.title}</b>
    </span>
    <button type="button" className={d.pill} aria-label={c.menu} disabled={!peer} onClick={() => setMenu(true)}><MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" /></button>
  </header>

  if (!id) return <MaisonPage page="community-thread" topbar={topbar}><StateBlock title={c.failed} /></MaisonPage>
  if (error && !items?.length) {
    const block = identityMissing(error) ? <StateBlock title={c.identity} body={c.identityBody} />
      : unavailable(error) ? <StateBlock tone="unavailable" title={c.soon} body={c.soonBody} />
      : <StateBlock tone="error" title={c.failed} retry={() => void loadLatest()} retryLabel={c.retry} />
    return <MaisonPage page="community-thread" topbar={topbar}><div className={d.page}>{block}</div></MaisonPage>
  }

  const joinedText = facts?.joinedAt && !Number.isNaN(Date.parse(facts.joinedAt))
    ? c.joined.replace('{date}', new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(facts.joinedAt))) : ''
  const followersText = facts ? c.followers.replace('{n}', new Intl.NumberFormat(locale).format(facts.followerCount)) : ''
  const actingMine = acting ? mineOf(acting) : false
  const actingSettled = acting ? !acting.state && !acting.id.startsWith('local-') : false

  return <MaisonPage page="community-thread" topbar={topbar}>
    <div className={d.thread} ref={list}>
      {items === null ? <Skeleton rows={4} /> : <>
        {peer && <div className={d.start}>
          {(joinedText || followersText) && <p className={d.facts}>{joinedText && <span>{joinedText}</span>}{followersText && <span>{followersText}</span>}</p>}
          <button type="button" className={d.profileKey} onClick={() => openPath(`/community/member/${encodeURIComponent(peer.handle)}`)}>{c.viewProfile}</button>
          <p>{c.firstLine}</p>
        </div>}
        {older && <button type="button" className={d.older} onClick={() => void loadOlder()}>{c.older}</button>}
        {rows.map(row => row.kind === 'day'
          ? <p key={row.key} className={d.day}>{row.label}</p>
          : <Bubble key={row.m.id} m={row.m} mine={row.mine} tail={row.tail} locale={locale} c={c}
            onHoldStart={holdStart} onHoldEnd={holdEnd}
            onMenu={(m) => setActing(m)}
            onRetry={(m) => void deliver(m)} />)}
      </>}
    </div>
    <form className={d.composer} data-glass-bar="" onSubmit={(e) => { e.preventDefault(); send() }}>
      {notice && <p className={d.notice} role="status">{notice}</p>}
      <div className={d.box}>
      {!draft.trim() && !rec && <div className={d.quick} role="group" aria-label={c.quickLabel}>
        {c.quick.map(text => <button key={text} type="button" className={d.quickPill} onClick={() => send(text)}>{text}</button>)}
      </div>}
      {rec ? <div className={d.recording} role="status">
        <button type="button" className={d.plus} aria-label={c.cancel} onClick={() => stopRecording(false)}><Trash2 size={19} strokeWidth={1.9} aria-hidden="true" /></button>
        <span className={d.recDot} aria-hidden="true" /><b dir="ltr">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, '0')}</b><span className={d.recHint}>{c.recording}</span>
        <button type="button" className={d.send} aria-label={c.send} onClick={() => stopRecording(true)}><ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" /></button>
      </div> : <div className={d.field}>
        {DM_SERVER_FEATURES.attachments && <button type="button" className={d.plus} aria-label={c.attach} aria-haspopup="dialog" onClick={() => setAttachOpen(true)}><Plus size={20} strokeWidth={2} aria-hidden="true" /></button>}
        <textarea ref={composer} value={draft} rows={1} maxLength={2000} placeholder={c.placeholder} aria-label={c.placeholder} dir="auto"
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px` }} />
        {draft.trim()
          ? <button type="submit" className={d.send} aria-label={c.send}><ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" /></button>
          : <button type="button" className={d.mic} aria-label={c.voiceKey} title={c.voiceKey} onClick={() => void startRecording()}><Mic size={20} strokeWidth={1.9} aria-hidden="true" /></button>}
      </div>}
      </div>
    </form>

    <input ref={photoPicker} type="file" accept={PHOTO_TYPES} hidden onChange={pick('image')} />
    <input ref={cameraPicker} type="file" accept="image/*" capture="environment" hidden onChange={pick('camera')} />
    <input ref={filePicker} type="file" accept={FILE_TYPES} hidden onChange={pick('file')} />

    <Sheet open={attachOpen} onClose={() => setAttachOpen(false)} title={c.attach}>
      <div className={d.options}>
        <button type="button" onClick={() => { setAttachOpen(false); photoPicker.current?.click() }}>{c.photo}</button>
        <button type="button" onClick={() => { setAttachOpen(false); cameraPicker.current?.click() }}>{c.camera}</button>
        <button type="button" onClick={() => { setAttachOpen(false); filePicker.current?.click() }}>{c.file}</button>
      </div>
    </Sheet>

    <Sheet open={acting !== null} onClose={() => setActing(null)} title={c.messageActions}>
      {acting && <div className={d.options}>
        {acting.body && actingSettled && <button type="button" onClick={() => void copyText(acting)}><Copy size={17} strokeWidth={1.9} aria-hidden="true" /> {c.copy}</button>}
        {actingSettled && <button type="button" onClick={() => replyTo(acting)}><Reply size={17} strokeWidth={1.9} aria-hidden="true" /> {c.reply}</button>}
        {DM_SERVER_FEATURES.unsend && actingMine && actingSettled && <button type="button" data-danger="" onClick={() => { setConfirming(acting); setActing(null) }}><Trash2 size={17} strokeWidth={1.9} aria-hidden="true" /> {c.del}</button>}
        {!actingMine && actingSettled && <button type="button" data-danger="" onClick={() => { setReporting(acting); setActing(null) }}><Flag size={17} strokeWidth={1.9} aria-hidden="true" /> {c.report}</button>}
      </div>}
    </Sheet>

    <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title={c.delTitle}>
      <div className={d.options}>
        <p className={d.confirmBody}>{c.delBody}</p>
        <button type="button" data-danger="" onClick={() => confirming && void unsend(confirming)}>{c.delConfirm}</button>
        <button type="button" onClick={() => setConfirming(null)}>{c.cancel}</button>
      </div>
    </Sheet>

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

/** A private attachment as a usable link: local previews pass through; server ones are signed on demand. */
function useAttachmentLink(url: string | null | undefined) {
  const isPrivate = Boolean(url && url.startsWith('/v1/community/dm/attachments/'))
  const [link, setLink] = useState<string | null>(isPrivate ? null : url ?? null)
  useEffect(() => {
    if (!url) { setLink(null); return }
    if (!isPrivate) { setLink(url); return }
    let live = true
    void dmAttachmentLink(url).then((next) => { if (live) setLink(next) })
    return () => { live = false }
  }, [url, isPrivate])
  return link
}

/** One message. A photo shows as a picture, a file as a link with its name; the bubble keeps its long-press. */
function Bubble({ m, mine, tail, locale, c, onHoldStart, onHoldEnd, onMenu, onRetry }: {
  m: Local; mine: boolean; tail: boolean; locale: string; c: Copy
  onHoldStart: (m: Local) => (e: ReactPointerEvent) => void; onHoldEnd: () => void; onMenu: (m: Local) => void; onRetry: (m: Local) => void
}) {
  const photo = useAttachmentLink(m.attachment?.kind === 'image' ? m.attachment.url : m.attachKind === 'voice' ? null : m.preview ?? null)
  const file = m.attachment?.kind === 'file' ? m.attachment : null
  const voice = useAttachmentLink(m.attachment?.kind === 'voice' ? m.attachment.url : m.attachKind === 'voice' ? m.preview ?? null : null)
  const openFile = (e: ReactMouseEvent) => { e.preventDefault(); e.stopPropagation(); if (!file) return; const tab = window.open('', '_blank'); void dmAttachmentLink(file.url).then((url) => { if (url && tab) tab.location.href = url; else tab?.close() }) }
  const fileName = file ? (file.name || c.fileLabel) : m.attachKind === 'file' ? (m.file?.name || c.fileLabel) : null
  return <div className={d.line} data-mine={mine || undefined} data-tail={tail || undefined}>
    <div className={d.bubble} dir="auto" data-state={m.state} data-kind={photo ? 'image' : voice ? 'voice' : fileName ? 'file' : undefined}
      onPointerDown={onHoldStart(m)} onPointerUp={onHoldEnd} onPointerLeave={onHoldEnd} onPointerCancel={onHoldEnd}
      onContextMenu={(e) => { e.preventDefault(); onMenu(m) }}
      onClick={m.state === 'failed' ? () => onRetry(m) : undefined}>
      {m.deletedAt ? '—' : <>
        {photo && <img className={d.photo} src={photo} alt={c.imageLabel} loading="lazy" decoding="async" draggable={false} />}
        {fileName && (file && mediaSrc(file.url)
          ? <a className={d.file} href={mediaSrc(file.url) ?? undefined} target="_blank" rel="noopener noreferrer" onClick={openFile}><FileText size={18} strokeWidth={1.9} aria-hidden="true" /><span dir="auto">{fileName}</span></a>
          : <span className={d.file}><FileText size={18} strokeWidth={1.9} aria-hidden="true" /><span dir="auto">{fileName}</span></span>)}
        {voice && <audio className={d.audio} controls preload="metadata" src={voice} onPointerDown={(e) => e.stopPropagation()} />}
        {m.body && <span className={d.text}>{m.body}</span>}
        {m.state === 'sending' && m.file && !m.attachment ? <small className={d.uploading}>{c.uploading}</small> : null}
      </>}
    </div>
    {m.state === 'failed' ? <small className={d.failed}>{c.notSent} · {c.tapRetry}</small>
      : tail && <small className={d.time}>{new Date(m.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>}
  </div>
}
