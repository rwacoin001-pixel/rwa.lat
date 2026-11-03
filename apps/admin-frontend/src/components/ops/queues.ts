import type { QueueKey } from './nav'
import type { Today, TodayAlert } from './data'
import { money } from './format.ts'

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
  { key: 'accountClosures', label: '账户注销', area: 'care', href: '/users/closures', lateAfter: 24 * 60 },
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
const str = (v: unknown) => (typeof v === 'string' ? v : null)

/** One plain line for an alert from /console/today (its detail carries the numbers). */
export function alertText(alert: TodayAlert): string {
  const d = alert.detail ?? {}
  switch (alert.kind) {
    case 'withdrawalExecutionPaused': return `提现执行已暂停${str(d.reason) ? `：${d.reason}` : ''}`
    case 'hotWalletError': return '热钱包余额查询失败'
    case 'hotWalletLow': {
      const parts: string[] = []
      if (d.shortUsdt) parts.push(`USDT 余额 ${money(str(d.usdtAtomic))}，少于待执行提现 ${money(str(d.queuedWithdrawalsAtomic))}`)
      if (d.shortTrx) parts.push('TRX 不够支付链上手续费')
      return parts.length ? `热钱包不足：${parts.join('；')}` : '热钱包余额偏低'
    }
    case 'reconciliationMismatch': return `对账不一致${str(d.differenceAtomicAmount) ? `，差额 ${money(str(d.differenceAtomicAmount))}` : ''}`
    case 'deadJobs': return `${typeof d.count === 'number' ? d.count : ''} 个后台任务失败，需要重试`
    default: return '需要注意'
  }
}

/**
 * The one thing to do first, for the Today side card. Order: withdrawals paused, the quant day close to (or past) its
 * cutoff, a withdrawal waiting too long, the hot wallet running short, then the largest open queue.
 */
export function topPriority(today: Today | null, now = Date.now()): Priority | null {
  if (!today) return null
  const q = today.queues
  const paused = today.alerts.find((a) => a.kind === 'withdrawalExecutionPaused')
  if (paused) return { title: '提现执行已暂停', detail: alertText(paused), href: '/funds/withdrawals', action: '查看开关', tone: 'down' }

  const quant = q.quantSettlement
  if (quant?.status === 'ok' && quant.count > 0 && quant.state !== 'posted' && quant.cutoffAt) {
    const left = (Date.parse(quant.cutoffAt) - now) / 60000
    if (quant.overdue || left <= 120) {
      const when = quant.overdue || left <= 0 ? '已过截止时间' : `离截止还有 ${Math.ceil(left)} 分钟`
      const step = quant.state === 'draft' ? '已录入，待确认' : quant.state === 'approved' ? '已确认，待过账' : '还没录入'
      return { title: `量化 ${quant.tradeDate ?? ''} 结算${step}`, detail: when, href: '/quant/daily', action: quant.state === 'draft' || quant.state === 'approved' ? '去确认' : '去录入', tone: quant.overdue || left <= 30 ? 'down' : 'warn' }
    }
  }

  for (const key of ['withdrawalReview', 'withdrawalExecute'] as const) {
    const item = q[key]
    if (item?.status === 'ok' && item.count > 0 && minutesSince(item.oldestAt, now) >= 30) {
      return { title: `${item.count} 笔提现${key === 'withdrawalReview' ? '待审' : '待执行'}`, detail: `最早一笔已等 ${Math.floor(minutesSince(item.oldestAt, now))} 分钟`, href: QUEUES.find((m) => m.key === key)!.href, action: '去处理', tone: 'warn' }
    }
  }

  const wallet = today.alerts.find((a) => a.kind === 'hotWalletLow' || a.kind === 'hotWalletError')
  if (wallet) return { title: '热钱包需要处理', detail: alertText(wallet), href: '/funds', action: '查看资金', tone: wallet.severity === 'critical' ? 'down' : 'warn' }

  const open = QUEUES.map((m) => ({ m, s: q[m.key] })).filter(({ s }) => s?.status === 'ok' && s.count > 0)
  if (open.length) {
    const { m, s } = open.sort((a, b) => b.s.count - a.s.count)[0]
    return { title: `${m.label} ${s.count} 件`, detail: s.oldestAt ? `最早一件已等 ${Math.floor(minutesSince(s.oldestAt, now))} 分钟` : '待处理', href: m.href, action: '去处理', tone: 'ok' }
  }
  return null
}

// Queues worth a browser notification when they grow while the console is in a background tab.
export const NOTIFY_QUEUES: QueueKey[] = ['withdrawalReview', 'withdrawalExecute', 'kyc', 'accountClosures', 'communityReports']

/** What grew between two polls of the Today endpoint, in queue order. No previous poll means nothing is new. */
export function newArrivals(prev: Today | null, next: Today | null, keys: QueueKey[] = NOTIFY_QUEUES): Array<{ key: QueueKey; label: string; href: string; added: number }> {
  if (!prev || !next) return []
  return QUEUES.filter((m) => keys.includes(m.key)).flatMap((m) => {
    const a = prev.queues[m.key]; const b = next.queues[m.key]
    if (!a || !b || a.status !== 'ok' || b.status !== 'ok' || b.count <= a.count) return []
    return [{ key: m.key, label: m.label, href: m.href, added: b.count - a.count }]
  })
}
