export type Tone = 'pending' | 'processing' | 'success' | 'failed' | 'neutral'
export type StatusDomain = 'redemption' | 'withdrawal' | 'deposit' | 'transfer' | 'product' | 'basket' | 'address' | 'addressRisk' | 'yield' | 'order' | 'basketSub' | 'kyc' | 'bet'
const groups: Partial<Record<StatusDomain, Partial<Record<Tone, string[]>>>> = {
  redemption: { pending: ['requested', 'queued'], processing: ['executing'], success: ['completed'], failed: ['failed'], neutral: ['canceled'] },
  withdrawal: { pending: ['requested', '2fa_verified', 'risk_review'], processing: ['approved', 'signing', 'broadcast', 'confirming'], success: ['completed'], failed: ['rejected', 'failed'], neutral: ['cancelled'] },
  deposit: { processing: ['detected', 'confirming'], success: ['credited'], failed: ['rejected'], pending: ['manual_review'] },
  transfer: { pending: ['requested', 'risk_review'], success: ['posted'], failed: ['rejected'], neutral: ['reversed'] },
  product: { success: ['published'], neutral: ['suspended', 'draft', 'retired'] },
  basket: { success: ['active'], pending: ['pilot'], neutral: ['draft', 'closed'] },
  address: { pending: ['pending'], success: ['active'], neutral: ['revoked'] },
  addressRisk: { success: ['clear'], pending: ['manual_review'], failed: ['blocked'] },
  yield: { success: ['credited'] }, order: { success: ['filled'], pending: ['pending'], processing: ['processing'], failed: ['failed'], neutral: ['canceled', 'cancelled'] },
  kyc: { processing: ['in_progress'], pending: ['submitted', 'needs_information'], success: ['approved'], failed: ['rejected', 'expired'], neutral: ['not_started'] },
}
const labels: Record<string, string> = { requested: '已申请', queued: '排队中', executing: '执行中', completed: '已完成', failed: '失败', canceled: '已取消', cancelled: '已取消', pending: '待处理', processing: '处理中', filled: '已成交', credited: '已入账', manual_review: '人工审核中', active: '运行中', pilot: '试运行', suspended: '暂停', rejected: '已拒绝', approved: '已批准', in_review: '审核中', revoked: '已撤销', clear: '已通过', blocked: '已拦截', not_started: '未开始', in_progress: '进行中', submitted: '已提交', needs_information: '需补充资料', expired: '已过期' }
export function statusBadge(domain: StatusDomain, state: string | null | undefined): { tone: Tone; label: string } {
  if (!state) return { tone: 'neutral', label: '—' }
  const tone = (Object.entries(groups[domain] ?? {}) as [Tone, string[]][]).find(([, states]) => states.includes(state))?.[0]
  return { tone: tone ?? 'neutral', label: tone ? labels[state] ?? state : state }
}
