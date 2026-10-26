'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { getNotificationDigest, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '@/lib/api/notifications'
import { openPath } from '@/lib/maison-nav'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { formatTime } from '@/lib/display/format'
import { localNotice } from '@/lib/display/labels'
import styles from './Buddy.module.css'

type Topic = 'quant' | 'security' | 'wallet' | 'order' | 'other'
const COPY: Partial<Record<AppLocale, { title: string; lede: (n: number) => string; all: string; ask: string; more: string; topics: Record<Topic, string> }>> = {
  'zh-CN': { title: '新消息', lede: n => `你有 ${n} 条新消息`, all: '全部已读', ask: '问问 AI', more: '查看全部通知',
    topics: { quant: '考拉量化', security: '账户安全', wallet: '钱包', order: '订单', other: '通知' } },
  en: { title: 'New messages', lede: n => `${n} new ${n === 1 ? 'message' : 'messages'}`, all: 'Mark all read', ask: 'Ask AI', more: 'All notifications',
    topics: { quant: 'Koala Quant', security: 'Security', wallet: 'Wallet', order: 'Orders', other: 'Notice' } },
}

const topicOf = (kind: string): Topic => /quant/i.test(kind) ? 'quant'
  : /security|login|device|password|passkey/i.test(kind) ? 'security'
  : /deposit|withdraw|transfer|wallet|payout|settle/i.test(kind) ? 'wallet'
  : /order|subscription|redemption|basket|asset/i.test(kind) ? 'order' : 'other'

/** The buddy's digest of unread notifications: a short sheet, newest first; tap one to open it (marked read). */
export function BuddyDigest({ items, onClose, onAllRead, onAskAi }: { items: NotificationItem[]; onClose: () => void; onAllRead: () => void; onAskAi: () => void }) {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en!
  const unread = items.filter(item => !item.readAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [busy, setBusy] = useState(false)
  // The buddy's one-line read of what came in (AI, facts only). Shown only when the model wrote it; the plain fallback
  // would just repeat the list below.
  const [summary, setSummary] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void getNotificationDigest(locale).then((result) => { if (live && result.ok && result.data.source === 'ai') setSummary(result.data.summary) })
    return () => { live = false }
  }, [locale])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const open = async (item: NotificationItem) => {
    if (busy) return
    setBusy(true)
    await markNotificationRead(item.id)
    setBusy(false)
    onClose()
    const route = item.payload?.route
    openPath(route?.startsWith('/') && !route.startsWith('//') && !route.includes('\\') ? route : '/notifications')
  }
  const allRead = async () => { if (busy) return; setBusy(true); const result = await markAllNotificationsRead(); setBusy(false); if (result.ok) onAllRead() }
  if (typeof document === 'undefined') return null
  return createPortal(<div className={styles.scrim} onClick={onClose}>
    <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={c.title} onClick={event => event.stopPropagation()}>
      <p className={styles.lede}>{c.lede(unread.length)}</p>
      {summary && <p className={styles.summary} aria-live="polite">{summary}</p>}
      <ul className={styles.list}>
        {unread.slice(0, 5).map(raw => localNotice(raw, locale)).map(item => <li key={item.id}><button type="button" onClick={() => void open(item)} disabled={busy}>
          <span className={styles.meta}><em>{c.topics[topicOf(item.kind)]}</em><time>{formatTime(item.createdAt, locale, { relative: true })}</time></span>
          <b>{item.title}</b>{item.body && <small>{item.body}</small>}
        </button></li>)}
      </ul>
      {unread.length > 5 && <button type="button" className={styles.more} onClick={() => { onClose(); openPath('/notifications') }}>{c.more}<ChevronRight size={15} aria-hidden="true" /></button>}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onAskAi}>{c.ask}</button>
        <button type="button" className={styles.solid} onClick={() => void allRead()} disabled={busy}>{c.all}</button>
      </div>
    </section>
  </div>, document.body)
}
