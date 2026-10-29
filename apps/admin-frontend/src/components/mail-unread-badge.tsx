'use client'

import { useEffect } from 'react'
import { useApi } from '@/components/console/framework'
import { useAdminProfile } from '@/components/rbac-gate'

export function MailUnreadBadge() {
  const access = useAdminProfile()
  const allowed = access.status === 'ready' && access.profile?.permissions.includes('mail.read')
  const { data, reload } = useApi<{ count: number }>(allowed ? '/api/admin/mail/unread-count' : null)
  useEffect(() => {
    if (!allowed) return
    const timer = window.setInterval(reload, 60000)
    window.addEventListener('mail-inbox-updated', reload)
    return () => { window.clearInterval(timer); window.removeEventListener('mail-inbox-updated', reload) }
  }, [allowed, reload])
  return data && data.count > 0 ? <span aria-label={`${data.count} 封未读会话`} className="ml-auto rounded-full bg-mint/12 px-2 text-[11px] font-semibold text-mint">{data.count > 99 ? '99+' : data.count}</span> : null
}
