'use client'
import { AlertTriangle, Bell, CheckCheck, Landmark, ReceiptText, ShieldAlert, WalletCards, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useUnread } from '@/hooks/useUnread'
import { markAllNotificationsRead, markNotificationRead, type NotificationItem } from '@/lib/api/notifications'
import { backOr, openPath, signInThenReturn } from '@/lib/maison-nav'
import RwaTopbar from '@/components/rwa-topbar'
import { EmptyState } from '@/components/ui/Empty'
import { ErrorBlock } from '@/components/ui/ErrorBlock'
import { Card } from '@/components/ui/card'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { formatTime } from '@/lib/display/format'
import { notificationDisplay } from '@/lib/display/labels'

const notificationCopy: Record<AppLocale, { title: string; markAll: string; filterLabel: string; all: string; unread: string; emptyUnread: string; empty: string; offline: string; marked: string; emptyBody: string; network: string; failed: string; unreadLabel: string }> = {
  en: { title: 'Notifications', markAll: 'Mark all read', filterLabel: 'Notification filter', all: 'All', unread: 'Unread', emptyUnread: 'No unread notifications', empty: 'No notifications yet', offline: 'Notifications cannot be updated while offline.', marked: 'All notifications marked as read.', emptyBody: 'Account, order and income updates will appear here.', network: 'Network unavailable. Try again.', failed: 'Could not update notifications. Try again.', unreadLabel: 'Unread' },
  'zh-CN': { title: '通知', markAll: '全部已读', filterLabel: '通知筛选', all: '全部', unread: '未读', emptyUnread: '没有未读通知', empty: '暂无通知', offline: '离线状态下无法更新通知。', marked: '通知已全部标为已读', emptyBody: '新的账户、订单或收益更新会显示在这里。', network: '网络不可用，请重试。', failed: '通知状态未更新，请重试。', unreadLabel: '未读' },
  hi: { title: 'सूचनाएँ', markAll: 'सभी पढ़ा हुआ करें', filterLabel: 'सूचना फ़िल्टर', all: 'सभी', unread: 'अपठित', emptyUnread: 'कोई अपठित सूचना नहीं', empty: 'अभी कोई सूचना नहीं', offline: 'ऑफ़लाइन होने पर सूचनाएँ अपडेट नहीं हो सकतीं।', marked: 'सभी सूचनाएँ पढ़ी गईं।', emptyBody: 'खाता, ऑर्डर और आय से जुड़े अपडेट यहाँ दिखेंगे।', network: 'नेटवर्क उपलब्ध नहीं। फिर प्रयास करें।', failed: 'सूचनाएँ अपडेट नहीं हुईं। फिर प्रयास करें।', unreadLabel: 'अपठित' },
  es: { title: 'Notificaciones', markAll: 'Marcar todo como leído', filterLabel: 'Filtro de notificaciones', all: 'Todo', unread: 'No leídas', emptyUnread: 'No hay notificaciones sin leer', empty: 'Aún no hay notificaciones', offline: 'No se pueden actualizar las notificaciones sin conexión.', marked: 'Todas las notificaciones se marcaron como leídas.', emptyBody: 'Aquí aparecerán las novedades de cuenta, órdenes e ingresos.', network: 'Sin conexión. Reintenta.', failed: 'No se pudieron actualizar las notificaciones. Reintenta.', unreadLabel: 'No leída' },
  ar: { title: 'الإشعارات', markAll: 'تحديد الكل كمقروء', filterLabel: 'تصفية الإشعارات', all: 'الكل', unread: 'غير مقروء', emptyUnread: 'لا توجد إشعارات غير مقروءة', empty: 'لا توجد إشعارات بعد', offline: 'لا يمكن تحديث الإشعارات أثناء عدم الاتصال.', marked: 'تم تحديد كل الإشعارات كمقروءة.', emptyBody: 'ستظهر هنا تحديثات الحساب والطلبات والعائد.', network: 'الشبكة غير متاحة. حاول مجددًا.', failed: 'تعذر تحديث الإشعارات. حاول مجددًا.', unreadLabel: 'غير مقروء' },
  fr: { title: 'Notifications', markAll: 'Tout marquer comme lu', filterLabel: 'Filtre des notifications', all: 'Tout', unread: 'Non lues', emptyUnread: 'Aucune notification non lue', empty: 'Aucune notification', offline: 'Les notifications ne peuvent pas être mises à jour hors ligne.', marked: 'Toutes les notifications sont marquées comme lues.', emptyBody: 'Les mises à jour du compte, des ordres et des revenus apparaîtront ici.', network: 'Réseau indisponible. Réessayez.', failed: 'Impossible de mettre à jour les notifications. Réessayez.', unreadLabel: 'Non lue' },
  pt: { title: 'Notificações', markAll: 'Marcar tudo como lido', filterLabel: 'Filtro de notificações', all: 'Tudo', unread: 'Não lidas', emptyUnread: 'Não há notificações não lidas', empty: 'Ainda não há notificações', offline: 'As notificações não podem ser atualizadas offline.', marked: 'Todas as notificações foram marcadas como lidas.', emptyBody: 'Atualizações de conta, ordens e rendimentos aparecerão aqui.', network: 'Sem rede. Tente de novo.', failed: 'Não foi possível atualizar as notificações. Tente de novo.', unreadLabel: 'Não lida' },
}

