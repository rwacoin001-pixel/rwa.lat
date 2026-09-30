import { invalidate } from './_query'
import { request } from './_http'
export type NotificationItem = { id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string; payload?: { route?: string } | null }
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
