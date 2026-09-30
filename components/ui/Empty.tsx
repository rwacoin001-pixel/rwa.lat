import { Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
export function Empty({ message = '暂无数据', action }: { message?: string; action?: ReactNode }) {
  return <div className="rwa-empty" role="status"><Inbox size={20} aria-hidden="true" /><p>{message}</p>{action}</div>
}

export function EmptyState({ variant = 'card', icon: Icon = Inbox, title, body, action }: { variant?: 'inline' | 'card' | 'page'; icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return <div className={`empty-state empty-state--${variant}`} role="status"><span className="empty-state__icon"><Icon size={variant === 'page' ? 28 : 22} aria-hidden="true" /></span><div><b>{title}</b>{body ? <small>{body}</small> : null}</div>{action}</div>
}