function iconFor(kind: string): LucideIcon {
  if (kind.includes('risk')) return ShieldAlert
  if (kind.includes('yield')) return Landmark
  if (kind.includes('wallet') || kind.includes('deposit') || kind.includes('withdraw')) return WalletCards
  if (kind.includes('order')) return ReceiptText
  return Bell
}
function destinationFor(kind: string): RwaScreen {
  if (kind.includes('order')) return 'records'
  if (kind.includes('wallet') || kind.includes('deposit') || kind.includes('withdraw')) return 'wallet'
  if (kind.includes('yield')) return 'portfolio'
  return 'activity'
}
// Shown when a /n/:id deep link points at a notification that is not in the list (deleted, expired or another account).
const missingCopy: Record<AppLocale, string> = {
  'zh-CN': '这条通知已不存在或不属于当前账户，下面是你的全部通知。',
  en: 'That notification is no longer available for this account. Showing all notifications.',
  es: 'Esa notificación ya no está disponible para esta cuenta. Se muestran todas.',
  ar: 'هذا الإشعار لم يعد متاحًا لهذا الحساب. تُعرض جميع الإشعارات.',
  fr: 'Cette notification n’est plus disponible pour ce compte. Toutes les notifications sont affichées.',
  pt: 'Essa notificação não está mais disponível para esta conta. Mostrando todas.',
  hi: 'यह सूचना इस खाते के लिए अब उपलब्ध नहीं है। सभी सूचनाएँ दिखाई जा रही हैं।',
}

const guestCopy: Record<AppLocale, { title: string; body: string; action: string }> = {
  'zh-CN': { title: '登录后查看通知', body: '通知只对账户本人可见。登录后会回到这条通知。', action: '登录' },
  en: { title: 'Sign in to view this notification', body: 'Notifications are visible only to the account holder. You will return here after signing in.', action: 'Sign in' },
  es: { title: 'Inicia sesión para ver la notificación', body: 'Solo el titular de la cuenta ve sus notificaciones. Volverás aquí tras iniciar sesión.', action: 'Iniciar sesión' },
  ar: { title: 'سجّل الدخول لعرض الإشعار', body: 'الإشعارات مرئية لصاحب الحساب فقط. ستعود إلى هنا بعد تسجيل الدخول.', action: 'تسجيل الدخول' },
  fr: { title: 'Connectez-vous pour voir la notification', body: 'Les notifications ne sont visibles que par le titulaire du compte. Vous reviendrez ici après connexion.', action: 'Se connecter' },
  pt: { title: 'Entre para ver a notificação', body: 'As notificações são visíveis apenas ao titular da conta. Você voltará aqui após entrar.', action: 'Entrar' },
  hi: { title: 'सूचना देखने के लिए लॉग इन करें', body: 'सूचनाएँ केवल खाताधारक को दिखती हैं। लॉग इन के बाद आप यहीं लौटेंगे।', action: 'लॉग इन करें' },
}

