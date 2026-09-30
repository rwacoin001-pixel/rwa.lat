/**
 * Support data layer — real tickets via Core API user-ops module.
 * API-first, no mock fallback (per roundtable #4: no fake local success states).
 */
import { request, type ApiResult } from './api/_http'

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
  return result.data
}

export type TicketStatus = 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'
export type TicketCategory = 'support' | 'dispute' | 'appeal' | 'scam_report'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportTicket = {
  id: string
  authorUserId: string
  subject: string
  body: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  orderId?: string
  reference: string
  assignee?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export type TicketMessage = {
  id: string
  actorType: 'user' | 'admin' | 'service'
  body: string
  attachments: Record<string, unknown>
  createdAt: string
}

export type TicketEvent = {
  id: string
  eventType: string
  actorType: string
  previousStatus?: string
  nextStatus?: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type TicketTimeline = {
  ticket: SupportTicket
  messages: TicketMessage[]
  events: TicketEvent[]
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  return unwrap(await request<SupportTicket[]>('/v1/user-ops/tickets'))
}

export async function createSupportTicket(input: {
  subject: string
  body: string
  category?: TicketCategory
  priority?: TicketPriority
  order_id?: string
  attachmentObjectIds?: string[]
}, idempotencyKey?: string): Promise<SupportTicket> {
  return unwrap(await request<SupportTicket>('/v1/user-ops/tickets', {
    method: 'POST', body: JSON.stringify(input), idempotencyKey,
  }))
}

export async function getSupportTicketTimeline(id: string): Promise<TicketTimeline> {
  return unwrap(await request<TicketTimeline>(`/v1/user-ops/tickets/${encodeURIComponent(id)}/timeline`))
}

export async function addSupportTicketMessage(id: string, body: string): Promise<unknown> {
  return unwrap(await request<unknown>(`/v1/user-ops/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) }))
}

export async function closeSupportTicket(id: string): Promise<unknown> {
  return unwrap(await request<unknown>(`/v1/user-ops/tickets/${encodeURIComponent(id)}/close`, { method: 'PUT' }))
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: '已提交',
  pending: '处理中',
  investigating: '调查中',
  waiting_user: '待您补充',
  resolved: '已解决',
  closed: '已关闭',
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  support: '使用与账户',
  dispute: '订单争议',
  appeal: '申诉与复核',
  scam_report: '诈骗举报',
}

/** 各状态的语义色调（供 UI 用）：info=中性 / warn=等用户 / ok=完成 / mute=关闭 */
export const TICKET_STATUS_TONE: Record<TicketStatus, 'info' | 'warn' | 'ok' | 'mute'> = {
  open: 'info',
  pending: 'info',
  investigating: 'warn',
  waiting_user: 'warn',
  resolved: 'ok',
  closed: 'mute',
}
