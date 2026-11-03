import type { QueueKey } from './nav'
import type { Today } from './data'

export type QueueArea = 'funds' | 'care' | 'community' | 'system'
export type QueueMeta = { key: QueueKey; label: string; area: QueueArea; href: string; /** minutes after which a wait counts as late */ lateAfter: number }

// Every kind of open work, in the order the Today list shows them. Hrefs open the queue already filtered.
export const QUEUES: QueueMeta[] = [
  { key: 'withdrawalReview', label: '提现待审', area: 'funds', href: '/funds/withdrawals?view=review', lateAfter: 30 },
  { key: 'withdrawalExecute', label: '提现待执行', area: 'funds', href: '/funds/withdrawals?view=approved', lateAfter: 30 },
  { key: 'quantSettlement', label: '量化今日结算', area: 'funds', href: '/quant/daily', lateAfter: Infinity },
  { key: 'ledgerAdjustments', label: '调账待审', area: 'funds', href: '/ledger', lateAfter: 24 * 60 },
  { key: 'kyc', label: 'KYC 待审', area: 'care', href: '/kyc', lateAfter: 12 * 60 },
  { key: 'supportTickets', label: '工单未回复', area: 'care', href: '/support', lateAfter: 4 * 60 },
  { key: 'mail', label: '未读邮件', area: 'care', href: '/inbox', lateAfter: 4 * 60 },
  { key: 'accountClosures', label: '账户注销', area: 'care', href: '/users?tab=closures', lateAfter: 24 * 60 },
  { key: 'communityQueue', label: '社区待审', area: 'community', href: '/community', lateAfter: 2 * 60 },
  { key: 'communityReports', label: '举报', area: 'community', href: '/community?tab=reports', lateAfter: 4 * 60 },
  { key: 'teamBatches', label: '团队月结', area: 'community', href: '/referral?tab=team', lateAfter: 3 * 24 * 60 },
  { key: 'predictionSettlements', label: '预测市场待结算', area: 'community', href: '/polymarket', lateAfter: 2 * 60 },
  { key: 'approvals', label: '审批', area: 'system', href: '/approvals', lateAfter: 24 * 60 },
  { key: 'deadJobs', label: '失败任务', area: 'system', href: '/job-queue', lateAfter: 0 },
]

export const AREA_LABEL: Record<QueueArea, string> = { funds: '资金', care: '用户与客服', community: '社区与增长', system: '系统' }

export type Priority = { title: string; detail: string; href: string; action: string; tone: 'down' | 'warn' | 'ok' }

const minutesSince = (iso: string | null | undefined, now: number) => (iso ? (now - Date.parse(iso)) / 60000 : 0)

/**
 * The one thing to do first, for the Today side card. Order: withdrawals paused, the quant settlement close to its
 * cutoff, a withdrawal waiting too long, the hot wallet running low, then the largest open queue.
 */
export function topPriority(today: Today | null, now = Date.now()): Priority | null {
  if (!today) return null
  const q = today.queues
  const paused = today.alerts.find((a) => a.code === 'withdrawal_execution_paused')
  if (paused) return { title: '提现执行已暂停', detail: paused.message, href: '/withdrawal-whitelist', action: '查看开关', tone: 'down' }

  const quant = q.quantSettlement
  if (quant?.status === 'ok' && quant.state !== 'posted' && quant.cutoffAt) {
    const left = (Date.parse(quant.cutoffAt) - now) / 60000
    if (left <= 120) {
      const when = left <= 0 ? '已过 15:00 截止' : `离 15:00 截止还有 ${Math.ceil(left)} 分钟`
      const step = quant.state === 'none' ? '还没录入' : quant.state === 'draft' ? '已录入，待确认' : '已确认，待过账'
      return { title: `量化今日结算${step}`, detail: when, href: '/quant/daily', action: quant.state === 'none' ? '去录入' : '去确认', tone: left <= 30 ? 'down' : 'warn' }
    }
  }

  for (const key of ['withdrawalReview', 'withdrawalExecute'] as const) {
    const item = q[key]
    if (item?.status === 'ok' && item.count > 0 && minutesSince(item.oldestAt, now) >= 30) {
      return { title: `${item.count} 笔提现${key === 'withdrawalReview' ? '待审' : '待执行'}`, detail: `最早一笔已等 ${Math.floor(minutesSince(item.oldestAt, now))} 分钟`, href: QUEUES.find((m) => m.key === key)!.href, action: '去处理', tone: 'warn' }
    }
  }

  const low = today.alerts.find((a) => a.code === 'hot_wallet_low' || a.code === 'hot_wallet_error')
  if (low) return { title: '热钱包需要补充', detail: low.message, href: '/funds', action: '查看资金', tone: 'warn' }

  const open = QUEUES.map((m) => ({ m, s: q[m.key] })).filter(({ s }) => s?.status === 'ok' && s.count > 0)
  if (open.length) {
    const { m, s } = open.sort((a, b) => b.s.count - a.s.count)[0]
    return { title: `${m.label} ${s.count} 件`, detail: s.oldestAt ? `最早一件已等 ${Math.floor(minutesSince(s.oldestAt, now))} 分钟` : '待处理', href: m.href, action: '去处理', tone: 'ok' }
  }
  return null
}
