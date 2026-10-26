import { invalidate } from './_query'
import { request } from './_http'
export type NotificationItem = { id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string; payload?: { route?: string; i18n?: Record<string, { title?: string; body?: string | null }> } | null }
export async function getNotifications(filter: 'all' | 'unread' = 'all') {
  return request<NotificationItem[]>(`/v1/notifications?filter=${filter}`)
}
export async function markNotificationRead(id: string) {
  const result = await request<NotificationItem>(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
  if (result.ok) invalidate('notifications:')
  return result
}
export async function markAllNotificationsRead() {
  const result = await request<{ updated: number }>('/v1/notifications/read-all', { method: 'POST' })
  if (result.ok) invalidate('notifications:')
  return result
}

/** The AI buddy's one-line digest of the unread notifications (facts only; a plain line when the model is unavailable). */
export type NotificationDigest = { summary: string | null; count: number; source: 'ai' | 'rule' | 'none' }
export async function getNotificationDigest(locale: string) {
  return request<NotificationDigest>(`/v1/ai/notifications/digest?locale=${encodeURIComponent(locale)}`, { loading: 'silent', timeoutMs: 9_000 })
}
