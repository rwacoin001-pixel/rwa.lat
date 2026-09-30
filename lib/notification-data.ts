import { apiClient } from './api-client'

export type NotificationView = {
  id: string
  recipientUserId: string
  channel: string
  kind: string
  title: string
  body?: string
  readAt?: string | null
  createdAt: string
}

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationView[]> {
  const response = await apiClient.axios.get<NotificationView[]>('/v1/notifications', { params: { channel: 'in_app', filter } })
  return response.data
}

export async function markNotificationRead(id: string): Promise<NotificationView> {
  const response = await apiClient.axios.post<NotificationView>(`/v1/notifications/${encodeURIComponent(id)}/read`)
  return response.data
}

export async function markAllNotificationsRead(): Promise<{ markedCount: number }> {
  const response = await apiClient.axios.post<{ markedCount: number }>('/v1/notifications/read-all')
  return response.data
}
