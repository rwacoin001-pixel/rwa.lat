'use client'
import { useMemo } from 'react'
import { getNotifications } from '@/lib/api/notifications'
import { POLL } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
export function useUnread(enabled = true) {
  const query = useQuery(enabled ? 'notifications:all' : null, () => getNotifications('all'), { pollInterval: POLL.unread, staleTime: POLL.unread })
  const unread = useMemo(() => query.data?.reduce((count, item) => count + (item.readAt ? 0 : 1), 0) ?? 0, [query.data])
  return { ...query, unread }
}
