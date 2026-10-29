'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { useUnread } from '@/hooks/useUnread'
import { getNotificationDigest, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '@/lib/api/notifications'
import { localNotice } from '@/lib/display/labels'
import { formatTime } from '@/lib/display/format'
import { openPath } from '@/lib/maison-nav'
import a from './ai-chat.module.css'

type Topic = 'quant' | 'security' | 'wallet' | 'order' | 'other'
const COPY = {
  'zh-CN': { title: '未读通知', all: '全部已读', ask: '问 AI', more: '全部通知', summary: '让 AI 总结', fallback: '总结一下我的未读通知', explain: '请帮我解读这条通知：', separator: '。', unread: '条未读通知',
    topics: { quant: '考拉量化', security: '账户安全', wallet: '钱包', order: '订单', other: '通知' } },
  en: { title: 'Unread notifications', all: 'Mark all read', ask: 'Ask AI', more: 'All notifications', summary: 'AI summary', fallback: 'Summarize my unread notifications', explain: 'Explain this notice: ', separator: '. ', unread: 'unread',
    topics: { quant: 'Koala Quant', security: 'Security', wallet: 'Wallet', order: 'Orders', other: 'Notice' } },
}
const topicOf = (kind: string): Topic => /quant/i.test(kind) ? 'quant'
  : /security|login|device|password|passkey/i.test(kind) ? 'security'
  : /deposit|withdraw|transfer|wallet|payout|settle/i.test(kind) ? 'wallet'
  : /order|subscription|redemption|basket|asset/i.test(kind) ? 'order' : 'other'

export function AiNoticeTray({ locale, disabled, onAsk, onSummary, hidden, onOpenChange }: { locale: AppLocale; disabled: boolean; onAsk: (text: string, notificationId?: string) => void; onSummary: (text: string) => void; hidden: boolean; onOpenChange?: (open: boolean) => void }) {
  const { data, unread, refetch } = useUnread(true)
  const c = COPY[locale === 'zh-CN' ? locale : 'en'], panelId = useId()
  const items = useMemo(() => (Array.isArray(data) ? data : []).filter(item => !item.readAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => localNotice(item, locale)), [data, locale])
  const show = !hidden && unread > 0 && items.length > 0
  const [present, setPresent] = useState(false), [visible, setVisible] = useState(false), [expanded, setExpanded] = useState(false)
  // The page under the tray steps aside while it is open (2026-10-28): the open list sat over the welcome line.
  useEffect(() => { onOpenChange?.(expanded && visible) }, [expanded, visible])
  const [index, setIndex] = useState(0), [pulse, setPulse] = useState(0), [busy, setBusy] = useState<'read' | 'summary' | null>(null)
  const [reduced, setReduced] = useState(false), [foreground, setForeground] = useState(true)
  const previous = useRef(unread), retained = useRef({ items, unread }), locked = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches), visibility = () => setForeground(document.visibilityState === 'visible')
    motion(); visibility(); media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility)
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (show) retained.current = { items, unread }
    if (unread > previous.current) setPulse(n => n + 1)
    previous.current = unread
  }, [items, unread, show])
  useEffect(() => {
    if (!pulse) return
    const timer = window.setTimeout(() => setPulse(0), 600)
    return () => window.clearTimeout(timer)
  }, [pulse])
  useEffect(() => {
    let frame = 0, nextFrame = 0, timer = 0
    if (show) {
      setPresent(true)
      if (reduced) setVisible(true)
      else frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => setVisible(true)) })
    } else {
      setVisible(false); setExpanded(false)
      if (reduced) setPresent(false)
      else timer = window.setTimeout(() => setPresent(false), 300)
    }
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); window.clearTimeout(timer) }
  }, [show, reduced])
  useEffect(() => {
    if (!show || expanded || reduced || !foreground || items.length < 2) return
    const timer = window.setInterval(() => setIndex(i => (i + 1) % items.length), 4500)
    return () => window.clearInterval(timer)
  }, [show, expanded, reduced, foreground, items.length])
  useEffect(() => {
    if (!expanded) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [expanded])

  const run = async (kind: 'read' | 'summary', action: () => Promise<void>) => {
    if (disabled || locked.current || !show) return
    locked.current = true; setBusy(kind)
    try { await action() } finally { locked.current = false; if (alive.current) setBusy(null) }
  }
  const read = (item: NotificationItem, ask = false) => run('read', async () => {
    const result = await markNotificationRead(item.id)
    await refetch()
    if (!alive.current || !result.ok) return
    setExpanded(false)
    if (ask) onAsk(c.explain + item.title + (item.body ? c.separator + item.body : ''), item.id)
    else { const route = item.payload?.route; openPath(route?.startsWith('/') && !route.startsWith('//') && !route.includes('\\') ? route : '/notifications') }
  })
  const allRead = () => run('read', async () => { await markAllNotificationsRead(); await refetch() })
  const summary = () => run('summary', async () => {
    try {
      const result = await getNotificationDigest(locale)
      if (!alive.current) return
      setExpanded(false)
      if (result.ok && result.data.summary) onSummary(result.data.summary)
      else onAsk(c.fallback)
    } catch { if (alive.current) { setExpanded(false); onAsk(c.fallback) } }
  })
  if (!present) return null
  // Retain the last row until its exit ends, including when the last notice is marked read.
  const snapshot = show ? { items, unread } : retained.current, item = snapshot.items[index % snapshot.items.length]
  if (!item) return null
  const blocked = disabled || busy !== null
  return <div className={a.noticePresence} data-visible={visible || undefined} aria-hidden={!show || undefined} inert={!show}>
    <div className={a.noticeClip}><section className={a.noticeTray} aria-label={c.title}>
      <div id={panelId} className={a.noticePanel} data-expanded={expanded || undefined} aria-hidden={!expanded} inert={!expanded}>
        <div className={a.noticePanelClip}><div className={a.noticeContent}>
          <ul className={a.noticeList}>{snapshot.items.slice(0, 5).map((notice, i) => <li key={notice.id} className={a.noticeItem} style={{ animationDelay: `${i * 40}ms` }}>
            <button type="button" className={a.noticeOpen} disabled={blocked} onClick={() => read(notice)}><span className={a.noticeMeta}><b>{c.topics[topicOf(notice.kind)]}</b><time dateTime={notice.createdAt}>{formatTime(notice.createdAt, locale, { relative: true })}</time></span><strong dir="auto">{notice.title}</strong>{notice.body && <small dir="auto">{notice.body}</small>}</button>
            <button type="button" className={a.noticeAsk} disabled={blocked} onClick={() => read(notice, true)}>{c.ask}</button>
          </li>)}</ul>
          {/* "Mark all read" is the main action (2026-10-28); the AI summary is a quiet extra. */}
          <div className={a.noticeFooter}><button type="button" disabled={blocked} aria-busy={busy === 'summary'} aria-label={c.summary} onClick={summary}>{busy === 'summary' ? '…' : c.summary}</button>{snapshot.unread > 5 && <button type="button" disabled={blocked} onClick={() => openPath('/notifications')}>{c.more}</button>}<button type="button" className={a.noticeSummary} disabled={blocked} aria-busy={busy === 'read'} onClick={allRead}>{busy === 'read' ? '…' : c.all}</button></div>
        </div></div>
      </div>
      <button type="button" className={a.noticeToggle} aria-expanded={expanded} aria-controls={panelId} aria-label={`${snapshot.unread} ${c.unread} · ${item.title}`} onClick={() => { if (!expanded) navigator.vibrate?.(6); setExpanded(value => !value) }}>
        <span key={pulse} className={a.noticeDot} data-pulse={pulse > 0 || undefined} aria-hidden="true"/><span key={item.id} className={a.noticeTicker}><span dir="auto">{item.title}</span><time dateTime={item.createdAt}>{formatTime(item.createdAt, locale, { relative: true })}</time></span>{snapshot.unread > 1 && <span className={a.noticeCount}>+{snapshot.unread - 1}</span>}<ChevronUp size={15} className={a.noticeChevron} aria-hidden="true"/>
      </button>
    </section></div>
  </div>
}
