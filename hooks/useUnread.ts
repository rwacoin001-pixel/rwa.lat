'use client'
import { useMemo } from 'react'
import { getNotifications } from '@/lib/api/notifications'
import { POLL } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { countUnread } from '@/lib/unread-count'
export function useUnread(enabled = true) {
  const query = useQuery(enabled ? 'notifications:all' : null, () => getNotifications('all'), { pollInterval: POLL.unread, staleTime: POLL.unread })
  const unread = useMemo(() => countUnread(query.data), [query.data])
  return { ...query, unread }
}