export function NotificationsScreen({ go, notify, enabled = true, guest = false, focusId }: { go: (screen: RwaScreen) => void; notify: (message: string) => void; enabled?: boolean; guest?: boolean; focusId?: string }) {
  const { locale } = useI18n()
  const copy = notificationCopy[locale]
  const query = useUnread(enabled)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const [markingAll, setMarkingAll] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const focusedRow = useRef<HTMLButtonElement | null>(null)
  const items = useMemo(() => (query.data ?? []).map(item => readIds.has(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item), [query.data, readIds])
  const visible = filter === 'unread' ? items.filter(item => !item.readAt) : items
  const unread = items.reduce((count, item) => count + (item.readAt ? 0 : 1), 0)
  useEffect(() => {
    if (!focusId || query.loading || query.error || !items.some(item => item.id === focusId)) return
    setFilter('all')
    window.requestAnimationFrame(() => {
      focusedRow.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      focusedRow.current?.focus({ preventScroll: true })
    })
  }, [focusId, items, query.error, query.loading])
  const open = async (item: NotificationItem) => {
    if (openingId || markingAll) return
    setOpeningId(item.id)
    if (!item.readAt) {
      setReadIds(current => new Set(current).add(item.id))
      const result = await markNotificationRead(item.id)
      if (!result.ok) { setReadIds(current => { const next = new Set(current); next.delete(item.id); return next }); setOpeningId(null); notify(result.error.status === 0 ? copy.network : copy.failed); return }
    }
    setOpeningId(null)
    const route = item.payload?.route
    if (route?.startsWith('/') && !route.startsWith('//') && !route.includes('\\')) {
      openPath(route)
      return
    }
    go(destinationFor(item.kind))
  }
  const markAll = async () => {
    if (!unread || markingAll || openingId) return
    setMarkingAll(true)
    const ids = items.filter(item => !item.readAt).map(item => item.id)
    const result = await markAllNotificationsRead()
    setMarkingAll(false)
    if (!result.ok) { notify(result.error.status === 0 ? copy.network : copy.failed); return }
    setReadIds(current => new Set([...current, ...ids]))
    void query.refetch()
    notify(copy.marked)
  }
  if (guest) { const g = guestCopy[locale]; return <section className="screen s2-notifications"><RwaTopbar screen="notifications" title={copy.title} onBack={() => backOr('/home')} /><EmptyState variant="card" icon={Bell} title={g.title} body={g.body} action={<button type="button" className="rwa-sel" data-state="rest" onClick={() => signInThenReturn()}>{g.action}</button>} /></section> }
  return <section className="screen s2-notifications"><RwaTopbar screen="notifications" title={copy.title} action={{ label: copy.markAll, onClick: () => void markAll(), Icon: CheckCheck }} onBack={() => go('home')} />
    <div className="s2-notification-filters" role="tablist" aria-label={copy.filterLabel}><button type="button" role="tab" aria-selected={filter === 'all'} className="rwa-sel" data-state={filter === 'all' ? 'selected' : 'rest'} onClick={() => setFilter('all')}>{copy.all}</button><button type="button" role="tab" aria-selected={filter === 'unread'} className="rwa-sel" data-state={filter === 'unread' ? 'selected' : 'rest'} onClick={() => setFilter('unread')}>{copy.unread} {unread || ''}</button></div>
    {focusId && query.data && !items.some(item => item.id === focusId) && <p className="trust-note" role="status">{missingCopy[locale]}</p>}
    {query.loading ? <Card state="skeleton" /> : query.error ? <ErrorBlock message={query.error.status === 0 ? copy.network : copy.failed} retry={query.refetch} /> : visible.length ? <div className="s2-notification-list">{visible.map(item => { const Icon = iconFor(item.kind); const display = notificationDisplay(item, locale); const focused = item.id === focusId; return <button type="button" key={item.id} ref={focused ? focusedRow : undefined} className="rwa-card card-row s2-notification-row" data-unread={!item.readAt} data-focused={focused || undefined} onClick={() => void open(item)}><Icon size={20} /><span><b>{!item.readAt && <span className="sr-only">{copy.unreadLabel}: </span>}{display.title}</b><small>{display.body}</small></span><time dateTime={item.createdAt}>{formatTime(item.createdAt, locale)}</time></button> })}</div> : <EmptyState variant="card" icon={Bell} title={filter === 'unread' ? copy.emptyUnread : copy.empty} body={copy.emptyBody} />}
    {typeof navigator !== 'undefined' && !navigator.onLine && <p className="s2-notification-offline"><AlertTriangle size={16} />{copy.offline}</p>}
  </section>
}
